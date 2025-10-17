import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Community Insights interfaces
interface UserBehaviorInsight {
  segment: 'POWER_USERS' | 'ACTIVE_USERS' | 'OCCASIONAL_USERS' | 'LURKERS' | 'NEW_USERS'
  count: number
  percentage: number
  avgPostsPerUser: number
  avgCommentsPerUser: number
  avgSessionDuration: number
  characteristics: string[]
}

interface ContentInsight {
  type: 'TRENDING_TOPICS' | 'PEAK_HOURS' | 'CONTENT_TYPES' | 'ENGAGEMENT_PATTERNS'
  title: string
  description: string
  data: any
  recommendations: string[]
}

interface PredictiveInsight {
  metric: string
  currentValue: number
  predictedValue: number
  confidence: number
  timeframe: string
  factors: string[]
}

interface CommunityTrend {
  metric: string
  direction: 'INCREASING' | 'DECREASING' | 'STABLE'
  changePercentage: number
  timeframe: string
  significance: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
}

// GET /api/community/insights - Get detailed community insights and predictions
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const insightType = searchParams.get('type') // 'behavior', 'content', 'predictive', 'trends'
    const period = searchParams.get('period') || '30' // days

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

    if (!userWorkspace || !['OWNER', 'ADMIN', 'ANALYST'].includes(userWorkspace.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const periodDays = parseInt(period)
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

    // If specific insight type requested, return only that
    if (insightType) {
      const data = await getSpecificInsight(workspaceId, insightType, startDate, periodDays)
      return NextResponse.json({ [insightType]: data })
    }

    // Get comprehensive insights
    const [
      userBehaviorInsights,
      contentInsights,
      predictiveInsights,
      communityTrends,
      engagementAnalysis,
      growthDrivers,
      retentionFactors,
      competitiveAnalysis
    ] = await Promise.all([
      getUserBehaviorInsights(workspaceId, startDate),
      getContentInsights(workspaceId, startDate, periodDays),
      getPredictiveInsights(workspaceId, startDate, periodDays),
      getCommunityTrends(workspaceId, periodDays),
      getEngagementAnalysis(workspaceId, startDate),
      getGrowthDrivers(workspaceId, startDate),
      getRetentionFactors(workspaceId, startDate),
      getCompetitiveAnalysis(workspaceId, startDate)
    ])

    return NextResponse.json({
      period: `${periodDays} days`,
      userBehaviorInsights,
      contentInsights,
      predictiveInsights,
      communityTrends,
      engagementAnalysis,
      growthDrivers,
      retentionFactors,
      competitiveAnalysis,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to generate community insights:', error)
    return NextResponse.json(
      { error: 'Failed to generate community insights' },
      { status: 500 }
    )
  }
}

// Helper functions for insights generation
async function getUserBehaviorInsights(workspaceId: string, startDate: Date): Promise<UserBehaviorInsight[]> {
  // Get all workspace users with their activity
  const users = await prisma.userWorkspace.findMany({
    where: { workspaceId },
    include: {
      user: {
        include: {
          forumPosts: {
            where: { createdAt: { gte: startDate } }
          },
          forumComments: {
            where: { createdAt: { gte: startDate } }
          },
          featureRequests: {
            where: { createdAt: { gte: startDate } }
          }
        }
      }
    }
  })

  const totalUsers = users.length

  // Categorize users based on activity
  const powerUsers = users.filter(u =>
    u.user.forumPosts.length >= 10 || u.user.forumComments.length >= 20
  )
  const activeUsers = users.filter(u =>
    (u.user.forumPosts.length >= 3 && u.user.forumPosts.length < 10) ||
    (u.user.forumComments.length >= 5 && u.user.forumComments.length < 20)
  )
  const occasionalUsers = users.filter(u =>
    u.user.forumPosts.length > 0 || u.user.forumComments.length > 0
  ).filter(u => !powerUsers.includes(u) && !activeUsers.includes(u))

  const lurkers = users.filter(u =>
    u.user.forumPosts.length === 0 && u.user.forumComments.length === 0
  )

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const newUsers = users.filter(u => u.createdAt >= thirtyDaysAgo)

  const segments: UserBehaviorInsight[] = [
    {
      segment: 'POWER_USERS',
      count: powerUsers.length,
      percentage: Math.round((powerUsers.length / totalUsers) * 100),
      avgPostsPerUser: powerUsers.length > 0 ?
        Math.round(powerUsers.reduce((sum, u) => sum + u.user.forumPosts.length, 0) / powerUsers.length) : 0,
      avgCommentsPerUser: powerUsers.length > 0 ?
        Math.round(powerUsers.reduce((sum, u) => sum + u.user.forumComments.length, 0) / powerUsers.length) : 0,
      avgSessionDuration: 85, // Mock data
      characteristics: [
        'Post frequently and consistently',
        'Engage heavily in discussions',
        'Often initiate conversations',
        'High influence on community sentiment'
      ]
    },
    {
      segment: 'ACTIVE_USERS',
      count: activeUsers.length,
      percentage: Math.round((activeUsers.length / totalUsers) * 100),
      avgPostsPerUser: activeUsers.length > 0 ?
        Math.round(activeUsers.reduce((sum, u) => sum + u.user.forumPosts.length, 0) / activeUsers.length) : 0,
      avgCommentsPerUser: activeUsers.length > 0 ?
        Math.round(activeUsers.reduce((sum, u) => sum + u.user.forumComments.length, 0) / activeUsers.length) : 0,
      avgSessionDuration: 45,
      characteristics: [
        'Regular contributors to discussions',
        'Moderate posting frequency',
        'Good engagement with others\' content',
        'Potential power user candidates'
      ]
    },
    {
      segment: 'OCCASIONAL_USERS',
      count: occasionalUsers.length,
      percentage: Math.round((occasionalUsers.length / totalUsers) * 100),
      avgPostsPerUser: occasionalUsers.length > 0 ?
        Math.round(occasionalUsers.reduce((sum, u) => sum + u.user.forumPosts.length, 0) / occasionalUsers.length) : 0,
      avgCommentsPerUser: occasionalUsers.length > 0 ?
        Math.round(occasionalUsers.reduce((sum, u) => sum + u.user.forumComments.length, 0) / occasionalUsers.length) : 0,
      avgSessionDuration: 25,
      characteristics: [
        'Sporadic participation',
        'Often respond rather than initiate',
        'May need encouragement to engage more',
        'Valuable for community diversity'
      ]
    },
    {
      segment: 'LURKERS',
      count: lurkers.length,
      percentage: Math.round((lurkers.length / totalUsers) * 100),
      avgPostsPerUser: 0,
      avgCommentsPerUser: 0,
      avgSessionDuration: 12,
      characteristics: [
        'Consume content without posting',
        'May vote or react silently',
        'Potential future contributors',
        'Important audience for announcements'
      ]
    },
    {
      segment: 'NEW_USERS',
      count: newUsers.length,
      percentage: Math.round((newUsers.length / totalUsers) * 100),
      avgPostsPerUser: newUsers.length > 0 ?
        Math.round(newUsers.reduce((sum, u) => sum + u.user.forumPosts.length, 0) / newUsers.length) : 0,
      avgCommentsPerUser: newUsers.length > 0 ?
        Math.round(newUsers.reduce((sum, u) => sum + u.user.forumComments.length, 0) / newUsers.length) : 0,
      avgSessionDuration: 20,
      characteristics: [
        'Recently joined the community',
        'Still learning community norms',
        'Critical onboarding period',
        'High potential for growth'
      ]
    }
  ]

  return segments
}

async function getContentInsights(workspaceId: string, startDate: Date, days: number): Promise<ContentInsight[]> {
  const insights: ContentInsight[] = []

  // Trending Topics Analysis
  const topCategories = await prisma.communityForumPost.groupBy({
    by: ['category'],
    where: { workspaceId, createdAt: { gte: startDate } },
    _count: { id: true },
    _avg: { likes: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5
  })

  insights.push({
    type: 'TRENDING_TOPICS',
    title: 'Trending Discussion Topics',
    description: 'Most popular categories and topics in recent discussions',
    data: {
      categories: topCategories.map(cat => ({
        name: cat.category,
        posts: cat._count.id,
        avgEngagement: Math.round(cat._avg.likes || 0)
      }))
    },
    recommendations: [
      'Create more content around trending topics',
      'Consider featured discussions for popular categories',
      'Engage with high-performing content'
    ]
  })

  // Peak Activity Hours
  const hourlyActivity = await getHourlyActivityPattern(workspaceId, startDate)

  insights.push({
    type: 'PEAK_HOURS',
    title: 'Community Activity Patterns',
    description: 'When your community is most active throughout the day',
    data: {
      peakHours: hourlyActivity.slice(0, 3),
      activityByHour: hourlyActivity
    },
    recommendations: [
      'Schedule important announcements during peak hours',
      'Consider live events during high-activity periods',
      'Optimize moderation coverage for busy times'
    ]
  })

  // Content Type Performance
  const contentTypes = await analyzeContentTypes(workspaceId, startDate)

  insights.push({
    type: 'CONTENT_TYPES',
    title: 'Content Performance by Type',
    description: 'Which types of content generate the most engagement',
    data: contentTypes,
    recommendations: [
      'Focus on creating more high-performing content types',
      'Experiment with underutilized content formats',
      'Encourage users to share successful content types'
    ]
  })

  // Engagement Patterns
  const engagementPatterns = await analyzeEngagementPatterns(workspaceId, startDate)

  insights.push({
    type: 'ENGAGEMENT_PATTERNS',
    title: 'User Engagement Patterns',
    description: 'How users typically interact with community content',
    data: engagementPatterns,
    recommendations: [
      'Encourage cross-platform engagement',
      'Implement gamification for lurkers',
      'Create discussion starters for quiet periods'
    ]
  })

  return insights
}

async function getPredictiveInsights(workspaceId: string, startDate: Date, days: number): Promise<PredictiveInsight[]> {
  // Calculate trends and make predictions
  const [currentUsers, previousUsers] = await Promise.all([
    prisma.userWorkspace.count({ where: { workspaceId } }),
    prisma.userWorkspace.count({
      where: {
        workspaceId,
        createdAt: { lt: startDate }
      }
    })
  ])

  const userGrowthRate = previousUsers > 0 ?
    ((currentUsers - previousUsers) / previousUsers) * 100 : 0

  const [currentPosts, previousPosts] = await Promise.all([
    prisma.communityForumPost.count({
      where: { workspaceId, createdAt: { gte: startDate } }
    }),
    prisma.communityForumPost.count({
      where: {
        workspaceId,
        createdAt: {
          gte: new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000),
          lt: startDate
        }
      }
    })
  ])

  const postGrowthRate = previousPosts > 0 ?
    ((currentPosts - previousPosts) / previousPosts) * 100 : 0

  return [
    {
      metric: 'User Growth',
      currentValue: currentUsers,
      predictedValue: Math.round(currentUsers * (1 + (userGrowthRate / 100))),
      confidence: userGrowthRate > 0 ? 75 : 60,
      timeframe: 'next 30 days',
      factors: [
        'Historical growth trend',
        'Seasonal patterns',
        'Recent engagement levels',
        'Content quality improvements'
      ]
    },
    {
      metric: 'Daily Posts',
      currentValue: Math.round(currentPosts / days),
      predictedValue: Math.round((currentPosts / days) * (1 + (postGrowthRate / 100))),
      confidence: 70,
      timeframe: 'next 30 days',
      factors: [
        'User growth trajectory',
        'Content engagement trends',
        'Community health score',
        'Moderation effectiveness'
      ]
    },
    {
      metric: 'Community Health Score',
      currentValue: 78,
      predictedValue: 82,
      confidence: 65,
      timeframe: 'next 30 days',
      factors: [
        'Improving moderation response times',
        'Reduced spam detection',
        'Increasing user engagement',
        'Better content quality'
      ]
    }
  ]
}

async function getCommunityTrends(workspaceId: string, days: number): Promise<CommunityTrend[]> {
  const trends: CommunityTrend[] = []

  // Calculate various trend metrics
  const currentPeriod = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const previousPeriod = new Date(currentPeriod.getTime() - days * 24 * 60 * 60 * 1000)

  const [currentData, previousData] = await Promise.all([
    // Current period data
    Promise.all([
      prisma.communityForumPost.count({
        where: { workspaceId, createdAt: { gte: currentPeriod } }
      }),
      prisma.communityForumComment.count({
        where: { post: { workspaceId }, createdAt: { gte: currentPeriod } }
      }),
      prisma.userWorkspace.count({
        where: {
          workspaceId,
          user: {
            OR: [
              { forumPosts: { some: { createdAt: { gte: currentPeriod } } } },
              { forumComments: { some: { createdAt: { gte: currentPeriod } } } }
            ]
          }
        }
      })
    ]),
    // Previous period data
    Promise.all([
      prisma.communityForumPost.count({
        where: {
          workspaceId,
          createdAt: { gte: previousPeriod, lt: currentPeriod }
        }
      }),
      prisma.communityForumComment.count({
        where: {
          post: { workspaceId },
          createdAt: { gte: previousPeriod, lt: currentPeriod }
        }
      }),
      prisma.userWorkspace.count({
        where: {
          workspaceId,
          user: {
            OR: [
              { forumPosts: { some: {
                createdAt: { gte: previousPeriod, lt: currentPeriod }
              }}},
              { forumComments: { some: {
                createdAt: { gte: previousPeriod, lt: currentPeriod }
              }}}
            ]
          }
        }
      })
    ])
  ])

  const [currentPosts, currentComments, currentActiveUsers] = currentData
  const [previousPosts, previousComments, previousActiveUsers] = previousData

  // Calculate trends
  const postTrend = calculateTrend(currentPosts, previousPosts)
  const commentTrend = calculateTrend(currentComments, previousComments)
  const userTrend = calculateTrend(currentActiveUsers, previousActiveUsers)

  trends.push(
    {
      metric: 'Forum Posts',
      direction: postTrend.direction,
      changePercentage: postTrend.change,
      timeframe: `${days} days`,
      significance: Math.abs(postTrend.change) > 20 ? 'HIGH' :
                   Math.abs(postTrend.change) > 10 ? 'MEDIUM' : 'LOW',
      description: `Forum posting activity has ${postTrend.direction.toLowerCase()} by ${Math.abs(postTrend.change)}%`
    },
    {
      metric: 'Comments & Discussions',
      direction: commentTrend.direction,
      changePercentage: commentTrend.change,
      timeframe: `${days} days`,
      significance: Math.abs(commentTrend.change) > 25 ? 'HIGH' :
                   Math.abs(commentTrend.change) > 15 ? 'MEDIUM' : 'LOW',
      description: `Comment activity has ${commentTrend.direction.toLowerCase()} by ${Math.abs(commentTrend.change)}%`
    },
    {
      metric: 'Active Users',
      direction: userTrend.direction,
      changePercentage: userTrend.change,
      timeframe: `${days} days`,
      significance: Math.abs(userTrend.change) > 15 ? 'HIGH' :
                   Math.abs(userTrend.change) > 8 ? 'MEDIUM' : 'LOW',
      description: `Active user count has ${userTrend.direction.toLowerCase()} by ${Math.abs(userTrend.change)}%`
    }
  )

  return trends
}

function calculateTrend(current: number, previous: number) {
  if (previous === 0) {
    return { direction: 'INCREASING' as const, change: 100 }
  }

  const change = ((current - previous) / previous) * 100

  if (Math.abs(change) < 5) {
    return { direction: 'STABLE' as const, change: Math.round(change) }
  }

  return {
    direction: change > 0 ? 'INCREASING' as const : 'DECREASING' as const,
    change: Math.round(Math.abs(change))
  }
}

// Additional helper functions
async function getHourlyActivityPattern(workspaceId: string, startDate: Date) {
  // Mock hourly activity data - in real implementation, extract from timestamps
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    posts: Math.floor(Math.random() * 20) + (i >= 9 && i <= 17 ? 10 : 0),
    comments: Math.floor(Math.random() * 30) + (i >= 9 && i <= 17 ? 15 : 0)
  }))

  return hours.sort((a, b) => (b.posts + b.comments) - (a.posts + a.comments))
}

