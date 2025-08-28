// Content Variant Generation API

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { abTestingService } from '@/lib/ai/ab-testing-service'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ABTestType, SocialProvider } from '@prisma/client'

const generateVariantsSchema = z.object({
  content: z.string().min(1).max(5000),
  platform: z.nativeEnum(SocialProvider).optional(),
  testType: z.nativeEnum(ABTestType).optional(),
  variantCount: z.number().min(1).max(5).optional(),
  context: z.object({
    targetAudience: z.string().optional(),
    campaignGoal: z.string().optional(),
    brandVoice: z.string().optional(),
    contentTheme: z.string().optional()
  }).optional()
})

// Generate AI-powered content variants
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
    const validatedData = generateVariantsSchema.parse(body)

    const startTime = Date.now()

    try {
      // Generate AI variants
      const variants = await abTestingService.generateContentVariants(
        validatedData.content,
        validatedData.platform || SocialProvider.TWITTER,
        validatedData.variantCount || 3,
        validatedData.testType || ABTestType.CONTENT
      )

      // Enhance variants with additional context if provided
      const enhancedVariants = validatedData.context 
        ? await enhanceVariantsWithContext(variants, validatedData.context)
        : variants

      // Calculate estimated performance for each variant
      const variantsWithEstimates = await Promise.all(
        enhancedVariants.map(async (variant) => {
          const estimate = await estimateVariantPerformance(
            variant.content,
            validatedData.platform || SocialProvider.TWITTER,
            userWorkspace.workspaceId
          )
          
          return {
            ...variant,
            estimatedPerformance: estimate
          }
        })
      )

      // Track AI usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: session.user.id,
          featureType: 'VARIANT_GENERATION',
          tokensUsed: 400 * (validatedData.variantCount || 3), // Estimated tokens
          costCents: Math.ceil(1.5 * (validatedData.variantCount || 3)), // Estimated cost
          responseTimeMs: Date.now() - startTime,
          successful: true
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          originalContent: validatedData.content,
          variants: variantsWithEstimates,
          metadata: {
            platform: validatedData.platform || SocialProvider.TWITTER,
            testType: validatedData.testType || ABTestType.CONTENT,
            generatedAt: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime
          },
          recommendations: generateVariantRecommendations(variantsWithEstimates)
        }
      })

    } catch (aiError) {
      // Track failed usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: session.user.id,
          featureType: 'VARIANT_GENERATION',
          responseTimeMs: Date.now() - startTime,
          successful: false,
          errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error'
        }
      })

      return NextResponse.json({
        error: 'AI variant generation failed',
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

    console.error('Generate variants API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Helper function to enhance variants with additional context
async function enhanceVariantsWithContext(variants: any[], context: any) {
  // This could use additional AI calls to refine variants based on context
  // For now, we'll add context information to the reasoning
  
  return variants.map(variant => ({
    ...variant,
    aiReasoning: `${variant.aiReasoning} Context: ${[
      context.targetAudience && `Target: ${context.targetAudience}`,
      context.campaignGoal && `Goal: ${context.campaignGoal}`,
      context.brandVoice && `Voice: ${context.brandVoice}`,
      context.contentTheme && `Theme: ${context.contentTheme}`
    ].filter(Boolean).join(', ')}`
  }))
}

// Helper function to estimate variant performance
async function estimateVariantPerformance(
  content: string, 
  platform: SocialProvider, 
  workspaceId: string
) {
  try {
    // Get historical performance data for similar content
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
        NOT: { actualEngagementRate: null }
      },
      select: {
        actualEngagementRate: true,
        actualReach: true,
        actualLikes: true,
        actualComments: true,
        actualShares: true
      },
      take: 100,
      orderBy: { createdAt: 'desc' }
    })

    if (historicalData.length === 0) {
      // Return platform-based defaults if no historical data
      const platformDefaults = {
        [SocialProvider.TWITTER]: { engagement: 1.5, reach: 500, likes: 15, comments: 3, shares: 2 },
        [SocialProvider.INSTAGRAM]: { engagement: 3.0, reach: 800, likes: 30, comments: 5, shares: 3 },
        [SocialProvider.LINKEDIN]: { engagement: 2.0, reach: 300, likes: 20, comments: 8, shares: 4 },
        [SocialProvider.FACEBOOK]: { engagement: 1.0, reach: 200, likes: 10, comments: 2, shares: 1 },
        [SocialProvider.TIKTOK]: { engagement: 5.0, reach: 1000, likes: 50, comments: 10, shares: 5 },
        [SocialProvider.YOUTUBE]: { engagement: 2.5, reach: 400, likes: 25, comments: 12, shares: 3 }
      }
      
      return platformDefaults[platform] || platformDefaults[SocialProvider.TWITTER]
    }

    // Calculate averages from historical data
    const avgEngagement = historicalData.reduce((sum, data) => sum + (data.actualEngagementRate || 0), 0) / historicalData.length
    const avgReach = historicalData.reduce((sum, data) => sum + (data.actualReach || 0), 0) / historicalData.length
    const avgLikes = historicalData.reduce((sum, data) => sum + (data.actualLikes || 0), 0) / historicalData.length
    const avgComments = historicalData.reduce((sum, data) => sum + (data.actualComments || 0), 0) / historicalData.length
    const avgShares = historicalData.reduce((sum, data) => sum + (data.actualShares || 0), 0) / historicalData.length

    // Apply content-based multipliers (simplified heuristics)
    const contentMultiplier = calculateContentMultiplier(content)

    return {
      engagement: avgEngagement * contentMultiplier,
      reach: Math.round(avgReach * contentMultiplier),
      likes: Math.round(avgLikes * contentMultiplier),
      comments: Math.round(avgComments * contentMultiplier),
      shares: Math.round(avgShares * contentMultiplier),
      confidence: historicalData.length > 10 ? 0.7 : 0.4 // Higher confidence with more data
    }

  } catch (error) {
    console.error('Performance estimation error:', error)
    // Return default estimates on error
    return {
      engagement: 2.0,
      reach: 500,
      likes: 20,
      comments: 5,
      shares: 3,
      confidence: 0.3
    }
  }
}

