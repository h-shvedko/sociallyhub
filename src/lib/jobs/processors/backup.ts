import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, stat, rm } from 'fs/promises'
import * as fsp from 'fs/promises'
import path from 'path'

import { Job } from 'bullmq'
import { Prisma } from '@prisma/client'

import { JobProcessor, JobResult } from '../queue-manager'
import {
  enqueueBackupExecute,
  computeNextRun,
  backupScopeDir,
  buildBackupFilename,
} from '../backup-queue'
import { prisma } from '@/lib/prisma'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

// ============================================================================
// ADR-0016 Phase 2 — REAL backups on the worker.
//
// These three processors replace the old Math.random/setTimeout simulation with
// genuine work: pg_dump / tar produce real files, crypto streams a real SHA-256
// checksum, and every BackupRecord row reflects the true outcome.
//
// HONESTY OVER COVERAGE (ADR-0016):
//   - A failed dump is recorded FAILED on its row with the REAL stderr tail; the
//     job still returns success (it ran, and the row truthfully says FAILED).
//   - Only genuine infra errors (DB unreachable, code bug) return success:false.
//   - INCREMENTAL / DIFFERENTIAL are NOT implemented → the record is set FAILED
//     with a truthful "not supported" message. We never fabricate a size or a
//     checksum, never claim an operation happened that did not.
//   - Restore verifies the file + checksum and takes a pre-restore safety
//     snapshot BEFORE touching the live DB; a mismatch or a failed snapshot
//     aborts without restoring.
// ============================================================================

/** Bound a single dump/restore so a hung child can never wedge the worker. */
const DUMP_TIMEOUT_MS = 30 * 60 * 1000
const RESTORE_TIMEOUT_MS = 30 * 60 * 1000
/** Minimum free space we insist on before starting a dump (best-effort guard). */
const MIN_FREE_BYTES = 100 * 1024 * 1024 // 100 MB floor
/** Types that pg_dump/pg_restore can produce and consume. */
const RESTORABLE_TYPES = new Set(['DATABASE_ONLY', 'FULL', 'CONFIGURATION_ONLY'])

interface CommandOutcome {
  code: number | null
  stderr: string
  /** Set when the binary could not be started at all (e.g. ENOENT). */
  spawnError?: string
  timedOut?: boolean
}

/**
 * Run a child process to completion with a hard timeout. NEVER uses a shell
 * (spawn, not exec) — args are passed as an array so a value can never be
 * interpreted as shell. Captures a bounded stderr tail. Resolves (never
 * rejects) with a structured outcome so callers branch honestly.
 */
function runCommand(cmd: string, args: string[], timeoutMs: number): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    let stderr = ''
    let settled = false

    const child = spawn(cmd, args, { env: process.env })

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      resolve({ code: null, stderr: `${stderr}\n[killed: exceeded ${timeoutMs}ms]`, timedOut: true })
    }, timeoutMs)

    child.stderr?.on('data', (d: Buffer) => {
      if (stderr.length < 8000) stderr += d.toString()
    })

    child.on('error', (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code: null, stderr, spawnError: err.message })
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, stderr })
    })
  })
}

