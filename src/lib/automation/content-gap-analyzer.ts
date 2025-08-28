import { openai } from '@/lib/ai/config'
import { prisma } from '@/lib/prisma'
import { ContentType, Platform, GapAnalysisStatus } from '@prisma/client'
import { z } from 'zod'

const ContentGapAnalysisResponseSchema = z.object({
  gaps: z.array(z.object({
    gapType: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    suggestedTopics: z.array(z.string()),
    contentTypes: z.array(z.string()),
    targetAudience: z.string().optional(),
    reasoning: z.string(),
    competitorExamples: z.array(z.string()).optional(),
    estimatedEffort: z.enum(['low', 'medium', 'high']),
    potentialImpact: z.enum(['low', 'medium', 'high'])
  }))
})

export interface ContentGapOptions {
  platforms?: Platform[]
  contentTypes?: ContentType[]
  timeframe?: '30d' | '90d' | '180d' | '1y'
  competitorAnalysis?: boolean
  audienceSegments?: string[]
  targetKeywords?: string[]
}

export interface ContentGap {
  gapType: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  suggestedTopics: string[]
  contentTypes: string[]
  targetAudience?: string
  reasoning: string
  competitorExamples?: string[]
  estimatedEffort: 'low' | 'medium' | 'high'
  potentialImpact: 'low' | 'medium' | 'high'
}

export interface ContentAnalytics {
  totalPosts: number
  platformDistribution: Record<Platform, number>
  contentTypeDistribution: Record<ContentType, number>
  engagementMetrics: {
    avgEngagementRate: number
    topPerformingTypes: ContentType[]
    lowPerformingTypes: ContentType[]
  }
  topicCoverage: {
    coveredTopics: string[]
    topicFrequency: Record<string, number>
  }
  audienceInsights: {
    mostEngagedSegments: string[]
    underservedSegments: string[]
  }
}

export class ContentGapAnalyzer {
  private readonly cache = new Map<string, { data: ContentGap[]; timestamp: number }>()
  private readonly CACHE_DURATION = 60 * 60 * 1000 // 1 hour

  async analyzeContentGaps(
    workspaceId: string,
    options: ContentGapOptions = {}
  ): Promise<ContentGap[]> {
    const cacheKey = this.generateCacheKey(workspaceId, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Get current content analytics
      const contentAnalytics = await this.getContentAnalytics(workspaceId, options)
      
      // Get competitor insights if enabled
      const competitorInsights = options.competitorAnalysis 
        ? await this.getCompetitorInsights(workspaceId)
        : null

      // Analyze gaps using AI
      const gaps = await this.performGapAnalysis(contentAnalytics, competitorInsights, options)
      
      // Store gaps in database
      await this.storeGapsInDatabase(workspaceId, gaps, options)
      
      // Cache results
      this.cache.set(cacheKey, { data: gaps, timestamp: Date.now() })
      
      return gaps
    } catch (error) {
      console.error('Error analyzing content gaps:', error)
      throw new Error('Failed to analyze content gaps')
    }
  }

  private async getContentAnalytics(
    workspaceId: string,
    options: ContentGapOptions
  ): Promise<ContentAnalytics> {
    const timeframeDays = this.getTimeframeDays(options.timeframe || '90d')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeframeDays)

