// AI Content Optimization API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { aiService } from '@/lib/ai/ai-service'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { SocialProvider } from '@prisma/client'

const optimizeContentSchema = z.object({
  content: z.string().min(1).max(5000),
  platform: z.nativeEnum(SocialProvider),
  tone: z.enum(['professional', 'casual', 'humorous', 'inspirational', 'educational', 'promotional', 'conversational', 'formal']).optional(),
  maxLength: z.number().min(10).max(5000).optional(),
  includeHashtags: z.boolean().optional(),
  includeEmojis: z.boolean().optional(),
  targetAudience: z.string().max(500).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = optimizeContentSchema.parse(body)

    const startTime = Date.now()

    try {
      const result = await aiService.optimizeForPlatform(
        validatedData.content,
        validatedData.platform,
        {
          tone: validatedData.tone,
          maxLength: validatedData.maxLength,
          includeHashtags: validatedData.includeHashtags,
          includeEmojis: validatedData.includeEmojis,
          targetAudience: validatedData.targetAudience,
          platform: validatedData.platform
        },
        userWorkspace.workspaceId,
        session.user.id
      )

      // Get platform-specific optimization insights
      const insights = generateOptimizationInsights(
        validatedData.content,
        result.content,
        validatedData.platform
      )

      return NextResponse.json({
        success: true,
        data: {
          originalContent: validatedData.content,
          optimizedContent: result.content,
          platform: validatedData.platform,
          suggestionId: result.suggestionId,
          insights,
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
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: session.user.id,
          featureType: 'CONTENT_GENERATION',
          responseTimeMs: Date.now() - startTime,
          successful: false,
          errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error'
        }
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

    console.error('Content optimization API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

function generateOptimizationInsights(original: string, optimized: string, platform: SocialProvider) {
  const insights: string[] = []
  const originalLength = original.length
  const optimizedLength = optimized.length

  // Length optimization insights
  if (optimizedLength < originalLength) {
    insights.push(`Content shortened by ${originalLength - optimizedLength} characters for better ${platform} performance`)
  } else if (optimizedLength > originalLength) {
    insights.push(`Content expanded by ${optimizedLength - originalLength} characters to provide more value`)
  }

  // Platform-specific insights
  switch (platform) {
    case SocialProvider.TWITTER:
      if (optimizedLength <= 280) {
        insights.push('Optimized to fit within Twitter\'s character limit')
      }
      if (optimized.includes('#')) {
        insights.push('Added strategic hashtags for better discoverability')
      }
      break

    case SocialProvider.INSTAGRAM:
      if (optimized.includes('📸') || optimized.includes('✨')) {
        insights.push('Enhanced with visual emojis suitable for Instagram')
      }
      break

    case SocialProvider.LINKEDIN:
      if (optimized.includes('industry') || optimized.includes('professional')) {
        insights.push('Adapted tone for professional LinkedIn audience')
      }
      break

    case SocialProvider.FACEBOOK:
      if (optimized.includes('?')) {
        insights.push('Added engagement-driving questions for Facebook algorithm')
      }
      break

    case SocialProvider.TIKTOK:
      if (optimized.toLowerCase().includes('trend') || optimized.includes('#')) {
        insights.push('Optimized with trending elements for TikTok visibility')
      }
      break
  }

  // Content structure insights
  if (optimized.split('\n').length > original.split('\n').length) {
    insights.push('Improved content structure with better formatting')
  }

  // Call-to-action insights
  const ctas = ['comment', 'share', 'like', 'follow', 'click', 'visit', 'learn more', 'sign up']
  const hasCTA = ctas.some(cta => optimized.toLowerCase().includes(cta))
  const originalHasCTA = ctas.some(cta => original.toLowerCase().includes(cta))
  
  if (hasCTA && !originalHasCTA) {
    insights.push('Added call-to-action to drive engagement')
  }

  // Emoji insights
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu
  const originalEmojis = (original.match(emojiRegex) || []).length
  const optimizedEmojis = (optimized.match(emojiRegex) || []).length
  
  if (optimizedEmojis > originalEmojis) {
    insights.push('Added emojis to increase visual appeal and engagement')
  }

  return insights
}