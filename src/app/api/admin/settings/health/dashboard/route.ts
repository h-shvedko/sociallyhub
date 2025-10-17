import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/health/dashboard - Get comprehensive system dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

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

    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

    // Get system health overview
    const healthMetrics = await prisma.systemHealthMetric.findMany({
      where: {
        workspaceId: workspaceId || null,
        collectedAt: { gte: last24Hours }
      },
      orderBy: { collectedAt: 'desc' }
    })

    // System configuration status
    const configStats = await prisma.systemConfiguration.aggregate({
      where: { workspaceId: workspaceId || null },
      _count: { id: true }
    })

    // Integration status
    const integrationStats = await prisma.integrationSetting.groupBy({
      by: ['isActive', 'isConfigured'],
      where: { workspaceId: workspaceId || null },
      _count: { id: true }
    })

    // Feature flags status
    const flagStats = await prisma.featureFlag.groupBy({
      by: ['isActive', 'environment'],
      where: { workspaceId: workspaceId || null },
      _count: { id: true }
    })

    // Backup status (most recent)
    const lastBackup = await prisma.backupRecord.findFirst({
      where: {
        workspaceId: workspaceId || null,
        status: 'COMPLETED'
      },
      orderBy: { createdAt: 'desc' }
    })

    // Recent errors and alerts
    const recentErrors = await prisma.systemHealthMetric.count({
      where: {
        workspaceId: workspaceId || null,
        status: { in: ['CRITICAL', 'WARNING'] },
        collectedAt: { gte: lastHour }
      }
    })

    // Calculate system components status
    const getComponentStatus = (metrics: any[], component: string) => {
      const componentMetrics = metrics.filter(m =>
        m.category === component || m.source === component
      )

      if (componentMetrics.length === 0) {
        return { status: 'UNKNOWN', lastChecked: null, issues: 0 }
      }

      const latest = componentMetrics[0]
      const criticalCount = componentMetrics.filter(m => m.status === 'CRITICAL').length
      const warningCount = componentMetrics.filter(m => m.status === 'WARNING').length

      let status = 'HEALTHY'
      if (criticalCount > 0) status = 'CRITICAL'
      else if (warningCount > 0) status = 'WARNING'

      return {
        status,
        lastChecked: latest.collectedAt,
        issues: criticalCount + warningCount
      }
    }

    const components = {
      database: getComponentStatus(healthMetrics, 'DATABASE'),
      application: getComponentStatus(healthMetrics, 'APPLICATION'),
      security: getComponentStatus(healthMetrics, 'SECURITY'),
      performance: getComponentStatus(healthMetrics, 'PERFORMANCE'),
      network: getComponentStatus(healthMetrics, 'NETWORK')
    }

    // Calculate overall system health score
    const componentStatuses = Object.values(components).map(c => c.status)
    const healthyCount = componentStatuses.filter(s => s === 'HEALTHY').length
    const warningCount = componentStatuses.filter(s => s === 'WARNING').length
    const criticalCount = componentStatuses.filter(s => s === 'CRITICAL').length
    const totalComponents = componentStatuses.length

    const healthScore = totalComponents > 0
      ? Math.round(
          ((healthyCount * 100) + (warningCount * 50) + (criticalCount * 0)) / totalComponents
        )
      : 100

    // System overview
    const systemOverview = {
      overallStatus: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL',
      healthScore,
      uptime: '99.9%', // Mock uptime - in real implementation, calculate from actual data
      lastUpdated: healthMetrics[0]?.collectedAt || now,
      components
    }

    // Quick stats
    const quickStats = {
      configurations: configStats._count.id || 0,
      activeIntegrations: integrationStats
        .filter(stat => stat.isActive && stat.isConfigured)
        .reduce((sum, stat) => sum + stat._count.id, 0),
      activeFlags: flagStats
        .filter(stat => stat.isActive)
        .reduce((sum, stat) => sum + stat._count.id, 0),
      lastBackup: lastBackup?.createdAt || null,
      recentAlerts: recentErrors
    }

    // Recent activity
    const recentActivity = [
      {
        type: 'backup',
        message: lastBackup
          ? `Backup completed successfully (${lastBackup.fileSize} bytes)`
          : 'No recent backups found',
        timestamp: lastBackup?.createdAt || null,
        status: lastBackup ? 'success' : 'warning'
      },
      {
        type: 'health_check',
        message: `System health check completed - ${healthScore}% healthy`,
        timestamp: healthMetrics[0]?.collectedAt || now,
        status: healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'error'
      },
      {
        type: 'alerts',
        message: recentErrors > 0
          ? `${recentErrors} new alerts in the last hour`
          : 'No recent alerts',
        timestamp: now,
        status: recentErrors === 0 ? 'success' : 'warning'
      }
    ]

    // Performance metrics summary
    const performanceMetrics = healthMetrics
      .filter(m => m.category === 'PERFORMANCE')
      .slice(0, 10)
      .map(m => ({
        metric: m.metric,
        value: m.value,
        unit: m.unit,
        status: m.status,
        timestamp: m.collectedAt
      }))

    // Recommendations based on current status
    const recommendations = []

    if (healthScore < 80) {
      recommendations.push({
        type: 'warning',
        title: 'System Health Below Optimal',
        description: 'Several components are showing warnings or critical issues',
        action: 'Review component details and address critical issues'
      })
    }

    if (recentErrors > 5) {
      recommendations.push({
        type: 'critical',
        title: 'High Alert Volume',
        description: `${recentErrors} alerts generated in the last hour`,
        action: 'Investigate root cause of increased alert volume'
      })
    }

    if (!lastBackup || (now.getTime() - new Date(lastBackup.createdAt).getTime()) > 24 * 60 * 60 * 1000) {
      recommendations.push({
        type: 'warning',
        title: 'Backup Overdue',
        description: 'No successful backup in the last 24 hours',
        action: 'Run manual backup and check backup configuration'
      })
    }

    const inactiveIntegrations = integrationStats
      .filter(stat => !stat.isActive || !stat.isConfigured)
      .reduce((sum, stat) => sum + stat._count.id, 0)

    if (inactiveIntegrations > 0) {
      recommendations.push({
        type: 'info',
        title: 'Inactive Integrations',
        description: `${inactiveIntegrations} integrations are not active or configured`,
        action: 'Review integration settings and enable required services'
      })
    }

    return NextResponse.json({
      systemOverview,
      quickStats,
      recentActivity,
      performanceMetrics,
      recommendations,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch system dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system dashboard' },
      { status: 500 }
    )
  }
}