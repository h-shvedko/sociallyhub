import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/support/tickets/[id]/notes - Get all notes for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const ticketId = params.id

    // Verify admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      },
      select: { workspaceId: true }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Verify ticket access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        workspaceId: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    if (ticket.workspaceId && !workspaceIds.includes(ticket.workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get notes
    const notes = await prisma.supportTicketNote.findMany({
      where: { ticketId },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            department: true,
            user: {
              select: {
                image: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ notes })

  } catch (error) {
    console.error('Failed to fetch ticket notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

// POST /api/admin/support/tickets/[id]/notes - Add internal note to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const ticketId = params.id
    const body = await request.json()

    const {
      content,
      tags = [],
      isInternal = true
    } = body

    // Validation
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    // Verify admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      },
      select: { workspaceId: true }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Verify ticket exists and access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        workspaceId: true,
        ticketNumber: true,
        title: true
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    if (ticket.workspaceId && !workspaceIds.includes(ticket.workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get or create agent record
    let agent = await prisma.supportAgent.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        title: true,
        department: true
      }
    })

    if (!agent) {
      // Create agent record if doesn't exist
      agent = await prisma.supportAgent.create({
        data: {
          userId,
          displayName: session.user.name || 'Admin',
          title: 'Administrator',
          department: 'admin',
          isActive: true,
          isOnline: true
        },
        select: {
          id: true,
          displayName: true,
          title: true,
          department: true
        }
      })
    }

    // Create note
    const note = await prisma.supportTicketNote.create({
      data: {
        ticketId,
        agentId: agent.id,
        content: content.trim(),
        tags,
        isInternal
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            department: true,
            user: {
              select: {
                image: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ note }, { status: 201 })

  } catch (error) {
    console.error('Failed to add ticket note:', error)
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    )
  }
}