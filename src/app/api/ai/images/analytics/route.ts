import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const visualAnalyticsSchema = z.object({
  timeframe: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']).optional(),
  metricType: z.enum(['engagement', 'reach', 'aesthetics', 'brand_consistency']).optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d'
    const platform = searchParams.get('platform')
    const metricType = searchParams.get('metricType')

    const { timeframe: validTimeframe, platform: validPlatform, metricType: validMetricType } = 
      visualAnalyticsSchema.parse({
        timeframe,
        platform: platform || undefined,
        metricType: metricType || undefined
      })

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Calculate date range
    const now = new Date()
    const timeframeMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    }
    const startDate = new Date(now.getTime() - timeframeMap[validTimeframe] * 24 * 60 * 60 * 1000)

    // Get visual performance metrics
    const whereClause = {
      workspaceId: userWorkspace.workspaceId,
      createdAt: { gte: startDate },
      ...(validPlatform && { platform: validPlatform }),
      ...(validMetricType && { metricType: validMetricType })
    }

    const visualMetrics = await prisma.visualPerformanceMetric.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          select: {
            id: true,
            content: true,
            scheduledAt: true,
            platforms: true
          }
        }
      }
    })

    // Get image analyses for the period
    const imageAnalyses = await prisma.imageAnalysis.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        createdAt: { gte: startDate },
        ...(validPlatform && { platform: validPlatform })
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate aggregated metrics
    const totalImages = imageAnalyses.length
    const avgAestheticScore = imageAnalyses.reduce((sum, analysis) => 
      sum + (analysis.aestheticScore || 0), 0) / totalImages || 0
    const avgBrandConsistency = imageAnalyses.reduce((sum, analysis) => 
      sum + (analysis.brandConsistencyScore || 0), 0) / totalImages || 0
    const avgSafetyScore = imageAnalyses.reduce((sum, analysis) => 
      sum + (analysis.safetyScore || 0), 0) / totalImages || 0

    // Color palette analysis
    const colorPalettes = imageAnalyses
      .flatMap(analysis => analysis.colorPalette || [])
      .reduce((acc: Record<string, number>, color) => {
        acc[color] = (acc[color] || 0) + 1
        return acc
      }, {})

    const topColors = Object.entries(colorPalettes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([color, count]) => ({ color, count }))

    // Performance trends
    const performanceTrends = visualMetrics.reduce((acc: Record<string, any>, metric) => {
      const date = metric.createdAt.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          date,
          engagement: 0,
          reach: 0,
          aestheticScore: 0,
          brandConsistency: 0,
          count: 0
        }
      }
      
      acc[date].engagement += metric.engagementRate || 0
      acc[date].reach += metric.reach || 0
      acc[date].aestheticScore += metric.aestheticScore || 0
      acc[date].brandConsistency += metric.brandConsistencyScore || 0
      acc[date].count += 1
      
      return acc
    }, {})

    // Average the trends
    const trendsArray = Object.values(performanceTrends).map((trend: any) => ({
      ...trend,
      engagement: trend.engagement / trend.count || 0,
      reach: trend.reach / trend.count || 0,
      aestheticScore: trend.aestheticScore / trend.count || 0,
      brandConsistency: trend.brandConsistency / trend.count || 0
    }))

    // Platform performance comparison
    const platformComparison = visualMetrics.reduce((acc: Record<string, any>, metric) => {
      const platform = metric.platform
      if (!acc[platform]) {
        acc[platform] = {
          platform,
          totalPosts: 0,
          avgEngagement: 0,
          avgReach: 0,
          avgAestheticScore: 0,
          avgBrandConsistency: 0
        }
      }
      
      acc[platform].totalPosts += 1
      acc[platform].avgEngagement += metric.engagementRate || 0
      acc[platform].avgReach += metric.reach || 0
      acc[platform].avgAestheticScore += metric.aestheticScore || 0
      acc[platform].avgBrandConsistency += metric.brandConsistencyScore || 0
      
      return acc
    }, {})

    // Average platform metrics
    const platformStats = Object.values(platformComparison).map((stats: any) => ({
      ...stats,
      avgEngagement: stats.avgEngagement / stats.totalPosts || 0,
      avgReach: stats.avgReach / stats.totalPosts || 0,
      avgAestheticScore: stats.avgAestheticScore / stats.totalPosts || 0,
      avgBrandConsistency: stats.avgBrandConsistency / stats.totalPosts || 0
    }))

    return NextResponse.json({
      success: true,
      analytics: {
        summary: {
          totalImages,
          avgAestheticScore: Math.round(avgAestheticScore * 100) / 100,
          avgBrandConsistency: Math.round(avgBrandConsistency * 100) / 100,
          avgSafetyScore: Math.round(avgSafetyScore * 100) / 100,
          timeframe: validTimeframe
        },
        colorAnalytics: {
          topColors,
          totalUniqueColors: Object.keys(colorPalettes).length
        },
        performanceTrends: trendsArray.sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        platformComparison: platformStats,
        recentMetrics: visualMetrics.slice(0, 10)
      }
    })

  } catch (error) {
    console.error('Visual analytics error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get visual analytics' },
      { status: 500 }
    )
  }
}