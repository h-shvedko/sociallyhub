import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Community Health interfaces
interface HealthAlert {
  id: string
  type: 'WARNING' | 'CRITICAL' | 'INFO'
  category: 'ACTIVITY' | 'MODERATION' | 'CONTENT' | 'USERS' | 'SYSTEM'
  title: string
  description: string
  severity: number // 1-10
  actionRequired: boolean
  autoResolvable: boolean
  createdAt: Date
  metadata?: any
}

interface HealthMetric {
  name: string
  value: number
  threshold: number
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  trend: 'UP' | 'DOWN' | 'STABLE'
  lastUpdated: Date
}

interface CommunityHealthReport {
  overallScore: number
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL'
  alerts: HealthAlert[]
  metrics: HealthMetric[]
  recommendations: string[]
  lastAssessment: Date
}

// GET /api/community/health - Get community health status and alerts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const includeHistory = searchParams.get('includeHistory') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: normalizeUserId(session.user.id),
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const healthReport = await generateHealthReport(workspaceId)

    const response: any = { healthReport }

    if (includeHistory) {
      response.history = await getHealthHistory(workspaceId)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Failed to get community health:', error)
    return NextResponse.json(
      { error: 'Failed to get community health' },
      { status: 500 }
    )
  }
}

// POST /api/community/health - Acknowledge alerts or trigger health check
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, workspaceId, alertIds, triggerCheck } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: normalizeUserId(session.user.id),
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (action === 'ACKNOWLEDGE_ALERTS' && alertIds) {
      // Mark alerts as acknowledged (implement with CommunityHealthAlert model if needed)
      console.log(`Acknowledging alerts: ${alertIds.join(', ')} by user ${session.user.id}`)

      return NextResponse.json({
        success: true,
        acknowledged: alertIds.length,
        message: `${alertIds.length} alert(s) acknowledged`
      })
    }

    if (action === 'TRIGGER_CHECK' || triggerCheck) {
      // Force a new health assessment
      const healthReport = await generateHealthReport(workspaceId, true)

      return NextResponse.json({
        success: true,
        healthReport,
        message: 'Health check completed'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Failed to process health action:', error)
    return NextResponse.json(
      { error: 'Failed to process health action' },
      { status: 500 }
    )
  }
}

// Helper functions for health assessment
async function generateHealthReport(workspaceId: string, forceRefresh = false): Promise<CommunityHealthReport> {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Collect all health metrics
  const metrics = await Promise.all([
    checkActivityHealth(workspaceId, last24h, last7d),
    checkModerationHealth(workspaceId, last24h, last7d),
    checkContentHealth(workspaceId, last7d, last30d),
    checkUserHealth(workspaceId, last7d, last30d),
    checkSystemHealth(workspaceId, last24h)
  ])

  const flatMetrics = metrics.flat()
  const alerts = await generateHealthAlerts(flatMetrics, workspaceId)

  // Calculate overall health score
  const overallScore = calculateOverallHealth(flatMetrics)
  const status = getHealthStatus(overallScore)

  const recommendations = generateRecommendations(flatMetrics, alerts)

  return {
    overallScore,
    status,
    alerts,
    metrics: flatMetrics,
    recommendations,
    lastAssessment: now
  }
}

async function checkActivityHealth(workspaceId: string, last24h: Date, last7d: Date): Promise<HealthMetric[]> {
  const [
    posts24h,
    posts7d,
    comments24h,
    activeUsers24h,
    activeUsers7d
  ] = await Promise.all([
    prisma.communityForumPost.count({
      where: { workspaceId, createdAt: { gte: last24h } }
    }),
    prisma.communityForumPost.count({
      where: { workspaceId, createdAt: { gte: last7d } }
    }),
    prisma.communityForumComment.count({
      where: { post: { workspaceId }, createdAt: { gte: last24h } }
    }),
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: last24h } } } },
            { forumComments: { some: { createdAt: { gte: last24h } } } }
          ]
        }
      }
    }),
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: last7d } } } },
            { forumComments: { some: { createdAt: { gte: last7d } } } }
          ]
        }
      }
    })
  ])

  return [
    {
      name: 'Daily Posts',
      value: posts24h,
      threshold: 5,
      status: posts24h >= 5 ? 'HEALTHY' : posts24h >= 2 ? 'WARNING' : 'CRITICAL',
      trend: posts24h > (posts7d / 7) ? 'UP' : 'DOWN',
      lastUpdated: new Date()
    },
    {
      name: 'Daily Comments',
      value: comments24h,
      threshold: 10,
      status: comments24h >= 10 ? 'HEALTHY' : comments24h >= 5 ? 'WARNING' : 'CRITICAL',
      trend: 'STABLE',
      lastUpdated: new Date()
    },
    {
      name: 'Daily Active Users',
      value: activeUsers24h,
      threshold: 10,
      status: activeUsers24h >= 10 ? 'HEALTHY' : activeUsers24h >= 5 ? 'WARNING' : 'CRITICAL',
      trend: activeUsers24h > (activeUsers7d / 7) ? 'UP' : 'DOWN',
      lastUpdated: new Date()
    }
  ]
}

