// AI Hashtag Suggestion API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { aiService } from '@/lib/ai/ai-service'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { SocialProvider } from '@prisma/client'

const suggestHashtagsSchema = z.object({
  content: z.string().min(1).max(2000),
  platform: z.nativeEnum(SocialProvider),
  industry: z.string().optional(),
  location: z.string().optional(),
  maxHashtags: z.number().min(1).max(30).optional().default(10)
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const body = await request.json()
    const validatedData = suggestHashtagsSchema.parse(body)

    const startTime = Date.now()

    try {
      const result = await aiService.suggestHashtags(
        {
          content: validatedData.content,
          platform: validatedData.platform,
          industry: validatedData.industry,
          location: validatedData.location,
          maxHashtags: validatedData.maxHashtags
        },
        userWorkspace.workspaceId,
        userId
      )

      // Store hashtag suggestions in the database for trending analysis
      const hashtagPromises = result.hashtags.map(hashtag =>
        prisma.hashtagSuggestion.upsert({
          where: {
            workspaceId_hashtag_platform: {
              workspaceId: userWorkspace.workspaceId,
              hashtag: hashtag,
              platform: validatedData.platform
            }
          },
          update: {
            lastUpdated: new Date(),
            performanceScore: Math.random() * 100 // TODO: Calculate based on actual performance
          },
          create: {
            workspaceId: userWorkspace.workspaceId,
            hashtag: hashtag,
            platform: validatedData.platform,
            trendingScore: Math.random() * 100, // TODO: Get from trending API
            performanceScore: Math.random() * 100,
            category: validatedData.industry
          }
        })
      )

      await Promise.all(hashtagPromises)

      return NextResponse.json({
        success: true,
        data: {
          hashtags: result.hashtags,
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
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: userId,
          featureType: 'HASHTAG_SUGGESTION',
          responseTimeMs: Date.now() - startTime,
          successful: false,
          errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error'
        }
      })

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

    console.error('Hashtag suggestion API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Get trending hashtags for a platform
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') as SocialProvider | null
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!platform) {
      return NextResponse.json({
        error: 'Platform parameter is required'
      }, { status: 400 })
    }

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

    // Get trending hashtags for the workspace/platform
    const trendingHashtags = await prisma.hashtagSuggestion.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        platform: platform,
        isBlocked: false,
        ...(category && { category })
      },
      orderBy: [
        { trendingScore: 'desc' },
        { performanceScore: 'desc' },
        { lastUpdated: 'desc' }
      ],
      take: limit,
      select: {
        hashtag: true,
        trendingScore: true,
        performanceScore: true,
        category: true,
        lastUpdated: true
      }
    })

    // Get usage statistics for the hashtags
    const hashtagStats = await prisma.aIContentSuggestion.groupBy({
      by: ['suggestedContent'],
      where: {
        workspaceId: userWorkspace.workspaceId,
        suggestionType: 'HASHTAGS',
        platform: platform,
        used: true
      },
      _count: true
    })

    const statsMap = new Map(
      hashtagStats.map(stat => [stat.suggestedContent, stat._count])
    )

    const enrichedHashtags = trendingHashtags.map(hashtag => ({
      ...hashtag,
      usageCount: statsMap.get(hashtag.hashtag) || 0
    }))

    return NextResponse.json({
      success: true,
      data: {
        hashtags: enrichedHashtags,
        platform,
        category,
        total: enrichedHashtags.length
      }
    })

  } catch (error) {
    console.error('Get trending hashtags API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}