import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { subDays, subMonths, format, startOfDay, endOfDay } from 'date-fns'

// GET /api/analytics/performance - Get performance comparison data
async function getHandler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Normalize user ID for consistency with legacy sessions
    const userId = await normalizeUserId(session.user.id)

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const comparisonType = searchParams.get('comparisonType') || 'previous'
    
    // Calculate date ranges based on period
    const now = new Date()
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date
    
    switch (period) {
      case 'week':
        currentStart = subDays(now, 7)
        currentEnd = now
        previousStart = subDays(now, 14)
        previousEnd = subDays(now, 7)
        break
      case 'quarter':
        currentStart = subMonths(now, 3)
        currentEnd = now
        previousStart = subMonths(now, 6)
        previousEnd = subMonths(now, 3)
        break
      case 'year':
        currentStart = subMonths(now, 12)
        currentEnd = now
        previousStart = subMonths(now, 24)
        previousEnd = subMonths(now, 12)
        break
      default: // month
        currentStart = subMonths(now, 1)
        currentEnd = now
        previousStart = subMonths(now, 2)
        previousEnd = subMonths(now, 1)
        break
    }

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true }
    })
    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Parallel queries for current and previous periods
    const [
      currentUsers,
      previousUsers,
      currentSessions,
      previousSessions,
      currentPosts,
      previousPosts,
      currentMetrics,
      previousMetrics,
      currentTrendData,
      previousTrendData
    ] = await Promise.all([
      // Current period users
      prisma.user.count({
        where: {
          workspaces: {
            some: {
              workspaceId: { in: workspaceIds }
            }
          },
          createdAt: { gte: currentStart, lte: currentEnd }
        }
      }),
      
      // Previous period users
      prisma.user.count({
        where: {
          workspaces: {
            some: {
              workspaceId: { in: workspaceIds }
            }
          },
          createdAt: { gte: previousStart, lte: previousEnd }
        }
      }),
      
      // Current sessions
      prisma.userSession.count({
        where: {
          startTime: { gte: currentStart, lte: currentEnd }
        }
      }),
      
      // Previous sessions
      prisma.userSession.count({
        where: {
          startTime: { gte: previousStart, lte: previousEnd }
        }
      }),
      
      // Current posts
      prisma.post.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: currentStart, lte: currentEnd }
        },
        include: {
          metrics: {
            where: {
              metricType: { in: ['likes', 'comments', 'shares', 'reach', 'impressions'] }
            }
          }
        }
      }),
      
      // Previous posts
      prisma.post.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: previousStart, lte: previousEnd }
        },
        include: {
          metrics: {
            where: {
              metricType: { in: ['likes', 'comments', 'shares', 'reach', 'impressions'] }
            }
          }
        }
      }),
      
      // Current analytics metrics
      prisma.analyticsMetric.findMany({
        where: {
          userId,
          date: { gte: currentStart, lte: currentEnd },
          metricType: { in: ['page_view', 'session', 'engagement'] }
        }
      }),
      
      // Previous analytics metrics
      prisma.analyticsMetric.findMany({
        where: {
          userId,
          date: { gte: previousStart, lte: previousEnd },
          metricType: { in: ['page_view', 'session', 'engagement'] }
        }
      }),
      
      // Current trend data (daily breakdown)
      generateTrendData(userId, workspaceIds, currentStart, currentEnd),
      
      // Previous trend data (daily breakdown)
      generateTrendData(userId, workspaceIds, previousStart, previousEnd)
    ])

    // Calculate metrics for both periods
    const currentPostMetrics = aggregatePostMetrics(currentPosts)
    const previousPostMetrics = aggregatePostMetrics(previousPosts)
    
    const currentPageViews = currentMetrics
      .filter(m => m.metricType === 'page_view')
      .reduce((sum, m) => sum + m.value, 0)
    
    const previousPageViews = previousMetrics
      .filter(m => m.metricType === 'page_view')
      .reduce((sum, m) => sum + m.value, 0)

    // Create comparison metrics
    const metrics = [
      {
        metric: 'Total Users',
        current: currentUsers,
        previous: previousUsers,
        unit: '',
        icon: 'Users'
      },
      {
        metric: 'Active Sessions',
        current: currentSessions,
        previous: previousSessions,
        unit: '',
        icon: 'Activity'
      },
      {
        metric: 'Posts Created',
        current: currentPosts.length,
        previous: previousPosts.length,
        unit: '',
        icon: 'BarChart3'
      },
      {
        metric: 'Page Views',
        current: currentPageViews,
        previous: previousPageViews,
        unit: '',
        icon: 'Eye'
      },
      {
        metric: 'Total Engagement',
        current: currentPostMetrics.totalEngagements,
        previous: previousPostMetrics.totalEngagements,
        unit: '',
        icon: 'Heart'
      },
      {
        metric: 'Reach',
        current: currentPostMetrics.reach,
        previous: previousPostMetrics.reach,
        unit: '',
        icon: 'TrendingUp'
      }
    ].map(metric => {
      const change = metric.current - metric.previous
      const changePercent = metric.previous > 0 ? (change / metric.previous) * 100 : 0
      return {
        ...metric,
        change,
        changePercent: Math.round(changePercent * 10) / 10,
        trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
      }
    })

    return NextResponse.json({
      metrics,
      trendData: {
        current: currentTrendData,
        previous: previousTrendData
      },
      periods: {
        current: {
          label: getPeriodLabel(period, 'current'),
          start: currentStart.toISOString(),
          end: currentEnd.toISOString()
        },
        previous: {
          label: getPeriodLabel(period, 'previous'),
          start: previousStart.toISOString(),
          end: previousEnd.toISOString()
        }
      },
      lastUpdated: now.toISOString()
    })

  } catch (error) {
    console.error('Error fetching performance analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to aggregate post metrics
function aggregatePostMetrics(posts: any[]) {
  return posts.reduce((acc, post) => {
    post.metrics.forEach((metric: any) => {
      if (metric.metricType === 'likes' || metric.metricType === 'comments' || metric.metricType === 'shares') {
        acc.totalEngagements += metric.value
      } else if (metric.metricType === 'reach') {
        acc.reach += metric.value
      }
    })
    return acc
  }, { totalEngagements: 0, reach: 0 })
}

// Helper function to generate trend data
async function generateTrendData(userId: string, workspaceIds: string[], startDate: Date, endDate: Date) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  return Promise.all(
    Array.from({ length: days }, async (_, i) => {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)

      // Get daily metrics
      const [posts, metrics] = await Promise.all([
        prisma.post.count({
          where: {
            workspaceId: { in: workspaceIds },
            createdAt: { gte: dayStart, lte: dayEnd }
          }
        }),
        prisma.analyticsMetric.findMany({
          where: {
            userId,
            date: { gte: dayStart, lte: dayEnd }
          }
        })
      ])

      const pageViews = metrics
        .filter(m => m.metricType === 'page_view')
        .reduce((sum, m) => sum + m.value, 0)

      return {
        date: format(date, 'MMM dd'),
        posts,
        pageViews,
        sessions: metrics.filter(m => m.metricType === 'session').length
      }
    })
  )
}

// Helper function to get period labels
function getPeriodLabel(period: string, type: 'current' | 'previous'): string {
  const labels = {
    week: type === 'current' ? 'This Week' : 'Last Week',
    month: type === 'current' ? 'This Month' : 'Last Month',
    quarter: type === 'current' ? 'This Quarter' : 'Last Quarter',
    year: type === 'current' ? 'This Year' : 'Last Year'
  }
  return labels[period as keyof typeof labels] || labels.month
}

export const GET = withLogging(getHandler, 'analytics-performance')