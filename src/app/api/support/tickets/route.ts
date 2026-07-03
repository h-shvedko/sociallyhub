import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { jsonError } from '@/lib/api/respond'

// Generate unique ticket number
function generateTicketNumber(): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `TICK-${timestamp}${random}`
}

// GET /api/support/tickets - List support tickets
//
// ADR-0005 fail-closed: previously `const where: any = {}` was scoped only
// inside `if (session?.user?.id)`, so an unauthenticated caller fell through
// to an UNSCOPED query that returned EVERY ticket across all workspaces. The
// route now requires a session and always scopes to the caller's own tickets
// plus tickets in workspaces they belong to.
export const GET = withApiAuth(
  async (request, { user }) => {
    const userId = user!.id
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const assignedAgentId = searchParams.get('assignedAgentId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Scope to the caller's own tickets and workspaces they have access to.
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true },
    })
    const workspaceIds = userWorkspaces.map((uw) => uw.workspaceId)

    const where: any = {
      OR: [
        { userId }, // User's own tickets
        { workspaceId: { in: workspaceIds } }, // Workspace tickets
      ],
    }

    // Apply filters
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    if (assignedAgentId) where.assignedAgentId = assignedAgentId

    const [tickets, totalCount] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          description: true,
          category: true,
          priority: true,
          status: true,
          type: true,
          guestName: true,
          guestEmail: true,
          assignedAgentId: true,
          assignedAt: true,
          resolution: true,
          resolvedAt: true,
          firstResponseAt: true,
          expectedResponseBy: true,
          slaBreached: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
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
          _count: {
            select: {
              updates: true,
              attachments: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.supportTicket.count({ where }),
    ])

    return NextResponse.json({
      tickets,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + tickets.length < totalCount,
      },
    })
  },
  { access: 'session' }
)

// POST /api/support/tickets - Create a new support ticket
//
// Intentionally `public` (ADR-0005 reviewed allow-list): guest support ticket
// creation is a designed feature (guestName/guestEmail/guestPhone). withApiAuth
// still resolves the session opportunistically, so an authenticated caller's
// ticket is bound to their (normalized) user id and validated workspace. This
// replaces the previous unawaited `normalizeUserId(session.user.id)` usage.
export const POST = withApiAuth(
  async (request, { user }) => {
    const body = await request.json()

    const {
      title,
      description,
      category = 'GENERAL',
      priority = 'MEDIUM',
      type = 'SUPPORT',
      tags = [],
      guestName,
      guestEmail,
      guestPhone,
      workspaceId,
    } = body

    // Validation
    if (!title || !description) {
      return jsonError(400, 'Title and description are required')
    }

    // For guest users, require contact info
    if (!user && (!guestName || !guestEmail)) {
      return jsonError(400, 'Guest name and email are required for non-logged-in users')
    }

    // Calculate expected response time based on priority
    const now = new Date()
    const expectedResponseBy = new Date(now)
    switch (priority) {
      case 'CRITICAL':
        expectedResponseBy.setHours(now.getHours() + 1) // 1 hour
        break
      case 'URGENT':
        expectedResponseBy.setHours(now.getHours() + 4) // 4 hours
        break
      case 'HIGH':
        expectedResponseBy.setHours(now.getHours() + 12) // 12 hours
        break
      case 'MEDIUM':
        expectedResponseBy.setDate(now.getDate() + 1) // 24 hours
        break
      case 'LOW':
        expectedResponseBy.setDate(now.getDate() + 3) // 3 days
        break
    }

    // Find available agent for auto-assignment
    const availableAgent = await prisma.supportAgent.findFirst({
      where: {
        isActive: true,
        isOnline: true,
        currentChatCount: {
          lt: prisma.supportAgent.fields.maxConcurrentChats,
        },
      },
      orderBy: {
        currentChatCount: 'asc', // Assign to agent with least workload
      },
    })

    const ticketData: any = {
      ticketNumber: generateTicketNumber(),
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      type,
      tags,
      expectedResponseBy,
      guestName: guestName?.trim(),
      guestEmail: guestEmail?.trim(),
      guestPhone: guestPhone?.trim(),
    }

    // Add user/workspace if authenticated
    if (user) {
      ticketData.userId = user.id
      if (workspaceId) {
        // Verify user has access to workspace
        const userWorkspace = await prisma.userWorkspace.findUnique({
          where: {
            userId_workspaceId: {
              userId: user.id,
              workspaceId,
            },
          },
        })
        if (userWorkspace) {
          ticketData.workspaceId = workspaceId
        }
      }
    }

    // Auto-assign if available agent found
    if (availableAgent) {
      ticketData.assignedAgentId = availableAgent.id
      ticketData.assignedAt = now
      ticketData.status = 'ASSIGNED'
    }

    const ticket = await prisma.supportTicket.create({
      data: ticketData,
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
    })

    // Create initial system update
    await prisma.ticketUpdate.create({
      data: {
        ticketId: ticket.id,
        updateType: 'SYSTEM_UPDATE',
        message: `Ticket created${availableAgent ? ` and assigned to ${availableAgent.displayName}` : ''}`,
        authorType: 'system',
        isPublic: true,
      },
    })

    return NextResponse.json(ticket, { status: 201 })
  },
  { access: 'public' }
)
