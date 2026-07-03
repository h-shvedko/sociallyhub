import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'

type TicketRouteParams = { ticketId: string }

// Access-scoped ticket lookup (ADR-0005, fail closed).
//
// The caller must already be authenticated (withApiAuth `session` gate runs
// BEFORE this). A ticket is visible only when it is the caller's own ticket
// (`userId`) OR belongs to a workspace the caller is a member of. A ticket
// outside that scope produces no match, so the handler returns 404 with no
// existence leak. There is no unauthenticated fallthrough: the old
// `const where: any = { id: ticketId }` with scoping only inside
// `if (session?.user?.id)` is gone.
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

// GET /api/support/tickets/[ticketId] - Get specific ticket details
export const GET = withApiAuth<TicketRouteParams>(
  async (_request, { user, params }) => {
    const { ticketId } = params
    const where = await scopedTicketWhere(user!.id, ticketId)

    const ticket = await prisma.supportTicket.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            department: true,
            isOnline: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        updates: {
          where: {
            isPublic: true, // Only show public updates to users
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        attachments: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found')
    }

    return NextResponse.json({ ticket })
  },
  { access: 'session' }
)

// PUT /api/support/tickets/[ticketId] - Update ticket
export const PUT = withApiAuth<TicketRouteParams>(
  async (request, { user, params }) => {
    const { ticketId } = params
    const userId = user!.id
    const body = await request.json()

    const {
      status,
      priority,
      category,
      assignedAgentId,
      resolution,
      tags,
      internalNotes,
    } = body

    // Verify ticket exists and the caller has access (owner or workspace member)
    const where = await scopedTicketWhere(userId, ticketId)
    const existingTicket = await prisma.supportTicket.findFirst({ where })

    if (!existingTicket) {
      return jsonError(404, 'Ticket not found')
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
        authorId: userId,
        authorType: 'user',
        authorName: user!.name || 'System',
        isPublic: true,
      })

      // Set resolution timestamp if resolving
      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date()
        updateData.resolvedBy = userId
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
        authorId: userId,
        authorType: 'user',
        authorName: user!.name || 'System',
        isPublic: true,
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
          select: { displayName: true },
        })

        updates.push({
          ticketId,
          updateType: 'ASSIGNMENT_CHANGE',
          message: `Ticket assigned to ${agent?.displayName || 'Unknown Agent'}`,
          oldAssignee: existingTicket.assignedAgentId,
          newAssignee: assignedAgentId,
          authorId: userId,
          authorType: 'user',
          authorName: user!.name || 'System',
          isPublic: true,
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
          authorId: userId,
          authorType: 'user',
          authorName: user!.name || 'Support Agent',
          isPublic: true,
          isResolution: true,
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
              image: true,
            },
          },
          assignedAgent: {
            select: {
              id: true,
              displayName: true,
              title: true,
              department: true,
              isOnline: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      // Create update records
      ...updates.map((update) =>
        prisma.ticketUpdate.create({ data: update })
      ),
    ])

    return NextResponse.json({ ticket: updatedTicket })
  },
  { access: 'session' }
)

// DELETE /api/support/tickets/[ticketId] - Delete ticket (owner or workspace OWNER/ADMIN)
export const DELETE = withApiAuth<TicketRouteParams>(
  async (_request, { user, params }) => {
    const { ticketId } = params
    const userId = user!.id

    // Verify user is the owner of the ticket, or an OWNER/ADMIN of its workspace
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
                  role: { in: ['OWNER', 'ADMIN'] },
                },
              },
            },
          },
        ],
      },
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found or insufficient permissions')
    }

    // Delete ticket and related records (cascading)
    await prisma.supportTicket.delete({
      where: { id: ticketId },
    })

    return NextResponse.json({ message: 'Ticket deleted successfully' })
  },
  { access: 'session' }
)
