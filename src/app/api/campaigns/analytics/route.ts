import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const campaignId = searchParams.get('campaignId') // Optional filter for specific campaign
    const dateRange = searchParams.get('dateRange') || '30d' // 7d, 30d, 90d, 1y

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId, workspaceId }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace access denied' }, { status: 403 })
    }

    // Calculate date range
    const now = new Date()
    const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))

    // Get campaigns in workspace
    const campaignsFilter = campaignId && campaignId !== 'all' 
      ? { workspaceId, id: campaignId }
      : { workspaceId }
    
    const campaigns = await prisma.campaign.findMany({
      where: campaignsFilter,
      include: {
        posts: {
          include: {
            metrics: {
              where: {
                date: {
                  gte: startDate
                }
              }
            }
          }
        }
      }
    })

    // Calculate analytics from real metrics data
    let totalReach = 0
    let totalImpressions = 0
    let totalEngagement = 0
    let totalClicks = 0
    let totalConversions = 0
    let totalSpent = 0

    // Performance over time data
    const performanceData: { [key: string]: any } = {}
    
    // Top posts data
    const postPerformance: Array<{
      id: string
      content: string
      reach: number
      engagement: number
      impressions: number
      clicks: number
      campaignName: string
    }> = []

    // Demographics data (we'll simulate some for now since we don't have detailed demographic data)
    const platformData: { [key: string]: number } = {}

    campaigns.forEach(campaign => {
      const budget = (campaign as any).budget || {}
      totalSpent += budget.spentAmount || 0

      campaign.posts.forEach(post => {
        let postReach = 0
        let postEngagement = 0
        let postImpressions = 0
        let postClicks = 0

        post.metrics.forEach(metric => {
          switch (metric.metricType) {
            case 'reach':
              totalReach += metric.value
              postReach += metric.value
              break
            case 'impressions':
              totalImpressions += metric.value
              postImpressions += metric.value
              break
            case 'engagement':
              totalEngagement += metric.value
              postEngagement += metric.value
              break
            case 'clicks':
              totalClicks += metric.value
              postClicks += metric.value
              break
            case 'conversions':
              totalConversions += metric.value
              break
          }

          // Track platform performance
          if (metric.platform) {
            platformData[metric.platform] = (platformData[metric.platform] || 0) + metric.value
          }

          // Track performance over time
          const dateKey = metric.date.toISOString().split('T')[0]
          if (!performanceData[dateKey]) {
            performanceData[dateKey] = {
              date: dateKey,
              reach: 0,
              engagement: 0,
              impressions: 0,
              clicks: 0
            }
          }
          performanceData[dateKey][metric.metricType] = (performanceData[dateKey][metric.metricType] || 0) + metric.value
        })

        // Add to top posts if has performance data
        if (postReach > 0 || postEngagement > 0) {
          postPerformance.push({
            id: post.id,
            content: post.baseContent || post.title || 'Untitled Post',
            reach: postReach,
            engagement: postEngagement,
            impressions: postImpressions,
            clicks: postClicks,
            campaignName: campaign.name
          })
        }
      })
    })

    // Sort posts by engagement
    postPerformance.sort((a, b) => b.engagement - a.engagement)
    const topPosts = postPerformance.slice(0, 10)

    // Calculate averages
    const averageEngagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0
    const averageCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const averageROI = totalSpent > 0 ? ((totalEngagement * 0.1 - totalSpent) / totalSpent) * 100 : 0 // Rough ROI calculation

    // Convert performance data to array and sort by date
    const performance = Object.values(performanceData).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Create demographics from platform data (simplified)
    const totalPlatformEngagement = Object.values(platformData).reduce((sum: number, val: number) => sum + val, 0)
    const demographics = {
      platforms: Object.entries(platformData).map(([platform, engagement]) => ({
        platform,
        percentage: totalPlatformEngagement > 0 ? ((engagement / totalPlatformEngagement) * 100).toFixed(1) : 0
      })),
      // Mock some demographic data since we don't store this currently
      ageGroups: totalEngagement > 0 ? {
        '18-24': 25,
        '25-34': 35,
        '35-44': 20,
        '45-54': 15,
        '55+': 5
      } : {},
      genders: totalEngagement > 0 ? {
        'Female': 52,
        'Male': 46,
        'Other': 2
      } : {},
      locations: totalEngagement > 0 ? {
        'United States': 45,
        'United Kingdom': 20,
        'Canada': 15,
        'Australia': 10,
        'Other': 10
      } : {}
    }

    const analyticsData = {
      overview: {
        totalReach,
        totalImpressions,
        totalEngagement,
        totalClicks,
        totalConversions,
        totalSpent,
        averageROI: Math.round(averageROI * 10) / 10,
        averageCTR: Math.round(averageCTR * 100) / 100,
        averageEngagementRate: Math.round(averageEngagementRate * 100) / 100
      },
      performance,
      demographics,
      topPosts,
      campaignBreakdown: campaigns.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        postsCount: campaign.posts.length,
        totalBudget: (campaign as any).budget?.totalBudget || 0,
        spentBudget: (campaign as any).budget?.spentAmount || 0
      }))
    }

    return NextResponse.json(analyticsData)
  } catch (error) {
    console.error('Error fetching campaign analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign analytics' },
      { status: 500 }
    )
  }
}