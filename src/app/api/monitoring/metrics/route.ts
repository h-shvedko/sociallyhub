import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { getHttpSummary } from '@/lib/observability/metrics'

// GET /api/monitoring/metrics - Get system metrics
async function getHandler(request: NextRequest) {
  try {
    // System-wide metrics: require platform admin (ADR-0004)
    await requirePlatformAdmin()

    // Calculate metrics
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get recent posts (API activity indicator)
    const recentPosts = await prisma.post.count({
      where: {
        createdAt: { gte: oneHourAgo }
      }
    })

    // Get user activity (session activity)
    const activeUsers = await prisma.userSession.count({
      where: {
        lastActivity: { gte: new Date(now.getTime() - 15 * 60 * 1000) }, // Last 15 minutes
        endTime: null
      }
    })

    // Get total users
    const totalUsers = await prisma.user.count()

    // Honest HTTP stats (ADR-0023): errorRate (5xx share) and avgResponseTime
    // are derived from THIS instance's prom-client http_* series — the real
    // replacement for the deleted random-number fabrications. Per-instance by
    // design; fleet-wide numbers come from querying Prometheus. Returns null
    // until at least one request has been recorded, so callers render "—"
    // rather than a fabricated 0.
    const httpSummary = await getHttpSummary()

    // Database health check
    let dbStatus = 'Connected'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      dbStatus = 'Disconnected'
    }

    const metrics = {
      // Derived from the real DB probe rather than hardcoded.
      systemStatus: dbStatus === 'Connected' ? 'Healthy' : 'Degraded',
      // uptime is now NUMERIC SECONDS this instance has been running
      // (process.uptime()) — the fabricated hardcoded-percentage string is gone.
      uptime: Math.round(process.uptime()),
      // null when no requests recorded yet (honest "no data"), never a fake 0.
      avgResponseTime: httpSummary ? httpSummary.avgResponseTimeMs : null,
      errorRate: httpSummary ? httpSummary.errorRate : null,
      totalRequests: httpSummary ? httpSummary.totalRequests : null,
      dbStatus,
      activeUsers,
      totalUsers,
      recentActivity: recentPosts,
      timestamp: now.toISOString()
    }

    return NextResponse.json(metrics)

  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withLogging(getHandler, 'monitoring-metrics')