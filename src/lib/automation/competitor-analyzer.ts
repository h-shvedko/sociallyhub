import { openai } from '@/lib/ai/config'
import { prisma } from '@/lib/prisma'
import { Platform, CompetitorAnalysisStatus, ContentType } from '@prisma/client'
import { z } from 'zod'

const CompetitorAnalysisResponseSchema = z.object({
  analysis: z.object({
    competitor: z.string(),
    overallStrategy: z.string(),
    contentStrategy: z.object({
      primaryContentTypes: z.array(z.string()),
      postingFrequency: z.string(),
      engagementPatterns: z.string(),
      topPerformingContent: z.array(z.string())
    }),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    differentiationStrategies: z.array(z.object({
      strategy: z.string(),
      description: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      implementation: z.string(),
      expectedImpact: z.string()
    })),
    industryTrends: z.array(z.string()),
    recommendations: z.array(z.string())
  })
})

export interface CompetitorData {
  name: string
  website?: string
  platforms: Platform[]
  followerCount?: Record<Platform, number>
  contentSample?: {
    platform: Platform
    contentType: ContentType
    content: string
    engagement?: number
    timestamp: Date
  }[]
  brandInfo?: {
    industry: string
    targetAudience: string
    brandVoice: string
    keyMessages: string[]
  }
}

export interface CompetitorAnalysisOptions {
  platforms?: Platform[]
  analysisDepth?: 'basic' | 'comprehensive' | 'strategic'
  includeContentAnalysis?: boolean
  includeTrendAnalysis?: boolean
  competitorCount?: number
  timeframe?: '30d' | '90d' | '180d'
}

export interface CompetitorAnalysisResult {
  competitor: string
  overallStrategy: string
  contentStrategy: {
    primaryContentTypes: string[]
    postingFrequency: string
    engagementPatterns: string
    topPerformingContent: string[]
  }
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  differentiationStrategies: {
    strategy: string
    description: string
    priority: 'low' | 'medium' | 'high'
    implementation: string
    expectedImpact: string
  }[]
  industryTrends: string[]
  recommendations: string[]
}

export class CompetitorAnalyzer {
  private readonly cache = new Map<string, { data: CompetitorAnalysisResult; timestamp: number }>()
  private readonly CACHE_DURATION = 2 * 60 * 60 * 1000 // 2 hours

  async analyzeCompetitor(
    workspaceId: string,
    competitorData: CompetitorData,
    options: CompetitorAnalysisOptions = {}
  ): Promise<CompetitorAnalysisResult> {
    const cacheKey = this.generateCacheKey(workspaceId, competitorData.name, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Get our brand context for comparison
      const ourBrandContext = await this.getBrandContext(workspaceId)
      
      // Perform AI analysis
      const analysis = await this.performCompetitorAnalysis(
        competitorData, 
        ourBrandContext,
        options
      )
      
      // Store analysis in database
      await this.storeAnalysisInDatabase(workspaceId, analysis, competitorData, options)
      
      // Cache results
      this.cache.set(cacheKey, { data: analysis, timestamp: Date.now() })
      
      return analysis
    } catch (error) {
      console.error('Error analyzing competitor:', error)
      throw new Error('Failed to analyze competitor')
    }
  }

  async analyzeMultipleCompetitors(
    workspaceId: string,
    competitors: CompetitorData[],
    options: CompetitorAnalysisOptions = {}
  ): Promise<{
    individualAnalyses: CompetitorAnalysisResult[]
    comparativeAnalysis: {
      marketPosition: string
      competitiveAdvantages: string[]
      marketGaps: string[]
      strategicRecommendations: string[]
    }
  }> {
    const individualAnalyses = await Promise.all(
      competitors.map(competitor => 
        this.analyzeCompetitor(workspaceId, competitor, options)
      )
    )

    const comparativeAnalysis = await this.performComparativeAnalysis(
      workspaceId,
      individualAnalyses,
      options
    )

    return {
      individualAnalyses,
      comparativeAnalysis
    }
  }

