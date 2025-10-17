import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/feature-requests/analytics - Get feature request analytics
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

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const periodDays = parseInt(period)
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

    // If specific metric requested, return only that
    if (metric) {
      const data = await getSpecificFeatureMetric(workspaceId, metric, startDate, periodDays)
      return NextResponse.json({ [metric]: data })
    }

    // Get comprehensive analytics
    const [
      overviewStats,
      submissionTrend,
      statusDistribution,
      categoryAnalysis,
      priorityAnalysis,
      implementationTimeline,
      topRequesters,
      votingAnalysis,
      moderationEfficiency
    ] = await Promise.all([
      getOverviewStats(workspaceId, startDate),
      getSubmissionTrend(workspaceId, periodDays),
      getStatusDistribution(workspaceId),
      getCategoryAnalysis(workspaceId, startDate),
      getPriorityAnalysis(workspaceId),
      getImplementationTimeline(workspaceId, periodDays),
      getTopRequesters(workspaceId, startDate),
      getVotingAnalysis(workspaceId, startDate),
      getModerationEfficiency(workspaceId, startDate)
    ])

    return NextResponse.json({
      period: `${periodDays} days`,
      overviewStats,
      submissionTrend,
      statusDistribution,
      categoryAnalysis,
      priorityAnalysis,
      implementationTimeline,
      topRequesters,
      votingAnalysis,
      moderationEfficiency,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to fetch feature request analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature request analytics' },
      { status: 500 }
    )
  }
}

// Helper functions for analytics
async function getOverviewStats(workspaceId: string, startDate: Date) {
  const [
    totalRequests,
    newRequests,
    approvedRequests,
    implementedRequests,
    rejectedRequests,
    averageVotes,
    totalVotes
  ] = await Promise.all([
    prisma.featureRequest.count({
      where: { workspaceId }
    }),
    prisma.featureRequest.count({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      }
    }),
    prisma.featureRequest.count({
      where: {
        workspaceId,
        status: 'APPROVED'
      }
    }),
    prisma.featureRequest.count({
      where: {
        workspaceId,
        status: 'IMPLEMENTED'
      }
    }),
    prisma.featureRequest.count({
      where: {
        workspaceId,
        status: 'REJECTED'
      }
    }),
    prisma.featureRequest.aggregate({
      where: { workspaceId },
      _avg: { votes: true }
    }),
    prisma.featureRequestVote.count({
      where: {
        request: { workspaceId }
      }
    })
  ])

  const implementationRate = totalRequests > 0 ?
    ((implementedRequests / totalRequests) * 100).toFixed(1) : '0'

  const approvalRate = totalRequests > 0 ?
    (((approvedRequests + implementedRequests) / totalRequests) * 100).toFixed(1) : '0'

  return {
    totalRequests,
    newRequests,
    approvedRequests,
    implementedRequests,
    rejectedRequests,
    totalVotes,
    averageVotes: Math.round(averageVotes._avg.votes || 0),
    implementationRate: parseFloat(implementationRate),
    approvalRate: parseFloat(approvalRate)
  }
}

async function getSubmissionTrend(workspaceId: string, days: number) {
  const trend = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const [submitted, approved, implemented] = await Promise.all([
      prisma.featureRequest.count({
        where: {
          workspaceId,
          createdAt: { gte: date, lt: nextDate }
        }
      }),
      prisma.featureRequest.count({
        where: {
          workspaceId,
          approvedAt: { gte: date, lt: nextDate }
        }
      }),
      prisma.featureRequest.count({
        where: {
          workspaceId,
          implementedAt: { gte: date, lt: nextDate }
        }
      })
    ])

    trend.push({
      date: date.toISOString().split('T')[0],
      submitted,
      approved,
      implemented
    })
  }

  return trend
}

async function getStatusDistribution(workspaceId: string) {
  const distribution = await prisma.featureRequest.groupBy({
    by: ['status'],
    where: { workspaceId },
    _count: { status: true }
  })

  const total = distribution.reduce((sum, item) => sum + item._count.status, 0)

  return distribution.map(item => ({
    status: item.status,
    count: item._count.status,
    percentage: total > 0 ? ((item._count.status / total) * 100).toFixed(1) : '0'
  }))
}

