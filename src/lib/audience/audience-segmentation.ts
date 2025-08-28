import { OpenAI } from 'openai'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Audience cluster analysis schema
const audienceClusterSchema = z.object({
  segments: z.array(z.object({
    name: z.string(),
    description: z.string(),
    characteristics: z.object({
      demographics: z.object({
        ageRange: z.string().optional(),
        location: z.string().optional(),
        interests: z.array(z.string())
      }),
      behavior: z.object({
        engagementPatterns: z.array(z.string()),
        preferredContentTypes: z.array(z.string()),
        activeTimeRanges: z.array(z.string()),
        platformPreferences: z.array(z.string())
      }),
      psychographics: z.object({
        values: z.array(z.string()),
        motivations: z.array(z.string()),
        painPoints: z.array(z.string())
      })
    }),
    estimatedSize: z.number(),
    engagementProfile: z.object({
      avgEngagementRate: z.number(),
      preferredPostTypes: z.array(z.string()),
      responsePatterns: z.array(z.string())
    })
  }))
})

export type AudienceClusterResult = z.infer<typeof audienceClusterSchema>

export interface EngagementData {
  userId?: string
  platform: string
  contentType: string
  engagementType: string // like, comment, share, click
  timestamp: Date
  sentiment?: number
  location?: string
  deviceType?: string
}

export interface ContentPreference {
  userId?: string
  platform: string
  contentFormat: string // image, video, text, carousel
  contentTopic: string
  engagementScore: number
  timeSpent?: number
}

export class AudienceSegmentation {
  /**
   * Analyze and cluster audience based on engagement patterns
   */
  async clusterAudience({
    workspaceId,
    timeframe = '90d',
    minSegmentSize = 50,
    maxSegments = 8
  }: {
    workspaceId: string
    timeframe?: string
    minSegmentSize?: number
    maxSegments?: number
  }) {
    try {
      // Gather comprehensive audience data
      const audienceData = await this.gatherAudienceData(workspaceId, timeframe)
      
      if (audienceData.engagements.length < 100) {
        return {
          success: false,
          message: 'Insufficient data for audience clustering',
          recommendations: ['Gather more engagement data before running analysis']
        }
      }

      // Perform AI-powered clustering analysis
      const clustering = await this.performAIClusterin(audienceData, { maxSegments, minSegmentSize })
      
      // Store segments in database
      const segments = await this.storeAudienceSegments(workspaceId, clustering.segments)

      return {
        success: true,
        segments,
        insights: clustering.insights,
        recommendations: clustering.recommendations
      }
    } catch (error) {
      console.error('Audience clustering failed:', error)
      throw error
    }
  }

  /**
   * Update audience segments based on new engagement data
   */
  async updateAudienceSegments(workspaceId: string) {
    const segments = await prisma.audienceSegment.findMany({
      where: { workspaceId, isActive: true }
    })

    for (const segment of segments) {
      await this.refreshSegmentData(segment.id)
    }
  }

  /**
   * Analyze engagement patterns for user personas
   */
  async analyzeEngagementPatterns({
    workspaceId,
    segmentId,
    timeframe = '30d'
  }: {
    workspaceId: string
    segmentId?: string
    timeframe?: string
  }) {
    const timeframeHours = this.parseTimeframe(timeframe)
    const startDate = new Date(Date.now() - timeframeHours * 60 * 60 * 1000)

    // Get engagement data
    const engagements = await this.getEngagementData(workspaceId, startDate, segmentId)
    
    // Analyze patterns
    const patterns = this.identifyEngagementPatterns(engagements)
    
    // Store pattern analysis
    for (const pattern of patterns) {
      await this.storeEngagementPattern(workspaceId, pattern)
    }

    return patterns
  }