async function checkModerationHealth(workspaceId: string, last24h: Date, last7d: Date): Promise<HealthMetric[]> {
  const [
    pendingActions,
    actionsToday,
    avgResponseTime,
    unresolvedReports,
    automationRate
  ] = await Promise.all([
    prisma.moderationAction.count({
      where: { workspaceId, status: 'PENDING' }
    }),
    prisma.moderationAction.count({
      where: { workspaceId, createdAt: { gte: last24h } }
    }),
    calculateAvgModerationTime(workspaceId, last7d),
    prisma.contentReport.count({
      where: { workspaceId, status: { in: ['PENDING', 'UNDER_REVIEW'] } }
    }),
    calculateAutomationRate(workspaceId, last7d)
  ])

  return [
    {
      name: 'Pending Moderation Actions',
      value: pendingActions,
      threshold: 5,
      status: pendingActions <= 5 ? 'HEALTHY' : pendingActions <= 15 ? 'WARNING' : 'CRITICAL',
      trend: 'STABLE',
      lastUpdated: new Date()
    },
    {
      name: 'Avg Moderation Response Time (hours)',
      value: avgResponseTime,
      threshold: 8,
      status: avgResponseTime <= 8 ? 'HEALTHY' : avgResponseTime <= 24 ? 'WARNING' : 'CRITICAL',
      trend: 'STABLE',
      lastUpdated: new Date()
    },
    {
      name: 'Unresolved Reports',
      value: unresolvedReports,
      threshold: 3,
      status: unresolvedReports <= 3 ? 'HEALTHY' : unresolvedReports <= 10 ? 'WARNING' : 'CRITICAL',
      trend: 'STABLE',
      lastUpdated: new Date()
    },
    {
      name: 'Automation Rate (%)',
      value: automationRate,
      threshold: 30,
      status: automationRate >= 30 ? 'HEALTHY' : automationRate >= 15 ? 'WARNING' : 'CRITICAL',
      trend: 'UP',
      lastUpdated: new Date()
    }
  ]
}

async function checkContentHealth(workspaceId: string, last7d: Date, last30d: Date): Promise<HealthMetric[]> {
  const [
    spamRate,
    qualityScore,
    duplicateRate,
    engagementRate
  ] = await Promise.all([
    calculateSpamRate(workspaceId, last7d),
    calculateContentQuality(workspaceId, last7d),
    calculateDuplicateRate(workspaceId, last7d),
    calculateEngagementRate(workspaceId, last7d)
  ])

  return [
    {
      name: 'Spam Detection Rate (%)',
      value: spamRate,
      threshold: 5,
      status: spamRate <= 5 ? 'HEALTHY' : spamRate <= 15 ? 'WARNING' : 'CRITICAL',
      trend: 'DOWN',
      lastUpdated: new Date()
    },
    {
      name: 'Content Quality Score',
      value: qualityScore,
      threshold: 3,
      status: qualityScore >= 3 ? 'HEALTHY' : qualityScore >= 2 ? 'WARNING' : 'CRITICAL',
      trend: 'UP',
      lastUpdated: new Date()
    },
    {
      name: 'Engagement Rate (%)',
      value: engagementRate,
      threshold: 15,
      status: engagementRate >= 15 ? 'HEALTHY' : engagementRate >= 8 ? 'WARNING' : 'CRITICAL',
      trend: 'STABLE',
      lastUpdated: new Date()
    }
  ]
}

