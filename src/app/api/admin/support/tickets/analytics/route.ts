import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/support/tickets/analytics - Get comprehensive ticket analytics
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
    const timeRange = searchParams.get('timeRange') || '30d' // 1d, 7d, 30d, 90d
    const department = searchParams.get('department')
    const agentId = searchParams.get('agentId')

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

    // Calculate date range
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

    // Base where clause
    const baseWhere: any = {
      OR: [
        { workspaceId: { in: workspaceIds } },
        { workspaceId: null }
      ],
      createdAt: { gte: startDate }
    }

    // Add filters
    if (department && department !== 'all') {
      baseWhere.assignedAgent = {
        department: department
      }
    }

    if (agentId && agentId !== 'all') {
      baseWhere.assignedAgentId = agentId
    }

    // Execute all analytics queries in parallel
    const [
      totalTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory,
      ticketsByDepartment,
      avgResponseTime,
      avgResolutionTime,
      slaBreaches,
      agentPerformance,
      dailyVolume,
      satisfactionRatings
    ] = await Promise.all([
      // Total tickets
      prisma.supportTicket.count({ where: baseWhere }),

      // Tickets by status
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true }
      }),

      // Tickets by priority
      prisma.supportTicket.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { priority: true }
      }),

      // Tickets by category
      prisma.supportTicket.groupBy({
        by: ['category'],
        where: baseWhere,
        _count: { category: true }
      }),

      // Tickets by department
      prisma.supportTicket.groupBy({
        by: ['assignedAgentId'],
        where: {
          ...baseWhere,
          assignedAgentId: { not: null }
        },
        _count: { assignedAgentId: true }
      }),

      // Average response time
      prisma.supportTicket.findMany({
        where: {
          ...baseWhere,
          firstResponseAt: { not: null }
        },
        select: {
          createdAt: true,
          firstResponseAt: true
        }
      }),

      // Average resolution time
      prisma.supportTicket.findMany({
        where: {
          ...baseWhere,
          resolvedAt: { not: null }
        },
        select: {
          createdAt: true,
          resolvedAt: true
        }
      }),

      // SLA breaches
      prisma.supportTicket.count({
        where: {
          ...baseWhere,
          slaBreached: true
        }
      }),

      // Agent performance
      prisma.supportAgent.findMany({
        where: {
          isActive: true,
          ...(department && department !== 'all' ? { department } : {})
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
                  createdAt: { gte: startDate },
                  OR: [
                    { workspaceId: { in: workspaceIds } },
                    { workspaceId: null }
                  ]
                }
              }
            }
          }
        }
      }),

      // Daily ticket volume
      prisma.$queryRaw`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved_count
        FROM support_tickets
        WHERE created_at >= ${startDate}
          AND (workspace_id = ANY(${workspaceIds}) OR workspace_id IS NULL)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `,

      // Mock satisfaction ratings (would be real in production)
      Promise.resolve([
        { rating: 5, count: 42 },
        { rating: 4, count: 28 },
        { rating: 3, count: 12 },
        { rating: 2, count: 5 },
        { rating: 1, count: 3 }
      ])
    ])

    // Calculate response time metrics
    const responseTimes = avgResponseTime
      .filter(t => t.firstResponseAt)
      .map(t => {
        const responseTime = t.firstResponseAt!.getTime() - t.createdAt.getTime()
        return responseTime / (1000 * 60 * 60) // Convert to hours
      })

    const avgResponseHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0

    // Calculate resolution time metrics
    const resolutionTimes = avgResolutionTime
      .filter(t => t.resolvedAt)
      .map(t => {
        const resolutionTime = t.resolvedAt!.getTime() - t.createdAt.getTime()
        return resolutionTime / (1000 * 60 * 60 * 24) // Convert to days
      })

    const avgResolutionDays = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0

    // Prepare department stats
    const departmentStats = await Promise.all(
      (await prisma.supportAgent.groupBy({
        by: ['department'],
        where: { isActive: true },
        _count: { department: true }
      })).map(async (dept) => {
        const ticketCount = await prisma.supportTicket.count({
          where: {
            ...baseWhere,
            assignedAgent: {
              department: dept.department
            }
          }
        })

        return {
          department: dept.department,
          agentCount: dept._count.department,
          ticketCount
        }
      })
    )

    // Calculate SLA metrics
    const slaPerformance = {
      totalTickets,
      slaBreaches,
      slaCompliance: totalTickets > 0 ? ((totalTickets - slaBreaches) / totalTickets) * 100 : 100,
      avgResponseTime: avgResponseHours,
      avgResolutionTime: avgResolutionDays
    }

    // Top categories and priorities
    const topCategories = ticketsByCategory
      .sort((a, b) => b._count.category - a._count.category)
      .slice(0, 5)

    const priorityDistribution = ticketsByPriority.map(p => ({
      priority: p.priority,
      count: p._count.priority,
      percentage: totalTickets > 0 ? (p._count.priority / totalTickets) * 100 : 0
    }))

    return NextResponse.json({
      overview: {
        totalTickets,
        avgResponseTime: avgResponseHours,
        avgResolutionTime: avgResolutionDays,
        slaCompliance: slaPerformance.slaCompliance
      },
      distribution: {
        byStatus: ticketsByStatus,
        byPriority: priorityDistribution,
        byCategory: topCategories,
        byDepartment: departmentStats
      },
      performance: {
        sla: slaPerformance,
        agents: agentPerformance,
        satisfaction: satisfactionRatings
      },
      trends: {
        dailyVolume,
        timeRange: {
          start: startDate,
          end: now,
          label: timeRange
        }
      }
    })

  } catch (error) {
    console.error('Failed to fetch ticket analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}