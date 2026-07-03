import { NextResponse } from 'next/server'

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

// GET /api/support/tickets/[ticketId]/updates - Get ticket updates
export const GET = withApiAuth<TicketRouteParams>(
  async (request, { user, params }) => {
    const { ticketId } = params
    const { searchParams } = new URL(request.url)
    const includeInternal = searchParams.get('includeInternal') === 'true'

    // Verify ticket access
    const ticket = await prisma.supportTicket.findFirst({
      where: await scopedTicketWhere(user!.id, ticketId),
      select: { id: true },
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found')
    }

    // Get updates
    const updateWhere: any = { ticketId }

    // Only show public updates unless internal updates are explicitly requested
    if (!includeInternal) {
      updateWhere.isPublic = true
    }

    const updates = await prisma.ticketUpdate.findMany({
      where: updateWhere,
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({ updates })
  },
  { access: 'session' }
)

// POST /api/support/tickets/[ticketId]/updates - Add ticket update
export const POST = withApiAuth<TicketRouteParams>(
  async (request, { user, params }) => {
    const { ticketId } = params
    const userId = user!.id
    const body = await request.json()

    const {
      message,
      updateType = 'USER_REPLY',
      isPublic = true,
      isResolution = false,
    } = body

    if (!message) {
      return jsonError(400, 'Message is required')
    }

    // Verify ticket access
    const ticket = await prisma.supportTicket.findFirst({
      where: await scopedTicketWhere(userId, ticketId),
    })

    if (!ticket) {
      return jsonError(404, 'Ticket not found')
    }

    // Create update
    const update = await prisma.ticketUpdate.create({
      data: {
        ticketId,
        updateType,
        message: message.trim(),
        authorId: userId,
        authorType: 'user',
        authorName: user!.name || ticket.guestName || 'Guest User',
        isPublic,
        isResolution,
      },
    })

    // Update ticket status if it's a user reply and ticket is pending
    if (updateType === 'USER_REPLY' && ticket.status === 'PENDING_USER') {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'PENDING_AGENT' },
      })
    }

    // Set first response time if this is the first agent reply
    if (updateType === 'AGENT_REPLY' && !ticket.firstResponseAt) {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      })
    }

    return NextResponse.json({ update }, { status: 201 })
  },
  { access: 'session' }
)