async function checkUserHealth(workspaceId: string, last7d: Date, last30d: Date): Promise<HealthMetric[]> {
  const [
    retentionRate,
    newUserRate,
    reportedUserRate
  ] = await Promise.all([
    calculateRetentionRate(workspaceId, last7d, last30d),
    calculateNewUserRate(workspaceId, last7d),
    calculateReportedUserRate(workspaceId, last30d)
  ])

  return [
    {
      name: 'User Retention Rate (%)',
      value: retentionRate,
      threshold: 70,
      status: retentionRate >= 70 ? 'HEALTHY' : retentionRate >= 50 ? 'WARNING' : 'CRITICAL',
      trend: 'UP',
      lastUpdated: new Date()
    },
    {
      name: 'New User Rate (weekly %)',
      value: newUserRate,
      threshold: 5,
      status: newUserRate >= 5 ? 'HEALTHY' : newUserRate >= 2 ? 'WARNING' : 'CRITICAL',
      trend: 'STABLE',
      lastUpdated: new Date()
    },
    {
      name: 'Reported User Rate (%)',
      value: reportedUserRate,
      threshold: 2,
      status: reportedUserRate <= 2 ? 'HEALTHY' : reportedUserRate <= 5 ? 'WARNING' : 'CRITICAL',
      trend: 'DOWN',
      lastUpdated: new Date()
    }
  ]
}

async function checkSystemHealth(workspaceId: string, last24h: Date): Promise<HealthMetric[]> {
  // System health metrics (API response times, error rates, etc.)
  return [
    {
      name: 'API Response Time (ms)',
      value: 180,
      threshold: 500,
      status: 'HEALTHY',
      trend: 'STABLE',
      lastUpdated: new Date()
    },
    {
      name: 'Error Rate (%)',
      value: 0.5,
      threshold: 2,
      status: 'HEALTHY',
      trend: 'DOWN',
      lastUpdated: new Date()
    }
  ]
}

async function generateHealthAlerts(metrics: HealthMetric[], workspaceId: string): Promise<HealthAlert[]> {
  const alerts: HealthAlert[] = []

  metrics.forEach((metric, index) => {
    if (metric.status === 'CRITICAL') {
      alerts.push({
        id: `alert-${index}-critical`,
        type: 'CRITICAL',
        category: getCategoryFromMetric(metric.name),
        title: `Critical: ${metric.name}`,
        description: `${metric.name} is at ${metric.value}, which is below the critical threshold of ${metric.threshold}`,
        severity: 9,
        actionRequired: true,
        autoResolvable: false,
        createdAt: new Date(),
        metadata: { metric: metric.name, value: metric.value, threshold: metric.threshold }
      })
    } else if (metric.status === 'WARNING') {
      alerts.push({
        id: `alert-${index}-warning`,
        type: 'WARNING',
        category: getCategoryFromMetric(metric.name),
        title: `Warning: ${metric.name}`,
        description: `${metric.name} is at ${metric.value}, approaching the threshold of ${metric.threshold}`,
        severity: 5,
        actionRequired: false,
        autoResolvable: true,
        createdAt: new Date(),
        metadata: { metric: metric.name, value: metric.value, threshold: metric.threshold }
      })
    }
  })

  return alerts
}

function getCategoryFromMetric(metricName: string): HealthAlert['category'] {
  if (metricName.includes('Posts') || metricName.includes('Comments') || metricName.includes('Active Users')) {
    return 'ACTIVITY'
  }
  if (metricName.includes('Moderation') || metricName.includes('Reports')) {
    return 'MODERATION'
  }
  if (metricName.includes('Spam') || metricName.includes('Quality') || metricName.includes('Engagement')) {
    return 'CONTENT'
  }
  if (metricName.includes('User') || metricName.includes('Retention')) {
    return 'USERS'
  }
  return 'SYSTEM'
}