  /**
   * Generate personalized content recommendations for segments
   */
  async generatePersonalizedRecommendations({
    workspaceId,
    segmentId,
    contentGoal = 'engagement'
  }: {
    workspaceId: string
    segmentId: string
    contentGoal?: 'engagement' | 'reach' | 'conversion' | 'awareness'
  }) {
    const segment = await prisma.audienceSegment.findUnique({
      where: { id: segmentId }
    })

    if (!segment) {
      throw new Error('Segment not found')
    }

    // Get historical performance data for this segment
    const historicalData = await this.getSegmentPerformanceData(segmentId)
    
    // Generate AI-powered recommendations
    const recommendations = await this.generateAIRecommendations(segment, historicalData, contentGoal)
    
    // Store recommendations
    const storedRecommendations = []
    for (const rec of recommendations) {
      const stored = await prisma.contentRecommendation.create({
        data: {
          workspaceId,
          segmentId,
          title: rec.title,
          description: rec.description,
          recommendationType: rec.type,
          suggestedTopics: rec.topics,
          suggestedTone: rec.tone,
          suggestedFormats: rec.formats,
          suggestedHashtags: rec.hashtags,
          platforms: rec.platforms,
          predictedEngagement: rec.predictedEngagement,
          predictedReach: rec.predictedReach,
          confidenceScore: rec.confidence
        }
      })
      storedRecommendations.push(stored)
    }

    return storedRecommendations
  }

  /**
   * Predict optimal posting times for audience segments
   */
  async predictOptimalPostingTimes({
    workspaceId,
    segmentId,
    platform
  }: {
    workspaceId: string
    segmentId?: string
    platform?: string
  }) {
    const segment = segmentId ? await prisma.audienceSegment.findUnique({
      where: { id: segmentId }
    }) : null

    // Get historical engagement data
    const engagementHistory = await this.getHistoricalEngagements(workspaceId, segmentId, platform)
    
    // Analyze time-based patterns
    const timePatterns = this.analyzeTimePatterns(engagementHistory)
    
    // Generate posting time recommendations
    const recommendations = await this.generatePostingTimeRecommendations(
      workspaceId,
      segmentId || 'general',
      timePatterns,
      platform
    )

    return recommendations
  }

