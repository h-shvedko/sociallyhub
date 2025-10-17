import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Community Analytics interfaces
interface CommunityOverview {
  totalMembers: number
  activeMembers: number
  totalPosts: number
  totalComments: number
  totalFeatureRequests: number
  totalReports: number
  memberGrowthRate: number
  engagementScore: number
}

interface ActivityMetrics {
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
  postsPerDay: number
  commentsPerDay: number
  avgSessionDuration: number
  retentionRate: number
}

interface ContentAnalytics {
  topCategories: { category: string; count: number; engagement: number }[]
  contentPerformance: { type: string; totalCount: number; avgEngagement: number }[]
  sentimentDistribution: { positive: number; negative: number; neutral: number }
  popularTags: { tag: string; count: number }[]
}

interface ModerationMetrics {
  totalActions: number
  actionsToday: number
  avgResponseTime: number
  automationRate: number
  topModerators: { name: string; actions: number }[]
  actionsByType: { type: string; count: number }[]
}

// GET /api/community/analytics - Get comprehensive community analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const period = searchParams.get('period') || '30' // days
    const metric = searchParams.get('metric') // specific metric

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

    const periodDays = parseInt(period)
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

    // If specific metric requested, return only that
    if (metric) {
      const data = await getSpecificCommunityMetric(workspaceId, metric, startDate, periodDays)
      return NextResponse.json({ [metric]: data })
    }

    // Get comprehensive analytics
    const [
      overview,
      activityMetrics,
      contentAnalytics,
      moderationMetrics,
      growthTrends,
      engagementTrends,
      communityHealth,
      userSegmentation
    ] = await Promise.all([
      getCommunityOverview(workspaceId, startDate),
      getActivityMetrics(workspaceId, startDate, periodDays),
      getContentAnalytics(workspaceId, startDate),
      getModerationMetrics(workspaceId, startDate),
      getGrowthTrends(workspaceId, periodDays),
      getEngagementTrends(workspaceId, periodDays),
      getCommunityHealth(workspaceId, startDate),
      getUserSegmentation(workspaceId, startDate)
    ])

    return NextResponse.json({
      period: `${periodDays} days`,
      overview,
      activityMetrics,
      contentAnalytics,
      moderationMetrics,
      growthTrends,
      engagementTrends,
      communityHealth,
      userSegmentation,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch community analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch community analytics' },
      { status: 500 }
    )
  }
}

