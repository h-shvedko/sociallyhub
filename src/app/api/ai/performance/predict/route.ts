// AI Performance Prediction API Endpoint

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { simpleAIService } from '@/lib/ai/simple-ai-service'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SocialProvider } from '@prisma/client'

const predictPerformanceSchema = z.object({
  content: z.string().min(1).max(5000),
  platform: z.nativeEnum(SocialProvider),
  postId: z.string().optional() // If provided, will save prediction to post
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
      return NextResponse.json({ 
        error: 'No workspace found', 
        debug: { userId: session.user.id },
        help: 'Make sure you are logged in with the demo account: demo@sociallyhub.com / demo123456'
      }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = predictPerformanceSchema.parse(body)

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
      const result = await simpleAIService.predictPerformance(
        validatedData.content,
        validatedData.platform,
        userWorkspace.workspaceId,
        session.user.id,
        validatedData.postId
      )

      // Get historical performance data for comparison
      const historicalAverage = await getHistoricalAverage(
        userWorkspace.workspaceId,
        validatedData.platform
      )

      const recommendations = generatePerformanceRecommendations(
        result.prediction,
        historicalAverage,
        validatedData.platform
      )

      return NextResponse.json({
        success: true,
        data: {
          prediction: {
            engagementRate: result.prediction.engagementRate,
            reach: result.prediction.reach,
            impressions: result.prediction.impressions,
            likes: result.prediction.likes,
            comments: result.prediction.comments,
            shares: result.prediction.shares,
            confidence: result.prediction.confidence
          },
          comparison: historicalAverage ? {
            engagementRateChange: ((result.prediction.engagementRate - historicalAverage.engagementRate) / historicalAverage.engagementRate) * 100,
            reachChange: historicalAverage.reach > 0 ? ((result.prediction.reach - historicalAverage.reach) / historicalAverage.reach) * 100 : null,
            likesChange: historicalAverage.likes > 0 ? ((result.prediction.likes - historicalAverage.likes) / historicalAverage.likes) * 100 : null
          } : null,
          recommendations,
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
          featureType: 'PERFORMANCE_PREDICTION',
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

    console.error('Performance prediction API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Get performance prediction history and accuracy
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') as SocialProvider | null
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get predictions with actual results for accuracy calculation
    const predictions = await prisma.contentPerformancePrediction.findMany({
      where: {
        post: {
          workspaceId: userWorkspace.workspaceId,
          ...(platform && {
            variants: {
              some: {
                socialAccount: {
                  provider: platform
                }
              }
            }
          })
        }
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            baseContent: true,
            createdAt: true,
            publishedAt: true,
            variants: {
              where: platform ? {
                socialAccount: { provider: platform }
              } : {},
              include: {
                socialAccount: {
                  select: { provider: true }
                }
              }
            },
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

    const total = await prisma.contentPerformancePrediction.count({
      where: {
        post: {
          workspaceId: userWorkspace.workspaceId,
          ...(platform && {
            variants: {
              some: {
                socialAccount: {
                  provider: platform
                }
              }
            }
          })
        }
      }
    })

    // Calculate prediction accuracy statistics
    const accuracyStats = calculateAccuracyStats(predictions)

    return NextResponse.json({
      success: true,
      data: {
        predictions: predictions.map(pred => ({
          id: pred.id,
          predicted: {
            engagementRate: pred.predictedEngagementRate,
            reach: pred.predictedReach,
            impressions: pred.predictedImpressions,
            likes: pred.predictedLikes,
            comments: pred.predictedComments,
            shares: pred.predictedShares
          },
          actual: {
            engagementRate: pred.actualEngagementRate,
            reach: pred.actualReach,
            impressions: pred.actualImpressions,
            likes: pred.actualLikes,
            comments: pred.actualComments,
            shares: pred.actualShares
          },
          accuracy: pred.predictionAccuracy,
          confidence: pred.confidenceScore,
          createdAt: pred.createdAt,
          post: pred.post
        })),
        accuracyStats,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    console.error('Get performance predictions API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function getHistoricalAverage(workspaceId: string, platform: SocialProvider) {
  const historicalData = await prisma.contentPerformancePrediction.findMany({
    where: {
      post: {
        workspaceId,
        variants: {
          some: {
            socialAccount: { provider: platform }
          }
        }
      },
      actualEngagementRate: { not: null }
    },
    select: {
      actualEngagementRate: true,
      actualReach: true,
      actualLikes: true,
      actualComments: true,
      actualShares: true
    }
  })

  if (historicalData.length === 0) return null

  const avgEngagementRate = historicalData.reduce((sum, data) => sum + (data.actualEngagementRate || 0), 0) / historicalData.length
  const avgReach = historicalData.reduce((sum, data) => sum + (data.actualReach || 0), 0) / historicalData.length
  const avgLikes = historicalData.reduce((sum, data) => sum + (data.actualLikes || 0), 0) / historicalData.length

  return {
    engagementRate: avgEngagementRate,
    reach: avgReach,
    likes: avgLikes
  }
}

function generatePerformanceRecommendations(prediction: any, historical: any, platform: SocialProvider): string[] {
  const recommendations: string[] = []

  // Engagement rate recommendations
  if (prediction.engagementRate < 1) {
    recommendations.push('Low predicted engagement rate - consider adding more interactive elements like questions or polls')
  } else if (prediction.engagementRate > 5) {
    recommendations.push('High predicted engagement rate - great content! Consider similar approaches for future posts')
  }

  // Platform-specific recommendations
  switch (platform) {
    case SocialProvider.TWITTER:
      if (prediction.shares < prediction.likes * 0.1) {
        recommendations.push('Consider adding a clear call-to-action to encourage retweets')
      }
      break
    case SocialProvider.INSTAGRAM:
      if (prediction.comments < prediction.likes * 0.05) {
        recommendations.push('Add questions or prompts to encourage more comments')
      }
      break
    case SocialProvider.LINKEDIN:
      if (prediction.engagementRate < 2) {
        recommendations.push('Professional insights and industry expertise tend to perform better on LinkedIn')
      }
      break
  }

  // Historical comparison recommendations
  if (historical) {
    if (prediction.engagementRate < historical.engagementRate * 0.8) {
      recommendations.push('Predicted performance is below your average - consider revising content or timing')
    } else if (prediction.engagementRate > historical.engagementRate * 1.2) {
      recommendations.push('Predicted performance is above average - this content strategy is working well!')
    }
  }

  // Confidence-based recommendations
  if (prediction.confidence < 0.6) {
    recommendations.push('Prediction confidence is low - consider A/B testing different versions')
  } else if (prediction.confidence > 0.8) {
    recommendations.push('High confidence prediction - you can rely on these metrics for planning')
  }

  return recommendations
}

function calculateAccuracyStats(predictions: any[]) {
  const predictionsWithActuals = predictions.filter(p => p.actualEngagementRate !== null)
  
  if (predictionsWithActuals.length === 0) {
    return {
      totalPredictions: predictions.length,
      predictionsWithActuals: 0,
      averageAccuracy: null,
      accuracyByConfidence: null
    }
  }

  // Calculate accuracy for each prediction
  const accuracies = predictionsWithActuals.map(pred => {
    const predicted = pred.predictedEngagementRate || 0
    const actual = pred.actualEngagementRate || 0
    
    if (actual === 0 && predicted === 0) return 1
    if (actual === 0) return 0
    
    return 1 - Math.abs((predicted - actual) / actual)
  }).filter(acc => acc >= 0 && acc <= 1)

  const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length

  // Group by confidence levels
  const highConfidence = predictionsWithActuals.filter(p => (p.confidenceScore || 0) > 0.8)
  const mediumConfidence = predictionsWithActuals.filter(p => (p.confidenceScore || 0) > 0.5 && (p.confidenceScore || 0) <= 0.8)
  const lowConfidence = predictionsWithActuals.filter(p => (p.confidenceScore || 0) <= 0.5)

  return {
    totalPredictions: predictions.length,
    predictionsWithActuals: predictionsWithActuals.length,
    averageAccuracy,
    accuracyByConfidence: {
      high: highConfidence.length,
      medium: mediumConfidence.length,
      low: lowConfidence.length
    }
  }
}