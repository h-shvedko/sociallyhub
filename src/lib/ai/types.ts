// AI Service Types and Interfaces

import { SocialProvider } from '@prisma/client'

export interface ContentGenerationOptions {
  platform?: SocialProvider
  tone?: 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational' | 'promotional' | 'conversational' | 'formal'
  maxLength?: number
  includeHashtags?: boolean
  includeEmojis?: boolean
  language?: string
  brandVoice?: string
  targetAudience?: string
}

export interface HashtagSuggestionOptions {
  platform: SocialProvider
  content: string
  industry?: string
  location?: string
  maxHashtags?: number
}

export interface ToneAnalysisResult {
  tone: string
  confidence: number
  sentiment: number // -1 to 1
  formality: number // 0 to 1
  energy: number // 0 to 1
}

export interface PerformancePredictionResult {
  engagementRate: number
  reach: number
  impressions: number
  likes: number
  comments: number
  shares: number
  confidence: number
}

export interface AIUsageMetrics {
  tokensUsed: number
  costCents: number
  responseTimeMs: number
  model: string
}

export interface AIProvider {
  generateContent(prompt: string, options: ContentGenerationOptions): Promise<{
    content: string
    usage: AIUsageMetrics
  }>
  
  suggestHashtags(options: HashtagSuggestionOptions): Promise<{
    hashtags: string[]
    usage: AIUsageMetrics
  }>
  
  analyzeTone(content: string): Promise<{
    analysis: ToneAnalysisResult
    usage: AIUsageMetrics
  }>
  
  optimizeForPlatform(content: string, platform: SocialProvider, options?: ContentGenerationOptions): Promise<{
    content: string
    usage: AIUsageMetrics
  }>
  
  predictPerformance(content: string, platform: SocialProvider, historicalData?: any[]): Promise<{
    prediction: PerformancePredictionResult
    usage: AIUsageMetrics
  }>
}

export interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'azure'
  model?: string
  maxTokens?: number
  temperature?: number
  rateLimitRPM?: number // Requests per minute
  rateLimitTPM?: number // Tokens per minute
  cacheEnabled?: boolean
  cacheTTL?: number // Cache time-to-live in seconds
}

export interface CacheEntry {
  key: string
  value: any
  expiresAt: Date
  metadata?: {
    provider: string
    model: string
    tokensSaved: number
  }
}

export interface SafetyFilter {
  checkContent(content: string): Promise<{
    safe: boolean
    flags: string[]
    severity: 'low' | 'medium' | 'high'
    suggestions?: string[]
  }>
}