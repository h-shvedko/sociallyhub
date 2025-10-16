import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Generate unique ticket number
function generateTicketNumber(): string {
  const timestamp = Date.now().toString().slice(-8)
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `TICK-${timestamp}${random}`
}

// GET /api/support/tickets - List support tickets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const assignedAgentId = searchParams.get('assignedAgentId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    // If user is logged in, show their tickets and workspace tickets they have access to
    if (session?.user?.id) {
      const userId = normalizeUserId(session.user.id)

      // Get user's workspaces
      const userWorkspaces = await prisma.userWorkspace.findMany({
        where: { userId },
        select: { workspaceId: true }
      })

      const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

      where.OR = [
        { userId }, // User's own tickets
        { workspaceId: { in: workspaceIds } } // Workspace tickets
      ]
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
          _count: {
            select: {
              updates: true,
              attachments: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.supportTicket.count({ where })
    ])

    return NextResponse.json({
      tickets,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + tickets.length < totalCount
      }
    })

  } catch (error) {
    console.error('Failed to fetch support tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}

// POST /api/support/tickets - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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
      workspaceId
    } = body

    // Validation
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // For guest users, require contact info
    if (!session?.user?.id && (!guestName || !guestEmail)) {
      return NextResponse.json(
        { error: 'Guest name and email are required for non-logged-in users' },
        { status: 400 }
      )
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
          lt: prisma.supportAgent.fields.maxConcurrentChats
        }
      },
      orderBy: {
        currentChatCount: 'asc' // Assign to agent with least workload
      }
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
      guestPhone: guestPhone?.trim()
    }

    // Add user/workspace if authenticated
    if (session?.user?.id) {
      ticketData.userId = normalizeUserId(session.user.id)
      if (workspaceId) {
        // Verify user has access to workspace
        const userWorkspace = await prisma.userWorkspace.findUnique({
          where: {
            userId_workspaceId: {
              userId: normalizeUserId(session.user.id),
              workspaceId
            }
          }
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
    })

    // Create initial system update
    await prisma.ticketUpdate.create({
      data: {
        ticketId: ticket.id,
        updateType: 'SYSTEM_UPDATE',
        message: `Ticket created${availableAgent ? ` and assigned to ${availableAgent.displayName}` : ''}`,
        authorType: 'system',
        isPublic: true
      }
    })

    return NextResponse.json(ticket, { status: 201 })

  } catch (error) {
    console.error('Failed to create support ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create support ticket' },
      { status: 500 }
    )
  }
}