import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

// GET /api/analytics/platform - Get platform-wide analytics
async function getHandler(request: NextRequest) {
  try {
    // Platform-wide, cross-tenant aggregates: require platform admin (ADR-0004)
    await requirePlatformAdmin()

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
      
      // Active users (distinct users with recent sessions) — count() has no
      // `distinct`, so group by userId and take the group count.
      prisma.userSession.groupBy({
        by: ['userId'],
        where: {
          lastActivity: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }).then((groups) => groups.length),
      
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
          NOT: { endTime: null }
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
      // Per-platform errorRate/responseTime intentionally omitted (ADR-0023): real
      // per-platform error/latency will derive from PostVariant publish statuses once
      // ADR-0008/0009 live posting exists — never fabricated from random numbers.
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days
      },
      metrics: metricSummary
    }

    return NextResponse.json(analyticsData)

  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withLogging(getHandler, 'analytics-platform')