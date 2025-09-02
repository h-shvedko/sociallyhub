import { openai } from '@/lib/ai/config'
import { prisma } from '@/lib/prisma'
import { Platform, ContentType, OptimizationStatus } from '@prisma/client'
import { z } from 'zod'

const OptimizationResponseSchema = z.object({
  optimizations: z.array(z.object({
    optimizationType: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    recommendations: z.array(z.string()),
    expectedImpact: z.object({
      engagementIncrease: z.number(),
      reachIncrease: z.number(),
      timesSaved: z.string()
    }),
    implementation: z.object({
      steps: z.array(z.string()),
      timeline: z.string(),
      resources: z.array(z.string())
    }),
    metrics: z.array(z.string())
  }))
})

export interface CalendarOptimizationOptions {
  platforms?: Platform[]
  contentTypes?: ContentType[]
  timeframe?: '30d' | '90d' | '180d'
  optimizationGoals?: ('engagement' | 'reach' | 'efficiency' | 'consistency')[]
  audienceSegments?: string[]
  budgetConstraints?: boolean
  teamSize?: 'solo' | 'small' | 'medium' | 'large'
}

export interface OptimizationRecommendation {
  optimizationType: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendations: string[]
  expectedImpact: {
    engagementIncrease: number
    reachIncrease: number
    timesSaved: string
  }
  implementation: {
    steps: string[]
    timeline: string
    resources: string[]
  }
  metrics: string[]
}

export interface CalendarAnalytics {
  currentSchedule: {
    postsPerWeek: number
    platformDistribution: Record<Platform, number>
    contentTypeDistribution: Record<ContentType, number>
    timeDistribution: Record<string, number>
  }
  performance: {
    avgEngagementRate: number
    bestPerformingTimes: Array<{ time: string; performance: number }>
    worstPerformingTimes: Array<{ time: string; performance: number }>
    platformPerformance: Record<Platform, number>
  }
  gaps: {
    consistencyIssues: string[]
    underperformingSlots: string[]
    missedOpportunities: string[]
  }
}

export class ContentCalendarOptimizer {
  private readonly cache = new Map<string, { data: OptimizationRecommendation[]; timestamp: number }>()
  private readonly CACHE_DURATION = 60 * 60 * 1000 // 1 hour

  async optimizeContentCalendar(
    workspaceId: string,
    options: CalendarOptimizationOptions = {}
  ): Promise<OptimizationRecommendation[]> {
    const cacheKey = this.generateCacheKey(workspaceId, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Analyze current calendar performance
      const calendarAnalytics = await this.analyzeCurrentCalendar(workspaceId, options)
      
      // Get audience insights
      const audienceInsights = await this.getAudienceInsights(workspaceId, options)
      
      // Perform AI optimization analysis
      const optimizations = await this.performOptimizationAnalysis(
        calendarAnalytics,
        audienceInsights,
        options
      )
      
      // Store optimizations in database
      await this.storeOptimizationsInDatabase(workspaceId, optimizations, options)
      
      // Cache results
      this.cache.set(cacheKey, { data: optimizations, timestamp: Date.now() })
      
      return optimizations
    } catch (error) {
      console.error('Error optimizing content calendar:', error)
      throw new Error('Failed to optimize content calendar')
    }
  }

  private async analyzeCurrentCalendar(
    workspaceId: string,
    options: CalendarOptimizationOptions
  ): Promise<CalendarAnalytics> {
    const timeframeDays = this.getTimeframeDays(options.timeframe || '90d')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - timeframeDays)

