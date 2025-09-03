import { OpenAI } from 'openai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Sentiment analysis result schema
const sentimentResultSchema = z.object({
  overallScore: z.number().min(-1).max(1), // -1 to 1 (negative to positive)
  positiveScore: z.number().min(0).max(1),
  negativeScore: z.number().min(0).max(1),
  neutralScore: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  emotions: z.object({
    joy: z.number().min(0).max(1),
    sadness: z.number().min(0).max(1),
    anger: z.number().min(0).max(1),
    fear: z.number().min(0).max(1),
    surprise: z.number().min(0).max(1),
    disgust: z.number().min(0).max(1)
  }),
  language: z.string().optional(),
  detectedTopics: z.array(z.string()),
  isInfluencer: z.boolean().optional(),
  followerCount: z.number().optional()
})

export type SentimentResult = z.infer<typeof sentimentResultSchema>

export interface SentimentAnalysisOptions {
  includeEmotions?: boolean
  includeTopics?: boolean
  language?: string
  authorData?: {
    handle?: string
    followersCount?: number
    isVerified?: boolean
  }
}

export class SentimentAnalyzer {
  private readonly maxRetries = 3
  private readonly retryDelay = 1000 // 1 second

  /**
   * Analyze sentiment of text content
   */
  async analyzeSentiment(
    content: string, 
    options: SentimentAnalysisOptions = {}
  ): Promise<SentimentResult> {
    const { includeEmotions = true, includeTopics = true } = options

    try {
      const prompt = this.buildSentimentPrompt(content, options)
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert sentiment analysis AI. Analyze the given text and return a detailed sentiment analysis in valid JSON format. Be precise and consistent in your scoring.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 500
      })

      const responseText = completion.choices[0]?.message?.content
      if (!responseText) {
        throw new Error('Empty response from OpenAI')
      }

      // Parse and validate the JSON response
      const jsonResponse = JSON.parse(responseText)
      const result = sentimentResultSchema.parse(jsonResponse)

