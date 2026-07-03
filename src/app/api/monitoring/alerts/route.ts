import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

// GET /api/monitoring/alerts - Get active alerts
async function getHandler(request: NextRequest) {
  try {
    // System-wide monitoring data: require platform admin (ADR-0004)
    await requirePlatformAdmin()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active', 'resolved', 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {}
    if (status === 'active') {
      where.resolved = false
    } else if (status === 'resolved') {
      where.resolved = true
    }

    // Get alerts from database
    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit
    })

    const transformedAlerts = alerts.map(alert => ({
      id: alert.id,
      ruleId: alert.ruleId,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      timestamp: alert.timestamp,
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt,
      metadata: alert.metadata
    }))

    return NextResponse.json({
      alerts: transformedAlerts,
      totalCount: alerts.length,
      activeCount: alerts.filter(a => !a.resolved).length
    })

  } catch (error) {
    return handleApiError(error)
  }
}

export const GET = withLogging(getHandler, 'monitoring-alerts')