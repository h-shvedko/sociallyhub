import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/support/tickets/[id] - Get ticket details with full history
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

    // Get ticket with full details
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
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
            isOnline: true,
            user: {
              select: {
                image: true
              }
            }
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        updates: {
          orderBy: { createdAt: 'asc' },
          include: {
            ticket: {
              select: {
                assignedAgent: {
                  select: {
                    displayName: true
                  }
                }
              }
            }
          }
        },
        attachments: {
          orderBy: { createdAt: 'desc' }
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            agent: {
              select: {
                id: true,
                displayName: true,
                title: true,
                department: true
              }
            }
          }
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            agent: {
              select: {
                id: true,
                displayName: true,
                title: true,
                department: true
              }
            }
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

    // Verify access to ticket
    if (ticket.workspaceId && !workspaceIds.includes(ticket.workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({ ticket })

  } catch (error) {
    console.error('Failed to fetch ticket details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ticket details' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/support/tickets/[id] - Update ticket
export async function PUT(
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
      title,
      description,
      category,
      priority,
      status,
      assignedAgentId,
      tags,
      resolution,
      expectedResponseBy
    } = body

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

    // Get current ticket
    const currentTicket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        priority: true,
        assignedAgentId: true,
        title: true,
        description: true,
        category: true,
        tags: true,
        resolution: true
      }
    })

    if (!currentTicket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Verify access to ticket
    if (currentTicket.workspaceId && !workspaceIds.includes(currentTicket.workspaceId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    const changes: string[] = []

    if (title !== undefined && title !== currentTicket.title) {
      updateData.title = title.trim()
      changes.push(`Title changed from "${currentTicket.title}" to "${title.trim()}"`)
    }

    if (description !== undefined && description !== currentTicket.description) {
      updateData.description = description.trim()
      changes.push('Description updated')
    }

    if (category !== undefined && category !== currentTicket.category) {
      updateData.category = category
      changes.push(`Category changed from ${currentTicket.category} to ${category}`)
    }

    if (priority !== undefined && priority !== currentTicket.priority) {
      updateData.priority = priority
      changes.push(`Priority changed from ${currentTicket.priority} to ${priority}`)
    }

    if (status !== undefined && status !== currentTicket.status) {
      updateData.status = status
      changes.push(`Status changed from ${currentTicket.status} to ${status}`)

      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date()
        updateData.resolvedBy = userId
      }
    }

    if (assignedAgentId !== undefined && assignedAgentId !== currentTicket.assignedAgentId) {
      updateData.assignedAgentId = assignedAgentId || null
      updateData.assignedAt = assignedAgentId ? new Date() : null

      if (assignedAgentId) {
        changes.push('Ticket assigned to agent')

        // Create assignment record
        await prisma.supportTicketAssignment.create({
          data: {
            ticketId: ticketId,
            agentId: assignedAgentId,
            assignedBy: userId,
            reason: 'Manual assignment by admin'
          }
        })
      } else {
        changes.push('Ticket unassigned')
      }
    }

    if (tags !== undefined) {
      updateData.tags = tags
      changes.push('Tags updated')
    }

    if (resolution !== undefined && resolution !== currentTicket.resolution) {
      updateData.resolution = resolution?.trim() || null
      changes.push('Resolution updated')
    }

    if (expectedResponseBy !== undefined) {
      updateData.expectedResponseBy = expectedResponseBy ? new Date(expectedResponseBy) : null
      changes.push('Expected response time updated')
    }

    // Update ticket if there are changes
    let updatedTicket = currentTicket
    if (Object.keys(updateData).length > 0) {
      updatedTicket = await prisma.supportTicket.update({
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
              department: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Create ticket update record
      if (changes.length > 0) {
        await prisma.ticketUpdate.create({
          data: {
            ticketId: ticketId,
            updateType: 'STATUS_CHANGE',
            message: changes.join('; '),
            oldStatus: priority !== undefined ? currentTicket.status : undefined,
            newStatus: status !== undefined ? status : undefined,
            oldPriority: priority !== undefined ? currentTicket.priority : undefined,
            newPriority: priority !== undefined ? priority : undefined,
            oldAssignee: assignedAgentId !== undefined ? currentTicket.assignedAgentId : undefined,
            newAssignee: assignedAgentId !== undefined ? assignedAgentId : undefined,
            authorId: userId,
            authorType: 'admin',
            authorName: session.user.name || 'Admin',
            isPublic: false
          }
        })
      }
    }

    return NextResponse.json({
      ticket: updatedTicket,
      changes: changes.length
    })

  } catch (error) {
    console.error('Failed to update ticket:', error)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/support/tickets/[id] - Delete ticket (admin only)
export async function DELETE(
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

    // Verify ticket exists and access
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        workspaceId: true,
        ticketNumber: true
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

    // Delete ticket (cascading deletes will handle related records)
    await prisma.supportTicket.delete({
      where: { id: ticketId }
    })

    return NextResponse.json({
      message: 'Ticket deleted successfully',
      ticketNumber: ticket.ticketNumber
    })

  } catch (error) {
    console.error('Failed to delete ticket:', error)
    return NextResponse.json(
      { error: 'Failed to delete ticket' },
      { status: 500 }
    )
  }
}