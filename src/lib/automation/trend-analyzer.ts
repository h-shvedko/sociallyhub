import { openai } from '@/lib/ai/config'
import { prisma } from '@/lib/prisma'
import { TrendSource, TrendStatus, ContentType } from '@prisma/client'
import { z } from 'zod'

const TrendAnalysisResponseSchema = z.object({
  trends: z.array(z.object({
    topic: z.string(),
    relevanceScore: z.number().min(0).max(1),
    viralityScore: z.number().min(0).max(1).optional(),
    suggestedAngles: z.array(z.string()),
    contentIdeas: z.array(z.string()),
    targetAudience: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    reasoning: z.string()
  }))
})

export interface TrendAnalysisOptions {
  industry?: string
  targetAudience?: string
  contentTypes?: ContentType[]
  timeframe?: '24h' | '7d' | '30d'
  sources?: TrendSource[]
  minRelevanceScore?: number
}

export interface DetectedTrend {
  topic: string
  relevanceScore: number
  viralityScore?: number
  suggestedAngles: string[]
  contentIdeas: string[]
  targetAudience?: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  reasoning: string
  source: TrendSource
}

export interface NewsSource {
  title: string
  url: string
  content: string
  publishedAt: Date
  source: string
  category?: string
}

export class TrendAnalyzer {
  private readonly rateLimiter = new Map<string, number[]>()
  private readonly cache = new Map<string, { data: DetectedTrend[]; timestamp: number }>()
  private readonly CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

