// AI Content Generation API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { aiService } from '@/lib/ai/ai-service'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { SocialProvider } from '@prisma/client'

const generateContentSchema = z.object({
  prompt: z.string().min(1).max(2000),
  platform: z.nativeEnum(SocialProvider).optional(),
  tone: z.enum(['professional', 'casual', 'humorous', 'inspirational', 'educational', 'promotional', 'conversational', 'formal']).optional(),
  maxLength: z.number().min(10).max(5000).optional(),
  includeHashtags: z.boolean().optional(),
  includeEmojis: z.boolean().optional(),
  language: z.string().optional(),
  brandVoice: z.string().max(500).optional(),
  targetAudience: z.string().max(500).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace (handle demo user ID compatibility)
    let userId = session.user.id
    if (userId === 'demo-user-id') {
      userId = 'cmesceft00000r6gjl499x7dl' // Use actual demo user ID from database
    }
    
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = generateContentSchema.parse(body)

    // Check if user has permission to use AI features
    // TODO: Implement subscription/permission checks here

    const startTime = Date.now()

    try {
      const result = await aiService.generateContent(
        validatedData.prompt,
        {
          platform: validatedData.platform,
          tone: validatedData.tone,
          maxLength: validatedData.maxLength,
          includeHashtags: validatedData.includeHashtags,
          includeEmojis: validatedData.includeEmojis,
          language: validatedData.language,
          brandVoice: validatedData.brandVoice,
          targetAudience: validatedData.targetAudience
        },
        userWorkspace.workspaceId,
        userId
      )

      return NextResponse.json({
        success: true,
        data: {
          content: result.content,
          suggestionId: result.suggestionId,
          usage: {
            tokensUsed: result.usage.tokensUsed,
            costCents: result.usage.costCents,
            responseTimeMs: result.usage.responseTimeMs,
            model: result.usage.model
          }
        }
      })

    } catch (aiError) {
      // Track failed usage
      await aiService['trackUsage']({
        workspaceId: userWorkspace.workspaceId,
        userId: userId,
        featureType: 'CONTENT_GENERATION',
        responseTimeMs: Date.now() - startTime,
        successful: false,
        errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error'
      })

      if (aiError instanceof Error && aiError.message.includes('safety check failed')) {
        return NextResponse.json({
          error: 'Content violates safety guidelines',
          details: aiError.message
        }, { status: 400 })
      }

      return NextResponse.json({
        error: 'AI service error',
        details: aiError instanceof Error ? aiError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Content generation API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Get content generation history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const platform = searchParams.get('platform') as SocialProvider | null

    // Handle demo user ID compatibility
    let userId = session.user.id
    if (userId === 'demo-user-id') {
      userId = 'cmesceft00000r6gjl499x7dl' // Use actual demo user ID from database
    }
    
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const suggestions = await prisma.aIContentSuggestion.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        suggestionType: 'CAPTION',
        ...(platform && { platform })
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    })

    const total = await prisma.aIContentSuggestion.count({
      where: {
        workspaceId: userWorkspace.workspaceId,
        suggestionType: 'CAPTION',
        ...(platform && { platform })
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        suggestions: suggestions.map(s => ({
          id: s.id,
          originalContent: s.originalContent,
          suggestedContent: s.suggestedContent,
          platform: s.platform,
          confidence: s.confidenceScore,
          used: s.used,
          createdAt: s.createdAt,
          user: s.user
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    console.error('Get content suggestions API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}