      return result
    } catch (error) {
      console.error('Sentiment analysis failed:', error)
      
      // Fallback to basic analysis
      return this.getFallbackSentiment(content, options)
    }
  }

  /**
   * Analyze sentiment for multiple texts in batch
   */
  async analyzeBatch(
    contents: Array<{ id: string; text: string; options?: SentimentAnalysisOptions }>
  ): Promise<Array<{ id: string; result: SentimentResult }>> {
    const results: Array<{ id: string; result: SentimentResult }> = []
    
    // Process in chunks to avoid rate limiting
    const chunkSize = 5
    for (let i = 0; i < contents.length; i += chunkSize) {
      const chunk = contents.slice(i, i + chunkSize)
      
      const chunkPromises = chunk.map(async (item) => {
        try {
          const result = await this.analyzeSentiment(item.text, item.options)
          return { id: item.id, result }
        } catch (error) {
          console.error(`Failed to analyze sentiment for item ${item.id}:`, error)
          return {
            id: item.id,
            result: this.getFallbackSentiment(item.text, item.options)
          }
        }
      })
      
      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
      
      // Add delay between chunks to respect rate limits
      if (i + chunkSize < contents.length) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
      }
    }
    
    return results
  }

  /**
   * Store sentiment analysis in database
   */
  async storeSentimentAnalysis({
    workspaceId,
    postId,
    sourceType,
    sourceId,
    content,
    platform,
    authorId,
    authorHandle,
    sentiment,
    followerCount
  }: {
    workspaceId: string
    postId?: string
    sourceType: 'COMMENT' | 'MENTION' | 'DIRECT_MESSAGE' | 'REVIEW' | 'SHARE' | 'REPLY'
    sourceId: string
    content: string
    platform: 'TWITTER' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'YOUTUBE' | 'TIKTOK'
    authorId?: string
    authorHandle?: string
    sentiment: SentimentResult
    followerCount?: number
  }) {
    try {
      const analysis = await prisma.sentimentAnalysis.create({
        data: {
          workspaceId,
          postId,
          sourceType,
          sourceId,
          content,
          overallScore: sentiment.overallScore,
          positiveScore: sentiment.positiveScore,
          negativeScore: sentiment.negativeScore,
          neutralScore: sentiment.neutralScore,
          confidenceScore: sentiment.confidenceScore,
          emotions: sentiment.emotions,
          platform,
          authorId,
          authorHandle,
          language: sentiment.language,
          detectedTopics: sentiment.detectedTopics,
          isInfluencer: sentiment.isInfluencer || false,
          followerCount
        }
      })

      return analysis
    } catch (error) {
      console.error('Failed to store sentiment analysis:', error)
      throw error
    }
  }

  /**
   * Get sentiment trends for a workspace
   */
  async getSentimentTrends({
    workspaceId,
    platform,
    startDate,
    endDate,
    groupBy = 'day'
  }: {
    workspaceId: string
    platform?: string
    startDate: Date
    endDate: Date
    groupBy?: 'hour' | 'day' | 'week'
  }) {
    const whereClause: any = {
      workspaceId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    if (platform) {
      whereClause.platform = platform
    }

    const sentiments = await prisma.sentimentAnalysis.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        overallScore: true,
        positiveScore: true,
        negativeScore: true,
        neutralScore: true,
        platform: true,
        detectedTopics: true,
        isInfluencer: true
      }
    })

    // Group and aggregate data
    return this.aggregateSentimentData(sentiments, groupBy)
  }

  /**
   * Detect potential crises based on sentiment patterns
   */
  async detectCrises({
    workspaceId,
    timeframe = '24h',
    thresholds = {
      sentimentDrop: -0.3,
      volumeIncrease: 2.0,
      negativeSpike: 0.7
    }
  }: {
    workspaceId: string
    timeframe?: string
    thresholds?: {
      sentimentDrop: number
      volumeIncrease: number
      negativeSpike: number
    }
  }) {
    const timeframeHours = this.parseTimeframe(timeframe)
    const currentTime = new Date()
    const startTime = new Date(currentTime.getTime() - timeframeHours * 60 * 60 * 1000)
    const compareTime = new Date(startTime.getTime() - timeframeHours * 60 * 60 * 1000)

    // Get current period sentiment
    const currentSentiments = await prisma.sentimentAnalysis.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: startTime,
          lte: currentTime
        }
      }
    })

    // Get comparison period sentiment
    const comparisonSentiments = await prisma.sentimentAnalysis.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: compareTime,
          lte: startTime
        }
      }
    })

    const currentMetrics = this.calculateMetrics(currentSentiments)
    const comparisonMetrics = this.calculateMetrics(comparisonSentiments)

    const crises = []

    // Check for sentiment drop
    if (currentMetrics.avgSentiment - comparisonMetrics.avgSentiment <= thresholds.sentimentDrop) {
      crises.push({
        type: 'SENTIMENT_SPIKE' as const,
        severity: this.calculateSeverity(
          Math.abs(currentMetrics.avgSentiment - comparisonMetrics.avgSentiment)
        ),
        currentValue: currentMetrics.avgSentiment,
        previousValue: comparisonMetrics.avgSentiment,
        change: currentMetrics.avgSentiment - comparisonMetrics.avgSentiment
      })
    }

    // Check for volume surge
    const volumeChange = currentMetrics.totalCount / Math.max(comparisonMetrics.totalCount, 1)
    if (volumeChange >= thresholds.volumeIncrease) {
      crises.push({
        type: 'VOLUME_SURGE' as const,
        severity: this.calculateSeverity(volumeChange - 1),
        currentValue: currentMetrics.totalCount,
        previousValue: comparisonMetrics.totalCount,
        change: volumeChange
      })
    }

    // Check for negative spike
    if (currentMetrics.negativeRatio >= thresholds.negativeSpike) {
      crises.push({
        type: 'NEGATIVE_TREND' as const,
        severity: this.calculateSeverity(currentMetrics.negativeRatio),
        currentValue: currentMetrics.negativeRatio,
        previousValue: comparisonMetrics.negativeRatio,
        change: currentMetrics.negativeRatio - comparisonMetrics.negativeRatio
      })
    }

    return crises
  }

  private buildSentimentPrompt(content: string, options: SentimentAnalysisOptions): string {
    return `
Analyze the sentiment of the following text and return a JSON response with the following structure:

{
  "overallScore": <number between -1 and 1, where -1 is very negative, 0 is neutral, 1 is very positive>,
  "positiveScore": <number between 0 and 1 indicating positive sentiment strength>,
  "negativeScore": <number between 0 and 1 indicating negative sentiment strength>,
  "neutralScore": <number between 0 and 1 indicating neutral sentiment strength>,
  "confidenceScore": <number between 0 and 1 indicating confidence in the analysis>,
  ${options.includeEmotions ? `"emotions": {
    "joy": <number between 0 and 1>,
    "sadness": <number between 0 and 1>,
    "anger": <number between 0 and 1>,
    "fear": <number between 0 and 1>,
    "surprise": <number between 0 and 1>,
    "disgust": <number between 0 and 1>
  },` : ''}
  ${options.language ? `"language": "${options.language}",` : '"language": "<detected language code>",'}
  ${options.includeTopics ? '"detectedTopics": ["<topic1>", "<topic2>", ...],\n' : '"detectedTopics": [],'}
  "isInfluencer": ${options.authorData?.isVerified || (options.authorData?.followersCount && options.authorData.followersCount > 10000)},
  "followerCount": ${options.authorData?.followersCount || null}
}

Text to analyze: "${content}"

Return only valid JSON, no additional text or formatting.`
  }

  private getFallbackSentiment(content: string, options: SentimentAnalysisOptions = {}): SentimentResult {
    // Simple keyword-based fallback analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'wonderful', 'fantastic', 'awesome', 'brilliant', 'perfect']
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'disgusting', 'worst', 'sucks', 'disappointing', 'annoying']
    
    const words = content.toLowerCase().split(/\s+/)
    const positiveCount = words.filter(word => positiveWords.includes(word)).length
    const negativeCount = words.filter(word => negativeWords.includes(word)).length
    
    const totalSentiment = positiveCount + negativeCount
    let overallScore = 0
    let positiveScore = 0
    let negativeScore = 0
    let neutralScore = 1
    
    if (totalSentiment > 0) {
      overallScore = (positiveCount - negativeCount) / totalSentiment
      positiveScore = positiveCount / totalSentiment
      negativeScore = negativeCount / totalSentiment
      neutralScore = Math.max(0, 1 - positiveScore - negativeScore)
    }
    
    return {
      overallScore,
      positiveScore,
      negativeScore,
      neutralScore,
      confidenceScore: 0.3, // Low confidence for fallback
      emotions: {
        joy: positiveScore * 0.7,
        sadness: negativeScore * 0.3,
        anger: negativeScore * 0.4,
        fear: negativeScore * 0.2,
        surprise: 0.1,
        disgust: negativeScore * 0.1
      },
      language: options.language || 'en',
      detectedTopics: [],
      isInfluencer: options.authorData?.isVerified || false,
      followerCount: options.authorData?.followersCount
    }
  }

  private aggregateSentimentData(sentiments: any[], groupBy: 'hour' | 'day' | 'week') {
    const grouped = new Map()
    
    sentiments.forEach(sentiment => {
      const date = new Date(sentiment.createdAt)
      let key: string
      
      switch (groupBy) {
        case 'hour':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        default: // day
          key = date.toISOString().split('T')[0]
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          sentiments: [],
          topics: new Set()
        })
      }
      
      const group = grouped.get(key)
      group.sentiments.push(sentiment)
      sentiment.detectedTopics.forEach((topic: string) => group.topics.add(topic))
    })
    
    return Array.from(grouped.values()).map(group => ({
      date: group.date,
      totalMentions: group.sentiments.length,
      avgSentiment: group.sentiments.reduce((sum: number, s: any) => sum + s.overallScore, 0) / group.sentiments.length,
      positiveCount: group.sentiments.filter((s: any) => s.overallScore > 0.1).length,
      negativeCount: group.sentiments.filter((s: any) => s.overallScore < -0.1).length,
      neutralCount: group.sentiments.filter((s: any) => Math.abs(s.overallScore) <= 0.1).length,
      topTopics: Array.from(group.topics).slice(0, 5),
      influencerMentions: group.sentiments.filter((s: any) => s.isInfluencer).length
    }))
  }

  private calculateMetrics(sentiments: any[]) {
    if (sentiments.length === 0) {
      return {
        totalCount: 0,
        avgSentiment: 0,
        negativeRatio: 0,
        positiveRatio: 0
      }
    }
    
    const totalCount = sentiments.length
    const avgSentiment = sentiments.reduce((sum, s) => sum + s.overallScore, 0) / totalCount
    const negativeCount = sentiments.filter(s => s.overallScore < -0.1).length
    const positiveCount = sentiments.filter(s => s.overallScore > 0.1).length
    
    return {
      totalCount,
      avgSentiment,
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

  private parseTimeframe(timeframe: string): number {
    const match = timeframe.match(/(\d+)([hdw])/)
    if (!match) return 24 // default to 24 hours
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 'h': return value
      case 'd': return value * 24
      case 'w': return value * 24 * 7
      default: return 24
    }
  }
}