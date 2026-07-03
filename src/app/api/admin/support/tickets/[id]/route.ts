import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
// GET /api/admin/support/tickets/[id] - Get ticket details with full history
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Platform support console: cross-tenant surface (ADR-0004).
    await requirePlatformAdmin()

    const ticketId = params.id

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

    return NextResponse.json({ ticket })

  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/admin/support/tickets/[id] - Update ticket
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Platform support console: cross-tenant surface (ADR-0004).
    const user = await requirePlatformAdmin()
    const userId = user.id

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
            authorName: user.name || 'Admin',
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
    return handleApiError(error)
  }
}

// DELETE /api/admin/support/tickets/[id] - Delete ticket (admin only)
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Platform support console: cross-tenant surface (ADR-0004).
    await requirePlatformAdmin()

    const ticketId = params.id

    // Verify ticket exists
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

    // Delete ticket (cascading deletes will handle related records)
    await prisma.supportTicket.delete({
      where: { id: ticketId }
    })

    return NextResponse.json({
      message: 'Ticket deleted successfully',
      ticketNumber: ticket.ticketNumber
    })

  } catch (error) {
    return handleApiError(error)
  }
}