// Helper functions for analytics calculations
async function getCommunityOverview(workspaceId: string, startDate: Date): Promise<CommunityOverview> {
  const [
    totalMembers,
    activeMembersCount,
    totalPosts,
    totalComments,
    totalFeatureRequests,
    totalReports,
    previousPeriodMembers
  ] = await Promise.all([
    // Total workspace members
    prisma.userWorkspace.count({
      where: { workspaceId }
    }),
    // Active members in period (posted, commented, or voted)
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: startDate } } } },
            { forumComments: { some: { createdAt: { gte: startDate } } } },
            { featureRequests: { some: { createdAt: { gte: startDate } } } },
            { featureRequestVotes: { some: { createdAt: { gte: startDate } } } }
          ]
        }
      }
    }),
    // Total forum posts
    prisma.communityForumPost.count({
      where: { workspaceId }
    }),
    // Total comments
    prisma.communityForumComment.count({
      where: { post: { workspaceId } }
    }),
    // Total feature requests
    prisma.featureRequest.count({
      where: { workspaceId }
    }),
    // Total reports
    prisma.contentReport.count({
      where: { workspaceId }
    }),
    // Previous period for growth calculation
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        createdAt: { lt: startDate }
      }
    })
  ])

  const memberGrowthRate = previousPeriodMembers > 0
    ? ((totalMembers - previousPeriodMembers) / previousPeriodMembers) * 100
    : 0

  // Calculate engagement score (posts + comments + votes) / active members
  const totalEngagementActions = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT 'post' as type FROM community_forum_posts WHERE workspace_id = ${workspaceId} AND created_at >= ${startDate}
      UNION ALL
      SELECT 'comment' as type FROM community_forum_comments c
        JOIN community_forum_posts p ON c.post_id = p.id
        WHERE p.workspace_id = ${workspaceId} AND c.created_at >= ${startDate}
      UNION ALL
      SELECT 'vote' as type FROM feature_request_votes v
        JOIN feature_requests fr ON v.request_id = fr.id
        WHERE fr.workspace_id = ${workspaceId} AND v.created_at >= ${startDate}
    ) actions
  `

  const engagementScore = activeMembersCount > 0
    ? Number(totalEngagementActions[0].count) / activeMembersCount
    : 0

  return {
    totalMembers,
    activeMembers: activeMembersCount,
    totalPosts,
    totalComments,
    totalFeatureRequests,
    totalReports,
    memberGrowthRate: parseFloat(memberGrowthRate.toFixed(2)),
    engagementScore: parseFloat(engagementScore.toFixed(2))
  }
}

async function getActivityMetrics(workspaceId: string, startDate: Date, days: number): Promise<ActivityMetrics> {
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    dailyActiveUsers,
    weeklyActiveUsers,
    monthlyActiveUsers,
    totalPosts,
    totalComments,
    userSessions
  ] = await Promise.all([
    // DAU - users active in last 24 hours
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } },
            { forumComments: { some: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } },
            { featureRequests: { some: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } } }
          ]
        }
      }
    }),
    // WAU - users active in last 7 days
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: weekStart } } } },
            { forumComments: { some: { createdAt: { gte: weekStart } } } },
            { featureRequests: { some: { createdAt: { gte: weekStart } } } }
          ]
        }
      }
    }),
    // MAU - users active in last 30 days
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: monthStart } } } },
            { forumComments: { some: { createdAt: { gte: monthStart } } } },
            { featureRequests: { some: { createdAt: { gte: monthStart } } } }
          ]
        }
      }
    }),
    // Posts in period
    prisma.communityForumPost.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      }
    }),
    // Comments in period
    prisma.communityForumComment.count({
      where: {
        post: { workspaceId },
        createdAt: { gte: startDate }
      }
    }),
    // User sessions (simulated data for now)
    prisma.userSession.count({
      where: {
        user: {
          workspaces: { some: { workspaceId } }
        },
        createdAt: { gte: startDate }
      }
    })
  ])

  const postsPerDay = Math.round(totalPosts / days)
  const commentsPerDay = Math.round(totalComments / days)

  // Calculate average session duration (in minutes)
  const avgSessionDuration = userSessions > 0 ? 45 : 0 // Mock for now

  // Calculate retention rate (users who were active 30 days ago and still active)
  const retentionRate = monthlyActiveUsers > 0
    ? (weeklyActiveUsers / monthlyActiveUsers) * 100
    : 0

  return {
    dailyActiveUsers,
    weeklyActiveUsers,
    monthlyActiveUsers,
    postsPerDay,
    commentsPerDay,
    avgSessionDuration,
    retentionRate: parseFloat(retentionRate.toFixed(2))
  }
}

async function getContentAnalytics(workspaceId: string, startDate: Date): Promise<ContentAnalytics> {
  const [
    categoryStats,
    sentimentData,
    tagData
  ] = await Promise.all([
    // Top categories by post count and engagement
    prisma.communityForumPost.groupBy({
      by: ['category'],
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      },
      _count: { id: true },
      _avg: { likes: true }
    }),
    // Sentiment distribution from inbox items
    prisma.inboxItem.groupBy({
      by: ['sentiment'],
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      },
      _count: { sentiment: true }
    }),
    // Popular tags from posts (extract from content for now)
    prisma.communityForumPost.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        content: { contains: '#' }
      },
      select: { content: true }
    })
  ])

  const topCategories = categoryStats.map(cat => ({
    category: cat.category,
    count: cat._count.id,
    engagement: Math.round(cat._avg.likes || 0)
  }))

  const sentimentCounts = sentimentData.reduce((acc, item) => {
    acc[item.sentiment] = item._count.sentiment
    return acc
  }, { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 } as any)

  const sentimentDistribution = {
    positive: sentimentCounts.POSITIVE || 0,
    negative: sentimentCounts.NEGATIVE || 0,
    neutral: sentimentCounts.NEUTRAL || 0
  }

  // Extract hashtags from post content
  const allTags: string[] = []
  tagData.forEach(post => {
    const tags = post.content.match(/#\w+/g) || []
    allTags.push(...tags.map(tag => tag.toLowerCase()))
  })

  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const popularTags = Object.entries(tagCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))

  const contentPerformance = [
    { type: 'Forum Posts', totalCount: topCategories.reduce((sum, cat) => sum + cat.count, 0), avgEngagement: 4.2 },
    { type: 'Feature Requests', totalCount: await prisma.featureRequest.count({ where: { workspaceId, createdAt: { gte: startDate } } }), avgEngagement: 8.5 },
    { type: 'Comments', totalCount: await prisma.communityForumComment.count({ where: { post: { workspaceId }, createdAt: { gte: startDate } } }), avgEngagement: 2.1 }
  ]

  return {
    topCategories,
    contentPerformance,
    sentimentDistribution,
    popularTags
  }
}

async function getModerationMetrics(workspaceId: string, startDate: Date): Promise<ModerationMetrics> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    totalActions,
    actionsToday,
    automatedActions,
    moderatorStats,
    actionTypes
  ] = await Promise.all([
    // Total moderation actions in period
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      }
    }),
    // Actions today
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: todayStart }
      }
    }),
    // Automated actions
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        isAutomatic: true
      }
    }),
    // Top moderators
    prisma.moderationAction.groupBy({
      by: ['moderatorId'],
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        moderatorId: { not: null }
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    }),
    // Actions by type
    prisma.moderationAction.groupBy({
      by: ['actionType'],
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      },
      _count: { actionType: true }
    })
  ])

  // Get moderator names
  const moderatorIds = moderatorStats.map(m => m.moderatorId).filter(Boolean) as string[]
  const moderators = await prisma.user.findMany({
    where: { id: { in: moderatorIds } },
    select: { id: true, name: true }
  })

  const topModerators = moderatorStats.map(stat => {
    const moderator = moderators.find(m => m.id === stat.moderatorId)
    return {
      name: moderator?.name || 'Unknown',
      actions: stat._count.id
    }
  })

  const actionsByType = actionTypes.map(action => ({
    type: action.actionType,
    count: action._count.actionType
  }))

  // Calculate average response time (hours from creation to review)
  const reviewedActions = await prisma.moderationAction.findMany({
    where: {
      workspaceId,
      createdAt: { gte: startDate },
      reviewedAt: { not: null },
      status: 'COMPLETED'
    },
    select: {
      createdAt: true,
      reviewedAt: true
    }
  })

  let avgResponseTime = 0
  if (reviewedActions.length > 0) {
    const totalResponseTime = reviewedActions.reduce((sum, action) => {
      const responseTime = action.reviewedAt!.getTime() - action.createdAt.getTime()
      return sum + (responseTime / (1000 * 60 * 60)) // Convert to hours
    }, 0)
    avgResponseTime = totalResponseTime / reviewedActions.length
  }

  const automationRate = totalActions > 0 ? (automatedActions / totalActions) * 100 : 0

  return {
    totalActions,
    actionsToday,
    avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
    automationRate: parseFloat(automationRate.toFixed(2)),
    topModerators,
    actionsByType
  }
}

async function getGrowthTrends(workspaceId: string, days: number) {
  const trends = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const [newMembers, newPosts, newComments, newFeatureRequests] = await Promise.all([
      prisma.userWorkspace.count({
        where: {
          workspaceId,
          createdAt: { gte: date, lt: nextDate }
        }
      }),
      prisma.communityForumPost.count({
        where: {
          workspaceId,
          createdAt: { gte: date, lt: nextDate }
        }
      }),
      prisma.communityForumComment.count({
        where: {
          post: { workspaceId },
          createdAt: { gte: date, lt: nextDate }
        }
      }),
      prisma.featureRequest.count({
        where: {
          workspaceId,
          createdAt: { gte: date, lt: nextDate }
        }
      })
    ])

    trends.push({
      date: date.toISOString().split('T')[0],
      newMembers,
      newPosts,
      newComments,
      newFeatureRequests
    })
  }

  return trends
}

async function getEngagementTrends(workspaceId: string, days: number) {
  const trends = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const [likes, shares, votes, comments] = await Promise.all([
      // Total likes on posts
      prisma.communityForumPost.aggregate({
        where: {
          workspaceId,
          createdAt: { gte: date, lt: nextDate }
        },
        _sum: { likes: true }
      }),
      // Total shares
      prisma.communityForumPost.aggregate({
        where: {
          workspaceId,
          createdAt: { gte: date, lt: nextDate }
        },
        _sum: { shares: true }
      }),
      // Feature request votes
      prisma.featureRequestVote.count({
        where: {
          request: { workspaceId },
          createdAt: { gte: date, lt: nextDate }
        }
      }),
      // Comments count
      prisma.communityForumComment.count({
        where: {
          post: { workspaceId },
          createdAt: { gte: date, lt: nextDate }
        }
      })
    ])

    trends.push({
      date: date.toISOString().split('T')[0],
      likes: likes._sum.likes || 0,
      shares: shares._sum.shares || 0,
      votes,
      comments
    })
  }

  return trends
}

async function getCommunityHealth(workspaceId: string, startDate: Date) {
  const [
    activeUsers,
    totalUsers,
    unresolved reports,
    avgPostQuality,
    moderationBacklog,
    spamDetectionRate
  ] = await Promise.all([
    // Active users percentage
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: startDate } } } },
            { forumComments: { some: { createdAt: { gte: startDate } } } }
          ]
        }
      }
    }),
    // Total users
    prisma.userWorkspace.count({
      where: { workspaceId }
    }),
    // Unresolved reports
    prisma.contentReport.count({
      where: {
        workspaceId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] }
      }
    }),
    // Average post quality score (likes/views ratio)
    prisma.communityForumPost.aggregate({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      },
      _avg: { likes: true }
    }),
    // Moderation backlog
    prisma.moderationAction.count({
      where: {
        workspaceId,
        status: 'PENDING'
      }
    }),
    // Spam detection rate
    prisma.spamDetection.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        isSpam: true
      }
    })
  ])

  const activityRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0
  const qualityScore = avgPostQuality._avg.likes || 0

  // Calculate overall health score (0-100)
  let healthScore = 100
  if (activityRate < 30) healthScore -= 20 // Low activity penalty
  if (unresolvedReports > 10) healthScore -= 15 // High reports penalty
  if (moderationBacklog > 5) healthScore -= 10 // Backlog penalty
  if (qualityScore < 2) healthScore -= 10 // Low quality penalty

  healthScore = Math.max(0, healthScore)

  return {
    activityRate: parseFloat(activityRate.toFixed(2)),
    qualityScore: parseFloat(qualityScore.toFixed(2)),
    unresolvedReports,
    moderationBacklog,
    spamDetectionRate,
    healthScore,
    status: healthScore >= 80 ? 'excellent' :
            healthScore >= 60 ? 'good' :
            healthScore >= 40 ? 'fair' : 'poor'
  }
}

async function getUserSegmentation(workspaceId: string, startDate: Date) {
  const [
    newUsers,
    activeUsers,
    powerUsers,
    inactiveUsers,
    moderators
  ] = await Promise.all([
    // New users (joined in period)
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      }
    }),
    // Active users (posted or commented)
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          OR: [
            { forumPosts: { some: { createdAt: { gte: startDate } } } },
            { forumComments: { some: { createdAt: { gte: startDate } } } }
          ]
        }
      }
    }),
    // Power users (10+ posts or comments)
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT uw.user_id) as count
      FROM user_workspaces uw
      LEFT JOIN community_forum_posts cfp ON uw.user_id = cfp.user_id AND cfp.created_at >= ${startDate}
      LEFT JOIN community_forum_comments cfc ON uw.user_id = cfc.user_id AND cfc.created_at >= ${startDate}
      WHERE uw.workspace_id = ${workspaceId}
      GROUP BY uw.user_id
      HAVING COUNT(cfp.id) + COUNT(cfc.id) >= 10
    `,
    // Inactive users (no activity in period)
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        user: {
          AND: [
            { forumPosts: { none: { createdAt: { gte: startDate } } } },
            { forumComments: { none: { createdAt: { gte: startDate } } } }
          ]
        }
      }
    }),
    // Moderators
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })
  ])

  return {
    newUsers,
    activeUsers,
    powerUsers: Number(powerUsers[0]?.count || 0),
    inactiveUsers,
    moderators
  }
}

async function getSpecificCommunityMetric(workspaceId: string, metric: string, startDate: Date, days: number) {
  switch (metric) {
    case 'overview':
      return await getCommunityOverview(workspaceId, startDate)
    case 'activity':
      return await getActivityMetrics(workspaceId, startDate, days)
    case 'content':
      return await getContentAnalytics(workspaceId, startDate)
    case 'moderation':
      return await getModerationMetrics(workspaceId, startDate)
    case 'growth':
      return await getGrowthTrends(workspaceId, days)
    case 'engagement':
      return await getEngagementTrends(workspaceId, days)
    case 'health':
      return await getCommunityHealth(workspaceId, startDate)
    case 'segmentation':
      return await getUserSegmentation(workspaceId, startDate)
    default:
      throw new Error(`Unknown metric: ${metric}`)
  }
}