  private async getBrandContext(workspaceId: string) {
    // Get workspace and recent posts to understand our brand
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    })

    const recentPosts = await prisma.post.findMany({
      where: { 
        workspaceId,
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      },
      include: {
        analyticsMetrics: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return {
      workspaceName: workspace?.name || 'Our Brand',
      contentTypes: [...new Set(recentPosts.map(p => p.contentType).filter(Boolean))],
      platforms: [...new Set(recentPosts.flatMap(p => p.platforms))],
      averagePostsPerWeek: recentPosts.length / 12, // Approximate weekly posting frequency
      topPerformingContent: recentPosts
        .sort((a, b) => {
          const aEngagement = a.analyticsMetrics.find(m => m.metricType === 'engagement_rate')
          const bEngagement = b.analyticsMetrics.find(m => m.metricType === 'engagement_rate')
          return parseFloat(bEngagement?.value || '0') - parseFloat(aEngagement?.value || '0')
        })
        .slice(0, 5)
        .map(p => p.content?.substring(0, 100) + '...')
        .filter(Boolean)
    }
  }

  private async performCompetitorAnalysis(
    competitorData: CompetitorData,
    ourBrandContext: any,
    options: CompetitorAnalysisOptions
  ): Promise<CompetitorAnalysisResult> {
    const prompt = `
Analyze this competitor and provide strategic insights for differentiation:

COMPETITOR DATA:
- Name: ${competitorData.name}
- Website: ${competitorData.website || 'Not provided'}
- Platforms: ${competitorData.platforms.join(', ')}
- Industry: ${competitorData.brandInfo?.industry || 'Unknown'}
- Target Audience: ${competitorData.brandInfo?.targetAudience || 'Unknown'}
- Brand Voice: ${competitorData.brandInfo?.brandVoice || 'Unknown'}

${competitorData.contentSample ? `
CONTENT SAMPLES:
${competitorData.contentSample.map(sample => 
  `- ${sample.platform}: ${sample.contentType} - "${sample.content.substring(0, 200)}..." (Engagement: ${sample.engagement || 'Unknown'})`
).join('\n')}
` : ''}

OUR BRAND CONTEXT:
- Current platforms: ${ourBrandContext.platforms.join(', ')}
- Content types we use: ${ourBrandContext.contentTypes.join(', ')}
- Posting frequency: ~${ourBrandContext.averagePostsPerWeek} posts/week
- Our top performing content themes: ${ourBrandContext.topPerformingContent.join(', ')}

ANALYSIS REQUIREMENTS:
- Analysis depth: ${options.analysisDepth || 'comprehensive'}
- Focus platforms: ${options.platforms?.join(', ') || 'all'}
- Include content analysis: ${options.includeContentAnalysis ? 'Yes' : 'No'}
- Include trend analysis: ${options.includeTrendAnalysis ? 'Yes' : 'No'}

Please provide a comprehensive analysis including:

1. Overall competitive strategy assessment
2. Content strategy breakdown (content types, posting frequency, engagement patterns)
3. Key strengths and weaknesses
4. Market opportunities they're missing
5. Specific differentiation strategies we can implement
6. Industry trends they're leveraging or missing
7. Actionable recommendations for competitive advantage

For each differentiation strategy, include:
- Strategy name and description
- Priority level (low/medium/high)
- Implementation steps
- Expected impact

Return your analysis as a JSON object following the required schema.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert competitive intelligence analyst specializing in social media strategy and brand differentiation. Provide actionable insights based on competitor analysis.'
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
      const validatedResponse = CompetitorAnalysisResponseSchema.parse(parsedResponse)

      return validatedResponse.analysis
    } catch (error) {
      console.error('Error in AI competitor analysis:', error)
      
      // Fallback analysis
      return this.getFallbackAnalysis(competitorData, ourBrandContext)
    }
  }

  private async performComparativeAnalysis(
    workspaceId: string,
    individualAnalyses: CompetitorAnalysisResult[],
    options: CompetitorAnalysisOptions
  ) {
    const prompt = `
Analyze these competitor insights and provide a comparative market analysis:

COMPETITOR ANALYSES:
${individualAnalyses.map((analysis, index) => `
Competitor ${index + 1}: ${analysis.competitor}
- Strategy: ${analysis.overallStrategy}
- Strengths: ${analysis.strengths.join(', ')}
- Weaknesses: ${analysis.weaknesses.join(', ')}
- Content Types: ${analysis.contentStrategy.primaryContentTypes.join(', ')}
- Top Differentiation Strategies: ${analysis.differentiationStrategies.slice(0, 3).map(s => s.strategy).join(', ')}
`).join('\n')}

Based on this competitive landscape, provide:

1. Our current market position relative to competitors
2. Key competitive advantages we can leverage
3. Market gaps and opportunities
4. Strategic recommendations for market differentiation
5. Priority actions for competitive advantage

Focus on actionable insights that can be implemented in social media strategy.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a strategic marketing analyst providing comparative market insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4
      })

      const response = completion.choices[0]?.message?.content || ''
      
      // Parse the response into structured format
      const lines = response.split('\n').filter(line => line.trim())
      
      return {
        marketPosition: lines.find(line => line.includes('position'))?.replace(/^\d+\.\s*/, '') || 
          'Market position analysis not available',
        competitiveAdvantages: lines
          .filter(line => line.includes('advantage') || line.includes('strength'))
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''))
          .slice(0, 5),
        marketGaps: lines
          .filter(line => line.includes('gap') || line.includes('opportunity'))
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''))
          .slice(0, 5),
        strategicRecommendations: lines
          .filter(line => line.includes('recommend') || line.includes('should'))
          .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''))
          .slice(0, 5)
      }
    } catch (error) {
      console.error('Error in comparative analysis:', error)
      return {
        marketPosition: 'Comparative analysis not available',
        competitiveAdvantages: [],
        marketGaps: [],
        strategicRecommendations: []
      }
    }
  }

  private getFallbackAnalysis(
    competitorData: CompetitorData,
    ourBrandContext: any
  ): CompetitorAnalysisResult {
    return {
      competitor: competitorData.name,
      overallStrategy: `${competitorData.name} appears to focus on ${competitorData.platforms.join(' and ')} with a ${competitorData.brandInfo?.brandVoice || 'professional'} brand voice.`,
      contentStrategy: {
        primaryContentTypes: competitorData.contentSample?.map(s => s.contentType) || ['TEXT', 'IMAGE'],
        postingFrequency: 'Regular posting schedule observed',
        engagementPatterns: 'Moderate engagement across platforms',
        topPerformingContent: competitorData.contentSample?.slice(0, 3).map(s => s.content.substring(0, 50) + '...') || []
      },
      strengths: [
        'Multi-platform presence',
        'Consistent brand voice',
        'Regular content publishing'
      ],
      weaknesses: [
        'Limited content format variety',
        'Opportunities for better engagement'
      ],
      opportunities: [
        'Video content expansion',
        'Interactive content development',
        'Community engagement improvements'
      ],
      differentiationStrategies: [
        {
          strategy: 'Content Format Innovation',
          description: 'Experiment with new content formats they are not using',
          priority: 'high',
          implementation: 'Start with video content and interactive posts',
          expectedImpact: 'Increased engagement and audience growth'
        }
      ],
      industryTrends: [
        'Short-form video content growth',
        'Interactive content popularity',
        'Authentic brand storytelling'
      ],
      recommendations: [
        'Focus on unique content formats',
        'Improve posting consistency',
        'Develop stronger community engagement'
      ]
    }
  }

  private async storeAnalysisInDatabase(
    workspaceId: string,
    analysis: CompetitorAnalysisResult,
    competitorData: CompetitorData,
    options: CompetitorAnalysisOptions
  ): Promise<void> {
    try {
      await prisma.competitorAnalysis.create({
        data: {
          workspaceId,
          competitorName: competitorData.name,
          competitorWebsite: competitorData.website,
          platforms: competitorData.platforms,
          strategy: analysis.overallStrategy,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          opportunities: analysis.opportunities,
          differentiationStrategies: analysis.differentiationStrategies.map(s => ({
            strategy: s.strategy,
            description: s.description,
            priority: s.priority,
            implementation: s.implementation,
            expectedImpact: s.expectedImpact
          })),
          industryTrends: analysis.industryTrends,
          recommendations: analysis.recommendations,
          status: CompetitorAnalysisStatus.COMPLETED,
          analysisDepth: options.analysisDepth?.toUpperCase() as any || 'COMPREHENSIVE',
          metadata: {
            contentStrategy: analysis.contentStrategy,
            analysisOptions: options,
            competitorInfo: competitorData.brandInfo
          }
        }
      })
    } catch (error) {
      console.error('Error storing competitor analysis in database:', error)
    }
  }

  async getStoredAnalyses(
    workspaceId: string,
    options: {
      status?: CompetitorAnalysisStatus
      competitorName?: string
      limit?: number
    } = {}
  ) {
    return prisma.competitorAnalysis.findMany({
      where: {
        workspaceId,
        status: options.status,
        competitorName: options.competitorName ? { contains: options.competitorName, mode: 'insensitive' } : undefined
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 20
    })
  }

  async updateAnalysisStatus(analysisId: string, status: CompetitorAnalysisStatus) {
    return prisma.competitorAnalysis.update({
      where: { id: analysisId },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }

  async generateCompetitiveReport(workspaceId: string, timeframe: '30d' | '90d' | '180d' = '90d') {
    const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 180
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const analyses = await prisma.competitorAnalysis.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (analyses.length === 0) {
      throw new Error('No competitor analyses found for the specified timeframe')
    }

    const prompt = `
Generate a comprehensive competitive intelligence report based on these competitor analyses:

${analyses.map((analysis, index) => `
Analysis ${index + 1}:
- Competitor: ${analysis.competitorName}
- Strategy: ${analysis.strategy}
- Key Strengths: ${analysis.strengths.slice(0, 3).join(', ')}
- Key Opportunities: ${analysis.opportunities.slice(0, 3).join(', ')}
- Top Differentiation Strategy: ${analysis.differentiationStrategies[0] || 'None'}
`).join('\n')}

Create a strategic report that includes:
1. Executive Summary
2. Competitive Landscape Overview
3. Key Market Trends
4. Strategic Recommendations
5. Priority Actions for Next Quarter

Format as a professional business report suitable for stakeholders.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence analyst creating comprehensive competitive reports.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2
      })

      return completion.choices[0]?.message?.content || 'Report generation failed'
    } catch (error) {
      console.error('Error generating competitive report:', error)
      throw new Error('Failed to generate competitive report')
    }
  }

  private generateCacheKey(workspaceId: string, competitorName: string, options: CompetitorAnalysisOptions): string {
    return `competitor-analysis:${workspaceId}:${competitorName}:${JSON.stringify(options)}`
  }
}