// AI Tone Analysis API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { aiService } from '@/lib/ai/ai-service'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'

const analyzeToneSchema = z.object({
  content: z.string().min(1).max(5000),
  postId: z.string().optional() // If provided, will save analysis to post
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
    const validatedData = analyzeToneSchema.parse(body)

    // If postId is provided, verify user has access to the post
    if (validatedData.postId) {
      const post = await prisma.post.findFirst({
        where: {
          id: validatedData.postId,
          workspaceId: userWorkspace.workspaceId
        }
      })

      if (!post) {
        return NextResponse.json({
          error: 'Post not found or access denied'
        }, { status: 404 })
      }
    }

    const startTime = Date.now()

    try {
      const result = await aiService.analyzeTone(
        validatedData.content,
        userWorkspace.workspaceId,
        session.user.id,
        validatedData.postId
      )

      return NextResponse.json({
        success: true,
        data: {
          analysis: {
            tone: result.analysis.tone,
            confidence: result.analysis.confidence,
            sentiment: result.analysis.sentiment,
            formality: result.analysis.formality,
            energy: result.analysis.energy
          },
          usage: {
            tokensUsed: result.usage.tokensUsed,
            costCents: result.usage.costCents,
            responseTimeMs: result.usage.responseTimeMs,
            model: result.usage.model
          },
          recommendations: generateToneRecommendations(result.analysis)
        }
      })

    } catch (aiError) {
      // Track failed usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: session.user.id,
          featureType: 'TONE_ANALYSIS',
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

    console.error('Tone analysis API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Get tone analysis history for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const tone = searchParams.get('tone')

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get tone analyses for workspace posts
    const analyses = await prisma.contentToneAnalysis.findMany({
      where: {
        post: {
          workspaceId: userWorkspace.workspaceId
        },
        ...(tone && { tone: tone.toUpperCase() as any })
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            baseContent: true,
            createdAt: true,
            owner: {
              select: { name: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    })

    const total = await prisma.contentToneAnalysis.count({
      where: {
        post: {
          workspaceId: userWorkspace.workspaceId
        },
        ...(tone && { tone: tone.toUpperCase() as any })
      }
    })

    // Get tone distribution statistics
    const toneDistribution = await prisma.contentToneAnalysis.groupBy({
      by: ['tone'],
      where: {
        post: {
          workspaceId: userWorkspace.workspaceId
        }
      },
      _count: true,
      _avg: {
        confidence: true,
        sentiment: true
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        analyses: analyses.map(analysis => ({
          id: analysis.id,
          tone: analysis.tone,
          confidence: analysis.confidence,
          sentiment: analysis.sentiment,
          formality: analysis.formality,
          energy: analysis.energy,
          createdAt: analysis.createdAt,
          post: analysis.post
        })),
        statistics: {
          toneDistribution: toneDistribution.map(dist => ({
            tone: dist.tone,
            count: dist._count,
            avgConfidence: dist._avg.confidence,
            avgSentiment: dist._avg.sentiment
          }))
        },
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    console.error('Get tone analyses API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

function generateToneRecommendations(analysis: any): string[] {
  const recommendations: string[] = []

  // Sentiment recommendations
  if (analysis.sentiment < -0.5) {
    recommendations.push('Consider adding more positive language to improve sentiment')
  } else if (analysis.sentiment < 0) {
    recommendations.push('Content has slight negative sentiment - consider balancing with positive elements')
  } else if (analysis.sentiment > 0.7) {
    recommendations.push('Great positive sentiment! This content should resonate well with audiences')
  }

  // Formality recommendations
  if (analysis.formality > 0.8) {
    recommendations.push('Very formal tone - consider making it more conversational for better engagement')
  } else if (analysis.formality < 0.2) {
    recommendations.push('Very informal tone - consider adding some structure for better clarity')
  }

  // Energy recommendations
  if (analysis.energy < 0.3) {
    recommendations.push('Low energy content - consider adding more dynamic language or calls to action')
  } else if (analysis.energy > 0.8) {
    recommendations.push('High energy content - great for engagement! Make sure it matches your brand voice')
  }

  // Tone-specific recommendations
  switch (analysis.tone.toLowerCase()) {
    case 'professional':
      recommendations.push('Professional tone detected - good for B2B audiences and formal contexts')
      break
    case 'casual':
      recommendations.push('Casual tone works well for social media engagement and younger audiences')
      break
    case 'humorous':
      recommendations.push('Humorous tone can increase engagement, but ensure it aligns with your brand')
      break
    case 'promotional':
      recommendations.push('Promotional tone detected - balance with value-driven content to avoid appearing too salesy')
      break
  }

  // Confidence recommendations
  if (analysis.confidence < 0.7) {
    recommendations.push('Tone analysis confidence is moderate - content may have mixed tonal elements')
  }

  return recommendations
}