/** Stream a file through SHA-256 for a REAL checksum (no full-buffer read). */
function sha256File(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(absPath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * Best-effort free-space guard. Uses fs.statfs when the runtime provides it
 * (Node 18.15+); if it is unavailable we skip the check rather than block a
 * legitimate backup. Returns a truthful error string when space is clearly
 * insufficient, else null.
 */
async function insufficientSpace(dir: string): Promise<string | null> {
  try {
    const statfs = (fsp as unknown as { statfs?: (p: string) => Promise<{ bavail: number; bsize: number }> }).statfs
    if (typeof statfs !== 'function') return null
    const s = await statfs(dir)
    const available = s.bavail * s.bsize
    if (available < MIN_FREE_BYTES) {
      return `Insufficient free disk space at ${dir}: ${available} bytes available (need at least ${MIN_FREE_BYTES}).`
    }
  } catch {
    // statfs failed (unsupported / path issue) — skip the guard honestly.
  }
  return null
}

type RecordWithConfig = Prisma.BackupRecordGetPayload<{ include: { configuration: true } }>

/** Resolve the absolute artifact path for a record (honor stored abs path). */
function recordAbsPath(record: {
  filePath: string
  filename: string
  workspaceId: string | null
}): string {
  if (record.filePath && path.isAbsolute(record.filePath)) return record.filePath
  return path.join(backupScopeDir(record.workspaceId), record.filename)
}

/**
 * Mark a record FAILED with a truthful message and roll the configuration's
 * failure stats forward. Never throws (best-effort, so the job can still
 * complete cleanly after an honest failure).
 */
async function recordFailure(
  record: NonNullable<RecordWithConfig>,
  message: string,
  startMs: number
): Promise<void> {
  const msg = message.slice(0, 2000)
  const durationSec = Math.max(0, Math.round((Date.now() - startMs) / 1000))
  try {
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        endTime: new Date(),
        duration: durationSec,
        errorMessage: msg,
      },
    })
    if (record.configurationId) {
      await prisma.backupConfiguration.update({
        where: { id: record.configurationId },
        data: {
          lastRun: new Date(),
          lastFailure: new Date(),
          failureCount: { increment: 1 },
          lastError: msg,
        },
      })
    }
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'backup_record_failure_update',
      recordId: record.id,
    })
  }
}

