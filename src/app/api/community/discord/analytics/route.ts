import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Discord Analytics interfaces
interface ChannelAnalytics {
  channelId: string
  channelName: string
  messageCount: number
  activeMembers: number
  averageMessagesPerDay: number
  peakActivity: {
    hour: number
    count: number
  }
}

interface MemberGrowthData {
  date: string
  total: number
  joined: number
  left: number
  net: number
}

interface ActivityHeatmap {
  hour: number
  day: number // 0 = Sunday, 1 = Monday, etc.
  activity: number
}

// GET /api/community/discord/analytics - Get Discord server analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const period = searchParams.get('period') || '30' // days
    const metric = searchParams.get('metric') // specific metric to fetch

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has admin permissions
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

    // Get Discord integration
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceId }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Discord integration not found' }, { status: 404 })
    }

    const periodDays = parseInt(period)
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

    // If specific metric requested, return only that
    if (metric) {
      const data = await getSpecificMetric(integration, metric, startDate, periodDays)
      return NextResponse.json({ [metric]: data })
    }

    // Get comprehensive analytics
    const [
      memberGrowth,
      channelAnalytics,
      activityHeatmap,
      topMembers,
      moderationStats,
      engagementMetrics,
      serverHealth
    ] = await Promise.all([
      getMemberGrowthData(integration, periodDays),
      getChannelAnalytics(integration, periodDays),
      getActivityHeatmap(integration, periodDays),
      getTopMembers(integration, periodDays),
      getModerationStats(workspaceId, startDate),
      getEngagementMetrics(integration, periodDays),
      getServerHealthMetrics(integration)
    ])

    return NextResponse.json({
      period: `${periodDays} days`,
      memberGrowth,
      channelAnalytics,
      activityHeatmap,
      topMembers,
      moderationStats,
      engagementMetrics,
      serverHealth,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch Discord analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Discord analytics' },
      { status: 500 }
    )
  }
}

// Helper functions to generate analytics data
async function getMemberGrowthData(integration: any, days: number): Promise<MemberGrowthData[]> {
  const data: MemberGrowthData[] = []
  let currentTotal = Math.max(0, (integration.memberCount || 1247) - days * 2) // Starting point

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    // Generate realistic growth patterns
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Lower activity on weekends
    const baseJoined = isWeekend ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 8) + 2
    const baseLeft = Math.floor(Math.random() * 2)

    const joined = Math.max(0, baseJoined + Math.floor(Math.random() * 3) - 1)
    const left = Math.max(0, baseLeft + Math.floor(Math.random() * 2))
    const net = joined - left

    currentTotal = Math.max(0, currentTotal + net)

    data.push({
      date: date.toISOString().split('T')[0],
      total: currentTotal,
      joined,
      left,
      net
    })
  }

  return data
}

async function getChannelAnalytics(integration: any, days: number): Promise<ChannelAnalytics[]> {
  // Mock channel data based on integration channels
  const channels = integration.channels || {
    general: '1234567890123456789',
    support: '1234567890123456790',
    announcements: '1234567890123456791',
    'feature-requests': '1234567890123456792',
    showcase: '1234567890123456793'
  }

  return Object.entries(channels).map(([name, id]) => {
    const baseActivity = name === 'general' ? 800 :
                        name === 'support' ? 200 :
                        name === 'announcements' ? 50 :
                        name === 'feature-requests' ? 150 : 100

    const messageCount = Math.floor(baseActivity + Math.random() * 200)
    const activeMembers = Math.floor((messageCount / 10) + Math.random() * 20)

    return {
      channelId: id as string,
      channelName: name,
      messageCount,
      activeMembers,
      averageMessagesPerDay: Math.round(messageCount / days),
      peakActivity: {
        hour: Math.floor(Math.random() * 12) + 10, // Peak between 10 AM - 10 PM
        count: Math.floor(messageCount * 0.1)
      }
    }
  })
}

async function getActivityHeatmap(integration: any, days: number): Promise<ActivityHeatmap[]> {
  const heatmap: ActivityHeatmap[] = []

  // Generate 24h x 7 days heatmap
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      // Simulate realistic activity patterns
      let baseActivity = 10

      // Higher activity during certain hours
      if (hour >= 9 && hour <= 17) baseActivity = 30 // Work hours
      if (hour >= 18 && hour <= 22) baseActivity = 50 // Evening peak
      if (hour >= 23 || hour <= 6) baseActivity = 5   // Night/early morning

      // Weekend patterns
      if (day === 0 || day === 6) { // Sunday or Saturday
        if (hour >= 10 && hour <= 20) baseActivity = Math.floor(baseActivity * 0.8)
      }

      const activity = Math.max(0, baseActivity + Math.floor(Math.random() * 20) - 10)

      heatmap.push({
        hour,
        day,
        activity
      })
    }
  }

  return heatmap
}

