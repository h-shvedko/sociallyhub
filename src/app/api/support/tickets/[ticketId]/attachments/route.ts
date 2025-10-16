import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: {
    ticketId: string
  }
}

// GET /api/support/tickets/[ticketId]/attachments - Get ticket attachments
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params

    // Verify ticket access
    const where: any = { id: ticketId }

    if (session?.user?.id) {
      const userId = normalizeUserId(session.user.id)

      // Get user's workspaces
      const userWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId },
        select: { workspaceId: true }
      })

      const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

      where.OR = [
        { userId }, // User's own ticket
        { workspaceId: { in: workspaceIds } } // Workspace ticket
      ]
    }

    const ticket = await prisma.supportTicket.findFirst({
      where,
      select: { id: true }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ attachments })

  } catch (error) {
    console.error('Failed to fetch ticket attachments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket attachments' },
      { status: 500 }
    )
  }
}

// POST /api/support/tickets/[ticketId]/attachments - Upload ticket attachment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params

    // Verify ticket access
    const where: any = { id: ticketId }

    if (session?.user?.id) {
      const userId = normalizeUserId(session.user.id)

      // Get user's workspaces
      const userWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId },
        select: { workspaceId: true }
      })

      const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

      where.OR = [
        { userId }, // User's own ticket
        { workspaceId: { in: workspaceIds } } // Workspace ticket
      ]
    }

    const ticket = await prisma.supportTicket.findFirst({
      where
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
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
      'application/zip'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const filename = `${uuidv4()}.${fileExtension}`
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
        uploadedBy: session?.user?.id ? normalizeUserId(session.user.id) : null,
        uploadedByType: session?.user?.id ? 'user' : 'guest',
        uploadedByName: session?.user?.name || ticket.guestName || 'Guest User',
        isScanned: false,
        scanResult: 'pending'
      }
    })

    // Create ticket update for attachment
    await prisma.ticketUpdate.create({
      data: {
        ticketId,
        updateType: 'SYSTEM_UPDATE',
        message: `File uploaded: ${file.name}`,
        authorId: session?.user?.id ? normalizeUserId(session.user.id) : null,
        authorType: session?.user?.id ? 'user' : 'guest',
        authorName: session?.user?.name || ticket.guestName || 'Guest User',
        isPublic: true
      }
    })

    return NextResponse.json({ attachment }, { status: 201 })

  } catch (error) {
    console.error('Failed to upload attachment:', error)
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    )
  }
}

// DELETE /api/support/tickets/[ticketId]/attachments/[attachmentId] - Delete attachment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'Attachment ID is required' },
        { status: 400 }
      )
    }

    // Verify ticket access
    const where: any = { id: ticketId }

    if (session?.user?.id) {
      const userId = normalizeUserId(session.user.id)

      // Get user's workspaces
      const userWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId },
        select: { workspaceId: true }
      })

      const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

      where.OR = [
        { userId }, // User's own ticket
        { workspaceId: { in: workspaceIds } } // Workspace ticket
      ]
    }

    const ticket = await prisma.supportTicket.findFirst({
      where,
      select: { id: true }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Find and delete attachment
    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        ticketId
      }
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      )
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
      where: { id: attachmentId }
    })

    return NextResponse.json({ message: 'Attachment deleted successfully' })

  } catch (error) {
    console.error('Failed to delete attachment:', error)
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    )
  }
}