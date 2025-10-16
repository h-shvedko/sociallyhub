import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

interface RouteParams {
  params: {
    ticketId: string
  }
}

// GET /api/support/tickets/[ticketId]/updates - Get ticket updates
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params
    const { searchParams } = new URL(request.url)
    const includeInternal = searchParams.get('includeInternal') === 'true'

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

    // Get updates
    const updateWhere: any = { ticketId }

    // Only show public updates unless user has admin access
    if (!includeInternal) {
      updateWhere.isPublic = true
    }

    const updates = await prisma.ticketUpdate.findMany({
      where: updateWhere,
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({ updates })

  } catch (error) {
    console.error('Failed to fetch ticket updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket updates' },
      { status: 500 }
    )
  }
}

// POST /api/support/tickets/[ticketId]/updates - Add ticket update
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params
    const body = await request.json()

    const {
      message,
      updateType = 'USER_REPLY',
      isPublic = true,
      isResolution = false
    } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
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
      where
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Create update
    const update = await prisma.ticketUpdate.create({
      data: {
        ticketId,
        updateType,
        message: message.trim(),
        authorId: session?.user?.id ? normalizeUserId(session.user.id) : null,
        authorType: session?.user?.id ? 'user' : 'guest',
        authorName: session?.user?.name || ticket.guestName || 'Guest User',
        isPublic,
        isResolution
      }
    })

    // Update ticket status if it's a user reply and ticket is pending
    if (updateType === 'USER_REPLY' && ticket.status === 'PENDING_USER') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'PENDING_AGENT' }
      })
    }

    // Set first response time if this is the first agent reply
    if (updateType === 'AGENT_REPLY' && !ticket.firstResponseAt) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() }
      })
    }

    return NextResponse.json({ update }, { status: 201 })

  } catch (error) {
    console.error('Failed to create ticket update:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket update' },
      { status: 500 }
    )
  }
}