async function analyzeContentTypes(workspaceId: string, startDate: Date) {
  // Mock content type analysis
  return {
    textPosts: { count: 145, avgEngagement: 4.2 },
    questions: { count: 89, avgEngagement: 6.7 },
    announcements: { count: 23, avgEngagement: 8.9 },
    discussions: { count: 167, avgEngagement: 5.1 }
  }
}

async function analyzeEngagementPatterns(workspaceId: string, startDate: Date) {
  return {
    averageTimeToFirstComment: 2.5, // hours
    averageCommentsPerPost: 3.8,
    likesToCommentsRatio: 2.1,
    peakEngagementWindow: '2-4 hours after posting'
  }
}

async function getEngagementAnalysis(workspaceId: string, startDate: Date) {
  return {
    topEngagementDrivers: [
      'Questions and polls',
      'Community challenges',
      'User-generated content',
      'Expert AMAs'
    ],
    lowEngagementAreas: [
      'Technical documentation',
      'Policy announcements',
      'Routine updates'
    ],
    engagementOptimization: [
      'Add interactive elements to announcements',
      'Create discussion prompts for documentation',
      'Implement community voting on updates'
    ]
  }
}

async function getGrowthDrivers(workspaceId: string, startDate: Date) {
  return {
    primaryDrivers: [
      'Word-of-mouth referrals',
      'Quality content creation',
      'Active moderation',
      'Regular events and challenges'
    ],
    growthBottlenecks: [
      'Complex onboarding process',
      'Limited mobile optimization',
      'Unclear community guidelines'
    ],
    recommendations: [
      'Simplify new user registration',
      'Improve mobile experience',
      'Create welcome guides and tutorials'
    ]
  }
}

