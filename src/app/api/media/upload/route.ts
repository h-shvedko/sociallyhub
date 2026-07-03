import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { getStorage, buildMediaKey } from '@/lib/storage'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi'
}

// POST /api/media/upload - Upload media files (ADR-0007: storage service + private serving)
export async function POST(request: NextRequest) {
  try {
    // Authenticate before touching the request body (docs/api-conventions.md §1).
    await requireSession()

    const formData = await request.formData()
    const workspaceId = formData.get('workspaceId') as string

    if (!workspaceId) {
      return jsonError(400, 'Workspace ID required')
    }

    // Authorize: caller must be OWNER/ADMIN/PUBLISHER of the target workspace
    // (ADR-0004). requireWorkspaceRole re-verifies membership against the DB and
    // returns the membership row, so we take the userId from there rather than
    // calling normalizeUserId in route code (banned by api-conventions §3).
    const membership = await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])
    const userId = membership.userId

    const file = formData.get('file') as File

    if (!file) {
      return jsonError(400, 'No file provided')
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return jsonError(400, `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
    }

    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return jsonError(400, 'File type not supported')
    }

    // Derive the stored filename/extension from the validated MIME type — never
    // from file.name (which is attacker-controlled and a traversal vector).
    const fileExtension = ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]
    const uniqueFilename = `${uuidv4()}${fileExtension}`
    const key = buildMediaKey(membership.workspaceId, uniqueFilename)

    const buffer = Buffer.from(await file.arrayBuffer())

    // Real dimensions, not the old 1920x1080/60.0 placeholders. sharp reads
    // width/height for every supported image type. Video width/height/duration
    // need ffprobe (not available here) — left null rather than fabricated
    // (probe is deferred to the ADR-0008 media pipeline).
    let width: number | null = null
    let height: number | null = null
    const duration: number | null = null

    if (file.type.startsWith('image/')) {
      try {
        const meta = await sharp(buffer).metadata()
        width = meta.width ?? null
        height = meta.height ?? null
      } catch (metaError) {
        // A corrupt/unsupported image still uploads; we just store null dims.
        console.warn('Failed to read image metadata:', metaError)
      }
    }

    // Write bytes through the storage service (private, non-public root). Put
    // first, then create the row, so we never persist an Asset pointing at a
    // file that failed to write.
    await getStorage().put(key, buffer, { contentType: file.type })

    const url = `/api/files/${key}`

    // Create asset record in database
    const asset = await prisma.asset.create({
      data: {
        workspaceId: membership.workspaceId,
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url,
        storageKey: key,
        // Images can be their own thumbnail (served via /api/files); a real
        // resized thumbnail is future work in the media pipeline (ADR-0008).
        thumbnailUrl: file.type.startsWith('image/') ? url : null,
        width,
        height,
        duration,
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        },
        tags: []
      }
    })

    // Get user info for response
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true }
    })

    return NextResponse.json({
      id: asset.id,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      uploadedBy: {
        name: user?.name || 'Unknown User',
        email: user?.email || 'unknown@sociallyhub.com'
      },
      createdAt: asset.createdAt.toISOString(),
      metadata: {
        width: asset.width,
        height: asset.height,
        duration: asset.duration
      },
      tags: asset.tags || []
    })
  } catch (error) {
    return handleApiError(error)
  }
}
