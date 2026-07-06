import { NextRequest, NextResponse } from 'next/server'

import { requirePlatformAdmin } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { enqueueBackupRestore } from '@/lib/jobs/backup-queue'

// Types pg_restore can consume (must mirror the worker's RESTORABLE_TYPES).
const RESTORABLE_TYPES = new Set(['DATABASE_ONLY', 'FULL', 'CONFIGURATION_ONLY'])

// POST /api/admin/settings/backup/records/[id]/restore — enqueue a DESTRUCTIVE
// restore (ADR-0016). Platform-admin ONLY, regardless of the backup's scope,
// because a restore clobbers the shared database. Requires a typed confirmation
// matching the configuration name. The worker verifies the file + checksum and
// takes a pre-restore safety snapshot before touching the live DB.
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // Restore is destructive → platform-admin only, never a workspace role.
    const admin = await requirePlatformAdmin()

    const params = await props.params
    const { id } = params

    const body = await request.json().catch(() => ({}))
    const { confirm } = body ?? {}

    const record = await prisma.backupRecord.findUnique({
      where: { id },
      include: { configuration: { select: { name: true, workspaceId: true } } },
    })

    if (!record) {
      return jsonError(404, 'Backup record not found')
    }

    if (!RESTORABLE_TYPES.has(record.backupType)) {
      return jsonError(
        400,
        `Backup type ${record.backupType} is not restorable (only database, full, and configuration dumps can be restored via pg_restore).`
      )
    }

    if (record.status !== 'COMPLETED') {
      return jsonError(400, `Only completed backups can be restored (status ${record.status})`)
    }

    // Typed confirmation must exactly equal the configuration name.
    if (!confirm || confirm !== record.configuration?.name) {
      return jsonError(400, 'Type the configuration name to confirm restore')
    }

    await enqueueBackupRestore({ recordId: record.id, userId: admin.id })

    // Audit trail for the destructive request (the model exists — no helper).
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        workspaceId: record.workspaceId ?? undefined,
        action: 'backup_restore_requested',
        resource: 'backup_record',
        resourceId: record.id,
        newValues: {
          backupType: record.backupType,
          filename: record.filename,
          configurationName: record.configuration?.name ?? null,
        },
        timestamp: new Date(),
      },
    })

    return NextResponse.json(
      { message: 'Restore enqueued. A pre-restore safety snapshot will be taken before the database is restored.' },
      { status: 202 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
