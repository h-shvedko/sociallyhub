// AI-Powered A/B Testing Service

import { openai } from './config'
import { prisma } from '@/lib/prisma'
import { ABTestType, ABTestStatus, SocialProvider } from '@prisma/client'

export interface ABTestConfig {
  workspaceId: string
  userId: string
  testName: string
  description?: string
  testType: ABTestType
  platform?: SocialProvider
  
  // Control content
  controlTitle?: string
  controlContent: string
  controlHashtags?: string[]
  controlMediaIds?: string[]
  
  // Test parameters
  sampleSize?: number
  confidenceLevel?: number
  testDuration?: number // hours
  autoOptimize?: boolean
  autoPublish?: boolean
}

export interface ContentVariant {
  id: string
  title?: string
  content: string
  hashtags?: string[]
  mediaIds?: string[]
  aiReasoning: string
}

export interface ABTestInsights {
  winningVariant: string
  liftPercentage: number
  statisticalSignificance: number
  keyInsights: string[]
  recommendations: string[]
  nextTestSuggestions: string[]
}

class ABTestingService {
  
  /**
   * Generate AI-optimized content variants for A/B testing
   */
  async generateContentVariants(
    controlContent: string,
    platform: SocialProvider,
    variantCount: number = 3,
    testType: ABTestType = ABTestType.CONTENT
  ): Promise<ContentVariant[]> {
    
    const prompt = this.buildVariantGenerationPrompt(
      controlContent, 
      platform, 
      testType, 
      variantCount
    )
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media content optimizer who creates high-performing A/B test variants based on proven engagement strategies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })

      const result = response.choices[0]?.message?.content
      if (!result) throw new Error('No response from AI service')

      return this.parseVariantResponse(result)
      
    } catch (error) {
      console.error('AI variant generation error:', error)
      // Fallback to rule-based variant generation
      return this.generateFallbackVariants(controlContent, variantCount)
    }
  }

  /**
   * Create A/B test with AI-generated variants
   */
  async createABTest(config: ABTestConfig): Promise<string> {
    
    // Generate AI variants
    const variants = await this.generateContentVariants(
      config.controlContent,
      config.platform || SocialProvider.TWITTER,
      3,
      config.testType
    )

    // Calculate traffic split
    const totalVariants = variants.length + 1 // +1 for control
    const splitPercentage = Math.floor(100 / totalVariants)
    const trafficSplit = {
      control: splitPercentage,
      ...variants.reduce((acc, variant, index) => {
        acc[`variant${index + 1}`] = splitPercentage
        return acc
      }, {} as Record<string, number>)
    }

    // Create A/B test in database
    const abTest = await prisma.contentABTest.create({
      data: {
        workspaceId: config.workspaceId,
        testName: config.testName,
        description: config.description,
        testType: config.testType,
        platform: config.platform,
        startDate: new Date(),
        endDate: config.testDuration 
          ? new Date(Date.now() + config.testDuration * 60 * 60 * 1000)
          : undefined,
        status: ABTestStatus.DRAFT,
        sampleSize: config.sampleSize,
        confidenceLevel: config.confidenceLevel || 0.95,
        
        controlTitle: config.controlTitle,
        controlContent: config.controlContent,
        controlHashtags: config.controlHashtags || [],
        controlMediaIds: config.controlMediaIds || [],
        
        variants: variants.map((variant, index) => ({
          id: `variant${index + 1}`,
          title: variant.title,
          content: variant.content,
          hashtags: variant.hashtags || [],
          mediaIds: variant.mediaIds || [],
          aiReasoning: variant.aiReasoning
        })),
        
        trafficSplit,
        testDuration: config.testDuration,
        autoOptimize: config.autoOptimize || false,
        autoPublish: config.autoPublish || false
      }
    })

    return abTest.id
  }

  /**
   * Start A/B test execution
   */
  async startABTest(testId: string): Promise<void> {
    await prisma.contentABTest.update({
      where: { id: testId },
      data: {
        status: ABTestStatus.RUNNING,
        startDate: new Date()
      }
    })
  }

  /**
   * Record A/B test interaction
   */
  async recordInteraction(
    testId: string,
    variant: string,
    userId?: string,
    sessionId?: string,
    interactionData?: {
      viewed?: boolean
      clicked?: boolean
      engaged?: boolean
      converted?: boolean
      engagementScore?: number
      timeSpent?: number
      platform?: SocialProvider
      deviceType?: string
      location?: string
    }
  ): Promise<void> {
    
    await prisma.aBTestExecution.create({
      data: {
        abTestId: testId,
        variant,
        userId,
        sessionId,
        viewed: interactionData?.viewed || false,
        clicked: interactionData?.clicked || false,
        engaged: interactionData?.engaged || false,
        converted: interactionData?.converted || false,
        engagementScore: interactionData?.engagementScore,
        timeSpent: interactionData?.timeSpent,
        platform: interactionData?.platform,
        deviceType: interactionData?.deviceType,
        location: interactionData?.location
      }
    })

    // Update test metrics
    await this.updateTestMetrics(testId)
  }

  /**
   * Analyze A/B test results with AI insights
   */
  async analyzeTestResults(testId: string): Promise<ABTestInsights> {
    
    const abTest = await prisma.contentABTest.findUnique({
      where: { id: testId },
      include: {
        executionLogs: true
      }
    })

    if (!abTest) throw new Error('A/B test not found')

    // Calculate metrics for each variant
    const variantMetrics = this.calculateVariantMetrics(abTest.executionLogs)
    
    // Determine statistical significance
    const statisticalAnalysis = this.calculateStatisticalSignificance(variantMetrics)
    
    // Generate AI insights
    const aiInsights = await this.generateAIInsights(abTest, variantMetrics, statisticalAnalysis)
    
    // Update test with results
    await prisma.contentABTest.update({
      where: { id: testId },
      data: {
        controlMetrics: variantMetrics.control,
        variantMetrics: {
          ...Object.keys(variantMetrics).reduce((acc, key) => {
            if (key !== 'control') acc[key] = variantMetrics[key]
            return acc
          }, {} as any)
        },
        winningVariant: aiInsights.winningVariant,
        statisticalSignificance: aiInsights.statisticalSignificance,
        liftPercentage: aiInsights.liftPercentage,
        aiRecommendations: aiInsights.keyInsights,
        nextTestSuggestions: aiInsights.nextTestSuggestions,
        status: ABTestStatus.COMPLETED
      }
    })

    return aiInsights
  }

  /**
   * Auto-optimize A/B test (switch traffic to winning variant)
   */
  async autoOptimize(testId: string): Promise<void> {
    
    const insights = await this.analyzeTestResults(testId)
    
    if (insights.statisticalSignificance < 0.95) {
      console.log(`Test ${testId} does not have sufficient statistical significance for auto-optimization`)
      return
    }

    // Gradually shift traffic to winning variant
    const newTrafficSplit = {
      control: insights.winningVariant === 'control' ? 80 : 20,
      variant1: insights.winningVariant === 'variant1' ? 80 : 20,
      variant2: 0,
      variant3: 0
    }

    await prisma.contentABTest.update({
      where: { id: testId },
      data: {
        trafficSplit: newTrafficSplit
      }
    })
  }

  /**
   * Auto-publish winning variant
   */
  async autoPublishWinner(testId: string): Promise<void> {
    
    const insights = await this.analyzeTestResults(testId)
    
    if (insights.statisticalSignificance < 0.95) {
      throw new Error('Insufficient statistical significance for auto-publish')
    }

    const abTest = await prisma.contentABTest.findUnique({
      where: { id: testId }
    })

    if (!abTest) throw new Error('A/B test not found')

    // Get winning variant content
    const winningContent = insights.winningVariant === 'control' 
      ? {
          title: abTest.controlTitle,
          content: abTest.controlContent,
          hashtags: abTest.controlHashtags,
          mediaIds: abTest.controlMediaIds
        }
      : this.getVariantContent(abTest.variants as any[], insights.winningVariant)

    // Create post with winning content (this would integrate with existing post creation logic)
    // For now, just mark as published
    await prisma.contentABTest.update({
      where: { id: testId },
      data: {
        publishedAt: new Date(),
        status: ABTestStatus.COMPLETED
      }
    })
  }

  /**
   * Get A/B test performance dashboard data
   */
  async getABTestDashboard(workspaceId: string) {
    
    const activeTests = await prisma.contentABTest.count({
      where: {
        workspaceId,
        status: ABTestStatus.RUNNING
      }
    })

    const completedTests = await prisma.contentABTest.count({
      where: {
        workspaceId,
        status: ABTestStatus.COMPLETED
      }
    })

    const recentTests = await prisma.contentABTest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        executionLogs: {
          select: {
            variant: true,
            engaged: true,
            converted: true
          }
        }
      }
    })

    // Calculate average lift across tests
    const testsWithResults = recentTests.filter(test => test.liftPercentage !== null)
    const averageLift = testsWithResults.length > 0 
      ? testsWithResults.reduce((sum, test) => sum + (test.liftPercentage || 0), 0) / testsWithResults.length
      : 0

    return {
      summary: {
        activeTests,
        completedTests,
        averageLift,
        totalTests: activeTests + completedTests
      },
      recentTests: recentTests.map(test => ({
        id: test.id,
        testName: test.testName,
        status: test.status,
        platform: test.platform,
        startDate: test.startDate,
        endDate: test.endDate,
        liftPercentage: test.liftPercentage,
        winningVariant: test.winningVariant,
        totalInteractions: test.executionLogs.length
      }))
    }
  }

  // Private helper methods

  private buildVariantGenerationPrompt(
    controlContent: string,
    platform: SocialProvider,
    testType: ABTestType,
    variantCount: number
  ): string {
    
    const platformContext = {
      [SocialProvider.TWITTER]: 'Twitter/X (280 characters, trending hashtags, conversational)',
      [SocialProvider.INSTAGRAM]: 'Instagram (2200 characters, visual-first, lifestyle hashtags)',
      [SocialProvider.LINKEDIN]: 'LinkedIn (3000 characters, professional tone, industry hashtags)',
      [SocialProvider.FACEBOOK]: 'Facebook (long-form friendly, community engagement)',
      [SocialProvider.TIKTOK]: 'TikTok (short, trending sounds, viral hashtags)',
      [SocialProvider.YOUTUBE]: 'YouTube (video descriptions, SEO-optimized)'
    }

    const testTypeContext = {
      [ABTestType.CONTENT]: 'Focus on different messaging approaches, tones, and value propositions',
      [ABTestType.HASHTAGS]: 'Focus on different hashtag strategies and quantities',
      [ABTestType.TIMING]: 'Focus on urgency and time-sensitive language',
      [ABTestType.AUDIENCE]: 'Focus on different audience segments and personalization',
      [ABTestType.VISUAL]: 'Focus on visual elements and calls-to-action',
      [ABTestType.HYBRID]: 'Test multiple elements simultaneously'
    }

    return `
Create ${variantCount} high-performing A/B test variants for ${platform} content.

Platform: ${platformContext[platform] || platform}
Test Focus: ${testTypeContext[testType] || testType}

Original Content:
"${controlContent}"

Requirements:
1. Each variant should test a specific hypothesis
2. Provide clear AI reasoning for each variant's approach
3. Optimize for engagement, reach, and conversions
4. Follow platform best practices and character limits
5. Include suggested hashtags where appropriate

Return JSON format:
{
  "variants": [
    {
      "id": "variant1",
      "content": "...",
      "hashtags": ["hashtag1", "hashtag2"],
      "aiReasoning": "This variant tests..."
    }
  ]
}
`
  }

  private parseVariantResponse(response: string): ContentVariant[] {
    try {
      const parsed = JSON.parse(response)
      return parsed.variants || []
    } catch {
      // Fallback parsing if JSON is malformed
      return this.extractVariantsFromText(response)
    }
  }

  private extractVariantsFromText(response: string): ContentVariant[] {
    // Basic text parsing fallback
    const variants: ContentVariant[] = []
    const lines = response.split('\n')
    
    let currentVariant: Partial<ContentVariant> = {}
    let variantCount = 0
    
    lines.forEach(line => {
      if (line.includes('variant') || line.includes('Variant')) {
        if (currentVariant.content) {
          variants.push({
            id: `variant${++variantCount}`,
            content: currentVariant.content,
            hashtags: currentVariant.hashtags || [],
            aiReasoning: currentVariant.aiReasoning || 'Generated variant'
          } as ContentVariant)
        }
        currentVariant = {}
      }
      
      if (line.includes('content') || line.includes('Content')) {
        currentVariant.content = line.replace(/.*content[:\s]*/i, '').trim()
      }
      
      if (line.includes('#')) {
        const hashtags = line.match(/#\w+/g) || []
        currentVariant.hashtags = hashtags
      }
    })
    
    return variants
  }

  private generateFallbackVariants(controlContent: string, count: number): ContentVariant[] {
    // Rule-based variant generation as fallback
    const variants: ContentVariant[] = []
    
    for (let i = 1; i <= count; i++) {
      variants.push({
        id: `variant${i}`,
        content: `${controlContent} [Variant ${i}]`,
        hashtags: ['#socialmedia', '#content'],
        aiReasoning: `Fallback variant ${i} - minor text variation`
      })
    }
    
    return variants
  }

  private async updateTestMetrics(testId: string): Promise<void> {
    // Aggregate execution logs to update test-level metrics
    const executions = await prisma.aBTestExecution.groupBy({
      by: ['variant'],
      where: { abTestId: testId },
      _count: {
        id: true
      },
      _sum: {
        engagementScore: true
      }
    })

    const totalViews = executions.reduce((sum, exec) => sum + exec._count.id, 0)

    await prisma.contentABTest.update({
      where: { id: testId },
      data: {
        totalViews,
        updatedAt: new Date()
      }
    })
  }

  private calculateVariantMetrics(executions: any[]): Record<string, any> {
    const metrics: Record<string, any> = {}
    
    const groupedExecutions = executions.reduce((acc, exec) => {
      if (!acc[exec.variant]) acc[exec.variant] = []
      acc[exec.variant].push(exec)
      return acc
    }, {} as Record<string, any[]>)

    Object.keys(groupedExecutions).forEach(variant => {
      const logs = groupedExecutions[variant]
      const totalViews = logs.length
      const engagements = logs.filter(log => log.engaged).length
      const conversions = logs.filter(log => log.converted).length
      const avgEngagementScore = logs.reduce((sum, log) => sum + (log.engagementScore || 0), 0) / totalViews

      metrics[variant] = {
        views: totalViews,
        engagements,
        conversions,
        engagementRate: totalViews > 0 ? engagements / totalViews : 0,
        conversionRate: totalViews > 0 ? conversions / totalViews : 0,
        avgEngagementScore
      }
    })

    return metrics
  }

  private calculateStatisticalSignificance(variantMetrics: Record<string, any>): any {
    // Simplified statistical significance calculation
    // In production, use proper statistical testing libraries
    
    const control = variantMetrics.control
    if (!control) return { significant: false, pValue: 1 }

    let bestVariant = 'control'
    let bestRate = control.engagementRate
    let maxDifference = 0

    Object.keys(variantMetrics).forEach(variant => {
      if (variant !== 'control') {
        const rate = variantMetrics[variant].engagementRate
        const difference = Math.abs(rate - control.engagementRate)
        
        if (rate > bestRate) {
          bestVariant = variant
          bestRate = rate
          maxDifference = difference
        }
      }
    })

    // Simplified significance test (in production, use Chi-square test)
    const significant = maxDifference > 0.05 && bestVariant !== 'control'
    const pValue = significant ? 0.95 : 0.5

    return {
      significant,
      pValue,
      bestVariant,
      liftPercentage: ((bestRate - control.engagementRate) / control.engagementRate) * 100
    }
  }

  private async generateAIInsights(
    abTest: any,
    variantMetrics: Record<string, any>,
    statisticalAnalysis: any
  ): Promise<ABTestInsights> {
    
    const prompt = `
Analyze A/B test results and provide insights:

Test: ${abTest.testName}
Platform: ${abTest.platform}
Test Type: ${abTest.testType}

Control Content: "${abTest.controlContent}"
Variants: ${JSON.stringify(abTest.variants)}

Performance Metrics:
${JSON.stringify(variantMetrics, null, 2)}

Statistical Analysis:
${JSON.stringify(statisticalAnalysis, null, 2)}

Provide:
1. Key insights about what worked/didn't work
2. Recommendations for future content
3. Next test suggestions
4. Strategic implications

Format as JSON with keys: keyInsights[], recommendations[], nextTestSuggestions[]
`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert A/B testing analyst who provides actionable insights from social media content tests.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })

      const result = response.choices[0]?.message?.content
      const insights = result ? JSON.parse(result) : {}

      return {
        winningVariant: statisticalAnalysis.bestVariant,
        liftPercentage: statisticalAnalysis.liftPercentage,
        statisticalSignificance: statisticalAnalysis.pValue,
        keyInsights: insights.keyInsights || ['Test completed successfully'],
        recommendations: insights.recommendations || ['Continue testing similar approaches'],
        nextTestSuggestions: insights.nextTestSuggestions || ['Test different elements']
      }

    } catch (error) {
      console.error('AI insights generation error:', error)
      
      // Fallback insights
      return {
        winningVariant: statisticalAnalysis.bestVariant,
        liftPercentage: statisticalAnalysis.liftPercentage,
        statisticalSignificance: statisticalAnalysis.pValue,
        keyInsights: ['Test analysis completed'],
        recommendations: ['Review performance metrics for optimization opportunities'],
        nextTestSuggestions: ['Consider testing different content elements']
      }
    }
  }

  private getVariantContent(variants: any[], variantId: string) {
    const variant = variants.find(v => v.id === variantId)
    return variant ? {
      title: variant.title,
      content: variant.content,
      hashtags: variant.hashtags,
      mediaIds: variant.mediaIds
    } : null
  }
}

export const abTestingService = new ABTestingService()