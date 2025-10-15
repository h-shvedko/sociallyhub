// Mock AI Provider for Development
import { SocialProvider } from '@prisma/client'
import {
  AIProvider,
  ContentGenerationOptions,
  HashtagSuggestionOptions,
  AIUsageMetrics,
  ToneAnalysis,
  PerformancePrediction
} from '../types'

export class MockAIProvider implements AIProvider {
  private delay: number

  constructor(delay: number = 1000) {
    this.delay = delay
  }

  private async simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.delay))
  }

  private createMockUsage(): AIUsageMetrics {
    return {
      tokensUsed: Math.floor(Math.random() * 100) + 50,
      costCents: Math.floor(Math.random() * 5) + 1,
      responseTimeMs: this.delay + Math.floor(Math.random() * 500),
      model: 'mock-gpt-3.5-turbo'
    }
  }

  async generateContent(
    prompt: string,
    options: ContentGenerationOptions = {}
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    await this.simulateDelay()

    const tones = {
      professional: "🏢 We're excited to share our latest insights with our valued clients and partners.",
      casual: "Hey everyone! 👋 Just wanted to drop some cool insights your way!",
      humorous: "Why did the social media manager cross the road? To get better engagement on the other side! 😄",
      inspirational: "✨ Every challenge is an opportunity to grow. Today's struggles are tomorrow's strengths! 🌟",
      educational: "📚 Did you know? Social media engagement increases by 67% when you post consistently.",
      promotional: "🎉 LIMITED TIME: Don't miss out on our exclusive offer! Save 50% today only!",
      conversational: "What's your take on this? We'd love to hear your thoughts in the comments below!",
      formal: "We would like to formally announce our strategic partnership and upcoming initiatives."
    }

    let content = tones[options.tone as keyof typeof tones] || tones.professional

    // Platform-specific adjustments
    if (options.platform) {
      switch (options.platform) {
        case 'TWITTER':
          content = content.substring(0, 240) + " #TwitterDemo"
          break
        case 'LINKEDIN':
          content += "\n\n#LinkedInDemo #Professional #MockContent"
          break
        case 'INSTAGRAM':
          content += "\n\n📸 #InstaDemo #MockContent #SocialMedia"
          break
        case 'FACEBOOK':
          content += "\n\nWhat do you think? Let us know in the comments! #FacebookDemo"
          break
        case 'YOUTUBE':
          content = "🎥 " + content + "\n\nDon't forget to like and subscribe! #YouTubeDemo"
          break
        case 'TIKTOK':
          content = "🎵 " + content.substring(0, 100) + " #TikTokDemo #Trending"
          break
      }
    }

    if (options.includeHashtags) {
      content += "\n\n#MockAI #SociallyHub #ContentGeneration #Demo"
    }

    if (options.includeEmojis && !content.includes('📸') && !content.includes('🎵') && !content.includes('🎥')) {
      content = "🚀 " + content + " ✨"
    }

    return {
      content,
      usage: this.createMockUsage()
    }
  }

  async suggestHashtags(
    options: HashtagSuggestionOptions
  ): Promise<{ hashtags: string[]; usage: AIUsageMetrics }> {
    await this.simulateDelay()

    const baseHashtags = [
      '#SociallyHub', '#MockAI', '#ContentCreation', '#SocialMedia',
      '#DigitalMarketing', '#Engagement', '#Demo', '#TestContent'
    ]

    const platformHashtags = {
      TWITTER: ['#TwitterChat', '#Tweet', '#Trending'],
      LINKEDIN: ['#LinkedIn', '#Professional', '#Business'],
      INSTAGRAM: ['#Insta', '#Photography', '#Visual'],
      FACEBOOK: ['#Facebook', '#Community', '#Social'],
      YOUTUBE: ['#YouTube', '#Video', '#Subscribe'],
      TIKTOK: ['#TikTok', '#Viral', '#ForYou']
    }

    let hashtags = [...baseHashtags]

    if (options.platform && platformHashtags[options.platform]) {
      hashtags = [...hashtags, ...platformHashtags[options.platform]]
    }

    // Limit to requested count
    const count = options.count || 8
    hashtags = hashtags.slice(0, count)

    return {
      hashtags,
      usage: this.createMockUsage()
    }
  }

  async analyzeTone(content: string): Promise<{
    analysis: ToneAnalysis;
    usage: AIUsageMetrics;
  }> {
    await this.simulateDelay()

    // Simple mock tone analysis based on content
    let tone = 'professional'
    let sentiment = 0.5
    let formality = 0.6
    let energy = 0.5

    if (content.includes('!') || content.includes('🎉') || content.includes('exciting')) {
      tone = 'enthusiastic'
      sentiment = 0.8
      energy = 0.9
    } else if (content.includes('?') || content.includes('think') || content.includes('opinion')) {
      tone = 'conversational'
      sentiment = 0.6
      formality = 0.3
    } else if (content.includes('formal') || content.includes('announce') || content.includes('partnership')) {
      tone = 'formal'
      formality = 0.9
      energy = 0.3
    }

    return {
      analysis: {
        tone,
        confidence: 0.85,
        sentiment,
        formality,
        energy
      },
      usage: this.createMockUsage()
    }
  }

  async optimizeForPlatform(
    content: string,
    platform: SocialProvider,
    options: ContentGenerationOptions = {}
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    await this.simulateDelay()

    let optimizedContent = content

    switch (platform) {
      case 'TWITTER':
        // Shorten for Twitter
        optimizedContent = content.substring(0, 240)
        if (!optimizedContent.includes('#')) {
          optimizedContent += ' #TwitterOptimized'
        }
        break

      case 'LINKEDIN':
        // Make more professional
        optimizedContent = content.charAt(0).toUpperCase() + content.slice(1)
        if (!optimizedContent.endsWith('.')) {
          optimizedContent += '.'
        }
        optimizedContent += '\n\n#LinkedIn #Professional'
        break

      case 'INSTAGRAM':
        // Add visual elements
        if (!optimizedContent.includes('📸')) {
          optimizedContent = '📸 ' + optimizedContent
        }
        optimizedContent += '\n\n#Instagram #Visual #MockOptimized'
        break

      case 'FACEBOOK':
        // Encourage engagement
        optimizedContent += '\n\nWhat are your thoughts? Share in the comments below! 👇'
        break

      case 'YOUTUBE':
        // Add video context
        optimizedContent = '🎥 ' + optimizedContent + '\n\nLike and subscribe for more content!'
        break

      case 'TIKTOK':
        // Keep it short and trendy
        optimizedContent = '🎵 ' + content.substring(0, 150) + ' #Trending #TikTok'
        break
    }

    return {
      content: optimizedContent,
      usage: this.createMockUsage()
    }
  }

  async predictPerformance(
    content: string,
    platform: SocialProvider,
    historicalData?: any[]
  ): Promise<{
    prediction: PerformancePrediction;
    usage: AIUsageMetrics;
  }> {
    await this.simulateDelay()

    // Generate realistic mock predictions
    const baseEngagement = Math.random() * 0.1 + 0.02 // 2-12%
    const platformMultiplier = {
      TWITTER: 0.8,
      INSTAGRAM: 1.5,
      LINKEDIN: 0.6,
      FACEBOOK: 0.7,
      YOUTUBE: 1.2,
      TIKTOK: 2.0
    }

    const multiplier = platformMultiplier[platform] || 1.0
    const engagementRate = baseEngagement * multiplier

    const impressions = Math.floor(Math.random() * 50000) + 1000
    const reach = Math.floor(impressions * 0.7)
    const likes = Math.floor(reach * engagementRate * 0.8)
    const comments = Math.floor(likes * 0.1)
    const shares = Math.floor(likes * 0.05)

    return {
      prediction: {
        engagementRate,
        reach,
        impressions,
        likes,
        comments,
        shares,
        confidence: 0.75
      },
      usage: this.createMockUsage()
    }
  }
}