import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TrendAnalyzer } from '@/lib/automation/trend-analyzer'
import { z } from 'zod'
import { ContentType } from '@prisma/client'

const ContentSuggestionRequestSchema = z.object({
  workspaceId: z.string().cuid(),
  contentType: z.nativeEnum(ContentType)
})

export async function POST(
  request: NextRequest,
  { params }: { params: { trendId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trendId } = params
    if (!trendId) {
      return NextResponse.json(
        { error: 'Trend ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = ContentSuggestionRequestSchema.parse(body)

    const trendAnalyzer = new TrendAnalyzer()
    const suggestions = await trendAnalyzer.generateContentSuggestions(
      validatedData.workspaceId,
      trendId,
      validatedData.contentType
    )

    return NextResponse.json({
      success: true,
      trendId,
      contentType: validatedData.contentType,
      suggestions,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error generating content suggestions:', error)
    
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
      { error: 'Failed to generate content suggestions' },
      { status: 500 }
    )
  }
}