// Helper function to calculate content multiplier based on content characteristics
function calculateContentMultiplier(content: string): number {
  let multiplier = 1.0

  // Check for engagement-driving elements
  if (content.includes('?')) multiplier += 0.2 // Questions drive engagement
  if (content.match(/[!]{2,}/)) multiplier += 0.1 // Excitement
  if (content.includes('@')) multiplier += 0.15 // Mentions
  if (content.match(/#\w+/g)) multiplier += 0.1 // Hashtags
  if (content.match(/\b(free|sale|discount|offer)\b/i)) multiplier += 0.2 // Promotional
  if (content.match(/\b(new|now|today|urgent)\b/i)) multiplier += 0.1 // Urgency
  if (content.length < 100) multiplier += 0.1 // Shorter content often performs better
  if (content.match(/\b(you|your)\b/gi)) multiplier += 0.1 // Direct address

  // Check for negative elements
  if (content.match(/\b(boring|tired|sad)\b/i)) multiplier -= 0.1
  if (content.length > 500) multiplier -= 0.1 // Very long content

  return Math.max(0.5, Math.min(2.0, multiplier)) // Cap between 0.5x and 2.0x
}

// Generate recommendations for the variants
function generateVariantRecommendations(variants: any[]) {
  const recommendations = []

  // Find best performing variant
  const bestVariant = variants.reduce((best, current) => 
    current.estimatedPerformance.engagement > best.estimatedPerformance.engagement ? current : best
  )

  recommendations.push({
    type: 'performance',
    title: 'Recommended variant',
    description: `Variant "${bestVariant.id}" shows highest estimated engagement (${bestVariant.estimatedPerformance.engagement.toFixed(1)}%)`,
    action: `Consider using "${bestVariant.id}" as your primary content or control group`
  })

  // Analyze variant diversity
  const contentLengths = variants.map(v => v.content.length)
  const avgLength = contentLengths.reduce((sum, len) => sum + len, 0) / contentLengths.length
  const lengthVariance = contentLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / contentLengths.length

  if (lengthVariance < 100) {
    recommendations.push({
      type: 'diversity',
      title: 'Increase content length variety',
      description: 'Your variants have similar lengths. Consider testing dramatically different lengths.',
      action: 'Create one very short (under 50 chars) and one longer variant (200+ chars)'
    })
  }

  // Check hashtag usage
  const hashtagCounts = variants.map(v => (v.hashtags || []).length)
  const hasHashtagVariation = Math.max(...hashtagCounts) - Math.min(...hashtagCounts) >= 2

  if (!hasHashtagVariation) {
    recommendations.push({
      type: 'hashtags',
      title: 'Test hashtag strategies',
      description: 'Consider testing different numbers of hashtags across variants',
      action: 'Create variants with 0, 3-5, and 8-10 hashtags to test optimal usage'
    })
  }

  // Analyze tone variety
  const tones = variants.map(v => analyzeTone(v.content))
  const uniqueTones = [...new Set(tones)]

  if (uniqueTones.length < 2) {
    recommendations.push({
      type: 'tone',
      title: 'Diversify content tone',
      description: 'All variants have similar tone. Test different approaches for better insights.',
      action: 'Try formal vs casual, humorous vs serious, or promotional vs informational tones'
    })
  }

  return recommendations
}

// Simple tone analysis helper
function analyzeTone(content: string): string {
  const formalWords = /\b(furthermore|therefore|consequently|nevertheless)\b/i
  const casualWords = /\b(hey|wow|cool|awesome|lol)\b/i
  const humorousWords = /\b(haha|funny|joke|laugh)\b/i
  const promotionalWords = /\b(sale|discount|buy|offer|deal)\b/i
  const urgentWords = /\b(now|urgent|limited|hurry|quick)\b/i

  if (promotionalWords.test(content)) return 'promotional'
  if (urgentWords.test(content)) return 'urgent'
  if (humorousWords.test(content)) return 'humorous'
  if (formalWords.test(content)) return 'formal'
  if (casualWords.test(content)) return 'casual'
  
  return 'neutral'
}