import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/support/tickets - List all tickets with filtering, search, and sorting
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)

    // Query parameters
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const assignedAgentId = searchParams.get('assignedAgentId')
    const department = searchParams.get('department')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'createdAt'
    const order = searchParams.get('order') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const timeRange = searchParams.get('timeRange') // 1d, 7d, 30d, 90d

    // Verify user has admin permissions
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

    // Build where clause
    const where: any = {
      OR: [
        { workspaceId: { in: workspaceIds } },
        { workspaceId: null } // Global tickets
      ]
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (priority && priority !== 'all') {
      where.priority = priority
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (assignedAgentId && assignedAgentId !== 'all') {
      if (assignedAgentId === 'unassigned') {
        where.assignedAgentId = null
      } else {
        where.assignedAgentId = assignedAgentId
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { guestName: { contains: search, mode: 'insensitive' } },
        { guestEmail: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (timeRange) {
      const now = new Date()
      let startDate: Date

      switch (timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }

      where.createdAt = { gte: startDate }
    }

    // Department filtering
    if (department && department !== 'all') {
      where.assignedAgent = {
        department: department
      }
    }

    // Build order by clause
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'title', 'ticketNumber']
    const sortField = validSortFields.includes(sort) ? sort : 'createdAt'
    const orderBy = { [sortField]: order === 'asc' ? 'asc' : 'desc' }

    // Execute queries in parallel
    const [tickets, totalCount, statusStats, priorityStats, categoryStats] = await Promise.all([
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
          firstResponseAt: true,
          expectedResponseBy: true,
          slaBreached: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
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
              attachments: true,
              notes: true
            }
          }
        },
        orderBy,
        take: limit,
        skip: offset
      }),

      prisma.supportTicket.count({ where }),

      // Status statistics
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: {
          OR: [
            { workspaceId: { in: workspaceIds } },
            { workspaceId: null }
          ]
        },
        _count: {
          status: true
        }
      }),

      // Priority statistics
      prisma.supportTicket.groupBy({
        by: ['priority'],
        where: {
          OR: [
            { workspaceId: { in: workspaceIds } },
            { workspaceId: null }
          ]
        },
        _count: {
          priority: true
        }
      }),

      // Category statistics
      prisma.supportTicket.groupBy({
        by: ['category'],
        where: {
          OR: [
            { workspaceId: { in: workspaceIds } },
            { workspaceId: null }
          ]
        },
        _count: {
          category: true
        }
      })
    ])

    // Get agent statistics
    const agentStats = await prisma.supportAgent.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        displayName: true,
        department: true,
        isOnline: true,
        currentChatCount: true,
        _count: {
          select: {
            assignedTickets: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] }
              }
            }
          }
        }
      }
    })

    return NextResponse.json({
      tickets,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + tickets.length < totalCount
      },
      statistics: {
        byStatus: statusStats,
        byPriority: priorityStats,
        byCategory: categoryStats,
        agents: agentStats
      }
    })

  } catch (error) {
    console.error('Failed to fetch admin tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    )
  }
}

// POST /api/admin/support/tickets - Create new ticket (admin only)
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
      title,
      description,
      category = 'GENERAL',
      priority = 'MEDIUM',
      type = 'SUPPORT',
      workspaceId,
      assignedAgentId,
      guestName,
      guestEmail,
      guestPhone,
      tags = [],
      expectedResponseBy
    } = body

    // Validation
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      )
    }

    // Verify admin permissions
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId
          }
        }
      })

      if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    // Generate ticket number
    const ticketCount = await prisma.supportTicket.count()
    const ticketNumber = `TICK-${String(ticketCount + 1).padStart(8, '0')}`

    // Create ticket
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        type,
        workspaceId,
        assignedAgentId,
        guestName: guestName?.trim(),
        guestEmail: guestEmail?.trim(),
        guestPhone: guestPhone?.trim(),
        tags,
        expectedResponseBy: expectedResponseBy ? new Date(expectedResponseBy) : undefined,
        assignedAt: assignedAgentId ? new Date() : undefined
      },
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

    // Create assignment record if agent assigned
    if (assignedAgentId) {
      await prisma.supportTicketAssignment.create({
        data: {
          ticketId: ticket.id,
          agentId: assignedAgentId,
          assignedBy: userId,
          reason: 'Initial assignment by admin'
        }
      })

      // Create ticket update
      await prisma.ticketUpdate.create({
        data: {
          ticketId: ticket.id,
          updateType: 'ASSIGNMENT',
          message: `Ticket assigned to agent`,
          newAssignee: assignedAgentId,
          authorId: userId,
          authorType: 'admin',
          authorName: session.user.name || 'Admin',
          isPublic: false
        }
      })
    }

    // Create initial ticket update
    await prisma.ticketUpdate.create({
      data: {
        ticketId: ticket.id,
        updateType: 'CREATED',
        message: `Ticket created by admin`,
        authorId: userId,
        authorType: 'admin',
        authorName: session.user.name || 'Admin',
        isPublic: false
      }
    })

    return NextResponse.json(ticket, { status: 201 })

  } catch (error) {
    console.error('Failed to create admin ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    )
  }
}