async function getCategoryAnalysis(workspaceId: string, startDate: Date) {
  const categories = await prisma.featureRequest.groupBy({
    by: ['category'],
    where: { workspaceId },
    _count: { category: true },
    _avg: { votes: true }
  })

  // Get implementation rate by category
  const categoryStats = await Promise.all(
    categories.map(async (cat) => {
      const [implemented, total] = await Promise.all([
        prisma.featureRequest.count({
          where: {
            workspaceId,
            category: cat.category,
            status: 'IMPLEMENTED'
          }
        }),
        prisma.featureRequest.count({
          where: {
            workspaceId,
            category: cat.category
          }
        })
      ])

      const implementationRate = total > 0 ? ((implemented / total) * 100).toFixed(1) : '0'

      return {
        category: cat.category,
        totalRequests: cat._count.category,
        averageVotes: Math.round(cat._avg.votes || 0),
        implementedCount: implemented,
        implementationRate: parseFloat(implementationRate)
      }
    })
  )

  return categoryStats.sort((a, b) => b.totalRequests - a.totalRequests)
}

async function getPriorityAnalysis(workspaceId: string) {
  const priorities = await prisma.featureRequest.groupBy({
    by: ['priority'],
    where: { workspaceId },
    _count: { priority: true },
    _avg: { votes: true }
  })

  const priorityStats = await Promise.all(
    priorities.map(async (priority) => {
      const [implemented, avgTimeToImplement] = await Promise.all([
        prisma.featureRequest.count({
          where: {
            workspaceId,
            priority: priority.priority,
            status: 'IMPLEMENTED'
          }
        }),
        // Calculate average time to implement
        prisma.featureRequest.findMany({
          where: {
            workspaceId,
            priority: priority.priority,
            status: 'IMPLEMENTED',
            implementedAt: { not: null }
          },
          select: {
            createdAt: true,
            implementedAt: true
          }
        })
      ])

      let avgDaysToImplement = 0
      if (avgTimeToImplement.length > 0) {
        const totalDays = avgTimeToImplement.reduce((sum, req) => {
          const days = Math.floor(
            (req.implementedAt!.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + days
        }, 0)
        avgDaysToImplement = Math.round(totalDays / avgTimeToImplement.length)
      }

      return {
        priority: priority.priority,
        count: priority._count.priority,
        averageVotes: Math.round(priority._avg.votes || 0),
        implementedCount: implemented,
        avgDaysToImplement
      }
    })
  )

  return priorityStats.sort((a, b) => {
    const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
    return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
           (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
  })
}

async function getImplementationTimeline(workspaceId: string, days: number) {
  const timeline = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const implemented = await prisma.featureRequest.findMany({
      where: {
        workspaceId,
        implementedAt: { gte: date, lt: nextDate }
      },
      select: {
        id: true,
        title: true,
        priority: true,
        category: true,
        votes: true,
        createdAt: true,
        implementedAt: true
      }
    })

    timeline.push({
      date: date.toISOString().split('T')[0],
      count: implemented.length,
      requests: implemented.map(req => ({
        ...req,
        daysToImplement: Math.floor(
          (req.implementedAt!.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      }))
    })
  }

  return timeline
}

async function getTopRequesters(workspaceId: string, startDate: Date) {
  const requesters = await prisma.featureRequest.groupBy({
    by: ['userId'],
    where: {
      workspaceId,
      createdAt: { gte: startDate },
      userId: { not: null }
    },
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 10
  })

  const userIds = requesters.map(r => r.userId).filter(Boolean)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, image: true }
  })

  const topRequestersWithDetails = await Promise.all(
    requesters.map(async (requester) => {
      const user = users.find(u => u.id === requester.userId)
      const [implemented, totalVotes] = await Promise.all([
        prisma.featureRequest.count({
          where: {
            workspaceId,
            userId: requester.userId!,
            status: 'IMPLEMENTED'
          }
        }),
        prisma.featureRequest.aggregate({
          where: {
            workspaceId,
            userId: requester.userId!
          },
          _sum: { votes: true }
        })
      ])

      return {
        user,
        requestCount: requester._count.userId,
        implementedCount: implemented,
        totalVotes: totalVotes._sum.votes || 0,
        implementationRate: requester._count.userId > 0 ?
          ((implemented / requester._count.userId) * 100).toFixed(1) : '0'
      }
    })
  )

  return topRequestersWithDetails
}

async function getVotingAnalysis(workspaceId: string, startDate: Date) {
  const [
    totalVotes,
    uniqueVoters,
    mostVotedRequests,
    votingTrend
  ] = await Promise.all([
    prisma.featureRequestVote.count({
      where: {
        request: { workspaceId },
        createdAt: { gte: startDate }
      }
    }),
    prisma.featureRequestVote.groupBy({
      by: ['userId'],
      where: {
        request: { workspaceId },
        createdAt: { gte: startDate }
      }
    }).then(result => result.length),
    prisma.featureRequest.findMany({
      where: { workspaceId },
      orderBy: { votes: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        votes: true,
        createdAt: true
      }
    }),
    // Daily voting activity
    Promise.all(
      Array.from({ length: 7 }, async (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        date.setHours(0, 0, 0, 0)
        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)

        const votes = await prisma.featureRequestVote.count({
          where: {
            request: { workspaceId },
            createdAt: { gte: date, lt: nextDate }
          }
        })

        return {
          date: date.toISOString().split('T')[0],
          votes
        }
      })
    )
  ])

  return {
    totalVotes,
    uniqueVoters,
    averageVotesPerVoter: uniqueVoters > 0 ? (totalVotes / uniqueVoters).toFixed(1) : '0',
    mostVotedRequests,
    votingTrend
  }
}

