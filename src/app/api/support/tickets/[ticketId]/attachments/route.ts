import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'
import { getStorage, buildTicketKey } from '@/lib/storage'

// Validated MIME type → canonical file extension. Attachments are stored under
// keys derived from this map (never from the user-supplied file.name), which is
// both the allow-list and the traversal-safe extension source (ADR-0007 Phase
// 0/1): a crafted name like `x./../../evil` can no longer influence the key.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.zip',
}

type TicketRouteParams = { ticketId: string }

// Access-scoped ticket lookup (ADR-0005, fail closed). The caller is already
// authenticated (withApiAuth `session` gate). A ticket is reachable only when
// it is the caller's own ticket OR belongs to a workspace the caller is a
// member of; anything else yields no match → 404 (no existence leak). The old
// unauthenticated fallthrough (`where: any = { id: ticketId }` scoped only
// inside `if (session?.user?.id)`) is gone.
//
// Attachment bytes are stored via the ADR-0007 storage service under private
// `tickets/{ticketId}/...` keys and served by the authenticated `/api/files`
// route — no longer under the public web root.
async function scopedTicketWhere(userId: string, ticketId: string) {
  const memberships = await prisma.userWorkspace.findMany({
    where: { userId },
    select: { workspaceId: true },
  })
  const workspaceIds = memberships.map((m) => m.workspaceId)
  return {
    id: ticketId,
    OR: [{ userId }, { workspaceId: { in: workspaceIds } }],
  }
}

// GET /api/support/tickets/[ticketId]/attachments - Get ticket attachments
export const GET = withApiAuth<TicketRouteParams>(
  async (_request, { user, params }) => {
    const { ticketId } = params

    const ticket = await prisma.supportTicket.findFirst({
      where: await scopedTicketWhere(user!.id, ticketId),
      select: { id: true },
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found')
    }

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ attachments })
  },
  { access: 'session' }
)

// POST /api/support/tickets/[ticketId]/attachments - Upload ticket attachment
export const POST = withApiAuth<TicketRouteParams>(
  async (request, { user, params }) => {
    const { ticketId } = params
    const userId = user!.id

    const ticket = await prisma.supportTicket.findFirst({
      where: await scopedTicketWhere(userId, ticketId),
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found')
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return jsonError(400, 'No file provided')
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return jsonError(400, 'File size exceeds 10MB limit')
    }

    // Validate file type (security) and derive the stored extension from the
    // VALIDATED MIME type — never from user-supplied file.name (ADR-0007).
    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return jsonError(400, 'File type not allowed')
    }

    // Store via the storage service under a private ticket key.
    const filename = `${uuidv4()}${ext}`
    const key = buildTicketKey(ticketId, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await getStorage().put(key, buffer, { contentType: file.type })

    // Create attachment record. The file is served by the authenticated
    // `/api/files` route (private), not the public web root.
    //
    // scanResult stays NULL and isScanned false: no scanner exists yet. Writing
    // 'pending' was a permanent lie (ADR-0007). Real ClamAV scanning lands in
    // ADR-0008; until then no "scanned" state may be claimed.
    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId,
        filename,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl: `/api/files/${key}`,
        storageKey: key,
        uploadedBy: userId,
        uploadedByType: 'user',
        uploadedByName: user!.name || ticket.guestName || 'Guest User',
        isScanned: false,
        scanResult: null,
      },
    })

    // Create ticket update for attachment
    await prisma.ticketUpdate.create({
      data: {
        ticketId,
        updateType: 'SYSTEM_UPDATE',
        message: `File uploaded: ${file.name}`,
        authorId: userId,
        authorType: 'user',
        authorName: user!.name || ticket.guestName || 'Guest User',
        isPublic: true,
      },
    })

    return NextResponse.json({ attachment }, { status: 201 })
  },
  { access: 'session' }
)

// DELETE /api/support/tickets/[ticketId]/attachments?attachmentId=... - Delete attachment
export const DELETE = withApiAuth<TicketRouteParams>(
  async (request, { user, params }) => {
    const { ticketId } = params
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return jsonError(400, 'Attachment ID is required')
    }

    // Verify ticket access
    const ticket = await prisma.supportTicket.findFirst({
      where: await scopedTicketWhere(user!.id, ticketId),
      select: { id: true },
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found')
    }

    // Find and delete attachment
    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        ticketId,
      },
    })

    if (!attachment) {
      return jsonError(404, 'Attachment not found')
    }

    // Delete the underlying file. New attachments live in the storage service
    // (storageKey); legacy rows still point at a public/uploads path.
    try {
      if (attachment.storageKey) {
        await getStorage().delete(attachment.storageKey)
      } else if (attachment.fileUrl?.startsWith('/uploads/')) {
        await unlink(join(process.cwd(), 'public', attachment.fileUrl))
      }
    } catch (error) {
      console.warn('Failed to delete attachment file:', error)
    }

    // Delete from database
    await prisma.ticketAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  },
  { access: 'session' }
)
