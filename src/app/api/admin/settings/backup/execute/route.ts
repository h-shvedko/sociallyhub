import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

import { requireSession, requirePlatformAdmin, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import {
  enqueueBackupExecute,
  backupScopeDir,
  buildBackupFilename,
} from '@/lib/jobs/backup-queue'

// POST /api/admin/settings/backup/execute — create the BackupRecord and enqueue
// the REAL dump (ADR-0016 Phase 2). No work happens inline here; the worker's
// backupExecuteProcessor runs pg_dump/tar, computes a real checksum, and writes
// the true outcome onto the record. This route only records intent + enqueues.
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()
    const body = await request.json()
    const { configurationId, immediate = false } = body

    if (!configurationId) {
      return jsonError(400, 'Configuration ID is required')
    }

    const configuration = await prisma.backupConfiguration.findUnique({
      where: { id: configurationId },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    })

    if (!configuration) {
      return jsonError(404, 'Backup configuration not found')
    }

    // Two-tier authorization (ADR-0004): workspace-scoped backups require
    // OWNER/ADMIN membership; global (workspaceId = null) backups are
    // platform-admin-only.
    if (configuration.workspaceId) {
      await requireWorkspaceRole(configuration.workspaceId, ['OWNER', 'ADMIN'])
    } else {
      await requirePlatformAdmin()
    }

    if (!configuration.isActive && !immediate) {
      return jsonError(400, 'Cannot execute inactive backup configuration')
    }

    // INCREMENTAL / DIFFERENTIAL are not implemented (ADR-0016). Reject up front
    // rather than creating a record that would only ever fail.
    if (
      configuration.backupType === 'INCREMENTAL' ||
      configuration.backupType === 'DIFFERENTIAL'
    ) {
      return jsonError(
        400,
        `Backup type ${configuration.backupType} is not supported (ADR-0016: only full, database, media, and configuration dumps are implemented).`
      )
    }

    // Real filename/filePath under the scope dir; the worker writes the artifact
    // exactly here (extension .dump for db/config/full, .tar.gz for media).
    const now = new Date()
    const filename = buildBackupFilename(configuration.name, configuration.backupType, now)
    const filePath = path.join(backupScopeDir(configuration.workspaceId), filename)

    const record = await prisma.backupRecord.create({
      data: {
        configurationId: configuration.id,
        workspaceId: configuration.workspaceId,
        filename,
        filePath,
        fileSize: BigInt(0),
        checksum: '',
        backupType: configuration.backupType,
        status: 'IN_PROGRESS',
        startTime: now,
        metadata: {
          triggeredBy: user.id,
          triggerType: immediate ? 'manual' : 'scheduled',
        },
      },
      include: {
        configuration: { select: { name: true, backupType: true } },
      },
    })

    await enqueueBackupExecute({
      recordId: record.id,
      workspaceId: configuration.workspaceId ?? undefined,
      userId: user.id,
    })

    // fileSize is a BigInt (0 at creation) — stringify it so NextResponse.json
    // never chokes on BigInt serialization.
    return NextResponse.json(
      { record: { ...record, fileSize: record.fileSize.toString() }, message: 'Backup enqueued' },
      { status: 202 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
