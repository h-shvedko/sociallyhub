import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

// GET /api/monitoring/alerts - Get active alerts
async function getHandler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has monitoring permissions (admin/owner)
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
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'monitoring-alerts')