async function getRetentionFactors(workspaceId: string, startDate: Date) {
  return {
    retentionStrengths: [
      'Strong sense of community',
      'Helpful and responsive members',
      'Regular fresh content',
      'Good moderation balance'
    ],
    retentionRisks: [
      'Long response times to questions',
      'Repetitive content',
      'Limited personalization'
    ],
    improvementAreas: [
      'Implement user mentorship program',
      'Create personalized content recommendations',
      'Develop community badges and achievements'
    ]
  }
}

async function getCompetitiveAnalysis(workspaceId: string, startDate: Date) {
  return {
    competitiveAdvantages: [
      'Integrated platform features',
      'Professional moderation tools',
      'Comprehensive analytics',
      'Multi-platform integration'
    ],
    marketPosition: 'Strong in enterprise segment',
    benchmarkMetrics: {
      industryAvgEngagement: '3.2%',
      yourEngagement: '4.7%',
      industryAvgRetention: '68%',
      yourRetention: '74%'
    },
    strategicRecommendations: [
      'Leverage analytics advantage in marketing',
      'Expand enterprise partnerships',
      'Develop unique community features'
    ]
  }
}

async function getSpecificInsight(workspaceId: string, type: string, startDate: Date, days: number) {
  switch (type) {
    case 'behavior':
      return await getUserBehaviorInsights(workspaceId, startDate)
    case 'content':
      return await getContentInsights(workspaceId, startDate, days)
    case 'predictive':
      return await getPredictiveInsights(workspaceId, startDate, days)
    case 'trends':
      return await getCommunityTrends(workspaceId, days)
    default:
      throw new Error(`Unknown insight type: ${type}`)
  }
}