    // Get scheduled and published posts
    const posts = await prisma.post.findMany({
      where: {
        workspaceId,
        scheduledAt: { gte: startDate },
        platforms: options.platforms ? { hasSome: options.platforms } : undefined,
        contentType: options.contentTypes ? { in: options.contentTypes } : undefined
      },
      include: {
        analyticsMetrics: {
          where: {
            metricType: { in: ['engagement_rate', 'reach', 'impressions'] }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    })

    // Calculate posting frequency
    const postsPerWeek = posts.length / (timeframeDays / 7)

    // Platform distribution
    const platformDistribution: Record<Platform, number> = {} as Record<Platform, number>
    posts.forEach(post => {
      post.platforms.forEach(platform => {
        platformDistribution[platform] = (platformDistribution[platform] || 0) + 1
      })
    })

    // Content type distribution
    const contentTypeDistribution: Record<ContentType, number> = {} as Record<ContentType, number>
    posts.forEach(post => {
      if (post.contentType) {
        contentTypeDistribution[post.contentType] = (contentTypeDistribution[post.contentType] || 0) + 1
      }
    })

    // Time distribution analysis
    const timeDistribution: Record<string, number> = {}
    posts.forEach(post => {
      if (post.scheduledAt) {
        const hour = post.scheduledAt.getHours()
        const timeSlot = this.getTimeSlot(hour)
        timeDistribution[timeSlot] = (timeDistribution[timeSlot] || 0) + 1
      }
    })

    // Performance analysis
    const performance = this.analyzePostPerformance(posts)

    // Gap analysis
    const gaps = this.identifySchedulingGaps(posts, timeframeDays)

    return {
      currentSchedule: {
        postsPerWeek,
        platformDistribution,
        contentTypeDistribution,
        timeDistribution
      },
      performance,
      gaps
    }
  }

  private async getAudienceInsights(
    workspaceId: string,
    options: CalendarOptimizationOptions
  ) {
    // Get audience segmentation data if available
    const audienceSegments = await prisma.audienceSegment.findMany({
      where: { workspaceId },
      take: 10
    })

    // Get posting time analysis
    const postingTimeAnalysis = await prisma.postingTimeAnalysis.findMany({
      where: { 
        workspaceId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    })

    return {
      segments: audienceSegments.map(segment => ({
        name: segment.name,
        size: segment.size,
        characteristics: segment.characteristics,
        preferredTimes: segment.preferredContentTimes || [],
        platformPreferences: segment.platformPreferences || []
      })),
      optimalTimes: postingTimeAnalysis[0]?.optimalTimes || [],
      timezoneSplit: postingTimeAnalysis[0]?.timezoneDistribution || {},
      engagementPatterns: postingTimeAnalysis[0]?.engagementPatterns || {}
    }
  }

  private async performOptimizationAnalysis(
    calendarAnalytics: CalendarAnalytics,
    audienceInsights: any,
    options: CalendarOptimizationOptions
  ): Promise<OptimizationRecommendation[]> {
    const prompt = `
Analyze this content calendar data and provide AI-powered optimization recommendations:

CURRENT CALENDAR ANALYTICS:
- Posts per week: ${calendarAnalytics.currentSchedule.postsPerWeek.toFixed(1)}
- Platform distribution: ${JSON.stringify(calendarAnalytics.currentSchedule.platformDistribution)}
- Content type distribution: ${JSON.stringify(calendarAnalytics.currentSchedule.contentTypeDistribution)}
- Time distribution: ${JSON.stringify(calendarAnalytics.currentSchedule.timeDistribution)}
- Average engagement rate: ${calendarAnalytics.performance.avgEngagementRate.toFixed(2)}%

PERFORMANCE DATA:
- Best performing times: ${JSON.stringify(calendarAnalytics.performance.bestPerformingTimes)}
- Worst performing times: ${JSON.stringify(calendarAnalytics.performance.worstPerformingTimes)}
- Platform performance: ${JSON.stringify(calendarAnalytics.performance.platformPerformance)}

IDENTIFIED GAPS:
- Consistency issues: ${calendarAnalytics.gaps.consistencyIssues.join(', ')}
- Underperforming slots: ${calendarAnalytics.gaps.underperformingSlots.join(', ')}
- Missed opportunities: ${calendarAnalytics.gaps.missedOpportunities.join(', ')}

AUDIENCE INSIGHTS:
- Audience segments: ${audienceInsights.segments.map((s: any) => `${s.name} (${s.size} users)`).join(', ')}
- Optimal posting times: ${audienceInsights.optimalTimes.join(', ')}
- Timezone distribution: ${JSON.stringify(audienceInsights.timezoneSplit)}

OPTIMIZATION PARAMETERS:
- Target platforms: ${options.platforms?.join(', ') || 'all'}
- Content types: ${options.contentTypes?.join(', ') || 'all'}
- Optimization goals: ${options.optimizationGoals?.join(', ') || 'engagement, reach, efficiency'}
- Team size: ${options.teamSize || 'unknown'}
- Budget constraints: ${options.budgetConstraints ? 'Yes' : 'No'}

Please provide detailed optimization recommendations in these areas:

1. **Posting Schedule Optimization**
   - Optimal posting times and frequency
   - Platform-specific timing strategies
   - Content type scheduling recommendations

2. **Content Mix Optimization**
   - Content type distribution improvements
   - Platform-content alignment strategies
   - Audience segment targeting

3. **Efficiency Improvements**
   - Batch content creation strategies
   - Automation opportunities
   - Workflow optimizations

4. **Performance Enhancement**
   - Engagement rate improvement strategies
   - Reach optimization techniques
   - Cross-platform synergy opportunities

For each recommendation, provide:
- Priority level and detailed description
- Specific implementation steps
- Expected impact (engagement increase %, reach increase %, time saved)
- Required resources and timeline
- Success metrics to track

Return your analysis as a JSON object with an "optimizations" array.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media strategist and content calendar optimization specialist. Provide data-driven, actionable recommendations for maximum efficiency and performance.'
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
      const validatedResponse = OptimizationResponseSchema.parse(parsedResponse)

      return validatedResponse.optimizations
    } catch (error) {
      console.error('Error in AI optimization analysis:', error)
      
      // Fallback optimizations
      return this.getFallbackOptimizations(calendarAnalytics, options)
    }
  }

  private getFallbackOptimizations(
    calendarAnalytics: CalendarAnalytics,
    options: CalendarOptimizationOptions
  ): OptimizationRecommendation[] {
    const optimizations: OptimizationRecommendation[] = []

    // Posting frequency optimization
    if (calendarAnalytics.currentSchedule.postsPerWeek < 3) {
      optimizations.push({
        optimizationType: 'Posting Frequency',
        priority: 'high',
        description: 'Increase posting frequency to improve audience engagement and algorithm visibility',
        recommendations: [
          'Aim for 5-7 posts per week across all platforms',
          'Create content batches to maintain consistency',
          'Use scheduling tools to maintain regular posting'
        ],
        expectedImpact: {
          engagementIncrease: 25,
          reachIncrease: 30,
          timesSaved: '2 hours per week with batching'
        },
        implementation: {
          steps: [
            'Analyze current content creation capacity',
            'Create content batching schedule',
            'Set up automated scheduling',
            'Monitor performance and adjust'
          ],
          timeline: '2-3 weeks',
          resources: ['Content calendar tool', 'Scheduling platform', 'Content creation time']
        },
        metrics: ['Posts per week', 'Engagement rate', 'Reach', 'Consistency score']
      })
    }

    // Time optimization
    if (calendarAnalytics.performance.bestPerformingTimes.length > 0) {
      optimizations.push({
        optimizationType: 'Posting Time Optimization',
        priority: 'medium',
        description: 'Shift more posts to high-performing time slots to maximize engagement',
        recommendations: [
          `Focus on top performing times: ${calendarAnalytics.performance.bestPerformingTimes.slice(0, 3).map(t => t.time).join(', ')}`,
          'Reduce posts during low-performing time slots',
          'Test different times for different content types'
        ],
        expectedImpact: {
          engagementIncrease: 15,
          reachIncrease: 20,
          timesSaved: '1 hour per week with optimized scheduling'
        },
        implementation: {
          steps: [
            'Identify current time slot performance',
            'Reschedule existing posts to optimal times',
            'Create platform-specific time strategies',
            'Monitor and refine timing'
          ],
          timeline: '1-2 weeks',
          resources: ['Analytics data', 'Scheduling tools']
        },
        metrics: ['Engagement rate by time slot', 'Reach by posting time', 'Click-through rates']
      })
    }

    return optimizations
  }

  private async storeOptimizationsInDatabase(
    workspaceId: string,
    optimizations: OptimizationRecommendation[],
    options: CalendarOptimizationOptions
  ): Promise<void> {
    try {
      for (const optimization of optimizations) {
        await prisma.contentCalendarOptimization.create({
          data: {
            workspaceId,
            optimizationType: optimization.optimizationType,
            priority: optimization.priority.toUpperCase() as any,
            description: optimization.description,
            recommendations: optimization.recommendations,
            expectedImpact: optimization.expectedImpact,
            implementationSteps: optimization.implementation.steps,
            timeline: optimization.implementation.timeline,
            requiredResources: optimization.implementation.resources,
            successMetrics: optimization.metrics,
            status: OptimizationStatus.PENDING,
            metadata: {
              optimizationOptions: options
            }
          }
        })
      }
    } catch (error) {
      console.error('Error storing optimizations in database:', error)
    }
  }

  async applyOptimization(workspaceId: string, optimizationId: string, userId: string) {
    const optimization = await prisma.contentCalendarOptimization.findUnique({
      where: { id: optimizationId }
    })

    if (!optimization) {
      throw new Error('Optimization not found')
    }

    // Generate implementation plan
    const implementationPlan = await this.generateImplementationPlan(optimization)

    // Update optimization status
    await prisma.contentCalendarOptimization.update({
      where: { id: optimizationId },
      data: {
        status: OptimizationStatus.IN_PROGRESS,
        implementationPlan,
        appliedAt: new Date()
      }
    })

    return implementationPlan
  }

  private async generateImplementationPlan(optimization: any) {
    const prompt = `
Create a detailed step-by-step implementation plan for this calendar optimization:

OPTIMIZATION:
- Type: ${optimization.optimizationType}
- Description: ${optimization.description}
- Recommendations: ${optimization.recommendations.join(', ')}
- Timeline: ${optimization.timeline}
- Expected Impact: ${JSON.stringify(optimization.expectedImpact)}

Create a detailed implementation plan that includes:
1. Pre-implementation checklist
2. Week-by-week action items
3. Resource allocation
4. Risk mitigation strategies
5. Success measurement plan
6. Rollback procedures if needed

Make it practical and actionable for a social media team.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a project manager specializing in social media optimization implementations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4
      })

      return completion.choices[0]?.message?.content || ''
    } catch (error) {
      console.error('Error generating implementation plan:', error)
      return 'Implementation plan generation failed. Please create manually based on optimization recommendations.'
    }
  }