async function getTopMembers(integration: any, days: number) {
  // Mock top members data
  return [
    {
      userId: '123456789012345678',
      username: 'ActiveUser',
      avatar: 'avatar_hash_1',
      messageCount: 234,
      reactionsGiven: 156,
      reactionsReceived: 89,
      joinedDaysAgo: 45,
      rank: 1
    },
    {
      userId: '234567890123456789',
      username: 'HelpfulMember',
      avatar: 'avatar_hash_2',
      messageCount: 189,
      reactionsGiven: 234,
      reactionsReceived: 145,
      joinedDaysAgo: 78,
      rank: 2
    },
    {
      userId: '345678901234567890',
      username: 'CommunityLead',
      avatar: 'avatar_hash_3',
      messageCount: 167,
      reactionsGiven: 123,
      reactionsReceived: 234,
      joinedDaysAgo: 120,
      rank: 3
    }
  ]
}

async function getModerationStats(workspaceId: string, startDate: Date) {
  const [
    totalActions,
    warnings,
    kicks,
    bans,
    timeouts
  ] = await Promise.all([
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        targetType: 'DISCORD_MEMBER'
      }
    }),
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        actionType: 'WARN',
        targetType: 'DISCORD_MEMBER'
      }
    }),
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        actionType: 'KICK',
        targetType: 'DISCORD_MEMBER'
      }
    }),
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        actionType: 'BAN',
        targetType: 'DISCORD_MEMBER'
      }
    }),
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        actionType: 'TIMEOUT',
        targetType: 'DISCORD_MEMBER'
      }
    })
  ])

  return {
    totalActions,
    warnings,
    kicks,
    bans,
    timeouts,
    actionsByDay: await getModerationTrend(workspaceId, startDate)
  }
}

async function getModerationTrend(workspaceId: string, startDate: Date) {
  const trend = []
  const daysDiff = Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  for (let i = daysDiff - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const count = await prisma.moderationAction.count({
      where: {
        workspaceId,
        targetType: 'DISCORD_MEMBER',
        createdAt: {
          gte: date,
          lt: nextDate
        }
      }
    })

    trend.push({
      date: date.toISOString().split('T')[0],
      count
    })
  }

  return trend
}

async function getEngagementMetrics(integration: any, days: number) {
  const memberCount = integration.memberCount || 1247

  return {
    dailyActiveUsers: Math.floor(memberCount * 0.15), // 15% DAU
    weeklyActiveUsers: Math.floor(memberCount * 0.35), // 35% WAU
    monthlyActiveUsers: Math.floor(memberCount * 0.65), // 65% MAU
    averageSessionDuration: 45, // minutes
    messagesPerActiveUser: 12.5,
    retentionRate: 0.78, // 78% retention
    engagementScore: 8.4 // out of 10
  }
}

async function getServerHealthMetrics(integration: any) {
  return {
    uptime: 99.9, // percentage
    latency: 145, // ms
    botStatus: 'online',
    apiCallsToday: 2847,
    apiLimit: 10000,
    webhookDeliveryRate: 98.5, // percentage
    errorRate: 0.02, // percentage
    lastIncident: null,
    healthScore: 'excellent' // excellent, good, fair, poor
  }
}

async function getSpecificMetric(integration: any, metric: string, startDate: Date, days: number) {
  switch (metric) {
    case 'memberGrowth':
      return await getMemberGrowthData(integration, days)
    case 'channelAnalytics':
      return await getChannelAnalytics(integration, days)
    case 'activityHeatmap':
      return await getActivityHeatmap(integration, days)
    case 'topMembers':
      return await getTopMembers(integration, days)
    case 'moderationStats':
      return await getModerationStats(integration.workspaceId, startDate)
    case 'engagementMetrics':
      return await getEngagementMetrics(integration, days)
    case 'serverHealth':
      return await getServerHealthMetrics(integration)
    default:
      throw new Error(`Unknown metric: ${metric}`)
  }
}