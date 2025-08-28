import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { SentimentMonitor } from '@/lib/audience/sentiment-monitor'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { ratelimit } from '@/lib/utils/rate-limit'

const analyzeSentimentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  sourceType: z.enum(['COMMENT', 'MENTION', 'DIRECT_MESSAGE', 'REVIEW', 'SHARE', 'REPLY']),
  sourceId: z.string(),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']),
  postId: z.string().optional(),
  authorData: z.object({
    id: z.string().optional(),
    handle: z.string().optional(),
    followersCount: z.number().optional(),
    isVerified: z.boolean().optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const identifier = session.user.id
    const { success } = await ratelimit.limit(identifier)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const {
      content,
      sourceType,
      sourceId,
      platform,
      postId,
      authorData
    } = analyzeSentimentSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize sentiment monitor
    const sentimentMonitor = new SentimentMonitor()

    // Analyze new content
    const result = await sentimentMonitor.analyzeNewContent({
      workspaceId: userWorkspace.workspaceId,
      postId,
      sourceType,
      sourceId,
      content,
      platform,
      authorData
    })

    return NextResponse.json({
      success: true,
      analysisId: result.analysis.id,
      sentiment: result.sentiment,
      requiresAttention: result.requiresAttention
    })

  } catch (error) {
    console.error('Sentiment analysis error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to analyze sentiment' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '24h'
    const platform = searchParams.get('platform')
    
    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const timeframeHours = parseTimeframe(timeframe)
    const startDate = new Date(Date.now() - timeframeHours * 60 * 60 * 1000)
    const endDate = new Date()

    // Get recent sentiment analyses
    const whereClause: any = {
      workspaceId: userWorkspace.workspaceId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    if (platform) {
      whereClause.platform = platform
    }

    const sentiments = await prisma.sentimentAnalysis.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    // Calculate summary metrics
    const totalCount = sentiments.length
    const avgSentiment = totalCount > 0 
      ? sentiments.reduce((sum, s) => sum + s.overallScore, 0) / totalCount 
      : 0
    const positiveCount = sentiments.filter(s => s.overallScore > 0.1).length
    const negativeCount = sentiments.filter(s => s.overallScore < -0.1).length
    const neutralCount = totalCount - positiveCount - negativeCount

    return NextResponse.json({
      success: true,
      summary: {
        totalCount,
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        positiveCount,
        negativeCount,
        neutralCount,
        timeframe
      },
      sentiments: sentiments.slice(0, 20) // Return top 20 for UI
    })

  } catch (error) {
    console.error('Get sentiment analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to get sentiment analysis' },
      { status: 500 }
    )
  }
}

function parseTimeframe(timeframe: string): number {
  const match = timeframe.match(/(\d+)([hdw])/)
  if (!match) return 24
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  switch (unit) {
    case 'h': return value
    case 'd': return value * 24
    case 'w': return value * 24 * 7
    default: return 24
  }
}