/** Average completed-backup duration (seconds) for the last 10, for config stats. */
async function avgDurationSeconds(configurationId: string): Promise<number> {
  const recent = await prisma.backupRecord.findMany({
    where: { configurationId, status: 'COMPLETED', duration: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { duration: true },
  })
  if (recent.length === 0) return 0
  const total = recent.reduce((sum, r) => sum + (r.duration || 0), 0)
  return Math.round(total / recent.length)
}

// ----------------------------------------------------------------------------
// 1) Execute: run the real dump for one IN_PROGRESS record.
// ----------------------------------------------------------------------------
export const backupExecuteProcessor: JobProcessor = async (job: Job): Promise<JobResult> => {
  const timer = PerformanceLogger.startTimer('backup_execute_job')
  const recordId: string | undefined = job.data?.payload?.recordId

  try {
    if (!recordId) {
      timer.end({ success: true, skipped: 'no_record_id' })
      return { success: true, result: { skipped: 'no recordId' } }
    }

    const record = await prisma.backupRecord.findUnique({
      where: { id: recordId },
      include: { configuration: true },
    })

    // Missing or already-decided record → no-op success (idempotent on re-run).
    if (!record) {
      timer.end({ success: true, skipped: 'record_missing' })
      return { success: true, result: { skipped: 'record not found', recordId } }
    }
    if (record.status !== 'IN_PROGRESS') {
      timer.end({ success: true, skipped: 'not_in_progress' })
      return { success: true, result: { skipped: `status ${record.status}`, recordId } }
    }

    const startMs = Date.now()

    // INCREMENTAL / DIFFERENTIAL are not implemented — fail honestly, do NOT fake.
    if (record.backupType === 'INCREMENTAL' || record.backupType === 'DIFFERENTIAL') {
      await recordFailure(
        record,
        `Backup type ${record.backupType} is not supported (ADR-0016: only real full/db/media/config dumps are implemented).`,
        startMs
      )
      timer.end({ success: true, unsupportedType: record.backupType })
      return { success: true, result: { recordId, status: 'FAILED', reason: 'unsupported_type' } }
    }

    const dir = backupScopeDir(record.workspaceId)
    await mkdir(dir, { recursive: true })
    const absPath = recordAbsPath(record)

    // Free-space guard before we start writing.
    const spaceError = await insufficientSpace(dir)
    if (spaceError) {
      await recordFailure(record, spaceError, startMs)
      timer.end({ success: true, failed: 'insufficient_space' })
      return { success: true, result: { recordId, status: 'FAILED', reason: 'insufficient_space' } }
    }

    // Build the real command.
    let cmd: string
    let args: string[]
    if (record.backupType === 'MEDIA_ONLY') {
      const mediaRoot = process.env.STORAGE_LOCAL_ROOT || '/app/uploads'
      // tar the media root into the artifact. `-C root .` keeps paths relative.
      cmd = 'tar'
      args = ['-czf', absPath, '-C', mediaRoot, '.']
    } else {
      // DATABASE_ONLY / FULL / CONFIGURATION_ONLY → a real pg_dump (custom
      // format). NOTE (ADR-0016 v1 deviation): CONFIGURATION_ONLY dumps the whole
      // DB (an honest full dump) rather than a table-filtered subset, and FULL is
      // a DB-only dump (media is captured by MEDIA_ONLY configs). The password is
      // carried only inside DATABASE_URL — never as a separate CLI arg.
      const dbUrl = process.env.DATABASE_URL
      if (!dbUrl) {
        await recordFailure(record, 'DATABASE_URL is not set; cannot run pg_dump.', startMs)
        timer.end({ success: true, failed: 'no_database_url' })
        return { success: true, result: { recordId, status: 'FAILED', reason: 'no_database_url' } }
      }
      cmd = 'pg_dump'
      args = ['-Fc', '--no-owner', '--no-privileges', '-f', absPath, dbUrl]
    }

    const outcome = await runCommand(cmd, args, DUMP_TIMEOUT_MS)

    if (outcome.spawnError) {
      // The binary could not be started (missing pg_dump/tar in the image). This
      // is a real, honest failure — record it on the row and clean up any partial.
      await rm(absPath, { force: true }).catch(() => {})
      await recordFailure(
        record,
        `Backup command '${cmd}' could not be started: ${outcome.spawnError}`,
        startMs
      )
      timer.end({ success: true, failed: 'spawn_error' })
      return { success: true, result: { recordId, status: 'FAILED', reason: 'spawn_error' } }
    }

    if (outcome.code !== 0) {
      await rm(absPath, { force: true }).catch(() => {})
      const tail = outcome.stderr.slice(-1500).trim() || '(no stderr)'
      await recordFailure(
        record,
        `${cmd} exited with code ${outcome.code}${outcome.timedOut ? ' (timed out)' : ''}: ${tail}`,
        startMs
      )
      timer.end({ success: true, failed: 'nonzero_exit' })
      return { success: true, result: { recordId, status: 'FAILED', reason: 'nonzero_exit' } }
    }

    // Success: measure the REAL bytes and compute the REAL checksum.
    const fileStat = await stat(absPath)
    const checksum = await sha256File(absPath)
    const durationSec = Math.max(0, Math.round((Date.now() - startMs) / 1000))
    const retentionDays = record.configuration?.retention ?? 30
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        duration: durationSec,
        fileSize: BigInt(fileStat.size),
        checksum,
        expiresAt,
        errorMessage: null,
      },
    })

    if (record.configurationId) {
      await prisma.backupConfiguration.update({
        where: { id: record.configurationId },
        data: {
          lastRun: new Date(),
          lastSuccess: new Date(),
          successCount: { increment: 1 },
          lastError: null,
          avgDuration: await avgDurationSeconds(record.configurationId),
        },
      })
    }

    BusinessLogger.logSystemEvent('backup_execute_completed', {
      recordId: record.id,
      backupType: record.backupType,
      bytes: fileStat.size,
      durationSec,
    })
    timer.end({ success: true, recordId: record.id, bytes: fileStat.size })

    return {
      success: true,
      result: { recordId: record.id, status: 'COMPLETED', bytes: fileStat.size, checksum, durationSec },
    }
  } catch (error) {
    // Genuine infra/DB error (not a per-dump failure). Best-effort mark the row
    // FAILED so it does not linger IN_PROGRESS, then surface the failure.
    timer.end({ success: false, error: true })
    ErrorLogger.logUnexpectedError(error as Error, { context: 'backup_execute_job', recordId })
    if (recordId) {
      try {
        await prisma.backupRecord.update({
          where: { id: recordId },
          data: {
            status: 'FAILED',
            endTime: new Date(),
            errorMessage: `Backup worker error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 2000),
          },
        })
      } catch {
        /* best effort */
      }
    }
    return { success: false, error: error instanceof Error ? error.message : 'backup execute failed' }
  }
}

// ----------------------------------------------------------------------------
// 2) Restore: verify, safety-snapshot, then pg_restore. Platform-admin gated at
//    the ROUTE (not here).
// ----------------------------------------------------------------------------
export const backupRestoreProcessor: JobProcessor = async (job: Job): Promise<JobResult> => {
  const timer = PerformanceLogger.startTimer('backup_restore_job')
  const recordId: string | undefined = job.data?.payload?.recordId
  const userId: string | undefined = job.data?.payload?.userId

  try {
    if (!recordId) {
      timer.end({ success: true, skipped: 'no_record_id' })
      return { success: true, result: { skipped: 'no recordId' } }
    }

    const record = await prisma.backupRecord.findUnique({
      where: { id: recordId },
      include: { configuration: true },
    })
    if (!record) {
      timer.end({ success: true, skipped: 'record_missing' })
      return { success: true, result: { skipped: 'record not found', recordId } }
    }

    /** Record a restore attempt's outcome in `logs` without lying about status. */
    const noteRestoreFailure = async (message: string, corrupt = false): Promise<void> => {
      try {
        await prisma.backupRecord.update({
          where: { id: record.id },
          data: {
            logs: `[restore ${new Date().toISOString()}] FAILED: ${message}`.slice(0, 5000),
            ...(corrupt ? { isCorrupted: true, lastVerified: new Date() } : {}),
          },
        })
      } catch {
        /* best effort */
      }
    }

    // Only DB-format artifacts are restorable via pg_restore.
    if (!RESTORABLE_TYPES.has(record.backupType)) {
      await noteRestoreFailure(`Backup type ${record.backupType} is not restorable via pg_restore.`)
      timer.end({ success: true, failed: 'unsupported_type' })
      return { success: true, result: { restored: false, reason: 'unsupported_type', recordId } }
    }

    const dir = backupScopeDir(record.workspaceId)
    const absPath = recordAbsPath(record)

    const fileStat = await stat(absPath).catch(() => null)
    if (!fileStat) {
      await noteRestoreFailure('Backup file is missing on disk; cannot restore.')
      timer.end({ success: true, failed: 'file_missing' })
      return { success: true, result: { restored: false, reason: 'file_missing', recordId } }
    }

    // Best-effort integrity check: refuse to restore an altered/corrupt artifact.
    if (record.checksum) {
      const actual = await sha256File(absPath)
      if (actual !== record.checksum) {
        await noteRestoreFailure(
          `Checksum mismatch (stored ${record.checksum.slice(0, 12)}…, actual ${actual.slice(0, 12)}…) — refusing to restore.`,
          true
        )
        timer.end({ success: true, failed: 'checksum_mismatch' })
        return { success: true, result: { restored: false, reason: 'checksum_mismatch', recordId } }
      }
    }

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      await noteRestoreFailure('DATABASE_URL is not set; cannot run pg_restore.')
      timer.end({ success: true, failed: 'no_database_url' })
      return { success: true, result: { restored: false, reason: 'no_database_url', recordId } }
    }

    // SAFETY: snapshot the CURRENT database before we clobber it, so a bad
    // restore is recoverable. Abort the restore if the snapshot itself fails.
    await mkdir(dir, { recursive: true })
    const safetyPath = path.join(dir, `pre-restore-safety-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`)
    const snapshot = await runCommand(
      'pg_dump',
      ['-Fc', '--no-owner', '--no-privileges', '-f', safetyPath, dbUrl],
      RESTORE_TIMEOUT_MS
    )
    if (snapshot.spawnError || snapshot.code !== 0) {
      const reason = snapshot.spawnError || snapshot.stderr.slice(-800).trim() || `exit ${snapshot.code}`
      await noteRestoreFailure(`Aborting restore: pre-restore safety snapshot failed (${reason}).`)
      timer.end({ success: true, failed: 'safety_snapshot_failed' })
      return { success: true, result: { restored: false, reason: 'safety_snapshot_failed', recordId } }
    }

    // Perform the destructive restore.
    const restore = await runCommand(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-d', dbUrl, absPath],
      RESTORE_TIMEOUT_MS
    )
    if (restore.spawnError || restore.code !== 0) {
      const reason = restore.spawnError || restore.stderr.slice(-1500).trim() || `exit ${restore.code}`
      await noteRestoreFailure(
        `pg_restore failed (code ${restore.code})${restore.timedOut ? ' [timed out]' : ''}: ${reason}. Safety snapshot at ${safetyPath}.`
      )
      timer.end({ success: true, failed: 'restore_failed' })
      return { success: true, result: { restored: false, reason: 'restore_failed', recordId, safetySnapshot: safetyPath } }
    }

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        isRestored: true,
        restoredAt: new Date(),
        restoredBy: userId ?? null,
        logs: `[restore ${new Date().toISOString()}] OK. Safety snapshot at ${safetyPath}.`.slice(0, 5000),
      },
    })

    BusinessLogger.logSystemEvent('backup_restore_completed', {
      recordId: record.id,
      backupType: record.backupType,
      restoredBy: userId ?? null,
    })
    timer.end({ success: true, restored: true, recordId: record.id })

    return { success: true, result: { restored: true, recordId: record.id, safetySnapshot: safetyPath } }
  } catch (error) {
    timer.end({ success: false, error: true })
    ErrorLogger.logUnexpectedError(error as Error, { context: 'backup_restore_job', recordId })
    return { success: false, error: error instanceof Error ? error.message : 'backup restore failed' }
  }
}

// ----------------------------------------------------------------------------
// 3) Tick: repeatable schedule dispatch + retention sweep.
// ----------------------------------------------------------------------------
export const backupTickProcessor: JobProcessor = async (): Promise<JobResult> => {
  const timer = PerformanceLogger.startTimer('backup_tick_job')

  try {
    const now = new Date()
    let created = 0
    let enqueued = 0
    let rescheduled = 0
    let expired = 0
    let errors = 0

    // (1) Due configurations: nextRun null (never scheduled) or already past.
    const dueConfigs = await prisma.backupConfiguration.findMany({
      where: { isActive: true, OR: [{ nextRun: null }, { nextRun: { lte: now } }] },
    })

    for (const config of dueConfigs) {
      try {
        // Advance nextRun regardless, so a due config never hot-loops the tick.
        const next = computeNextRun(config.schedule, now)

        // Don't create a doomed record for unsupported types — just advance.
        if (config.backupType === 'INCREMENTAL' || config.backupType === 'DIFFERENTIAL') {
          await prisma.backupConfiguration.update({
            where: { id: config.id },
            data: { nextRun: next },
          })
          rescheduled++
          continue
        }

        const filename = buildBackupFilename(config.name, config.backupType, now)
        const filePath = path.join(backupScopeDir(config.workspaceId), filename)

        const record = await prisma.backupRecord.create({
          data: {
            configurationId: config.id,
            workspaceId: config.workspaceId,
            filename,
            filePath,
            fileSize: BigInt(0),
            checksum: '',
            backupType: config.backupType,
            status: 'IN_PROGRESS',
            startTime: now,
            metadata: { triggeredBy: 'system', triggerType: 'scheduled' },
          },
        })
        created++

        await enqueueBackupExecute({
          recordId: record.id,
          workspaceId: config.workspaceId ?? undefined,
        })
        enqueued++

        await prisma.backupConfiguration.update({
          where: { id: config.id },
          data: { nextRun: next },
        })
        rescheduled++
      } catch (error) {
        errors++
        ErrorLogger.logUnexpectedError(error as Error, {
          context: 'backup_tick_schedule',
          configurationId: config.id,
        })
      }
    }

    // (2) Retention sweep: delete expired COMPLETED artifacts, mark EXPIRED.
    const expiredRecords = await prisma.backupRecord.findMany({
      where: { status: 'COMPLETED', expiresAt: { lte: now } },
    })

    for (const rec of expiredRecords) {
      try {
        const absPath = recordAbsPath(rec)
        await rm(absPath, { force: true }).catch(() => {})
        await prisma.backupRecord.update({
          where: { id: rec.id },
          data: { status: 'EXPIRED' },
        })
        expired++
      } catch (error) {
        errors++
        ErrorLogger.logUnexpectedError(error as Error, {
          context: 'backup_tick_retention',
          recordId: rec.id,
        })
      }
    }

    BusinessLogger.logSystemEvent('backup_tick_completed', {
      created,
      enqueued,
      rescheduled,
      expired,
      errors,
    })
    timer.end({ success: true, created, enqueued, expired, errors })

    return { success: true, result: { created, enqueued, rescheduled, expired, errors } }
  } catch (error) {
    timer.end({ success: false, error: true })
    ErrorLogger.logUnexpectedError(error as Error, { context: 'backup_tick_job' })
    return { success: false, error: error instanceof Error ? error.message : 'backup tick failed' }
  }
}
