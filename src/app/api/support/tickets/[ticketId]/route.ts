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

// GET /api/support/tickets/[ticketId] - Get specific ticket details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params

    // Build where clause for access control
    const where: any = { id: ticketId }

    // If user is logged in, verify access
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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        assignedAgent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            department: true,
            isOnline: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        updates: {
          where: {
            isPublic: true // Only show public updates to users
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        attachments: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ticket })

  } catch (error) {
    console.error('Failed to fetch ticket:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    )
  }
}

// PUT /api/support/tickets/[ticketId] - Update ticket
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params
    const body = await request.json()

    const {
      status,
      priority,
      category,
      assignedAgentId,
      resolution,
      tags,
      internalNotes
    } = body

    // Verify ticket exists and user has access
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

    const existingTicket = await prisma.supportTicket.findFirst({
      where
    })

    if (!existingTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}
    const updates: any[] = []

    if (status && status !== existingTicket.status) {
      updateData.status = status
      updates.push({
        ticketId,
        updateType: 'STATUS_CHANGE',
        message: `Status changed from ${existingTicket.status} to ${status}`,
        oldStatus: existingTicket.status,
        newStatus: status,
        authorId: session?.user?.id ? normalizeUserId(session.user.id) : null,
        authorType: session?.user?.id ? 'user' : 'system',
        authorName: session?.user?.name || 'System',
        isPublic: true
      })

      // Set resolution timestamp if resolving
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date()
        updateData.resolvedBy = session?.user?.id ? normalizeUserId(session.user.id) : existingTicket.assignedAgentId
      }
    }

    if (priority && priority !== existingTicket.priority) {
      updateData.priority = priority
      updates.push({
        ticketId,
        updateType: 'PRIORITY_CHANGE',
        message: `Priority changed from ${existingTicket.priority} to ${priority}`,
        oldPriority: existingTicket.priority,
        newPriority: priority,
        authorId: session?.user?.id ? normalizeUserId(session.user.id) : null,
        authorType: session?.user?.id ? 'user' : 'system',
        authorName: session?.user?.name || 'System',
        isPublic: true
      })
    }

    if (category && category !== existingTicket.category) {
      updateData.category = category
    }

    if (assignedAgentId !== undefined && assignedAgentId !== existingTicket.assignedAgentId) {
      updateData.assignedAgentId = assignedAgentId
      updateData.assignedAt = assignedAgentId ? new Date() : null

      if (assignedAgentId) {
        const agent = await prisma.supportAgent.findUnique({
          where: { id: assignedAgentId },
          select: { displayName: true }
        })

        updates.push({
          ticketId,
          updateType: 'ASSIGNMENT_CHANGE',
          message: `Ticket assigned to ${agent?.displayName || 'Unknown Agent'}`,
          oldAssignee: existingTicket.assignedAgentId,
          newAssignee: assignedAgentId,
          authorId: session?.user?.id ? normalizeUserId(session.user.id) : null,
          authorType: session?.user?.id ? 'user' : 'system',
          authorName: session?.user?.name || 'System',
          isPublic: true
        })
      }
    }

    if (resolution !== undefined) {
      updateData.resolution = resolution
      if (resolution) {
        updates.push({
          ticketId,
          updateType: 'RESOLUTION',
          message: resolution,
          authorId: session?.user?.id ? normalizeUserId(session.user.id) : null,
          authorType: session?.user?.id ? 'user' : 'agent',
          authorName: session?.user?.name || 'Support Agent',
          isPublic: true,
          isResolution: true
        })
      }
    }

    if (tags !== undefined) {
      updateData.tags = tags
    }

    if (internalNotes !== undefined) {
      updateData.internalNotes = internalNotes
    }

    // Update ticket and create update records
    const [updatedTicket] = await Promise.all([
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          assignedAgent: {
            select: {
              id: true,
              displayName: true,
              title: true,
              department: true,
              isOnline: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      // Create update records
      ...updates.map(update =>
        prisma.ticketUpdate.create({ data: update })
      )
    ])

    return NextResponse.json({ ticket: updatedTicket })

  } catch (error) {
    console.error('Failed to update ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}

// DELETE /api/support/tickets/[ticketId] - Delete ticket (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    const { ticketId } = params

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user is admin or owner of the ticket
    const ticket = await prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        OR: [
          { userId },
          {
            workspace: {
              userWorkspaces: {
                some: {
                  userId,
                  role: { in: ['OWNER', 'ADMIN'] }
                }
              }
            }
          }
        ]
      }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found or insufficient permissions' },
        { status: 404 }
      )
    }

    // Delete ticket and related records (cascading)
    await prisma.supportTicket.delete({
      where: { id: ticketId }
    })

    return NextResponse.json({ message: 'Ticket deleted successfully' })

  } catch (error) {
    console.error('Failed to delete ticket:', error)
    return NextResponse.json(
      { error: 'Failed to delete ticket' },
      { status: 500 }
    )
  }
}