import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { SentimentMonitor } from '@/lib/audience/sentiment-monitor'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const sentimentTrendsSchema = z.object({
  timeframe: z.enum(['7d', '30d', '90d']).default('30d'),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']).optional(),
  groupBy: z.enum(['hour', 'day', 'week']).default('day')
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
    const groupBy = searchParams.get('groupBy') || 'day'

    const { timeframe: validTimeframe, platform: validPlatform, groupBy: validGroupBy } = 
      sentimentTrendsSchema.parse({
        timeframe,
        platform: platform || undefined,
        groupBy
      })

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Calculate date range
    const now = new Date()
    const timeframeMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    }
    const startDate = new Date(now.getTime() - timeframeMap[validTimeframe] * 24 * 60 * 60 * 1000)

    // Get sentiment trends
    const whereClause: any = {
      workspaceId: userWorkspace.workspaceId,
      date: { gte: startDate },
      ...(validPlatform && { platform: validPlatform })
    }

    const trends = await prisma.sentimentTrend.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    })

    // Initialize sentiment monitor for mood recommendations
    const sentimentMonitor = new SentimentMonitor()
    const moodRecommendations = await sentimentMonitor.getMoodRecommendations(userWorkspace.workspaceId)

    // Calculate aggregated metrics
    const totalMentions = trends.reduce((sum, trend) => sum + trend.totalMentions, 0)
    const avgSentiment = trends.length > 0 
      ? trends.reduce((sum, trend) => sum + trend.avgSentiment, 0) / trends.length 
      : 0

    // Identify significant changes
    const significantChanges = []
    for (let i = 1; i < trends.length; i++) {
      const current = trends[i]
      const previous = trends[i - 1]
      
      const sentimentChange = Math.abs(current.avgSentiment - previous.avgSentiment)
      const volumeChange = Math.abs(current.totalMentions - previous.totalMentions) / Math.max(previous.totalMentions, 1)
      
      if (sentimentChange > 0.3) {
        significantChanges.push({
          date: current.date,
          type: 'sentiment_shift',
          change: current.avgSentiment - previous.avgSentiment,
          description: `Sentiment ${current.avgSentiment > previous.avgSentiment ? 'improved' : 'declined'} by ${sentimentChange.toFixed(2)} points`
        })
      }
      
      if (volumeChange > 1.0) {
        significantChanges.push({
          date: current.date,
          type: 'volume_change',
          change: volumeChange,
          description: `Mention volume ${current.totalMentions > previous.totalMentions ? 'increased' : 'decreased'} by ${Math.round(volumeChange * 100)}%`
        })
      }
    }

    return NextResponse.json({
      success: true,
      trends,
      summary: {
        totalMentions,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        timeframe: validTimeframe,
        platform: validPlatform,
        trendCount: trends.length
      },
      moodRecommendations,
      significantChanges: significantChanges.slice(-5), // Last 5 significant changes
      insights: generateTrendInsights(trends, significantChanges)
    })

  } catch (error) {
    console.error('Sentiment trends error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get sentiment trends' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize sentiment monitor and update trends
    const sentimentMonitor = new SentimentMonitor()
    await sentimentMonitor.updateSentimentTrends(userWorkspace.workspaceId)

    return NextResponse.json({
      success: true,
      message: 'Sentiment trends updated successfully'
    })

  } catch (error) {
    console.error('Update sentiment trends error:', error)
    return NextResponse.json(
      { error: 'Failed to update sentiment trends' },
      { status: 500 }
    )
  }
}

function generateTrendInsights(trends: any[], changes: any[]): string[] {
  const insights = []
  
  if (trends.length === 0) {
    return ['No sentiment data available for the selected timeframe']
  }
  
  const latest = trends[trends.length - 1]
  const earliest = trends[0]
  
  // Overall trend direction
  const overallChange = latest.avgSentiment - earliest.avgSentiment
  if (Math.abs(overallChange) > 0.1) {
    insights.push(
      `Overall sentiment has ${overallChange > 0 ? 'improved' : 'declined'} by ${Math.abs(overallChange).toFixed(2)} points over the period`
    )
  }
  
  // Volume insights
  const volumeChange = latest.totalMentions - earliest.totalMentions
  if (Math.abs(volumeChange) > 10) {
    insights.push(
      `Mention volume has ${volumeChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(volumeChange)} mentions`
    )
  }
  
  // Stability insights
  const volatility = calculateVolatility(trends.map(t => t.avgSentiment))
  if (volatility > 0.3) {
    insights.push('Sentiment has been highly volatile - consider investigating triggers')
  } else if (volatility < 0.1) {
    insights.push('Sentiment has remained stable throughout the period')
  }
  
  // Recent significant changes
  if (changes.length > 0) {
    const recentChange = changes[changes.length - 1]
    insights.push(`Most recent significant change: ${recentChange.description}`)
  }
  
  // Topic insights
  if (latest.topNegativeTopics.length > 0) {
    insights.push(`Main concerns: ${latest.topNegativeTopics.slice(0, 3).join(', ')}`)
  }
  
  if (latest.topPositiveTopics.length > 0) {
    insights.push(`Positive feedback on: ${latest.topPositiveTopics.slice(0, 3).join(', ')}`)
  }
  
  return insights
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  
  return Math.sqrt(variance)
}