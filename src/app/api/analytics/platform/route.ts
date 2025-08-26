import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

// GET /api/analytics/platform - Get platform-wide analytics
async function getHandler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has analytics permissions (admin/owner)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get analytics data
    const [
      totalUsers,
      activeUsers,
      totalSessions,
      recentSessions,
      totalPosts,
      analyticsMetrics
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Active users (users with recent sessions)
      prisma.userSession.count({
        where: {
          lastActivity: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        distinct: ['userId']
      }),
      
      // Total sessions
      prisma.userSession.count({
        where: {
          startTime: { gte: startDate }
        }
      }),
      
      // Recent sessions for calculating avg duration
      prisma.userSession.findMany({
        where: {
          startTime: { gte: startDate },
          endTime: { not: null }
        },
        select: {
          duration: true
        }
      }),
      
      // Total posts created
      prisma.post.count({
        where: {
          createdAt: { gte: startDate }
        }
      }),
      
      // Analytics metrics
      prisma.analyticsMetric.findMany({
        where: {
          date: { gte: startDate }
        },
        select: {
          metricType: true,
          value: true,
          date: true
        }
      })
    ])

    // Calculate average session duration
    const avgSessionDuration = recentSessions.length > 0
      ? recentSessions.reduce((sum, session) => sum + (session.duration || 0), 0) / recentSessions.length
      : 0

    // Aggregate analytics metrics
    const metricSummary = analyticsMetrics.reduce((acc: any, metric) => {
      if (!acc[metric.metricType]) {
        acc[metric.metricType] = { total: 0, count: 0 }
      }
      acc[metric.metricType].total += metric.value
      acc[metric.metricType].count += 1
      return acc
    }, {})

    // Calculate derived metrics
    const pageViews = metricSummary.page_view?.total || totalPosts * 3 // Fallback estimate
    const apiRequests = metricSummary.api_request?.total || totalPosts * 5 // Fallback estimate

    const analyticsData = {
      totalUsers,
      activeUsers,
      totalSessions,
      avgSessionDuration: Math.round(avgSessionDuration),
      pageViews,
      apiRequests,
      postsCreated: totalPosts,
      errorRate: Math.round((Math.random() * 2) * 100) / 100, // Mock error rate
      responseTime: Math.round(200 + Math.random() * 200), // Mock response time
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days
      },
      metrics: metricSummary
    }

    return NextResponse.json(analyticsData)

  } catch (error) {
    console.error('Error fetching platform analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'analytics-platform')