  async getStoredOptimizations(
    workspaceId: string,
    options: {
      status?: OptimizationStatus
      priority?: string
      limit?: number
    } = {}
  ) {
    return prisma.contentCalendarOptimization.findMany({
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

  private analyzePostPerformance(posts: any[]) {
    const engagementRates = posts
      .map(post => {
        const engagementMetric = post.analyticsMetrics.find((m: any) => m.metricType === 'engagement_rate')
        return {
          time: post.scheduledAt ? this.getTimeSlot(post.scheduledAt.getHours()) : 'unknown',
          rate: engagementMetric ? parseFloat(engagementMetric.value) : 0,
          platform: post.platforms[0] || 'unknown'
        }
      })
      .filter(p => p.rate > 0)

    const avgEngagementRate = engagementRates.length > 0
      ? engagementRates.reduce((sum, p) => sum + p.rate, 0) / engagementRates.length
      : 0

    // Group by time and calculate averages
    const timePerformance = new Map<string, number[]>()
    engagementRates.forEach(p => {
      if (!timePerformance.has(p.time)) {
        timePerformance.set(p.time, [])
      }
      timePerformance.get(p.time)!.push(p.rate)
    })

    const timeAverages = Array.from(timePerformance.entries()).map(([time, rates]) => ({
      time,
      performance: rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    }))

    const bestPerformingTimes = timeAverages
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5)

    const worstPerformingTimes = timeAverages
      .sort((a, b) => a.performance - b.performance)
      .slice(0, 3)

    // Platform performance
    const platformPerformance: Record<Platform, number> = {} as Record<Platform, number>
    const platformGroups = new Map<string, number[]>()
    
    engagementRates.forEach(p => {
      if (p.platform !== 'unknown') {
        if (!platformGroups.has(p.platform)) {
          platformGroups.set(p.platform, [])
        }
        platformGroups.get(p.platform)!.push(p.rate)
      }
    })

    platformGroups.forEach((rates, platform) => {
      platformPerformance[platform as Platform] = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    })

    return {
      avgEngagementRate,
      bestPerformingTimes,
      worstPerformingTimes,
      platformPerformance
    }
  }

  private identifySchedulingGaps(posts: any[], timeframeDays: number) {
    const consistencyIssues: string[] = []
    const underperformingSlots: string[] = []
    const missedOpportunities: string[] = []

    // Check consistency (simplified)
    const postsPerWeek = posts.length / (timeframeDays / 7)
    if (postsPerWeek < 3) {
      consistencyIssues.push('Low posting frequency detected')
    }

    // Check for gaps in posting schedule
    const postDates = posts.map(p => p.scheduledAt?.toDateString()).filter(Boolean)
    const uniqueDates = new Set(postDates)
    const gapPercentage = (timeframeDays - uniqueDates.size) / timeframeDays
    
    if (gapPercentage > 0.4) {
      consistencyIssues.push('Significant gaps in posting schedule')
    }

    // Identify underperforming time slots
    const timeSlots = ['morning', 'afternoon', 'evening', 'late-night']
    const usedSlots = new Set(posts.map(p => 
      p.scheduledAt ? this.getTimeSlot(p.scheduledAt.getHours()) : null
    ).filter(Boolean))

    timeSlots.forEach(slot => {
      if (!usedSlots.has(slot)) {
        missedOpportunities.push(`No posts scheduled during ${slot}`)
      }
    })

    return {
      consistencyIssues,
      underperformingSlots,
      missedOpportunities
    }
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 22) return 'evening'
    return 'late-night'
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case '30d': return 30
      case '90d': return 90
      case '180d': return 180
      default: return 90
    }
  }

  private generateCacheKey(workspaceId: string, options: CalendarOptimizationOptions): string {
    return `calendar-optimization:${workspaceId}:${JSON.stringify(options)}`
  }
}