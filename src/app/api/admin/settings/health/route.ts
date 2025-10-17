import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/health - Get system health metrics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const timeRange = searchParams.get('timeRange') || '24h'
    const includeGlobal = searchParams.get('includeGlobal') === 'true'

    // Check permissions if workspace-specific
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Calculate time range
    const getTimeFilter = (range: string) => {
      const now = new Date()
      switch (range) {
        case '1h':
          return new Date(now.getTime() - 60 * 60 * 1000)
        case '6h':
          return new Date(now.getTime() - 6 * 60 * 60 * 1000)
        case '24h':
          return new Date(now.getTime() - 24 * 60 * 60 * 1000)
        case '7d':
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        case '30d':
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        default:
          return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }
    }

    const startTime = getTimeFilter(timeRange)

    // Build where clause
    const where: any = {
      collectedAt: { gte: startTime }
    }

    if (workspaceId) {
      if (includeGlobal) {
        where.OR = [
          { workspaceId: workspaceId },
          { workspaceId: null }
        ]
      } else {
        where.workspaceId = workspaceId
      }
    } else if (!includeGlobal) {
      where.workspaceId = null
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    // Get health metrics
    const metrics = await prisma.systemHealthMetric.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true }
        }
      },
      orderBy: { collectedAt: 'desc' },
      take: 1000 // Limit to prevent excessive data
    })

    // Group metrics by category and metric type
    const metricsByCategory = metrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = {}
      }
      if (!acc[metric.category][metric.metric]) {
        acc[metric.category][metric.metric] = []
      }
      acc[metric.category][metric.metric].push(metric)
      return acc
    }, {} as Record<string, Record<string, any[]>>)

    // Calculate current status for each metric
    const currentStatus = Object.entries(metricsByCategory).reduce((acc, [category, categoryMetrics]) => {
      acc[category] = {}
      Object.entries(categoryMetrics).forEach(([metricName, metricData]) => {
        const latest = metricData[0] // Most recent
        acc[category][metricName] = {
          value: latest.value,
          unit: latest.unit,
          status: latest.status,
          trend: latest.trend,
          lastUpdated: latest.collectedAt,
          threshold: latest.threshold,
          criticalThreshold: latest.criticalThreshold,
          isAnomaly: latest.isAnomaly,
          source: latest.source
        }
      })
      return acc
    }, {} as Record<string, Record<string, any>>)

    // Calculate overall health statistics
    const stats = {
      totalMetrics: metrics.length,
      categories: Object.keys(metricsByCategory).length,
      healthyMetrics: metrics.filter(m => m.status === 'HEALTHY').length,
      warningMetrics: metrics.filter(m => m.status === 'WARNING').length,
      criticalMetrics: metrics.filter(m => m.status === 'CRITICAL').length,
      anomalies: metrics.filter(m => m.isAnomaly).length,
      lastCollected: metrics[0]?.collectedAt || null,
      timeRange: timeRange
    }

    // Calculate system health score (0-100)
    const totalStatusMetrics = stats.healthyMetrics + stats.warningMetrics + stats.criticalMetrics
    const healthScore = totalStatusMetrics > 0
      ? Math.round(
          ((stats.healthyMetrics * 1.0) + (stats.warningMetrics * 0.5) + (stats.criticalMetrics * 0.0)) /
          totalStatusMetrics * 100
        )
      : 100

    return NextResponse.json({
      currentStatus,
      metrics: metricsByCategory,
      stats: {
        ...stats,
        healthScore
      },
      timeRange,
      total: metrics.length
    })

  } catch (error) {
    console.error('Failed to fetch system health metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system health metrics' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/health - Record system health metric
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      workspaceId,
      category,
      metric,
      value,
      unit,
      threshold,
      criticalThreshold,
      tags,
      metadata,
      source,
      collectedAt
    } = body

    // Validate required fields
    if (!category || !metric || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: category, metric, value' },
        { status: 400 }
      )
    }

    // Check permissions if workspace-specific
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Validate category
    const validCategories = [
      'SYSTEM', 'APPLICATION', 'DATABASE', 'SECURITY', 'PERFORMANCE',
      'AVAILABILITY', 'ERRORS', 'CAPACITY', 'NETWORK', 'INTEGRATION', 'USER_EXPERIENCE'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Calculate status based on thresholds
    let status = 'HEALTHY'
    if (criticalThreshold !== undefined && value >= criticalThreshold) {
      status = 'CRITICAL'
    } else if (threshold !== undefined && value >= threshold) {
      status = 'WARNING'
    }

    // Get previous value for trend calculation
    const previousMetric = await prisma.systemHealthMetric.findFirst({
      where: {
        workspaceId: workspaceId || null,
        category,
        metric
      },
      orderBy: { collectedAt: 'desc' }
    })

    let trend = null
    let changePercent = null
    let isAnomaly = false

    if (previousMetric) {
      const change = value - previousMetric.value
      changePercent = previousMetric.value !== 0 ? (change / previousMetric.value) * 100 : 0

      if (Math.abs(changePercent) < 5) {
        trend = 'STABLE'
      } else if (change > 0) {
        trend = 'DEGRADING' // Assuming higher values are worse
      } else {
        trend = 'IMPROVING'
      }

      // Simple anomaly detection (value is more than 50% different from previous)
      isAnomaly = Math.abs(changePercent) > 50
    }

    // Create health metric
    const healthMetric = await prisma.systemHealthMetric.create({
      data: {
        workspaceId: workspaceId || null,
        category,
        metric,
        value,
        unit,
        status,
        threshold,
        criticalThreshold,
        trend,
        previousValue: previousMetric?.value,
        changePercent,
        isAnomaly,
        tags,
        metadata,
        source,
        collectedAt: collectedAt ? new Date(collectedAt) : new Date()
      },
      include: {
        workspace: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({ metric: healthMetric }, { status: 201 })

  } catch (error) {
    console.error('Failed to record system health metric:', error)
    return NextResponse.json(
      { error: 'Failed to record system health metric' },
      { status: 500 }
    )
  }
}