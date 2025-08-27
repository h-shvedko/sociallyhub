import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

export async function GET(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    try {
      // Get basic campaign counts
      const [
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        draftCampaigns,
        pausedCampaigns,
        cancelledCampaigns,
        statusBreakdown,
        typeBreakdown,
        recentCampaigns
      ] = await Promise.all([
        // Total campaigns
        prisma.campaign.count({
          where: { workspaceId }
        }),
        
        // Active campaigns
        prisma.campaign.count({
          where: { 
            workspaceId,
            objectives: {
              path: ['status'],
              equals: 'ACTIVE'
            }
          }
        }),
        
        // Completed campaigns
        prisma.campaign.count({
          where: { 
            workspaceId,
            objectives: {
              path: ['status'],
              equals: 'COMPLETED'
            }
          }
        }),
        
        // Draft campaigns
        prisma.campaign.count({
          where: { 
            workspaceId,
            objectives: {
              path: ['status'],
              equals: 'DRAFT'
            }
          }
        }),
        
        // Paused campaigns
        prisma.campaign.count({
          where: { 
            workspaceId,
            objectives: {
              path: ['status'],
              equals: 'PAUSED'
            }
          }
        }),
        
        // Cancelled campaigns
        prisma.campaign.count({
          where: { 
            workspaceId,
            objectives: {
              path: ['status'],
              equals: 'CANCELLED'
            }
          }
        }),
        
        // Status breakdown using raw SQL for better performance
        prisma.$queryRaw`
          SELECT 
            objectives->>'status' as status,
            COUNT(*) as count
          FROM campaigns 
          WHERE "workspaceId" = ${workspaceId}
            AND objectives->>'status' IS NOT NULL
          GROUP BY objectives->>'status'
        `,
        
        // Type breakdown using raw SQL
        prisma.$queryRaw`
          SELECT 
            objectives->>'type' as type,
            COUNT(*) as count
          FROM campaigns 
          WHERE "workspaceId" = ${workspaceId}
            AND objectives->>'type' IS NOT NULL
          GROUP BY objectives->>'type'
        `,
        
        // Recent campaigns (last 30 days)
        prisma.campaign.count({
          where: {
            workspaceId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ])

      // Calculate budget statistics
      const budgetStats = await calculateBudgetStats(workspaceId)
      
      // Get performance data
      const performanceStats = await calculatePerformanceStats(workspaceId)
      
      // Get monthly trend data
      const monthlyTrends = await getMonthlyTrends(workspaceId)
      
      // Get top performing campaigns
      const topPerformers = await getTopPerformingCampaigns(workspaceId)

      return NextResponse.json({
        overview: {
          totalCampaigns,
          activeCampaigns,
          completedCampaigns,
          draftCampaigns,
          pausedCampaigns,
          cancelledCampaigns,
          recentCampaigns,
          ...budgetStats,
          ...performanceStats
        },
        breakdowns: {
          byStatus: Object.fromEntries(
            (statusBreakdown as any[]).map((item: any) => [item.status, parseInt(item.count)])
          ),
          byType: Object.fromEntries(
            (typeBreakdown as any[]).map((item: any) => [item.type, parseInt(item.count)])
          )
        },
        trends: {
          monthly: monthlyTrends
        },
        topPerformers
      })
    } catch (error) {
      console.error('Error fetching campaign statistics:', error)
      return NextResponse.json({
        error: 'Failed to fetch campaign statistics'
      }, { status: 500 })
    }
  }, 'campaigns-stats')(request)
}

async function calculateBudgetStats(workspaceId: string) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      select: {
        objectives: true
      }
    })

    let totalBudget = 0
    let spentBudget = 0
    let activeBudget = 0

    campaigns.forEach(campaign => {
      const budget = (campaign.objectives as any)?.budget
      if (budget) {
        totalBudget += budget.totalBudget || 0
        spentBudget += budget.spentAmount || 0
        
        // Count as active budget if campaign is active
        const status = (campaign.objectives as any)?.status
        if (status === 'ACTIVE') {
          activeBudget += budget.remainingAmount || 0
        }
      }
    })

    return {
      totalBudget,
      spentBudget,
      remainingBudget: totalBudget - spentBudget,
      activeBudget
    }
  } catch (error) {
    console.error('Error calculating budget stats:', error)
    return {
      totalBudget: 0,
      spentBudget: 0,
      remainingBudget: 0,
      activeBudget: 0
    }
  }
}

