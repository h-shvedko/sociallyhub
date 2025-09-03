import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContentGapAnalyzer } from '@/lib/automation/content-gap-analyzer'
import { z } from 'zod'
import { Platform, ContentType } from '@prisma/client'

const ContentGapAnalysisRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  platforms: z.array(z.nativeEnum(Platform)).optional(),
  contentTypes: z.array(z.nativeEnum(ContentType)).optional(),
  timeframe: z.enum(['30d', '90d', '180d', '1y']).optional(),
  competitorAnalysis: z.boolean().optional(),
  audienceSegments: z.array(z.string()).optional(),
  targetKeywords: z.array(z.string()).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = ContentGapAnalysisRequestSchema.parse(body)

    const gapAnalyzer = new ContentGapAnalyzer()
    const gaps = await gapAnalyzer.analyzeContentGaps(
      validatedData.workspaceId,
      {
        platforms: validatedData.platforms,
        contentTypes: validatedData.contentTypes,
        timeframe: validatedData.timeframe,
        competitorAnalysis: validatedData.competitorAnalysis,
        audienceSegments: validatedData.audienceSegments,
        targetKeywords: validatedData.targetKeywords
      }
    )

    return NextResponse.json({
      success: true,
      gaps,
      count: gaps.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in content gap analysis:', error)
    
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
      { error: 'Failed to analyze content gaps' },
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
    const priority = searchParams.get('priority')
    const limit = searchParams.get('limit')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    const gapAnalyzer = new ContentGapAnalyzer()
    const storedGaps = await gapAnalyzer.getStoredGaps(workspaceId, {
      status,
      priority,
      limit: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json({
      success: true,
      gaps: storedGaps,
      count: storedGaps.length
    })
  } catch (error) {
    console.error('Error fetching content gaps:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content gaps' },
      { status: 500 }
    )
  }
}