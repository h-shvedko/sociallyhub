/**
 * Backup-execution queue helpers (ADR-0016 Phase 2).
 *
 * The single seam through which the web tier (the manual "execute now" route)
 * and the repeatable tick sweep enqueue backup work — mirroring
 * `publish-queue.ts` / `client-reports-queue.ts`. This module imports ONLY
 * `queueManager` (+ the `path` builtin) so a web route can enqueue a backup
 * without pulling the heavy processor import graph (child_process, crypto,
 * fs streaming) into its bundle.
 *
 * It also owns the self-contained cron evaluator (`computeNextRun`) and the
 * scope-dir / filename helpers shared by the routes and the processor, so the
 * on-disk layout and the "when does this configuration run next" logic live in
 * exactly ONE place.
 *
 * HONESTY (ADR-0016): a failed dump is recorded FAILED on its BackupRecord by
 * the processor and the job still *succeeds* (it ran, and the row truthfully
 * says FAILED). So execute jobs use `attempts: 1` — there is nothing to retry
 * on a genuine dump failure, and a retry-storm against pg_dump would be
 * dishonest churn. Restore jobs also use `attempts: 1` (destructive; never
 * auto-repeat).
 */
import path from 'path'

import { queueManager } from './queue-manager'

/** Queue the backup processors consume (registered in job-scheduler). */
export const BACKUP_QUEUE = 'backup-execution'

/** BullMQ job *names* — MUST match the enqueued `type` for processor dispatch. */
export const BACKUP_EXECUTE_JOB = 'backup_execute'
export const BACKUP_RESTORE_JOB = 'backup_restore'
export const BACKUP_TICK_JOB = 'backup_tick'

/** Stable scheduler id for the repeatable retention+schedule tick. */
export const BACKUP_TICK_SCHEDULER_ID = 'backup-tick-repeatable'
/** Tick cadence — every 5 minutes (schedule dispatch + retention sweep). */
export const BACKUP_TICK_INTERVAL_MS = 5 * 60 * 1000

/** Root directory for all backup artifacts (mounted volume in prod). */
export const BACKUP_DIR = process.env.BACKUP_DIR || '/app/backups'

/** Per-scope backup directory: BACKUP_DIR/{workspaceId | 'global'}. */
export function backupScopeDir(workspaceId?: string | null): string {
  return path.join(BACKUP_DIR, workspaceId || 'global')
}

/** File extension for a backup type: media → tar.gz, everything else → dump. */
export function backupExtension(backupType: string): string {
  return backupType === 'MEDIA_ONLY' ? 'tar.gz' : 'dump'
}

/** Deterministic, timestamped backup filename (safe for the filesystem). */
export function buildBackupFilename(name: string, backupType: string, at: Date): string {
  const ts = at.toISOString().replace(/[:.]/g, '-')
  const safe = (name || 'backup').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60)
  return `backup-${safe}-${ts}.${backupExtension(backupType)}`
}

/**
 * Ensure the queue object exists in *this* process's registry so
 * removeJob/getJob resolve the real queue (see publish-queue.ts for why).
 */
async function ensureQueue(): Promise<void> {
  await queueManager.createQueue(BACKUP_QUEUE)
}

/**
 * Enqueue a backup-execution job for an already-created (IN_PROGRESS)
 * BackupRecord. Deterministic jobId `backup-exec:{recordId}` (remove-then-add,
 * so a re-enqueue for the same record replaces rather than dedupes). The
 * processor loads the record + configuration from the DB — recordId is the only
 * payload the pipeline needs; workspaceId/userId ride the envelope for logging.
 *
 * @returns the BullMQ jobId of the enqueued job.
 */
export async function enqueueBackupExecute(params: {
  recordId: string
  workspaceId?: string
  userId?: string
}): Promise<string> {
  const { recordId, workspaceId, userId } = params
  // NOTE: BullMQ rejects a custom job id containing ':' ("Custom Id cannot
  // contain :"), so the separator is '-' (recordIds are cuids — no collision).
  const jobId = `backup-exec-${recordId}`

  await ensureQueue()
  await queueManager.removeJob(BACKUP_QUEUE, jobId)

  const job = await queueManager.addJob(
    BACKUP_QUEUE,
    {
      id: jobId,
      type: BACKUP_EXECUTE_JOB,
      payload: { recordId },
      userId,
      workspaceId,
      createdAt: new Date().toISOString(),
    },
    {
      jobId,
      // A failed dump is recorded FAILED on the row and the job still succeeds,
      // so there is nothing to retry; only a genuine infra error throws, and a
      // retry-storm against pg_dump would be dishonest churn. attempts: 1.
      attempts: 1,
    }
  )

  return job.id as string
}

/**
 * Enqueue a DESTRUCTIVE restore job (platform-admin gated at the route). The
 * processor verifies the file + checksum, takes a pre-restore safety snapshot,
 * then pg_restore's the record. Deterministic jobId `backup-restore:{recordId}`,
 * `attempts: 1` — a restore must never auto-repeat.
 *
 * @returns the BullMQ jobId of the enqueued job.
 */
