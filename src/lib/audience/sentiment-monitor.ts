import { prisma } from '@/lib/prisma'
import { SentimentAnalyzer } from './sentiment-analyzer'

interface AlertRule {
  id: string
  type: 'sentiment_drop' | 'volume_surge' | 'negative_spike'
  threshold: number
  timeframe: string
  isActive: boolean
}

interface NotificationChannels {
  email: boolean
  slack: boolean
  sms: boolean
  webhook?: string
}

export class SentimentMonitor {
  private sentimentAnalyzer: SentimentAnalyzer
  
  constructor() {
    this.sentimentAnalyzer = new SentimentAnalyzer()
  }

  /**
   * Monitor sentiment in real-time and trigger alerts
   */
  async monitorWorkspace({
    workspaceId,
    alertRules = [],
    notificationChannels
  }: {
    workspaceId: string
    alertRules?: AlertRule[]
    notificationChannels: NotificationChannels
  }) {
    try {
      // Get recent sentiment data for analysis
      const recentSentiments = await this.getRecentSentiments(workspaceId, '1h')
      
      if (recentSentiments.length === 0) {
        return { alerts: [], status: 'no_data' }
      }

      const alerts = []

      // Process each alert rule
      for (const rule of alertRules.filter(r => r.isActive)) {
        const alert = await this.evaluateAlertRule(workspaceId, rule, recentSentiments)
        if (alert) {
          alerts.push(alert)
        }
      }

      // Create crisis alerts if thresholds are exceeded
      if (alerts.length > 0) {
        await this.createCrisisAlerts(workspaceId, alerts, notificationChannels)
      }

      // Update sentiment trends
      await this.updateSentimentTrends(workspaceId)

      return { alerts, status: 'monitored' }
    } catch (error) {
      console.error('Sentiment monitoring failed:', error)
      throw error
    }
  }