async function calculatePerformanceStats(workspaceId: string) {
  try {
    // Get all posts from campaigns in this workspace
    const campaignPosts = await prisma.post.findMany({
      where: {
        workspaceId,
        campaignId: { not: null }
      },
      include: {
        metrics: true
      }
    })

    let totalReach = 0
    let totalImpressions = 0
    let totalEngagement = 0
    let totalClicks = 0
    let totalConversions = 0

    campaignPosts.forEach(post => {
      post.metrics.forEach(metric => {
        switch (metric.metricType) {
          case 'reach':
            totalReach += metric.value
            break
          case 'impressions':
            totalImpressions += metric.value
            break
          case 'engagement':
            totalEngagement += metric.value
            break
          case 'clicks':
            totalClicks += metric.value
            break
          case 'conversions':
            totalConversions += metric.value
            break
        }
      })
    })

    const averageROI = totalConversions > 0 && totalImpressions > 0 
      ? ((totalConversions / totalImpressions) * 100)
      : 0

    return {
      totalReach,
      totalImpressions,
      totalEngagement,
      totalClicks,
      totalConversions,
      averageROI
    }
  } catch (error) {
    console.error('Error calculating performance stats:', error)
    return {
      totalReach: 0,
      totalImpressions: 0,
      totalEngagement: 0,
      totalClicks: 0,
      totalConversions: 0,
      averageROI: 0
    }
  }
}

async function getMonthlyTrends(workspaceId: string) {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyData = await prisma.$queryRaw`
      SELECT 
        TO_CHAR("createdAt", 'YYYY-MM') as month,
        COUNT(*) as campaigns,
        COALESCE(SUM(CAST(objectives->'budget'->>'totalBudget' AS NUMERIC)), 0) as budget
      FROM campaigns 
      WHERE "workspaceId" = ${workspaceId}
        AND "createdAt" >= ${sixMonthsAgo}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month
    `

    // Get performance data for each month
    const trendsWithPerformance = await Promise.all(
      (monthlyData as any[]).map(async (monthData) => {
        const monthStart = new Date(`${monthData.month}-01`)
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
        
        const performance = await calculateMonthPerformance(workspaceId, monthStart, monthEnd)
        
        return {
          month: monthData.month,
          campaigns: parseInt(monthData.campaigns),
          budget: parseFloat(monthData.budget),
          performance
        }
      })
    )

    return trendsWithPerformance
  } catch (error) {
    console.error('Error getting monthly trends:', error)
    return []
  }
}

async function calculateMonthPerformance(workspaceId: string, startDate: Date, endDate: Date) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        posts: {
          include: {
            metrics: true
          }
        }
      }
    })

    let reach = 0
    let engagement = 0
    let conversions = 0

    campaigns.forEach(campaign => {
      campaign.posts.forEach(post => {
        post.metrics.forEach(metric => {
          switch (metric.metricType) {
            case 'reach':
              reach += metric.value
              break
            case 'engagement':
              engagement += metric.value
              break
            case 'conversions':
              conversions += metric.value
              break
          }
        })
      })
    })

    return { reach, engagement, conversions }
  } catch (error) {
    console.error('Error calculating month performance:', error)
    return { reach: 0, engagement: 0, conversions: 0 }
  }
}

async function getTopPerformingCampaigns(workspaceId: string, limit: number = 5) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        posts: {
          include: {
            metrics: true
          }
        }
      }
    })

    const campaignPerformance = campaigns.map(campaign => {
      let reach = 0
      let engagement = 0
      let conversions = 0
      let impressions = 0

      campaign.posts.forEach(post => {
        post.metrics.forEach(metric => {
          switch (metric.metricType) {
            case 'reach':
              reach += metric.value
              break
            case 'engagement':
              engagement += metric.value
              break
            case 'conversions':
              conversions += metric.value
              break
            case 'impressions':
              impressions += metric.value
              break
          }
        })
      })

      const roi = impressions > 0 ? (conversions / impressions) * 100 : 0

      return {
        campaignId: campaign.id,
        name: campaign.name,
        roi,
        reach,
        engagement
      }
    })

    return campaignPerformance
      .sort((a, b) => b.roi - a.roi)
      .slice(0, limit)
  } catch (error) {
    console.error('Error getting top performing campaigns:', error)
    return []
  }
}