  async analyzeTrends(
    workspaceId: string,
    options: TrendAnalysisOptions = {}
  ): Promise<DetectedTrend[]> {
    const cacheKey = this.generateCacheKey(workspaceId, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    if (!this.checkRateLimit(workspaceId)) {
      throw new Error('Rate limit exceeded for trend analysis')
    }

    try {
      // Get news sources based on options
      const newsSources = await this.fetchNewsContent(options)
      
      // Analyze trends using AI
      const trends = await this.analyzeContentForTrends(newsSources, options)
      
      // Store trends in database
      await this.storeTrendsInDatabase(workspaceId, trends, options)
      
      // Cache results
      this.cache.set(cacheKey, { data: trends, timestamp: Date.now() })
      
      return trends
    } catch (error) {
      console.error('Error analyzing trends:', error)
      throw new Error('Failed to analyze trends')
    }
  }

  private async fetchNewsContent(options: TrendAnalysisOptions): Promise<NewsSource[]> {
    // In a real implementation, this would fetch from multiple news APIs
    // For now, we'll simulate with placeholder data and focus on AI analysis
    const mockNewsSources: NewsSource[] = [
      {
        title: "AI Revolution in Social Media Marketing 2024",
        url: "https://example.com/ai-social-media-2024",
        content: "Artificial intelligence is transforming how brands engage with audiences on social media. New AI tools are enabling personalized content creation, predictive analytics, and automated customer service responses.",
        publishedAt: new Date(),
        source: "TechCrunch",
        category: "technology"
      },
      {
        title: "Short-Form Video Content Dominates Engagement",
        url: "https://example.com/short-form-video-2024",
        content: "Research shows that short-form video content continues to drive the highest engagement rates across all major social media platforms. Brands are shifting budget towards TikTok, Instagram Reels, and YouTube Shorts.",
        publishedAt: new Date(),
        source: "Marketing Land",
        category: "marketing"
      },
      {
        title: "Sustainability Messaging Resonates with Gen Z",
        url: "https://example.com/sustainability-genz-2024",
        content: "Gen Z consumers are increasingly choosing brands based on their environmental and social impact. Companies with authentic sustainability messaging see 40% higher engagement from younger demographics.",
        publishedAt: new Date(),
        source: "Forbes",
        category: "business"
      }
    ]

    // Filter based on timeframe and industry if specified
    const filteredSources = mockNewsSources.filter(source => {
      if (options.industry) {
        return source.category?.toLowerCase().includes(options.industry.toLowerCase()) ||
               source.content.toLowerCase().includes(options.industry.toLowerCase())
      }
      return true
    })

    return filteredSources
  }

  private async analyzeContentForTrends(
    newsSources: NewsSource[],
    options: TrendAnalysisOptions
  ): Promise<DetectedTrend[]> {
    const newsContent = newsSources.map(source => 
      `Title: ${source.title}\nContent: ${source.content}\nSource: ${source.source}`
    ).join('\n\n---\n\n')

    const prompt = `
Analyze the following news content and identify trending topics relevant for social media marketing.

NEWS CONTENT:
${newsContent}

ANALYSIS CONTEXT:
- Industry focus: ${options.industry || 'general'}
- Target audience: ${options.targetAudience || 'general business audience'}
- Content types: ${options.contentTypes?.join(', ') || 'all types'}
- Timeframe: ${options.timeframe || '7d'}

Please analyze and identify trends that could be valuable for social media content creation. For each trend, provide:

1. Topic name and description
2. Relevance score (0-1) for social media marketing
3. Virality potential score (0-1) if applicable
4. 3-5 suggested content angles
5. 3-5 specific content ideas
6. Target audience if specific
7. Urgency level (low/medium/high/critical)
8. Reasoning for why this trend matters

Focus on trends that are:
- Actionable for content creation
- Relevant to the specified industry and audience
- Have potential for engagement
- Are timely and current

Return your analysis as a JSON object with a "trends" array.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media trend analyst. Provide actionable insights for content creators based on current news and market trends.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from AI')
      }

      const parsedResponse = JSON.parse(response)
      const validatedResponse = TrendAnalysisResponseSchema.parse(parsedResponse)

      return validatedResponse.trends.map(trend => ({
        ...trend,
        source: TrendSource.NEWS // Default to NEWS source
      }))
    } catch (error) {
      console.error('Error in AI trend analysis:', error)
      
      // Fallback analysis
      return this.getFallbackTrends(newsSources, options)
    }
  }

  private getFallbackTrends(
    newsSources: NewsSource[],
    options: TrendAnalysisOptions
  ): DetectedTrend[] {
    // Simple fallback when AI analysis fails
    return newsSources.slice(0, 3).map((source, index) => ({
      topic: source.title,
      relevanceScore: 0.7 - (index * 0.1),
      viralityScore: 0.5,
      suggestedAngles: [
        `Educational content about ${source.title.toLowerCase()}`,
        `Behind-the-scenes perspective on ${source.title.toLowerCase()}`,
        `Expert opinion on ${source.title.toLowerCase()}`
      ],
      contentIdeas: [
        `Create an infographic about ${source.title}`,
        `Write a thought leadership post about ${source.title}`,
        `Share expert tips related to ${source.title}`
      ],
      urgency: 'medium' as const,
      reasoning: `This topic is trending based on recent news coverage and could provide valuable content opportunities.`,
      source: TrendSource.NEWS
    }))
  }

  private async storeTrendsInDatabase(
    workspaceId: string,
    trends: DetectedTrend[],
    options: TrendAnalysisOptions
  ): Promise<void> {
    try {
      for (const trend of trends) {
        await prisma.trendAnalysis.create({
          data: {
            workspaceId,
            topic: trend.topic,
            sourceType: trend.source,
            trendScore: trend.relevanceScore,
            viralityScore: trend.viralityScore,
            suggestedTopics: trend.contentIdeas,
            suggestedAngles: trend.suggestedAngles,
            targetAudience: trend.targetAudience,
            urgencyLevel: trend.urgency.toUpperCase() as any,
            reasoning: trend.reasoning,
            status: TrendStatus.ACTIVE,
            expiresAt: this.calculateExpirationDate(options.timeframe || '7d'),
            metadata: {
              industry: options.industry,
              contentTypes: options.contentTypes,
              analysisOptions: options
            }
          }
        })
      }
    } catch (error) {
      console.error('Error storing trends in database:', error)
      // Don't throw here, as analysis was successful
    }
  }

  async getStoredTrends(
    workspaceId: string,
    options: {
      status?: TrendStatus
      sourceType?: TrendSource
      minScore?: number
      limit?: number
    } = {}
  ) {
    return prisma.trendAnalysis.findMany({
      where: {
        workspaceId,
        status: options.status || TrendStatus.ACTIVE,
        sourceType: options.sourceType,
        trendScore: options.minScore ? { gte: options.minScore } : undefined,
        expiresAt: { gt: new Date() }
      },
      orderBy: [
        { trendScore: 'desc' },
        { createdAt: 'desc' }
      ],
      take: options.limit || 20
    })
  }

  async updateTrendStatus(trendId: string, status: TrendStatus, userId: string) {
    return prisma.trendAnalysis.update({
      where: { id: trendId },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }

  async generateContentSuggestions(
    workspaceId: string,
    trendId: string,
    contentType: ContentType
  ) {
    const trend = await prisma.trendAnalysis.findUnique({
      where: { id: trendId }
    })

    if (!trend) {
      throw new Error('Trend not found')
    }

    const prompt = `
Based on this trending topic, generate specific ${contentType.toLowerCase()} content suggestions:

TREND: ${trend.topic}
SUGGESTED ANGLES: ${trend.suggestedAngles.join(', ')}
TARGET AUDIENCE: ${trend.targetAudience || 'general'}

Generate 5 specific content ideas for ${contentType.toLowerCase()} that would:
1. Leverage this trend effectively
2. Engage the target audience
3. Be practical to create
4. Align with current social media best practices

For each suggestion, provide:
- Content title/hook
- Brief description
- Suggested platform(s)
- Estimated engagement potential
- Key hashtags to use
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a social media content strategist. Provide practical, actionable content suggestions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })

      const suggestions = completion.choices[0]?.message?.content || ''

      // Store content suggestion
      await prisma.contentSuggestion.create({
        data: {
          workspaceId,
          trendAnalysisId: trendId,
          contentType,
          title: `Content suggestions for: ${trend.topic}`,
          suggestion: suggestions,
          confidence: 0.8,
          status: 'PENDING'
        }
      })

      return suggestions
    } catch (error) {
      console.error('Error generating content suggestions:', error)
      throw new Error('Failed to generate content suggestions')
    }
  }

  private checkRateLimit(workspaceId: string): boolean {
    const now = Date.now()
    const requests = this.rateLimiter.get(workspaceId) || []
    
    // Remove requests older than 1 hour
    const recentRequests = requests.filter(time => now - time < 60 * 60 * 1000)
    
    // Allow max 10 requests per hour per workspace
    if (recentRequests.length >= 10) {
      return false
    }
    
    recentRequests.push(now)
    this.rateLimiter.set(workspaceId, recentRequests)
    return true
  }

  private generateCacheKey(workspaceId: string, options: TrendAnalysisOptions): string {
    return `trends:${workspaceId}:${JSON.stringify(options)}`
  }

  private calculateExpirationDate(timeframe: string): Date {
    const now = new Date()
    switch (timeframe) {
      case '24h':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case '7d':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    }
  }
}