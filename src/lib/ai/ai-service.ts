// Main AI Service Manager

import { SocialProvider, AIUsageTracking, AIContentSuggestion } from '@prisma/client'
import { OpenAIProvider } from './providers/openai-provider'
import { MockAIProvider } from './providers/mock-provider'
import { AICache } from './cache'
import { ContentSafetyFilter } from './safety-filter'
import { prisma } from '../prisma'
import {
  AIProvider,
  AIServiceConfig,
  ContentGenerationOptions,
  HashtagSuggestionOptions,
  AIUsageMetrics
} from './types'

export class AIService {
  private providers: Map<string, AIProvider> = new Map()
  private cache: AICache
  private safetyFilter: ContentSafetyFilter
  private config: AIServiceConfig

  constructor(config: AIServiceConfig) {
    this.config = config
    this.cache = new AICache(config.cacheTTL || 3600)
    this.safetyFilter = new ContentSafetyFilter()
    
    // Initialize providers based on config
    this.initializeProviders()
  }

  private initializeProviders(): void {
    // Initialize OpenAI provider if API key is available
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey && openaiKey !== 'your-openai-api-key-here' && (this.config.provider === 'openai' || !this.config.provider)) {
      const provider = new OpenAIProvider(
        openaiKey,
        this.config.rateLimitRPM || 60,
        this.config.rateLimitTPM || 40000
      )
      this.providers.set('openai', provider)
      console.log('✅ OpenAI provider initialized')
    } else {
      // Use mock provider for development when OpenAI is not configured
      const mockProvider = new MockAIProvider(500) // 500ms delay for realistic simulation
      this.providers.set('openai', mockProvider)
      console.log('🚧 Using mock AI provider (OpenAI API key not configured)')
    }

    // TODO: Add other providers (Anthropic, Google, Azure) as needed
  }

  private getProvider(): AIProvider {
    const provider = this.providers.get(this.config.provider || 'openai')
    if (!provider) {
      throw new Error(`AI provider ${this.config.provider || 'openai'} not initialized`)
    }
    return provider
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
    // Get historical data for better predictions
    const historicalData = await this.getHistoricalData(workspaceId, platform)
    
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