  /**
   * Update daily sentiment trends
   */
  async updateSentimentTrends(workspaceId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get all platforms for this workspace
    const platforms = await prisma.sentimentAnalysis.groupBy({
      by: ['platform'],
      where: {
        workspaceId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Update trends for each platform and overall
    const platformsToUpdate = [null, ...platforms.map(p => p.platform)]

    for (const platform of platformsToUpdate) {
      await this.updatePlatformTrend(workspaceId, today, platform)
    }
  }

  /**
   * Get sentiment mood recommendations for content adaptation
   */
  async getMoodRecommendations(workspaceId: string) {
    const recentTrends = await prisma.sentimentTrend.findMany({
      where: {
        workspaceId,
        date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { date: 'desc' },
      take: 7
    })

    if (recentTrends.length === 0) {
      return {
        currentMood: 'neutral',
        trend: 'stable',
        recommendations: ['Continue with current content strategy']
      }
    }

    const latestTrend = recentTrends[0]
    const averageSentiment = recentTrends.reduce((sum, trend) => sum + trend.avgSentiment, 0) / recentTrends.length
    
    // Calculate trend direction
    const trendDirection = recentTrends.length > 1 
      ? latestTrend.avgSentiment - recentTrends[recentTrends.length - 1].avgSentiment
      : 0

    // Determine current mood
    let currentMood: 'positive' | 'negative' | 'neutral' | 'mixed'
    if (averageSentiment > 0.3) currentMood = 'positive'
    else if (averageSentiment < -0.3) currentMood = 'negative'
    else if (latestTrend.positiveCount > 0 && latestTrend.negativeCount > 0) currentMood = 'mixed'
    else currentMood = 'neutral'

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable'
    if (trendDirection > 0.1) trend = 'improving'
    else if (trendDirection < -0.1) trend = 'declining'
    else trend = 'stable'

    // Generate recommendations
    const recommendations = this.generateContentRecommendations(currentMood, trend, latestTrend)

    return {
      currentMood,
      trend,
      averageSentiment,
      trendDirection,
      recommendations,
      topPositiveTopics: latestTrend.topPositiveTopics,
      topNegativeTopics: latestTrend.topNegativeTopics,
      insights: this.generateMoodInsights(recentTrends)
    }
  }

  /**
   * Real-time sentiment analysis for new content (comments, mentions, etc.)
   */
  async analyzeNewContent({
    workspaceId,
    postId,
    sourceType,
    sourceId,
    content,
    platform,
    authorData
  }: {
    workspaceId: string
    postId?: string
    sourceType: 'COMMENT' | 'MENTION' | 'DIRECT_MESSAGE' | 'REVIEW' | 'SHARE' | 'REPLY'
    sourceId: string
    content: string
    platform: 'TWITTER' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'YOUTUBE' | 'TIKTOK'
    authorData?: {
      id?: string
      handle?: string
      followersCount?: number
      isVerified?: boolean
    }
  }) {
    // Analyze sentiment
    const sentiment = await this.sentimentAnalyzer.analyzeSentiment(content, {
      includeEmotions: true,
      includeTopics: true,
      authorData: authorData
    })

    // Store in database
    const analysis = await this.sentimentAnalyzer.storeSentimentAnalysis({
      workspaceId,
      postId,
      sourceType,
      sourceId,
      content,
      platform,
      authorId: authorData?.id,
      authorHandle: authorData?.handle,
      sentiment,
      followerCount: authorData?.followersCount
    })

    // Check if this triggers any alerts
    const isHighInfluencer = (authorData?.followersCount || 0) > 100000
    const isNegativeFromInfluencer = sentiment.overallScore < -0.5 && isHighInfluencer
    
    if (isNegativeFromInfluencer) {
      await this.createInfluencerAlert(workspaceId, analysis, authorData)
    }

    return {
      analysis,
      sentiment,
      requiresAttention: sentiment.overallScore < -0.7 || isNegativeFromInfluencer
    }
  }

  private async getRecentSentiments(workspaceId: string, timeframe: string) {
    const hours = this.parseTimeframe(timeframe)
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000)

    return await prisma.sentimentAnalysis.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startTime
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  private async evaluateAlertRule(workspaceId: string, rule: AlertRule, recentSentiments: any[]) {
    const currentTime = new Date()
    const timeframeHours = this.parseTimeframe(rule.timeframe)
    const comparisonStart = new Date(currentTime.getTime() - 2 * timeframeHours * 60 * 60 * 1000)
    const currentStart = new Date(currentTime.getTime() - timeframeHours * 60 * 60 * 1000)

    // Get comparison period data
    const comparisonSentiments = await prisma.sentimentAnalysis.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: comparisonStart,
          lt: currentStart
        }
      }
    })

    const currentMetrics = this.calculatePeriodMetrics(recentSentiments)
    const comparisonMetrics = this.calculatePeriodMetrics(comparisonSentiments)

    let triggered = false
    let currentValue = 0
    let description = ''

    switch (rule.type) {
      case 'sentiment_drop':
        currentValue = currentMetrics.avgSentiment - comparisonMetrics.avgSentiment
        triggered = currentValue <= rule.threshold
        description = `Sentiment dropped by ${Math.abs(currentValue).toFixed(2)} points`
        break
        
      case 'volume_surge':
        currentValue = currentMetrics.totalCount / Math.max(comparisonMetrics.totalCount, 1)
        triggered = currentValue >= rule.threshold
        description = `Mention volume increased by ${((currentValue - 1) * 100).toFixed(0)}%`
        break
        
      case 'negative_spike':
        currentValue = currentMetrics.negativeRatio
        triggered = currentValue >= rule.threshold
        description = `Negative sentiment ratio reached ${(currentValue * 100).toFixed(0)}%`
        break
    }

    if (triggered) {
      return {
        ruleId: rule.id,
        type: rule.type,
        currentValue,
        threshold: rule.threshold,
        description,
        severity: this.calculateSeverity(Math.abs(currentValue - rule.threshold))
      }
    }

    return null
  }

  private async createCrisisAlerts(workspaceId: string, alerts: any[], notificationChannels: NotificationChannels) {
    for (const alert of alerts) {
      const crisisAlert = await prisma.crisisAlert.create({
        data: {
          workspaceId,
          alertType: this.mapAlertTypeToCrisisType(alert.type),
          severity: alert.severity,
          title: `${alert.type.replace('_', ' ').toUpperCase()} Alert`,
          description: alert.description,
          triggerMetric: alert.type,
          currentValue: alert.currentValue,
          thresholdValue: alert.threshold,
          timeframe: '1h', // TODO: Use actual timeframe from rule
          notificationsSent: {
            email: false,
            slack: false,
            sms: false
          }
        }
      })

      // Send notifications
      await this.sendNotifications(crisisAlert, notificationChannels)
    }
  }