export async function enqueueBackupRestore(params: {
  recordId: string
  userId: string
}): Promise<string> {
  const { recordId, userId } = params
  // BullMQ rejects ':' in a custom job id (see enqueueBackupExecute) — use '-'.
  const jobId = `backup-restore-${recordId}`

  await ensureQueue()
  await queueManager.removeJob(BACKUP_QUEUE, jobId)

  const job = await queueManager.addJob(
    BACKUP_QUEUE,
    {
      id: jobId,
      type: BACKUP_RESTORE_JOB,
      payload: { recordId, userId },
      userId,
      createdAt: new Date().toISOString(),
    },
    {
      jobId,
      attempts: 1,
    }
  )

  return job.id as string
}

/**
 * Create/replace the repeatable backup tick (idempotent by
 * BACKUP_TICK_SCHEDULER_ID — a re-boot never stacks a second timer). Fires
 * BACKUP_TICK_JOB every BACKUP_TICK_INTERVAL_MS. Called by the worker bootstrap;
 * kept here so the queue name + job name + interval live in one place.
 */
export async function upsertBackupTickScheduler(): Promise<void> {
  const queue = await queueManager.createQueue(BACKUP_QUEUE)
  await queue.upsertJobScheduler(
    BACKUP_TICK_SCHEDULER_ID,
    { every: BACKUP_TICK_INTERVAL_MS },
    {
      name: BACKUP_TICK_JOB,
      data: {
        id: BACKUP_TICK_SCHEDULER_ID,
        type: BACKUP_TICK_JOB,
        payload: {},
        userId: 'system',
        createdAt: new Date().toISOString(),
      },
      opts: {
        removeOnComplete: 20,
        removeOnFail: 20,
      },
    }
  )
}

/** Remove the repeatable backup tick (no-op if absent). */
export async function removeBackupTickScheduler(): Promise<void> {
  const queue = await queueManager.createQueue(BACKUP_QUEUE)
  await queue.removeJobScheduler(BACKUP_TICK_SCHEDULER_ID)
}

// ============================================================================
// Self-contained cron evaluator (ADR-0016).
//
// A CORRECT standard 5-field cron evaluator with NO npm dependency
// (cron-parser is intentionally not added — see the ADR-0016 deviation note).
// Supports '*', comma lists, a-b ranges, */step and a-b/step per field.
// Day-of-month + day-of-week follow Vixie-cron "OR" semantics: when BOTH are
// restricted a match on either satisfies the day; when only one is restricted
// only that one must match. Evaluated in server local time (consistent with
// the naive helper it replaces). Iterates minute-by-minute over a bounded
// 366-day horizon and returns the first matching minute, or null if none.
// ============================================================================

/**
 * Parse a single cron field into the set of allowed integer values in
 * [min, max]. Returns null on any malformed token (the caller then treats the
 * whole expression as unschedulable → null next-run).
 */
function parseCronField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    if (part.length === 0) return null

    let rangePart = part
    let step = 1
    const slash = part.indexOf('/')
    if (slash !== -1) {
      rangePart = part.slice(0, slash)
      step = Number(part.slice(slash + 1))
      if (!Number.isInteger(step) || step <= 0) return null
    }

    let start: number
    let end: number
    if (rangePart === '*') {
      start = min
      end = max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      start = Number(a)
      end = Number(b)
    } else {
      start = Number(rangePart)
      // A bare value with a step ("5/10") ranges from the value up to max.
      end = slash !== -1 ? max : start
    }

    if (!Number.isInteger(start) || !Number.isInteger(end)) return null
    if (start < min || end > max || start > end) return null

    for (let v = start; v <= end; v += step) values.add(v)
  }

  return values.size > 0 ? values : null
}

/** Whether a candidate date satisfies the (dom, dow) day fields. */
function cronDayMatches(
  d: Date,
  dom: Set<number>,
  dow: Set<number>,
  domRestricted: boolean,
  dowRestricted: boolean
): boolean {
  const dayOfMonthOk = dom.has(d.getDate())
  const dayOfWeekOk = dow.has(d.getDay())
  if (domRestricted && dowRestricted) return dayOfMonthOk || dayOfWeekOk
  if (domRestricted) return dayOfMonthOk
  if (dowRestricted) return dayOfWeekOk
  return true
}

/**
 * Compute the next fire time strictly after `from` for a standard 5-field cron
 * expression (`minute hour day-of-month month day-of-week`). Returns null for a
 * malformed expression or if nothing matches within 366 days.
 */
export function computeNextRun(cron: string, from: Date): Date | null {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return null

  const [minF, hourF, domF, monF, dowF] = fields
  const minute = parseCronField(minF, 0, 59)
  const hour = parseCronField(hourF, 0, 23)
  const dom = parseCronField(domF, 1, 31)
  const month = parseCronField(monF, 1, 12)
  const dow = parseCronField(dowF, 0, 7)
  if (!minute || !hour || !dom || !month || !dow) return null

  // Cron allows 7 as an alias for Sunday (0). Normalize so getDay() (0-6) hits.
  if (dow.has(7)) {
    dow.add(0)
    dow.delete(7)
  }

  const domRestricted = domF !== '*'
  const dowRestricted = dowF !== '*'

  // Start at the next whole minute strictly after `from`.
  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const horizon = from.getTime() + 366 * 24 * 60 * 60 * 1000
  while (cursor.getTime() <= horizon) {
    if (
      minute.has(cursor.getMinutes()) &&
      hour.has(cursor.getHours()) &&
      month.has(cursor.getMonth() + 1) &&
      cronDayMatches(cursor, dom, dow, domRestricted, dowRestricted)
    ) {
      return new Date(cursor.getTime())
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  return null
}