async function getModerationEfficiency(workspaceId: string, startDate: Date) {
  const [
    totalModerationActions,
    averageTimeToModerate,
    moderationByStatus
  ] = await Promise.all([
    prisma.moderationAction.count({
      where: {
        workspaceId,
        targetType: 'FEATURE_REQUEST',
        createdAt: { gte: startDate }
      }
    }),
    // Calculate average time from creation to first moderation
    prisma.featureRequest.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        OR: [
          { approvedAt: { not: null } },
          { rejectedAt: { not: null } }
        ]
      },
      select: {
        createdAt: true,
        approvedAt: true,
        rejectedAt: true
      }
    }),
    prisma.moderationAction.groupBy({
      by: ['actionType'],
      where: {
        workspaceId,
        targetType: 'FEATURE_REQUEST',
        createdAt: { gte: startDate }
      },
      _count: { actionType: true }
    })
  ])

  let avgHoursToModerate = 0
  if (averageTimeToModerate.length > 0) {
    const totalHours = averageTimeToModerate.reduce((sum, req) => {
      const moderatedAt = req.approvedAt || req.rejectedAt
      if (moderatedAt) {
        const hours = (moderatedAt.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60)
        return sum + hours
      }
      return sum
    }, 0)
    avgHoursToModerate = Math.round(totalHours / averageTimeToModerate.length)
  }

  return {
    totalModerationActions,
    avgHoursToModerate,
    moderationByStatus
  }
}

async function getSpecificFeatureMetric(workspaceId: string, metric: string, startDate: Date, days: number) {
  switch (metric) {
    case 'overviewStats':
      return await getOverviewStats(workspaceId, startDate)
    case 'submissionTrend':
      return await getSubmissionTrend(workspaceId, days)
    case 'statusDistribution':
      return await getStatusDistribution(workspaceId)
    case 'categoryAnalysis':
      return await getCategoryAnalysis(workspaceId, startDate)
    case 'priorityAnalysis':
      return await getPriorityAnalysis(workspaceId)
    case 'implementationTimeline':
      return await getImplementationTimeline(workspaceId, days)
    case 'topRequesters':
      return await getTopRequesters(workspaceId, startDate)
    case 'votingAnalysis':
      return await getVotingAnalysis(workspaceId, startDate)
    case 'moderationEfficiency':
      return await getModerationEfficiency(workspaceId, startDate)
    default:
      throw new Error(`Unknown metric: ${metric}`)
  }
}