  private async gatherAudienceData(workspaceId: string, timeframe: string) {
    const timeframeHours = this.parseTimeframe(timeframe)
    const startDate = new Date(Date.now() - timeframeHours * 60 * 60 * 1000)

    // Get engagement metrics
    const engagements = await prisma.analyticsMetric.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
        metricType: { in: ['ENGAGEMENT', 'REACH', 'IMPRESSIONS'] }
      },
      include: {
        post: {
          include: {
            variants: true
          }
        }
      }
    })

    // Get sentiment data
    const sentiments = await prisma.sentimentAnalysis.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      }
    })

    return {
      engagements,
      sentiments,
      totalPosts: engagements.length,
      timeframe
    }
  }

  private async performAIClusterin(audienceData: any, options: { maxSegments: number; minSegmentSize: number }) {
    const prompt = `
Analyze the following audience engagement data and identify distinct audience segments. 
Create ${options.maxSegments} or fewer meaningful segments with at least ${options.minSegmentSize} users each.

Data Summary:
- Total Engagements: ${audienceData.engagements.length}
- Total Sentiment Entries: ${audienceData.sentiments.length}
- Time Period: ${audienceData.timeframe}

Engagement Patterns:
${this.summarizeEngagementData(audienceData.engagements)}

Sentiment Patterns:
${this.summarizeSentimentData(audienceData.sentiments)}

Please return a JSON response with the following structure:
{
  "segments": [
    {
      "name": "Segment Name",
      "description": "Detailed description of this audience segment",
      "characteristics": {
        "demographics": {
          "ageRange": "25-34",
          "location": "US",
          "interests": ["technology", "business"]
        },
        "behavior": {
          "engagementPatterns": ["high morning engagement", "prefers video content"],
          "preferredContentTypes": ["video", "infographic"],
          "activeTimeRanges": ["9-11 AM", "7-9 PM"],
          "platformPreferences": ["instagram", "linkedin"]
        },
        "psychographics": {
          "values": ["innovation", "efficiency"],
          "motivations": ["career growth", "learning"],
          "painPoints": ["time constraints", "information overload"]
        }
      },
      "estimatedSize": 1500,
      "engagementProfile": {
        "avgEngagementRate": 0.045,
        "preferredPostTypes": ["educational", "behind-the-scenes"],
        "responsePatterns": ["likes quickly", "comments thoughtfully"]
      }
    }
  ],
  "insights": ["Key insights about the audience"],
  "recommendations": ["Actionable recommendations based on the analysis"]
}

Return only valid JSON, no additional text.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert audience analyst specializing in social media segmentation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      })

      const response = completion.choices[0]?.message?.content
      if (!response) throw new Error('Empty AI response')

      const parsed = JSON.parse(response)
      return audienceClusterSchema.parse(parsed)
    } catch (error) {
      console.error('AI clustering failed:', error)
      
      // Fallback to rule-based clustering
      return this.performRuleBasedClustering(audienceData)
    }
  }

  private async storeAudienceSegments(workspaceId: string, segments: any[]) {
    const storedSegments = []

    for (const segment of segments) {
      const stored = await prisma.audienceSegment.create({
        data: {
          workspaceId,
          name: segment.name,
          description: segment.description,
          segmentType: 'BEHAVIORAL',
          criteria: segment.characteristics,
          estimatedSize: segment.estimatedSize,
          avgEngagementRate: segment.engagementProfile.avgEngagementRate,
          preferredPlatforms: segment.characteristics.behavior.platformPreferences.map((p: string) => p.toUpperCase()),
          topContentTypes: segment.characteristics.behavior.preferredContentTypes,
          personalityTraits: segment.characteristics.psychographics,
          interests: segment.characteristics.demographics.interests,
          demographicProfile: {
            ageRange: segment.characteristics.demographics.ageRange,
            location: segment.characteristics.demographics.location
          }
        }
      })
      storedSegments.push(stored)
    }

    return storedSegments
  }

  private async refreshSegmentData(segmentId: string) {
    // Get recent engagement data for this segment
    const segment = await prisma.audienceSegment.findUnique({
      where: { id: segmentId }
    })

    if (!segment) return

    // Update segment metrics based on recent activity
    const recentEngagements = await this.getRecentSegmentEngagements(segmentId, '7d')
    const updatedMetrics = this.calculateSegmentMetrics(recentEngagements)

    await prisma.audienceSegment.update({
      where: { id: segmentId },
      data: {
        actualSize: updatedMetrics.userCount,
        avgEngagementRate: updatedMetrics.avgEngagement
      }
    })
  }

  private identifyEngagementPatterns(engagements: any[]) {
    const patterns = []

    // Time-based patterns
    const timePattern = this.analyzeTimeBasedPatterns(engagements)
    if (timePattern.strength > 0.3) {
      patterns.push({
        type: 'DAILY',
        name: 'Daily Engagement Peak',
        description: `Strong engagement pattern at ${timePattern.peakHour}:00`,
        triggers: { hour: timePattern.peakHour },
        behaviors: { engagementMultiplier: timePattern.strength },
        timeline: { daily: true },
        confidenceScore: timePattern.strength
      })
    }

    // Content-type patterns
    const contentPattern = this.analyzeContentTypePatterns(engagements)
    for (const [contentType, score] of Object.entries(contentPattern)) {
      if ((score as number) > 0.4) {
        patterns.push({
          type: 'CONTENT_TYPE',
          name: `${contentType} Preference`,
          description: `Strong preference for ${contentType} content`,
          triggers: { contentType },
          behaviors: { preferenceScore: score },
          timeline: { ongoing: true },
          confidenceScore: score as number
        })
      }
    }

    return patterns.map(pattern => ({
      ...pattern,
      dataPoints: engagements.length,
      audienceSize: Math.floor(engagements.length / 10) // Estimate
    }))
  }

  private async storeEngagementPattern(workspaceId: string, pattern: any) {
    return await prisma.engagementPattern.create({
      data: {
        workspaceId,
        patternType: pattern.type,
        patternName: pattern.name,
        description: pattern.description,
        triggers: pattern.triggers,
        behaviors: pattern.behaviors,
        timeline: pattern.timeline,
        audienceSize: pattern.audienceSize,
        confidenceScore: pattern.confidenceScore,
        dataPoints: pattern.dataPoints
      }
    })
  }

  private async getSegmentPerformanceData(segmentId: string) {
    return await prisma.contentRecommendation.findMany({
      where: {
        segmentId,
        status: 'IMPLEMENTED',
        actualPerformance: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  }

  private async generateAIRecommendations(segment: any, historicalData: any[], contentGoal: string) {
    const prompt = `
Based on the following audience segment data and historical performance, generate personalized content recommendations.

Segment: ${segment.name}
Description: ${segment.description}
Size: ${segment.actualSize || segment.estimatedSize}
Avg Engagement: ${segment.avgEngagementRate}
Interests: ${segment.interests?.join(', ') || 'N/A'}
Preferred Platforms: ${segment.preferredPlatforms?.join(', ') || 'N/A'}
Content Goal: ${contentGoal}

Historical Performance:
${historicalData.slice(0, 10).map(h => `- ${h.title}: ${h.actualPerformance?.engagement || 'N/A'}% engagement`).join('\n')}

Generate 3-5 content recommendations in JSON format:
{
  "recommendations": [
    {
      "title": "Recommendation Title",
      "description": "Detailed description",
      "type": "CONTENT_TOPIC",
      "topics": ["topic1", "topic2"],
      "tone": "EDUCATIONAL",
      "formats": ["video", "carousel"],
      "hashtags": ["#hashtag1", "#hashtag2"],
      "platforms": ["INSTAGRAM", "LINKEDIN"],
      "predictedEngagement": 0.042,
      "predictedReach": 1500,
      "confidence": 0.85
    }
  ]
}

Return only valid JSON.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a content strategist specializing in personalized recommendations.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })

      const response = completion.choices[0]?.message?.content
      const parsed = JSON.parse(response || '{}')
      return parsed.recommendations || []
    } catch (error) {
      console.error('AI recommendation generation failed:', error)
      return this.getFallbackRecommendations(segment, contentGoal)
    }
  }

  private async getHistoricalEngagements(workspaceId: string, segmentId?: string, platform?: string) {
    // This would typically join with user engagement data
    // For now, use analytics metrics as a proxy
    const whereClause: any = { workspaceId }
    if (platform) whereClause.platform = platform

    return await prisma.analyticsMetric.findMany({
      where: whereClause,
      include: {
        post: {
          include: {
            variants: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000
    })
  }

  private analyzeTimePatterns(engagements: any[]) {
    // Group by hour and day of week
    const hourlyPattern = new Array(24).fill(0)
    const dailyPattern = new Array(7).fill(0)

    engagements.forEach(engagement => {
      const date = new Date(engagement.createdAt)
      const hour = date.getHours()
      const day = date.getDay()
      
      hourlyPattern[hour] += engagement.value || 1
      dailyPattern[day] += engagement.value || 1
    })

    return {
      hourly: hourlyPattern,
      daily: dailyPattern,
      recommendations: this.generateTimeRecommendations(hourlyPattern, dailyPattern)
    }
  }

  private async generatePostingTimeRecommendations(
    workspaceId: string,
    segmentId: string,
    timePatterns: any,
    platform?: string
  ) {
    const recommendations = []

    // Find top 3 hours for each day
    for (let day = 0; day < 7; day++) {
      const topHours = timePatterns.hourly
        .map((score: number, hour: number) => ({ hour, score: score * timePatterns.daily[day] }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3)

      for (const { hour, score } of topHours) {
        if (score > 0) {
          const recommendation = await prisma.postingTimeRecommendation.upsert({
            where: {
              segmentId_platform_dayOfWeek_hour: {
                segmentId,
                platform: platform as any || 'TWITTER',
                dayOfWeek: day,
                hour
              }
            },
            update: {
              expectedEngagement: score / 100,
              confidenceScore: Math.min(score / 50, 1),
              lastUpdated: new Date()
            },
            create: {
              workspaceId,
              segmentId,
              platform: platform as any || 'TWITTER',
              dayOfWeek: day,
              hour,
              timezone: 'UTC',
              expectedEngagement: score / 100,
              confidenceScore: Math.min(score / 50, 1),
              audienceSize: Math.floor(score / 10),
              dataPoints: timePatterns.hourly.reduce((sum: number, h: number) => sum + h, 0)
            }
          })
          recommendations.push(recommendation)
        }
      }
    }

    return recommendations
  }

  private summarizeEngagementData(engagements: any[]) {
    const platforms = engagements.reduce((acc: any, e) => {
      acc[e.platform] = (acc[e.platform] || 0) + 1
      return acc
    }, {})

    const avgEngagement = engagements.reduce((sum, e) => sum + (e.value || 0), 0) / engagements.length

    return `Platforms: ${Object.entries(platforms).map(([p, c]) => `${p}: ${c}`).join(', ')}
Average Engagement: ${avgEngagement.toFixed(3)}`
  }

  private summarizeSentimentData(sentiments: any[]) {
    const avgSentiment = sentiments.reduce((sum, s) => sum + s.overallScore, 0) / sentiments.length
    const positive = sentiments.filter(s => s.overallScore > 0.1).length
    const negative = sentiments.filter(s => s.overallScore < -0.1).length

    return `Average Sentiment: ${avgSentiment.toFixed(3)}, Positive: ${positive}, Negative: ${negative}`
  }

  private performRuleBasedClustering(audienceData: any) {
    // Fallback clustering logic
    return {
      segments: [
        {
          name: 'Active Engagers',
          description: 'Users with high engagement rates',
          characteristics: {
            demographics: { interests: ['general'] },
            behavior: {
              engagementPatterns: ['high engagement'],
              preferredContentTypes: ['mixed'],
              activeTimeRanges: ['business hours'],
              platformPreferences: ['twitter', 'linkedin']
            },
            psychographics: {
              values: ['engagement'],
              motivations: ['interaction'],
              painPoints: ['low quality content']
            }
          },
          estimatedSize: Math.floor(audienceData.engagements.length * 0.3),
          engagementProfile: {
            avgEngagementRate: 0.05,
            preferredPostTypes: ['educational'],
            responsePatterns: ['quick responses']
          }
        }
      ],
      insights: ['Generated from rule-based fallback'],
      recommendations: ['Collect more data for better segmentation']
    }
  }

  private analyzeTimeBasedPatterns(engagements: any[]) {
    const hourCounts = new Array(24).fill(0)
    
    engagements.forEach(engagement => {
      const hour = new Date(engagement.createdAt).getHours()
      hourCounts[hour]++
    })

    const maxCount = Math.max(...hourCounts)
    const peakHour = hourCounts.indexOf(maxCount)
    const avgCount = hourCounts.reduce((sum, count) => sum + count, 0) / 24
    const strength = (maxCount - avgCount) / maxCount

    return { peakHour, strength }
  }

  private analyzeContentTypePatterns(engagements: any[]) {
    const contentTypes: any = {}
    const total = engagements.length

    engagements.forEach(engagement => {
      const contentType = engagement.post?.variants?.[0]?.platformData?.contentType || 'text'
      contentTypes[contentType] = (contentTypes[contentType] || 0) + 1
    })

    // Normalize to 0-1 scores
    Object.keys(contentTypes).forEach(type => {
      contentTypes[type] = contentTypes[type] / total
    })

    return contentTypes
  }

  private generateTimeRecommendations(hourly: number[], daily: number[]) {
    const topHours = hourly
      .map((score, hour) => ({ hour, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    const topDays = daily
      .map((score, day) => ({ day, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    return {
      bestHours: topHours,
      bestDays: topDays
    }
  }

  private getFallbackRecommendations(segment: any, contentGoal: string) {
    return [
      {
        title: 'Engage with Educational Content',
        description: 'Create content that educates your audience',
        type: 'CONTENT_TOPIC',
        topics: ['education', 'tips'],
        tone: 'EDUCATIONAL',
        formats: ['image', 'text'],
        hashtags: ['#tips', '#education'],
        platforms: segment.preferredPlatforms || ['TWITTER'],
        predictedEngagement: 0.03,
        predictedReach: segment.estimatedSize * 0.1,
        confidence: 0.5
      }
    ]
  }

  private async getEngagementData(workspaceId: string, startDate: Date, segmentId?: string) {
    return await prisma.analyticsMetric.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate }
      },
      include: {
        post: {
          include: {
            variants: true
          }
        }
      }
    })
  }

  private async getRecentSegmentEngagements(segmentId: string, timeframe: string) {
    // Mock data for now - in real implementation, this would query user engagement data
    return []
  }

  private calculateSegmentMetrics(engagements: any[]) {
    return {
      userCount: engagements.length,
      avgEngagement: engagements.reduce((sum, e) => sum + (e.value || 0), 0) / engagements.length
    }
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)([hdw])/)
    if (!match) return 24 * 7 // default to 7 days
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 'h': return value
      case 'd': return value * 24
      case 'w': return value * 24 * 7
      default: return 24 * 7
    }
  }
}