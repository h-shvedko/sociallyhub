import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import path from 'path'

import { requirePlatformAdmin, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { backupScopeDir, backupExtension } from '@/lib/jobs/backup-queue'

// This route reads the filesystem and the session cookie, so it must run on the
// Node.js runtime and never be cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sanitize a filename for a Content-Disposition header (no CR/LF injection). */
function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'backup'
  // Strip control chars, non-ASCII, quotes and backslash so the header's
  // filename="…" param stays well-formed.
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'backup'
}

// GET /api/admin/settings/backup/records/[id]/download — stream a completed
// backup artifact (ADR-0016). Two-tier auth on the record's scope.
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params
    const { id } = params

    const record = await prisma.backupRecord.findUnique({
      where: { id },
      include: { configuration: { select: { workspaceId: true } } },
    })

    if (!record) {
      return jsonError(404, 'Backup record not found')
    }

    // Two-tier authorization (ADR-0004): workspace-scoped records require
    // OWNER/ADMIN membership; global records are platform-admin-only.
    if (record.workspaceId) {
      await requireWorkspaceRole(record.workspaceId, ['OWNER', 'ADMIN'])
    } else {
      await requirePlatformAdmin()
    }

    if (record.status !== 'COMPLETED') {
      return jsonError(400, `Backup is not downloadable (status ${record.status})`)
    }

    const absPath =
      record.filePath && path.isAbsolute(record.filePath)
        ? record.filePath
        : path.join(backupScopeDir(record.workspaceId), record.filename)

    const info = await stat(absPath).catch(() => null)
    if (!info) {
      // The row claims COMPLETED but the artifact is gone — orphaned row.
      return jsonError(404, 'Backup file is missing on disk (record is orphaned)')
    }

    await prisma.backupRecord.update({
      where: { id: record.id },
      data: { downloadCount: { increment: 1 }, lastDownload: new Date() },
    })

    const contentType =
      backupExtension(record.backupType) === 'tar.gz'
        ? 'application/gzip'
        : 'application/octet-stream'

    const webStream = Readable.toWeb(createReadStream(absPath)) as unknown as ReadableStream

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Length', String(info.size))
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Cache-Control', 'private, no-store')
    headers.set('Content-Disposition', `attachment; filename="${safeFilename(record.filename)}"`)

    return new NextResponse(webStream, { status: 200, headers })
  } catch (error) {
    return handleApiError(error)
  }
}
