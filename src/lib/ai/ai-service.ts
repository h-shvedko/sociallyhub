// Main AI Service Manager

import { SocialProvider, AIUsageTracking, AIContentSuggestion } from '@prisma/client'
import { OpenAIProvider } from './providers/openai-provider'
import { MockAIProvider } from './providers/mock-provider'
import { AICache } from './cache'
import { ContentSafetyFilter } from './safety-filter'
import { prisma } from '../prisma'
import { assertWithinLimit } from '../billing/entitlements'
import { isDemoMode } from '@/lib/config/demo'
import {
  AIAvailability,
  AIQuotaExceededError,
  AIUnavailableError,
  getAIAvailability,
} from './availability'
import {
  AIProvider,
  AIServiceConfig,
  ContentGenerationOptions,
  HashtagSuggestionOptions,
  AIUsageMetrics
} from './types'

export class AIService {
  private providers: Map<string, AIProvider> = new Map()
  private providersInitialized = false
  private cache: AICache
  private safetyFilter: ContentSafetyFilter
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
    this.cache = new AICache(config.cacheTTL || 3600)
    this.safetyFilter = new ContentSafetyFilter()
    // Providers are initialized LAZILY on first use — no env-dependent
    // client construction at module scope (ADR-0022 build lesson).
  }

  /** Availability contract (ADR-0018) — see src/lib/ai/availability.ts. */
  getAvailability(): AIAvailability {
    return getAIAvailability()
  }

  private initializeProviders(): void {
    // Real OpenAI when a genuine key is present.
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
      const provider = new OpenAIProvider(
        openaiKey,
        this.config.rateLimitRPM || 60,
        this.config.rateLimitTPM || 40000
      )
      this.providers.set('openai', provider)
      return
    }

    // Mock ONLY in demo mode (NODE_ENV=development or ENABLE_DEMO='true');
    // its output is labeled simulated by withAIMeta(). Otherwise register
    // NOTHING — getProvider() throws AIUnavailableError and routes 503.
    if (isDemoMode()) {
      const mockProvider = new MockAIProvider(500) // 500ms delay for realistic simulation
      this.providers.set('openai', mockProvider)
    }
  }

  private getProvider(): AIProvider {
    if (!this.providersInitialized) {
      this.initializeProviders()
      this.providersInitialized = true
    }
    const provider = this.providers.get('openai')
    if (!provider) {
      throw new AIUnavailableError()
    }
    return provider
  }

  /**
   * Workspace monthly SPEND backstop (default OFF). When
   * AI_MONTHLY_COST_LIMIT_CENTS is set (> 0), reject provider calls once the
   * workspace's tracked AIUsageTracking.costCents for the current calendar
   * month reaches the ceiling. Plan-tier credit limits (ADR-0019
   * assertWithinLimit) remain the primary control.
   */
  private async assertWithinCostCeiling(workspaceId: string): Promise<void> {
    const raw = process.env.AI_MONTHLY_COST_LIMIT_CENTS
    if (!raw) return
    const limitCents = Number.parseInt(raw, 10)
    if (!Number.isFinite(limitCents) || limitCents <= 0) return

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const aggregate = await prisma.aIUsageTracking.aggregate({
      where: { workspaceId, createdAt: { gte: monthStart } },
      _sum: { costCents: true },
    })
    const usedCents = aggregate._sum.costCents ?? 0
    if (usedCents >= limitCents) {
      throw new AIQuotaExceededError(limitCents, usedCents)
    }
  }

  async generateContent(
    prompt: string, 
    options: ContentGenerationOptions = {},
    workspaceId: string,
    userId: string
  ): Promise<{
    content: string
    suggestionId: string
    usage: AIUsageMetrics
  }> {
    // ADR-0019: AI-credit metering choke point — one credit per AI call
    // (cached responses included: a call is a call). Throws LimitExceededError,
    // which API routes map to a 402 limit_exceeded response.
    await assertWithinLimit(workspaceId, 'aiCreditsPerMonth')

    // Check cache first if enabled
    const cacheKey = this.cache.generateKey('generateContent', { prompt, options })
    
    if (this.config.cacheEnabled) {
      const cached = await this.cache.get<{ content: string; usage: AIUsageMetrics }>(cacheKey)
      if (cached) {
        // Still create a suggestion record for tracking
        const suggestion = await this.saveSuggestion({
          workspaceId,
          userId,
          originalContent: prompt,
          suggestedContent: cached.content,
          suggestionType: 'CAPTION',
          platform: options.platform,
          confidenceScore: 0.9,
          postId: null
        })

        return {
          content: cached.content,
          suggestionId: suggestion.id,
          usage: { ...cached.usage, costCents: 0 } // No cost for cached responses
        }
      }
    }

    // Safety check
    const safetyCheck = await this.safetyFilter.checkContent(prompt)
    if (!safetyCheck.safe) {
      throw new Error(`Content safety check failed: ${safetyCheck.flags.join(', ')}`)
    }

    // Generate content using AI provider
    await this.assertWithinCostCeiling(workspaceId)
    const provider = this.getProvider()
    const result = await provider.generateContent(prompt, options)

    // Safety check generated content
    const generatedSafetyCheck = await this.safetyFilter.checkContent(result.content)
    if (!generatedSafetyCheck.safe) {
      throw new Error(`Generated content safety check failed: ${generatedSafetyCheck.flags.join(', ')}`)
    }

    // Cache the result if enabled
    if (this.config.cacheEnabled) {
      await this.cache.set(cacheKey, result, this.config.cacheTTL, {
        provider: this.config.provider,
        model: result.usage.model,
        tokensSaved: result.usage.tokensUsed
      })
    }

    // Save suggestion to database
    const suggestion = await this.saveSuggestion({
      workspaceId,
      userId,
      originalContent: prompt,
      suggestedContent: result.content,
      suggestionType: 'CAPTION',
      platform: options.platform,
      confidenceScore: 0.8,
      postId: null
    })

    // Track usage
    await this.trackUsage({
      workspaceId,
      userId,
      featureType: 'CONTENT_GENERATION',
      tokensUsed: result.usage.tokensUsed,
      costCents: result.usage.costCents,
      responseTimeMs: result.usage.responseTimeMs,
      model: result.usage.model,
      successful: true
    })

    return {
      content: result.content,
      suggestionId: suggestion.id,
      usage: result.usage
    }
  }

  async suggestHashtags(
    options: HashtagSuggestionOptions,
    workspaceId: string,
    userId: string
  ): Promise<{
    hashtags: string[]
    suggestionId: string
    usage: AIUsageMetrics
  }> {
    // ADR-0019: AI-credit metering (see generateContent)
    await assertWithinLimit(workspaceId, 'aiCreditsPerMonth')

    const cacheKey = this.cache.generateKey('suggestHashtags', options)
    
    if (this.config.cacheEnabled) {
      const cached = await this.cache.get<{ hashtags: string[]; usage: AIUsageMetrics }>(cacheKey)
      if (cached) {
        const suggestion = await this.saveSuggestion({
          workspaceId,
          userId,
          originalContent: options.content,
          suggestedContent: cached.hashtags.join(' '),
          suggestionType: 'HASHTAGS',
          platform: options.platform,
          confidenceScore: 0.9,
          postId: null
        })

        return {
          hashtags: cached.hashtags,
          suggestionId: suggestion.id,
          usage: { ...cached.usage, costCents: 0 }
        }
      }
    }

    await this.assertWithinCostCeiling(workspaceId)
    const provider = this.getProvider()
    const result = await provider.suggestHashtags(options)

    if (this.config.cacheEnabled) {
      await this.cache.set(cacheKey, result, this.config.cacheTTL)
    }

    const suggestion = await this.saveSuggestion({
      workspaceId,
      userId,
      originalContent: options.content,
      suggestedContent: result.hashtags.join(' '),
      suggestionType: 'HASHTAGS',
      platform: options.platform,
      confidenceScore: 0.8,
      postId: null
    })

    await this.trackUsage({
      workspaceId,
      userId,
      featureType: 'HASHTAG_SUGGESTION',
      tokensUsed: result.usage.tokensUsed,
      costCents: result.usage.costCents,
      responseTimeMs: result.usage.responseTimeMs,
      model: result.usage.model,
      successful: true
    })

    return {
      hashtags: result.hashtags,
      suggestionId: suggestion.id,
      usage: result.usage
    }
  }

  async analyzeTone(
    content: string,
    workspaceId: string,
    userId: string,
    postId?: string
  ) {
    // ADR-0019: AI-credit metering (see generateContent)
    await assertWithinLimit(workspaceId, 'aiCreditsPerMonth')

    await this.assertWithinCostCeiling(workspaceId)
    const provider = this.getProvider()
    const result = await provider.analyzeTone(content)

    // Save tone analysis if postId provided
    if (postId) {
      await prisma.contentToneAnalysis.upsert({
        where: { postId },
        update: {
          tone: result.analysis.tone.toUpperCase() as any,
          confidence: result.analysis.confidence,
          sentiment: result.analysis.sentiment,
          formality: result.analysis.formality,
          energy: result.analysis.energy
        },
        create: {
          postId,
          tone: result.analysis.tone.toUpperCase() as any,
          confidence: result.analysis.confidence,
          sentiment: result.analysis.sentiment,
          formality: result.analysis.formality,
          energy: result.analysis.energy
        }
      })
    }

    await this.trackUsage({
      workspaceId,
      userId,
      featureType: 'TONE_ANALYSIS',
      tokensUsed: result.usage.tokensUsed,
      costCents: result.usage.costCents,
      responseTimeMs: result.usage.responseTimeMs,
      model: result.usage.model,
      successful: true
    })

    return result
  }

  async optimizeForPlatform(
    content: string,
    platform: SocialProvider,
    options: ContentGenerationOptions = {},
    workspaceId: string,
    userId: string
  ) {
    // ADR-0019: AI-credit metering (see generateContent)
    await assertWithinLimit(workspaceId, 'aiCreditsPerMonth')

    await this.assertWithinCostCeiling(workspaceId)
    const provider = this.getProvider()
    const result = await provider.optimizeForPlatform(content, platform, options)

    const suggestion = await this.saveSuggestion({
      workspaceId,
      userId,
      originalContent: content,
      suggestedContent: result.content,
      suggestionType: 'OPTIMIZATION',
      platform,
      confidenceScore: 0.85,
      postId: null
    })

    await this.trackUsage({
      workspaceId,
      userId,
      featureType: 'CONTENT_GENERATION',
      tokensUsed: result.usage.tokensUsed,
      costCents: result.usage.costCents,
      responseTimeMs: result.usage.responseTimeMs,
      model: result.usage.model,
      successful: true
    })

    return {
      content: result.content,
      suggestionId: suggestion.id,
      usage: result.usage
    }
  }

  async predictPerformance(
    content: string,
    platform: SocialProvider,
    workspaceId: string,
    userId: string,
    postId?: string
  ) {
    // ADR-0019: AI-credit metering (see generateContent)
    await assertWithinLimit(workspaceId, 'aiCreditsPerMonth')

    // Get historical data for better predictions
    const historicalData = await this.getHistoricalData(workspaceId, platform)
    
    await this.assertWithinCostCeiling(workspaceId)
    const provider = this.getProvider()
    const result = await provider.predictPerformance(content, platform, historicalData)

    // Save prediction if postId provided
    if (postId) {
      await prisma.contentPerformancePrediction.upsert({
        where: { postId },
        update: {
          predictedEngagementRate: result.prediction.engagementRate,
          predictedReach: result.prediction.reach,
          predictedImpressions: result.prediction.impressions,
          predictedLikes: result.prediction.likes,
          predictedComments: result.prediction.comments,
          predictedShares: result.prediction.shares,
          confidenceScore: result.prediction.confidence
        },
        create: {
          postId,
          predictedEngagementRate: result.prediction.engagementRate,
          predictedReach: result.prediction.reach,
          predictedImpressions: result.prediction.impressions,
          predictedLikes: result.prediction.likes,
          predictedComments: result.prediction.comments,
          predictedShares: result.prediction.shares,
          confidenceScore: result.prediction.confidence
        }
      })
    }

    await this.trackUsage({
      workspaceId,
      userId,
      featureType: 'PERFORMANCE_PREDICTION',
      tokensUsed: result.usage.tokensUsed,
      costCents: result.usage.costCents,
      responseTimeMs: result.usage.responseTimeMs,
      model: result.usage.model,
      successful: true
    })

    return result
  }

  private async saveSuggestion(data: {
    workspaceId: string
    userId: string
    originalContent: string | null
    suggestedContent: string
    suggestionType: 'HASHTAGS' | 'CAPTION' | 'TONE_ADJUSTMENT' | 'OPTIMIZATION' | 'TRANSLATION'
    platform: SocialProvider | null | undefined
    confidenceScore: number
    postId: string | null
  }): Promise<AIContentSuggestion> {
    return await prisma.aIContentSuggestion.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        originalContent: data.originalContent,
        suggestedContent: data.suggestedContent,
        suggestionType: data.suggestionType,
        platform: data.platform,
        confidenceScore: data.confidenceScore,
        postId: data.postId
      }
    })
  }

  private async trackUsage(data: {
    workspaceId: string
    userId: string
    featureType: 'CONTENT_GENERATION' | 'HASHTAG_SUGGESTION' | 'TONE_ANALYSIS' | 'PERFORMANCE_PREDICTION' | 'IMAGE_ANALYSIS' | 'TRANSLATION'
    tokensUsed?: number
    costCents?: number
    responseTimeMs?: number
    model?: string
    successful: boolean
    errorMessage?: string
  }): Promise<AIUsageTracking> {
    return await prisma.aIUsageTracking.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        featureType: data.featureType,
        tokensUsed: data.tokensUsed,
        costCents: data.costCents,
        responseTimeMs: data.responseTimeMs,
        model: data.model,
        successful: data.successful,
        errorMessage: data.errorMessage
      }
    })
  }

  private async getHistoricalData(workspaceId: string, platform: SocialProvider) {
    // Get recent posts with metrics for the platform
    const historicalPosts = await prisma.post.findMany({
      where: {
        workspaceId,
        variants: {
          some: {
            socialAccount: {
              provider: platform
            }
          }
        }
      },
      include: {
        metrics: true,
        variants: {
          where: {
            socialAccount: {
              provider: platform
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return historicalPosts.map(post => ({
      content: post.baseContent,
      metrics: post.metrics
    }))
  }

  // Utility methods for monitoring
  getCacheStats() {
    return this.cache.getStats()
  }

  async getUsageStats(workspaceId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    
    return await prisma.aIUsageTracking.aggregate({
      where: {
        workspaceId,
        createdAt: { gte: since }
      },
      _sum: {
        tokensUsed: true,
        costCents: true
      },
      _count: true,
      _avg: {
        responseTimeMs: true
      }
    })
  }
}

// Export a singleton instance
export const aiService = new AIService({
  provider: 'openai',
  rateLimitRPM: 60,
  rateLimitTPM: 40000,
  cacheEnabled: true,
  cacheTTL: 3600
})