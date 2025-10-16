import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/admin/support/tickets/[id]/reply - Add response to ticket
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
      message,
      isPublic = true,
      isResolution = false,
      updateStatus,
      updatePriority
    } = body

    // Validation
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
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
        status: true,
        priority: true,
        firstResponseAt: true,
        title: true,
        user: {
          select: {
            email: true,
            name: true
          }
        },
        guestEmail: true,
        guestName: true
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

    // Get agent info
    const agent = await prisma.supportAgent.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        title: true,
        department: true
      }
    })

    // Prepare ticket updates
    const ticketUpdateData: any = {}
    const changes: string[] = []

    // Mark first response time if this is the first agent response
    if (!ticket.firstResponseAt) {
      ticketUpdateData.firstResponseAt = new Date()
      changes.push('First response recorded')
    }

    // Update status if provided
    if (updateStatus && updateStatus !== ticket.status) {
      ticketUpdateData.status = updateStatus
      changes.push(`Status changed to ${updateStatus}`)

      if (updateStatus === 'RESOLVED' || updateStatus === 'CLOSED') {
        ticketUpdateData.resolvedAt = new Date()
        ticketUpdateData.resolvedBy = userId
      }
    }

    // Update priority if provided
    if (updatePriority && updatePriority !== ticket.priority) {
      ticketUpdateData.priority = updatePriority
      changes.push(`Priority changed to ${updatePriority}`)
    }

    // If marked as resolution, add resolution to ticket
    if (isResolution) {
      ticketUpdateData.resolution = message.trim()
      if (!updateStatus) {
        ticketUpdateData.status = 'RESOLVED'
        ticketUpdateData.resolvedAt = new Date()
        ticketUpdateData.resolvedBy = userId
        changes.push('Ticket resolved')
      }
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update ticket if needed
      let updatedTicket = ticket
      if (Object.keys(ticketUpdateData).length > 0) {
        updatedTicket = await tx.supportTicket.update({
          where: { id: ticketId },
          data: ticketUpdateData,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            assignedAgent: {
              select: {
                id: true,
                displayName: true,
                title: true,
                department: true
              }
            }
          }
        })
      }

      // Create ticket update record
      const ticketUpdate = await tx.ticketUpdate.create({
        data: {
          ticketId: ticketId,
          updateType: isResolution ? 'RESOLUTION' : 'REPLY',
          message: message.trim(),
          oldStatus: updateStatus ? ticket.status : undefined,
          newStatus: updateStatus || undefined,
          oldPriority: updatePriority ? ticket.priority : undefined,
          newPriority: updatePriority || undefined,
          authorId: userId,
          authorType: 'agent',
          authorName: agent?.displayName || session.user.name || 'Agent',
          isPublic,
          isResolution
        },
        include: {
          ticket: {
            select: {
              ticketNumber: true,
              title: true
            }
          }
        }
      })

      return { updatedTicket, ticketUpdate }
    })

    // TODO: Send email notification to user if isPublic
    if (isPublic) {
      const userEmail = ticket.user?.email || ticket.guestEmail
      const userName = ticket.user?.name || ticket.guestName

      if (userEmail) {
        // Email notification logic would go here
        console.log(`Email notification should be sent to ${userEmail} for ticket response`)
      }
    }

    return NextResponse.json({
      ticketUpdate: result.ticketUpdate,
      ticket: result.updatedTicket,
      changes: changes.length
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to add ticket reply:', error)
    return NextResponse.json(
      { error: 'Failed to add reply' },
      { status: 500 }
    )
  }
}