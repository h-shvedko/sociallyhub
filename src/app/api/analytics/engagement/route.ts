import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { subDays, format, startOfDay, endOfDay } from 'date-fns'

// GET /api/analytics/engagement - Get engagement analytics data
async function getHandler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Normalize user ID for consistency with legacy sessions
    const userId = await normalizeUserId(session.user.id)

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30d'
    
    // Calculate date range
    const now = new Date()
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true }
    })
    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Get social accounts grouped by platform
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        status: 'ACTIVE'
      },
      select: {
        id: true,
        provider: true,
        displayName: true
      }
    })

    // Group accounts by platform
    const platformGroups = socialAccounts.reduce((acc, account) => {
      if (!acc[account.provider]) {
        acc[account.provider] = []
      }
      acc[account.provider].push(account.id)
      return acc
    }, {} as Record<string, string[]>)

    // Get platform colors
    const platformColors = {
      TWITTER: '#1DA1F2',
      INSTAGRAM: '#E4405F',
      LINKEDIN: '#0077B5',
      FACEBOOK: '#4267B2',
      TIKTOK: '#000000',
      YOUTUBE: '#FF0000'
    }

    // Fetch engagement metrics for each platform
    const platformData = await Promise.all(
      Object.entries(platformGroups).map(async ([provider, accountIds]) => {
        // Get posts for this platform in the time range
        const posts = await prisma.post.findMany({
          where: {
            workspaceId: { in: workspaceIds },
            createdAt: { gte: startDate },
            variants: {
              some: {
                socialAccounts: {
                  some: {
                    id: { in: accountIds }
                  }
                }
              }
            }
          },
          include: {
            metrics: {
              where: {
                metricType: { in: ['likes', 'comments', 'shares', 'saves', 'reach', 'impressions'] }
              }
            }
          }
        })

        // Aggregate metrics
        const metrics = posts.reduce((acc, post) => {
          post.metrics.forEach(metric => {
            acc[metric.metricType] = (acc[metric.metricType] || 0) + metric.value
          })
          return acc
        }, {} as Record<string, number>)

        const totalEngagements = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0)
        const reach = metrics.reach || 0
        const engagementRate = reach > 0 ? (totalEngagements / reach) * 100 : 0

        return {
          platform: provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase(),
          likes: metrics.likes || 0,
          comments: metrics.comments || 0,
          shares: metrics.shares || 0,
          saves: metrics.saves || 0,
          reach: reach,
          impressions: metrics.impressions || 0,
          engagementRate: Math.round(engagementRate * 10) / 10,
          color: platformColors[provider as keyof typeof platformColors] || '#6B7280'
        }
      })
    )

    // Generate trend data for the time period
    const trendData = await Promise.all(
      Array.from({ length: days }, async (_, i) => {
        const date = subDays(new Date(), days - 1 - i)
        const dayStart = startOfDay(date)
        const dayEnd = endOfDay(date)

        // Get daily metrics
        const dailyMetrics = await prisma.analyticsMetric.findMany({
          where: {
            userId,
            date: {
              gte: dayStart,
              lte: dayEnd
            },
            metricType: { in: ['likes', 'comments', 'shares', 'reach'] }
          }
        })

        const dailyTotals = dailyMetrics.reduce((acc, metric) => {
          acc[metric.metricType] = (acc[metric.metricType] || 0) + metric.value
          return acc
        }, {} as Record<string, number>)

        const dailyEngagements = (dailyTotals.likes || 0) + (dailyTotals.comments || 0) + (dailyTotals.shares || 0)
        const dailyReach = dailyTotals.reach || 0
        const dailyEngagementRate = dailyReach > 0 ? (dailyEngagements / dailyReach) * 100 : 0

        return {
          date: format(date, 'MMM dd'),
          likes: dailyTotals.likes || 0,
          comments: dailyTotals.comments || 0,
          shares: dailyTotals.shares || 0,
          reach: dailyReach,
          engagementRate: Math.round(dailyEngagementRate * 10) / 10
        }
      })
    )

    return NextResponse.json({
      platformData: platformData.filter(p => p.likes > 0 || p.comments > 0 || p.shares > 0), // Only return platforms with data
      trendData,
      timeRange,
      lastUpdated: now.toISOString()
    })

  } catch (error) {
    console.error('Error fetching engagement analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'analytics-engagement')