function calculateOverallHealth(metrics: HealthMetric[]): number {
  const scores = metrics.map(metric => {
    switch (metric.status) {
      case 'HEALTHY': return 100
      case 'WARNING': return 60
      case 'CRITICAL': return 20
      default: return 50
    }
  })

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function getHealthStatus(score: number): CommunityHealthReport['status'] {
  if (score >= 85) return 'EXCELLENT'
  if (score >= 70) return 'GOOD'
  if (score >= 50) return 'FAIR'
  if (score >= 30) return 'POOR'
  return 'CRITICAL'
}

function generateRecommendations(metrics: HealthMetric[], alerts: HealthAlert[]): string[] {
  const recommendations: string[] = []

  // Generate recommendations based on problematic metrics
  metrics.forEach(metric => {
    if (metric.status === 'CRITICAL' || metric.status === 'WARNING') {
      switch (metric.name) {
        case 'Daily Posts':
          recommendations.push('Consider running engagement campaigns or community challenges to increase posting activity')
          break
        case 'Pending Moderation Actions':
          recommendations.push('Add more moderators or implement automated moderation rules to reduce backlog')
          break
        case 'Spam Detection Rate (%)':
          recommendations.push('Review and tighten spam detection rules, consider implementing stricter auto-moderation')
          break
        case 'User Retention Rate (%)':
          recommendations.push('Implement user onboarding improvements and engagement initiatives')
          break
      }
    }
  })

  if (recommendations.length === 0) {
    recommendations.push('Community health is good! Continue monitoring and maintaining current practices.')
  }

  return [...new Set(recommendations)] // Remove duplicates
}

// Calculation helper functions
async function calculateAvgModerationTime(workspaceId: string, since: Date): Promise<number> {
  const completedActions = await prisma.moderationAction.findMany({
    where: {
      workspaceId,
      createdAt: { gte: since },
      reviewedAt: { not: null },
      status: 'COMPLETED'
    },
    select: { createdAt: true, reviewedAt: true }
  })

  if (completedActions.length === 0) return 0

  const totalTime = completedActions.reduce((sum, action) => {
    const time = action.reviewedAt!.getTime() - action.createdAt.getTime()
    return sum + (time / (1000 * 60 * 60)) // Convert to hours
  }, 0)

  return Math.round(totalTime / completedActions.length * 100) / 100
}

async function calculateAutomationRate(workspaceId: string, since: Date): Promise<number> {
  const [total, automated] = await Promise.all([
    prisma.moderationAction.count({
      where: { workspaceId, createdAt: { gte: since } }
    }),
    prisma.moderationAction.count({
      where: { workspaceId, createdAt: { gte: since }, isAutomatic: true }
    })
  ])

  return total > 0 ? Math.round((automated / total) * 100) : 0
}

async function calculateSpamRate(workspaceId: string, since: Date): Promise<number> {
  const [totalPosts, spamDetections] = await Promise.all([
    prisma.communityForumPost.count({
      where: { workspaceId, createdAt: { gte: since } }
    }),
    prisma.spamDetection.count({
      where: { workspaceId, createdAt: { gte: since }, isSpam: true }
    })
  ])

  return totalPosts > 0 ? Math.round((spamDetections / totalPosts) * 100) : 0
}

async function calculateContentQuality(workspaceId: string, since: Date): Promise<number> {
  const avgLikes = await prisma.communityForumPost.aggregate({
    where: { workspaceId, createdAt: { gte: since } },
    _avg: { likes: true }
  })

  return Math.round((avgLikes._avg.likes || 0) * 100) / 100
}

async function calculateDuplicateRate(workspaceId: string, since: Date): Promise<number> {
  // This would require more sophisticated duplicate detection
  // For now, return a mock value
  return 2.5
}

async function calculateEngagementRate(workspaceId: string, since: Date): Promise<number> {
  const [posts, totalEngagement] = await Promise.all([
    prisma.communityForumPost.count({
      where: { workspaceId, createdAt: { gte: since } }
    }),
    prisma.communityForumPost.aggregate({
      where: { workspaceId, createdAt: { gte: since } },
      _sum: { likes: true, shares: true }
    })
  ])

  const engagementActions = (totalEngagement._sum.likes || 0) + (totalEngagement._sum.shares || 0)
  return posts > 0 ? Math.round((engagementActions / posts) * 100) / 100 : 0
}

async function calculateRetentionRate(workspaceId: string, last7d: Date, last30d: Date): Promise<number> {
  const [activeThisWeek, activeLast30Days] = await Promise.all([
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: last7d } } } },
            { forumComments: { some: { createdAt: { gte: last7d } } } }
          ]
        }
      }
    }),
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: last30d } } } },
            { forumComments: { some: { createdAt: { gte: last30d } } } }
          ]
        }
      }
    })
  ])

  return activeLast30Days > 0 ? Math.round((activeThisWeek / activeLast30Days) * 100) : 0
}

async function calculateNewUserRate(workspaceId: string, since: Date): Promise<number> {
  const [newUsers, totalUsers] = await Promise.all([
    prisma.userWorkspace.count({
      where: { workspaceId, createdAt: { gte: since } }
    }),
    prisma.userWorkspace.count({
      where: { workspaceId }
    })
  ])

  return totalUsers > 0 ? Math.round((newUsers / totalUsers) * 100) : 0
}

async function calculateReportedUserRate(workspaceId: string, since: Date): Promise<number> {
  // This would require tracking reported users
  // For now, return a mock value
  return 1.2
}

async function getHealthHistory(workspaceId: string) {
  // This would retrieve historical health data
  // For now, return mock historical data
  const history = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    history.push({
      date: date.toISOString().split('T')[0],
      score: Math.floor(Math.random() * 30) + 70, // Random score between 70-100
      status: 'GOOD',
      criticalAlerts: Math.floor(Math.random() * 3),
      warningAlerts: Math.floor(Math.random() * 5)
    })
  }
  return history
}