    // Get posts with analytics
    const posts = await prisma.post.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        platforms: options.platforms ? { hasSome: options.platforms } : undefined,
        contentType: options.contentTypes ? { in: options.contentTypes } : undefined
      },
      include: {
        analyticsMetrics: {
          where: {
            metricType: { in: ['engagement_rate', 'impressions', 'clicks', 'likes', 'shares'] }
          }
        }
      }
    })

    // Calculate platform distribution
    const platformDistribution: Record<Platform, number> = {} as Record<Platform, number>
    posts.forEach(post => {
      post.platforms.forEach(platform => {
        platformDistribution[platform] = (platformDistribution[platform] || 0) + 1
      })
    })

    // Calculate content type distribution
    const contentTypeDistribution: Record<ContentType, number> = {} as Record<ContentType, number>
    posts.forEach(post => {
      if (post.contentType) {
        contentTypeDistribution[post.contentType] = (contentTypeDistribution[post.contentType] || 0) + 1
      }
    })

    // Calculate engagement metrics
    const engagementRates = posts.map(post => {
      const engagementMetric = post.analyticsMetrics.find(m => m.metricType === 'engagement_rate')
      return engagementMetric ? parseFloat(engagementMetric.value) : 0
    })
    
    const avgEngagementRate = engagementRates.length > 0 
      ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length
      : 0

    // Analyze topic coverage (simplified - in practice would use NLP)
    const topicCoverage = this.analyzeTopicCoverage(posts)

    return {
      totalPosts: posts.length,
      platformDistribution,
      contentTypeDistribution,
      engagementMetrics: {
        avgEngagementRate,
        topPerformingTypes: this.getTopPerformingContentTypes(posts),
        lowPerformingTypes: this.getLowPerformingContentTypes(posts)
      },
      topicCoverage,
      audienceInsights: {
        mostEngagedSegments: [], // Would be calculated from actual audience data
        underservedSegments: []
      }
    }
  }

  private async getCompetitorInsights(workspaceId: string) {
    // Get competitor analysis data if available
    const competitorAnalyses = await prisma.competitorAnalysis.findMany({
      where: { 
        workspaceId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return {
      competitorStrategies: competitorAnalyses.map(analysis => ({
        competitor: analysis.competitorName,
        strategy: analysis.strategy,
        strengths: analysis.strengths,
        opportunities: analysis.opportunities
      })),
      industryTrends: competitorAnalyses.flatMap(analysis => analysis.industryTrends || [])
    }
  }

  private async performGapAnalysis(
    contentAnalytics: ContentAnalytics,
    competitorInsights: any,
    options: ContentGapOptions
  ): Promise<ContentGap[]> {
    const prompt = `
Analyze the following content performance data and identify content gaps and opportunities:

CURRENT CONTENT ANALYTICS:
- Total posts: ${contentAnalytics.totalPosts}
- Platform distribution: ${JSON.stringify(contentAnalytics.platformDistribution)}
- Content type distribution: ${JSON.stringify(contentAnalytics.contentTypeDistribution)}
- Average engagement rate: ${contentAnalytics.engagementMetrics.avgEngagementRate.toFixed(2)}%
- Top performing content types: ${contentAnalytics.engagementMetrics.topPerformingTypes.join(', ')}
- Low performing content types: ${contentAnalytics.engagementMetrics.lowPerformingTypes.join(', ')}
- Topic coverage: ${JSON.stringify(contentAnalytics.topicCoverage)}

${competitorInsights ? `
COMPETITOR INSIGHTS:
- Competitor strategies: ${JSON.stringify(competitorInsights.competitorStrategies)}
- Industry trends: ${competitorInsights.industryTrends.join(', ')}
` : ''}

ANALYSIS PARAMETERS:
- Target platforms: ${options.platforms?.join(', ') || 'all'}
- Content types focus: ${options.contentTypes?.join(', ') || 'all'}
- Timeframe: ${options.timeframe || '90d'}
- Target audience segments: ${options.audienceSegments?.join(', ') || 'general'}

Please identify content gaps and opportunities in the following areas:
1. Platform coverage gaps
2. Content format diversification opportunities
3. Topic coverage gaps
4. Audience segment gaps
5. Engagement optimization opportunities
6. Competitive positioning gaps

For each gap identified, provide:
- Gap type and priority level
- Clear description of the gap
- 3-5 specific topic suggestions
- Recommended content types
- Target audience (if specific)
- Reasoning for why this gap matters
- Estimated effort to fill the gap
- Potential impact on overall performance
- Competitor examples if relevant

Return your analysis as a JSON object with a "gaps" array.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content strategist specializing in content gap analysis and optimization. Provide actionable insights based on data analysis.'
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
      const validatedResponse = ContentGapAnalysisResponseSchema.parse(parsedResponse)

      return validatedResponse.gaps
    } catch (error) {
      console.error('Error in AI gap analysis:', error)
      
      // Fallback analysis
      return this.getFallbackGaps(contentAnalytics, options)
    }
  }

  private getFallbackGaps(
    contentAnalytics: ContentAnalytics,
    options: ContentGapOptions
  ): ContentGap[] {
    const gaps: ContentGap[] = []

    // Platform coverage gap
    const availablePlatforms = Object.values(Platform)
    const usedPlatforms = Object.keys(contentAnalytics.platformDistribution) as Platform[]
    const missingPlatforms = availablePlatforms.filter(p => !usedPlatforms.includes(p))

    if (missingPlatforms.length > 0) {
      gaps.push({
        gapType: 'Platform Coverage',
        priority: 'medium',
        description: `Missing presence on ${missingPlatforms.length} platform(s): ${missingPlatforms.join(', ')}`,
        suggestedTopics: ['Cross-platform content strategy', 'Platform-specific optimization'],
        contentTypes: ['image', 'video', 'text'],
        reasoning: 'Expanding platform presence can increase reach and engagement',
        estimatedEffort: 'medium',
        potentialImpact: 'high'
      })
    }

    // Content type diversification
    const availableTypes = Object.values(ContentType)
    const usedTypes = Object.keys(contentAnalytics.contentTypeDistribution) as ContentType[]
    const missingTypes = availableTypes.filter(t => !usedTypes.includes(t))

    if (missingTypes.length > 0) {
      gaps.push({
        gapType: 'Content Format Diversification',
        priority: 'high',
        description: `Underutilized content formats: ${missingTypes.join(', ')}`,
        suggestedTopics: ['Interactive content', 'Educational content', 'Behind-the-scenes'],
        contentTypes: missingTypes.map(t => t.toLowerCase()),
        reasoning: 'Diversifying content formats can improve engagement and reach different audience preferences',
        estimatedEffort: 'low',
        potentialImpact: 'medium'
      })
    }

    return gaps
  }

  private async storeGapsInDatabase(
    workspaceId: string,
    gaps: ContentGap[],
    options: ContentGapOptions
  ): Promise<void> {
    try {
      for (const gap of gaps) {
        await prisma.contentGapAnalysis.create({
          data: {
            workspaceId,
            gapType: gap.gapType,
            priority: gap.priority.toUpperCase() as any,
            description: gap.description,
            suggestedTopics: gap.suggestedTopics,
            suggestedContentTypes: gap.contentTypes,
            targetAudience: gap.targetAudience,
            reasoning: gap.reasoning,
            estimatedEffort: gap.estimatedEffort.toUpperCase() as any,
            potentialImpact: gap.potentialImpact.toUpperCase() as any,
            status: GapAnalysisStatus.IDENTIFIED,
            metadata: {
              competitorExamples: gap.competitorExamples,
              analysisOptions: options
            }
          }
        })
      }
    } catch (error) {
      console.error('Error storing gaps in database:', error)
    }
  }

  async getStoredGaps(
    workspaceId: string,
    options: {
      status?: GapAnalysisStatus
      priority?: string
      limit?: number
    } = {}
  ) {
    return prisma.contentGapAnalysis.findMany({
      where: {
        workspaceId,
        status: options.status,
        priority: options.priority as any
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: options.limit || 20
    })
  }

  async updateGapStatus(gapId: string, status: GapAnalysisStatus, userId: string) {
    return prisma.contentGapAnalysis.update({
      where: { id: gapId },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }

  async generateActionPlan(workspaceId: string, gapId: string) {
    const gap = await prisma.contentGapAnalysis.findUnique({
      where: { id: gapId }
    })

    if (!gap) {
      throw new Error('Content gap not found')
    }

    const prompt = `
Create a detailed action plan to address this content gap:

GAP ANALYSIS:
- Type: ${gap.gapType}
- Priority: ${gap.priority}
- Description: ${gap.description}
- Suggested Topics: ${gap.suggestedTopics.join(', ')}
- Target Content Types: ${gap.suggestedContentTypes.join(', ')}
- Estimated Effort: ${gap.estimatedEffort}
- Potential Impact: ${gap.potentialImpact}

Create a step-by-step action plan that includes:
1. Immediate actions (next 1-2 weeks)
2. Short-term goals (next month)
3. Long-term objectives (next quarter)
4. Resource requirements
5. Success metrics to track
6. Timeline and milestones
7. Potential challenges and solutions

Make the plan practical and actionable for a social media team.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a social media strategist creating actionable plans to address content gaps.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5
      })

      return completion.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('Error generating action plan:', error)
      throw new Error('Failed to generate action plan')
    }
  }

  private analyzeTopicCoverage(posts: any[]) {
    // Simplified topic analysis - in practice would use NLP
    const topics = new Set<string>()
    const topicFrequency: Record<string, number> = {}

    posts.forEach(post => {
      if (post.content) {
        // Extract hashtags as topics
        const hashtags = post.content.match(/#[\w]+/g) || []
        hashtags.forEach(tag => {
          const topic = tag.substring(1).toLowerCase()
          topics.add(topic)
          topicFrequency[topic] = (topicFrequency[topic] || 0) + 1
        })
      }
    })

    return {
      coveredTopics: Array.from(topics),
      topicFrequency
    }
  }

  private getTopPerformingContentTypes(posts: any[]): ContentType[] {
    // Simplified - would calculate based on actual engagement metrics
    const typePerformance = new Map<ContentType, number>()
    
    posts.forEach(post => {
      if (post.contentType && post.analyticsMetrics.length > 0) {
        const avgEngagement = post.analyticsMetrics
          .filter((m: any) => m.metricType === 'engagement_rate')
          .reduce((sum: number, metric: any) => sum + parseFloat(metric.value), 0) / 
          post.analyticsMetrics.filter((m: any) => m.metricType === 'engagement_rate').length || 0
        
        const current = typePerformance.get(post.contentType) || 0
        typePerformance.set(post.contentType, Math.max(current, avgEngagement))
      }
    })

    return Array.from(typePerformance.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type)
  }

  private getLowPerformingContentTypes(posts: any[]): ContentType[] {
    // Simplified - would calculate based on actual engagement metrics
    const typePerformance = new Map<ContentType, number>()
    
    posts.forEach(post => {
      if (post.contentType && post.analyticsMetrics.length > 0) {
        const avgEngagement = post.analyticsMetrics
          .filter((m: any) => m.metricType === 'engagement_rate')
          .reduce((sum: number, metric: any) => sum + parseFloat(metric.value), 0) / 
          post.analyticsMetrics.filter((m: any) => m.metricType === 'engagement_rate').length || 0
        
        const current = typePerformance.get(post.contentType) || 0
        typePerformance.set(post.contentType, Math.min(current, avgEngagement))
      }
    })

    return Array.from(typePerformance.entries())
      .sort(([,a], [,b]) => a - b)
      .slice(0, 2)
      .map(([type]) => type)
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case '30d': return 30
      case '90d': return 90
      case '180d': return 180
      case '1y': return 365
      default: return 90
    }
  }

  private generateCacheKey(workspaceId: string, options: ContentGapOptions): string {
    return `content-gaps:${workspaceId}:${JSON.stringify(options)}`
  }
}