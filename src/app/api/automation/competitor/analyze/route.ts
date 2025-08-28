import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CompetitorAnalyzer, CompetitorData } from '@/lib/automation/competitor-analyzer'
import { z } from 'zod'
import { Platform, ContentType } from '@prisma/client'

const CompetitorAnalysisRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  competitors: z.array(z.object({
    name: z.string(),
    website: z.string().optional(),
    platforms: z.array(z.nativeEnum(Platform)),
    followerCount: z.record(z.nativeEnum(Platform), z.number()).optional(),
    contentSample: z.array(z.object({
      platform: z.nativeEnum(Platform),
      contentType: z.nativeEnum(ContentType),
      content: z.string(),
      engagement: z.number().optional(),
      timestamp: z.string().transform(str => new Date(str))
    })).optional(),
    brandInfo: z.object({
      industry: z.string(),
      targetAudience: z.string(),
      brandVoice: z.string(),
      keyMessages: z.array(z.string())
    }).optional()
  })),
  options: z.object({
    platforms: z.array(z.nativeEnum(Platform)).optional(),
    analysisDepth: z.enum(['basic', 'comprehensive', 'strategic']).optional(),
    includeContentAnalysis: z.boolean().optional(),
    includeTrendAnalysis: z.boolean().optional(),
    competitorCount: z.number().optional(),
    timeframe: z.enum(['30d', '90d', '180d']).optional()
  }).optional()
})

const SingleCompetitorAnalysisRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  competitor: z.object({
    name: z.string(),
    website: z.string().optional(),
    platforms: z.array(z.nativeEnum(Platform)),
    followerCount: z.record(z.nativeEnum(Platform), z.number()).optional(),
    contentSample: z.array(z.object({
      platform: z.nativeEnum(Platform),
      contentType: z.nativeEnum(ContentType),
      content: z.string(),
      engagement: z.number().optional(),
      timestamp: z.string().transform(str => new Date(str))
    })).optional(),
    brandInfo: z.object({
      industry: z.string(),
      targetAudience: z.string(),
      brandVoice: z.string(),
      keyMessages: z.array(z.string())
    }).optional()
  }),
  options: z.object({
    platforms: z.array(z.nativeEnum(Platform)).optional(),
    analysisDepth: z.enum(['basic', 'comprehensive', 'strategic']).optional(),
    includeContentAnalysis: z.boolean().optional(),
    includeTrendAnalysis: z.boolean().optional(),
    timeframe: z.enum(['30d', '90d', '180d']).optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const analysisType = searchParams.get('type') || 'multiple'

    if (analysisType === 'single') {
      // Single competitor analysis
      const validatedData = SingleCompetitorAnalysisRequestSchema.parse(body)
      
      const competitorAnalyzer = new CompetitorAnalyzer()
      const analysis = await competitorAnalyzer.analyzeCompetitor(
        validatedData.workspaceId,
        validatedData.competitor as CompetitorData,
        validatedData.options || {}
      )

      return NextResponse.json({
        success: true,
        analysisType: 'single',
        analysis,
        competitor: validatedData.competitor.name,
        timestamp: new Date().toISOString()
      })
    } else {
      // Multiple competitors analysis
      const validatedData = CompetitorAnalysisRequestSchema.parse(body)
      
      const competitorAnalyzer = new CompetitorAnalyzer()
      const result = await competitorAnalyzer.analyzeMultipleCompetitors(
        validatedData.workspaceId,
        validatedData.competitors as CompetitorData[],
        validatedData.options || {}
      )

      return NextResponse.json({
        success: true,
        analysisType: 'multiple',
        individualAnalyses: result.individualAnalyses,
        comparativeAnalysis: result.comparativeAnalysis,
        competitorCount: validatedData.competitors.length,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error in competitor analysis:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to analyze competitors' },
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
    const competitorName = searchParams.get('competitorName')
    const limit = searchParams.get('limit')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const competitorAnalyzer = new CompetitorAnalyzer()
    const storedAnalyses = await competitorAnalyzer.getStoredAnalyses(workspaceId, {
      status,
      competitorName: competitorName || undefined,
      limit: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json({
      success: true,
      analyses: storedAnalyses,
      count: storedAnalyses.length
    })
  } catch (error) {
    console.error('Error fetching competitor analyses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch competitor analyses' },
      { status: 500 }
    )
  }
}