import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TrendAnalyzer } from '@/lib/automation/trend-analyzer'
import { z } from 'zod'
import { ContentType, TrendSource } from '@prisma/client'

const TrendAnalysisRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  contentTypes: z.array(z.nativeEnum(ContentType)).optional(),
  timeframe: z.enum(['24h', '7d', '30d']).optional(),
  sources: z.array(z.nativeEnum(TrendSource)).optional(),
  minRelevanceScore: z.number().min(0).max(1).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = TrendAnalysisRequestSchema.parse(body)

    const trendAnalyzer = new TrendAnalyzer()
    const trends = await trendAnalyzer.analyzeTrends(
      validatedData.workspaceId,
      {
        industry: validatedData.industry,
        targetAudience: validatedData.targetAudience,
        contentTypes: validatedData.contentTypes,
        timeframe: validatedData.timeframe,
        sources: validatedData.sources,
        minRelevanceScore: validatedData.minRelevanceScore
      }
    )

    return NextResponse.json({
      success: true,
      trends,
      count: trends.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in trend analysis:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to analyze trends' },
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
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') as any
    const sourceType = searchParams.get('sourceType') as any
    const minScore = searchParams.get('minScore')
    const limit = searchParams.get('limit')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const trendAnalyzer = new TrendAnalyzer()
    const storedTrends = await trendAnalyzer.getStoredTrends(workspaceId, {
      status,
      sourceType,
      minScore: minScore ? parseFloat(minScore) : undefined,
      limit: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json({
      success: true,
      trends: storedTrends,
      count: storedTrends.length
    })
  } catch (error) {
    console.error('Error fetching stored trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    )
  }
}