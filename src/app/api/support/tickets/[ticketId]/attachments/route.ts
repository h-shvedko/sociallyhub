import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'

type TicketRouteParams = { ticketId: string }

// Access-scoped ticket lookup (ADR-0005, fail closed). The caller is already
// authenticated (withApiAuth `session` gate). A ticket is reachable only when
// it is the caller's own ticket OR belongs to a workspace the caller is a
// member of; anything else yields no match → 404 (no existence leak). The old
// unauthenticated fallthrough (`where: any = { id: ticketId }` scoped only
// inside `if (session?.user?.id)`) is gone.
//
// NOTE: attachment bytes are still written under `public/uploads/tickets`,
// leaving them world-readable by URL. Relocating attachment storage out of the
// public web root is owned by ADR-0007 and intentionally left unchanged here.
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

    // Validate file type (security)
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
    ]

    if (!allowedTypes.includes(file.type)) {
      return jsonError(400, 'File type not allowed')
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${fileExtension}`
    // NOTE (ADR-0007): still under the public web root — see module header.
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'tickets')
    const filePath = join(uploadDir, filename)

    // Create upload directory if it doesn't exist
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create attachment record
    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId,
        filename,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl: `/uploads/tickets/${filename}`,
        uploadedBy: userId,
        uploadedByType: 'user',
        uploadedByName: user!.name || ticket.guestName || 'Guest User',
        isScanned: false,
        scanResult: 'pending',
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

    // Delete file from filesystem
    try {
      const fs = require('fs').promises
      const filePath = join(process.cwd(), 'public', attachment.fileUrl)
      await fs.unlink(filePath)
    } catch (error) {
      console.warn('Failed to delete file from filesystem:', error)
    }

    // Delete from database
    await prisma.ticketAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })
  },
  { access: 'session' }
)
