import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/admin/support/tickets/bulk - Bulk operations on tickets
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      action,
      ticketIds,
      data = {}
    } = body

    // Validation
    if (!action || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json(
        { error: 'Action and ticket IDs are required' },
        { status: 400 }
      )
    }

    if (ticketIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 tickets can be processed at once' },
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

    // Verify all tickets exist and user has access
    const tickets = await prisma.supportTicket.findMany({
      where: {
        id: { in: ticketIds },
        OR: [
          { workspaceId: { in: workspaceIds } },
          { workspaceId: null }
        ]
      },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        assignedAgentId: true,
        workspaceId: true
      }
    })

    if (tickets.length !== ticketIds.length) {
      return NextResponse.json(
        { error: 'Some tickets not found or access denied' },
        { status: 404 }
      )
    }

    let result: any = {}
    let updateCount = 0

    // Perform bulk operation based on action
    switch (action) {
      case 'UPDATE_STATUS':
        if (!data.status) {
          return NextResponse.json(
            { error: 'Status is required for update_status action' },
            { status: 400 }
          )
        }

        await prisma.$transaction(async (tx) => {
          // Update tickets
          const updateResult = await tx.supportTicket.updateMany({
            where: { id: { in: ticketIds } },
            data: {
              status: data.status,
              ...(data.status === 'RESOLVED' || data.status === 'CLOSED' ? {
                resolvedAt: new Date(),
                resolvedBy: userId
              } : {})
            }
          })

          updateCount = updateResult.count

          // Create ticket updates for each ticket
          for (const ticket of tickets) {
            await tx.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                updateType: 'STATUS_CHANGE',
                message: `Status changed from ${ticket.status} to ${data.status} (bulk operation)`,
                oldStatus: ticket.status,
                newStatus: data.status,
                authorId: userId,
                authorType: 'admin',
                authorName: session.user.name || 'Admin',
                isPublic: false
              }
            })
          }
        })

        result = { action: 'UPDATE_STATUS', updated: updateCount, newStatus: data.status }
        break

      case 'UPDATE_PRIORITY':
        if (!data.priority) {
          return NextResponse.json(
            { error: 'Priority is required for update_priority action' },
            { status: 400 }
          )
        }

        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.supportTicket.updateMany({
            where: { id: { in: ticketIds } },
            data: { priority: data.priority }
          })

          updateCount = updateResult.count

          for (const ticket of tickets) {
            await tx.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                updateType: 'PRIORITY_CHANGE',
                message: `Priority changed from ${ticket.priority} to ${data.priority} (bulk operation)`,
                oldPriority: ticket.priority,
                newPriority: data.priority,
                authorId: userId,
                authorType: 'admin',
                authorName: session.user.name || 'Admin',
                isPublic: false
              }
            })
          }
        })

        result = { action: 'UPDATE_PRIORITY', updated: updateCount, newPriority: data.priority }
        break

      case 'ASSIGN_AGENT':
        if (!data.agentId) {
          return NextResponse.json(
            { error: 'Agent ID is required for assign_agent action' },
            { status: 400 }
          )
        }

        // Verify agent exists
        const agent = await prisma.supportAgent.findUnique({
          where: { id: data.agentId },
          select: { id: true, displayName: true, department: true }
        })

        if (!agent) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          )
        }

        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.supportTicket.updateMany({
            where: { id: { in: ticketIds } },
            data: {
              assignedAgentId: data.agentId,
              assignedAt: new Date()
            }
          })

          updateCount = updateResult.count

          // Create assignment records
          for (const ticket of tickets) {
            await tx.supportTicketAssignment.create({
              data: {
                ticketId: ticket.id,
                agentId: data.agentId,
                assignedBy: userId,
                reason: 'Bulk assignment by admin'
              }
            })

            await tx.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                updateType: 'ASSIGNMENT',
                message: `Ticket assigned to ${agent.displayName} (bulk operation)`,
                oldAssignee: ticket.assignedAgentId,
                newAssignee: data.agentId,
                authorId: userId,
                authorType: 'admin',
                authorName: session.user.name || 'Admin',
                isPublic: false
              }
            })
          }
        })

        result = { action: 'ASSIGN_AGENT', updated: updateCount, agent: agent.displayName }
        break

      case 'UNASSIGN':
        await prisma.$transaction(async (tx) => {
          const updateResult = await tx.supportTicket.updateMany({
            where: { id: { in: ticketIds } },
            data: {
              assignedAgentId: null,
              assignedAt: null
            }
          })

          updateCount = updateResult.count

          for (const ticket of tickets) {
            if (ticket.assignedAgentId) {
              await tx.ticketUpdate.create({
                data: {
                  ticketId: ticket.id,
                  updateType: 'ASSIGNMENT',
                  message: 'Ticket unassigned (bulk operation)',
                  oldAssignee: ticket.assignedAgentId,
                  newAssignee: null,
                  authorId: userId,
                  authorType: 'admin',
                  authorName: session.user.name || 'Admin',
                  isPublic: false
                }
              })
            }
          }
        })

        result = { action: 'UNASSIGN', updated: updateCount }
        break

      case 'ADD_TAGS':
        if (!data.tags || !Array.isArray(data.tags) || data.tags.length === 0) {
          return NextResponse.json(
            { error: 'Tags array is required for add_tags action' },
            { status: 400 }
          )
        }

        await prisma.$transaction(async (tx) => {
          for (const ticket of tickets) {
            const currentTags = await tx.supportTicket.findUnique({
              where: { id: ticket.id },
              select: { tags: true }
            })

            const newTags = [...new Set([...(currentTags?.tags || []), ...data.tags])]

            await tx.supportTicket.update({
              where: { id: ticket.id },
              data: { tags: newTags }
            })

            await tx.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                updateType: 'TAG_CHANGE',
                message: `Tags added: ${data.tags.join(', ')} (bulk operation)`,
                authorId: userId,
                authorType: 'admin',
                authorName: session.user.name || 'Admin',
                isPublic: false
              }
            })
          }
          updateCount = tickets.length
        })

        result = { action: 'ADD_TAGS', updated: updateCount, tags: data.tags }
        break

      case 'DELETE':
        if (!data.confirm) {
          return NextResponse.json(
            { error: 'Confirmation required for delete action' },
            { status: 400 }
          )
        }

        await prisma.$transaction(async (tx) => {
          const deleteResult = await tx.supportTicket.deleteMany({
            where: { id: { in: ticketIds } }
          })
          updateCount = deleteResult.count
        })

        result = { action: 'DELETE', deleted: updateCount }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      result,
      ticketsProcessed: tickets.length,
      ticketNumbers: tickets.map(t => t.ticketNumber)
    })

  } catch (error) {
    console.error('Failed to perform bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}