  private async updatePlatformTrend(workspaceId: string, date: Date, platform: string | null) {
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)

    const sentiments = await prisma.sentimentAnalysis.findMany({
      where: {
        workspaceId,
        ...(platform && { platform }),
        createdAt: {
          gte: date,
          lt: nextDay
        }
      }
    })

    if (sentiments.length === 0) return

    const metrics = this.calculatePeriodMetrics(sentiments)
    
    // Get previous day for trend calculation
    const previousDay = new Date(date)
    previousDay.setDate(previousDay.getDate() - 1)
    
    const previousTrend = await prisma.sentimentTrend.findFirst({
      where: {
        workspaceId,
        date: previousDay,
        platform: platform as any
      }
    })

    // Calculate changes
    const sentimentChange = previousTrend ? metrics.avgSentiment - previousTrend.avgSentiment : 0
    const volumeChange = previousTrend ? (metrics.totalCount - previousTrend.totalMentions) / Math.max(previousTrend.totalMentions, 1) : 0

    // Get top topics
    const allTopics = sentiments.flatMap(s => s.detectedTopics)
    const topicCounts = allTopics.reduce((acc: Record<string, number>, topic) => {
      acc[topic] = (acc[topic] || 0) + 1
      return acc
    }, {})

    const sortedTopics = Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([topic]) => topic)

    const positiveTopics = sentiments
      .filter(s => s.overallScore > 0.1)
      .flatMap(s => s.detectedTopics)
      .slice(0, 5)

    const negativeTopics = sentiments
      .filter(s => s.overallScore < -0.1)
      .flatMap(s => s.detectedTopics)
      .slice(0, 5)

    // Upsert trend record
    await prisma.sentimentTrend.upsert({
      where: {
        workspaceId_date_platform: {
          workspaceId,
          date,
          platform: platform as any
        }
      },
      update: {
        totalMentions: metrics.totalCount,
        avgSentiment: metrics.avgSentiment,
        positiveCount: metrics.positiveCount,
        negativeCount: metrics.negativeCount,
        neutralCount: metrics.neutralCount,
        sentimentChange,
        volumeChange,
        topPositiveTopics: positiveTopics,
        topNegativeTopics: negativeTopics
      },
      create: {
        workspaceId,
        date,
        platform: platform as any,
        totalMentions: metrics.totalCount,
        avgSentiment: metrics.avgSentiment,
        positiveCount: metrics.positiveCount,
        negativeCount: metrics.negativeCount,
        neutralCount: metrics.neutralCount,
        sentimentChange,
        volumeChange,
        topPositiveTopics: positiveTopics,
        topNegativeTopics: negativeTopics
      }
    })
  }

  private async createInfluencerAlert(workspaceId: string, analysis: any, authorData: any) {
    await prisma.crisisAlert.create({
      data: {
        workspaceId,
        alertType: 'BRAND_ATTACK',
        severity: 'HIGH',
        title: 'Negative Feedback from Influencer',
        description: `High-follower account (@${authorData?.handle || 'unknown'}) posted negative content`,
        triggerMetric: 'influencer_negative',
        currentValue: analysis.overallScore,
        thresholdValue: -0.5,
        timeframe: '1h',
        keyMentions: [analysis.id],
        notificationsSent: {
          email: false,
          slack: false,
          sms: false
        }
      }
    })
  }

  private generateContentRecommendations(mood: string, trend: string, latestTrend: any): string[] {
    const recommendations = []

    switch (mood) {
      case 'positive':
        if (trend === 'improving') {
          recommendations.push('Continue with current positive content themes')
          recommendations.push('Amplify successful content formats')
          recommendations.push('Engage more with positive community feedback')
        } else if (trend === 'declining') {
          recommendations.push('Investigate what changed in recent content')
          recommendations.push('Return to previously successful content types')
        }
        break

      case 'negative':
        recommendations.push('Address negative feedback directly and transparently')
        recommendations.push('Pivot to more solution-oriented content')
        recommendations.push('Increase customer support visibility')
        if (latestTrend.topNegativeTopics.length > 0) {
          recommendations.push(`Address concerns about: ${latestTrend.topNegativeTopics.slice(0, 3).join(', ')}`)
        }
        break

      case 'mixed':
        recommendations.push('Acknowledge both positive and negative feedback')
        recommendations.push('Focus on balanced, educational content')
        recommendations.push('Highlight customer success stories')
        break

      case 'neutral':
        recommendations.push('Experiment with more engaging content formats')
        recommendations.push('Ask questions to encourage audience interaction')
        recommendations.push('Share behind-the-scenes content to build connection')
        break
    }

    if (trend === 'improving') {
      recommendations.push('Monitor what\'s working and scale successful approaches')
    } else if (trend === 'declining') {
      recommendations.push('Consider temporary pause on controversial topics')
      recommendations.push('Focus on core value proposition and customer benefits')
    }

    return recommendations
  }

  private generateMoodInsights(trends: any[]): string[] {
    const insights = []
    
    if (trends.length < 2) return insights

    const latest = trends[0]
    const previous = trends[1]
    
    // Volume insights
    const volumeChange = (latest.totalMentions - previous.totalMentions) / Math.max(previous.totalMentions, 1)
    if (Math.abs(volumeChange) > 0.2) {
      insights.push(`Mention volume ${volumeChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(volumeChange * 100).toFixed(0)}%`)
    }

    // Sentiment insights
    const sentimentChange = latest.avgSentiment - previous.avgSentiment
    if (Math.abs(sentimentChange) > 0.1) {
      insights.push(`Overall sentiment ${sentimentChange > 0 ? 'improved' : 'declined'} by ${Math.abs(sentimentChange).toFixed(2)} points`)
    }

    // Topic insights
    if (latest.topNegativeTopics.length > 0) {
      insights.push(`Main concerns: ${latest.topNegativeTopics.slice(0, 3).join(', ')}`)
    }

    if (latest.topPositiveTopics.length > 0) {
      insights.push(`Positive feedback on: ${latest.topPositiveTopics.slice(0, 3).join(', ')}`)
    }

    return insights
  }

  private calculatePeriodMetrics(sentiments: any[]) {
    if (sentiments.length === 0) {
      return {
        totalCount: 0,
        avgSentiment: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        negativeRatio: 0,
        positiveRatio: 0
      }
    }

    const totalCount = sentiments.length
    const avgSentiment = sentiments.reduce((sum, s) => sum + s.overallScore, 0) / totalCount
    const positiveCount = sentiments.filter(s => s.overallScore > 0.1).length
    const negativeCount = sentiments.filter(s => s.overallScore < -0.1).length
    const neutralCount = totalCount - positiveCount - negativeCount

    return {
      totalCount,
      avgSentiment,
      positiveCount,
      negativeCount,
      neutralCount,
      negativeRatio: negativeCount / totalCount,
      positiveRatio: positiveCount / totalCount
    }
  }

  private calculateSeverity(value: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (value >= 0.8) return 'CRITICAL'
    if (value >= 0.6) return 'HIGH'
    if (value >= 0.3) return 'MEDIUM'
    return 'LOW'
  }

  private mapAlertTypeToCrisisType(alertType: string) {
    switch (alertType) {
      case 'sentiment_drop': return 'SENTIMENT_SPIKE'
      case 'volume_surge': return 'VOLUME_SURGE'
      case 'negative_spike': return 'NEGATIVE_TREND'
      default: return 'BRAND_ATTACK'
    }
  }

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)([hdw])/)
    if (!match) return 1
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 'h': return value
      case 'd': return value * 24
      case 'w': return value * 24 * 7
      default: return 1
    }
  }

  private async sendNotifications(alert: any, channels: NotificationChannels) {
    // TODO: Implement actual notification sending
    console.log('Sending notifications for alert:', alert.title)
    
    // Email notification
    if (channels.email) {
      console.log('📧 Email notification sent')
    }

    // Slack notification
    if (channels.slack) {
      console.log('📱 Slack notification sent')
    }

    // SMS notification
    if (channels.sms) {
      console.log('📲 SMS notification sent')
    }

    // Webhook notification
    if (channels.webhook) {
      console.log('🔗 Webhook notification sent to:', channels.webhook)
    }
  }
}