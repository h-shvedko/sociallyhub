// Simplified AI Service for immediate use
import { openai } from './config'
import { prisma } from '@/lib/prisma'

interface ToneAnalysisResult {
  analysis: {
    tone: string
    confidence: number
    sentiment: number
    formality: number
    energy: number
  }
  usage: {
    tokensUsed: number
    costCents: number
    responseTimeMs: number
    model: string
  }
}

interface PerformancePredictionResult {
  prediction: {
    engagementRate: number
    viralityScore: number
    optimalTime: string
    confidence: number
  }
  usage: {
    tokensUsed: number
    costCents: number
    responseTimeMs: number
    model: string
  }
}

class SimpleAIService {
  async analyzeTone(
    content: string,
    workspaceId: string,
    userId: string,
    postId?: string
  ): Promise<ToneAnalysisResult> {
    const startTime = Date.now()
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content analyst. Analyze the tone, sentiment, formality, and energy of the given content. Respond with JSON format: {"tone": "professional|casual|humorous|promotional|informative", "confidence": 0.0-1.0, "sentiment": -1.0 to 1.0, "formality": 0.0-1.0, "energy": 0.0-1.0}'
          },
          {
            role: 'user',
            content: `Analyze this content: "${content}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: 'json_object' }
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from AI')
      }

      let analysisResult
      try {
        analysisResult = JSON.parse(response)
      } catch (e) {
        // Fallback if JSON parsing fails
        analysisResult = {
          tone: 'professional',
          confidence: 0.5,
          sentiment: 0,
          formality: 0.5,
          energy: 0.5
        }
      }

      const responseTimeMs = Date.now() - startTime
      const tokensUsed = completion.usage?.total_tokens || 0
      const costCents = Math.ceil(tokensUsed * 0.0015) // Rough estimate

      // Store usage tracking
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId,
          userId,
          featureType: 'TONE_ANALYSIS',
          tokensUsed,
          costCents,
          responseTimeMs,
          successful: true,
          metadata: { model: 'gpt-3.5-turbo', content_length: content.length }
        }
      }).catch(console.error) // Don't fail if tracking fails

      // Store tone analysis if postId provided
      if (postId) {
        await prisma.contentToneAnalysis.create({
          data: {
            postId,
            tone: analysisResult.tone?.toUpperCase() || 'PROFESSIONAL',
            confidence: analysisResult.confidence || 0.5,
            sentiment: analysisResult.sentiment || 0,
            formality: analysisResult.formality || 0.5,
            energy: analysisResult.energy || 0.5
          }
        }).catch(console.error) // Don't fail if storage fails
      }

      return {
        analysis: {
          tone: analysisResult.tone || 'professional',
          confidence: analysisResult.confidence || 0.5,
          sentiment: analysisResult.sentiment || 0,
          formality: analysisResult.formality || 0.5,
          energy: analysisResult.energy || 0.5
        },
        usage: {
          tokensUsed,
          costCents,
          responseTimeMs,
          model: 'gpt-3.5-turbo'
        }
      }
    } catch (error) {
      console.error('AI Tone Analysis Error:', error)
      
      // Store failed usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId,
          userId,
          featureType: 'TONE_ANALYSIS',
          tokensUsed: 0,
          costCents: 0,
          responseTimeMs: Date.now() - startTime,
          successful: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(console.error)

      throw error
    }
  }

  async predictPerformance(
    content: string,
    platform: string,
    workspaceId: string,
    userId: string,
    postId?: string
  ): Promise<PerformancePredictionResult> {
    const startTime = Date.now()
    
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert social media analyst. Predict the performance of content for ${platform}. Consider factors like content quality, timing, engagement potential, and virality. Respond with JSON: {"engagementRate": 0.0-10.0, "viralityScore": 0.0-1.0, "optimalTime": "day_hour", "confidence": 0.0-1.0}`
          },
          {
            role: 'user',
            content: `Predict performance for this ${platform} content: "${content}"`
          }
        ],
        temperature: 0.4,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from AI')
      }

      let predictionResult
      try {
        predictionResult = JSON.parse(response)
      } catch (e) {
        // Fallback prediction
        predictionResult = {
          engagementRate: 2.5,
          viralityScore: 0.3,
          optimalTime: 'tuesday_14:00',
          confidence: 0.5
        }
      }

      const responseTimeMs = Date.now() - startTime
      const tokensUsed = completion.usage?.total_tokens || 0
      const costCents = Math.ceil(tokensUsed * 0.0015) // Rough estimate

      // Store usage tracking
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId,
          userId,
          featureType: 'PERFORMANCE_PREDICTION',
          tokensUsed,
          costCents,
          responseTimeMs,
          successful: true,
          metadata: { model: 'gpt-3.5-turbo', platform, content_length: content.length }
        }
      }).catch(console.error)

      // Store prediction if postId provided
      if (postId) {
        await prisma.contentPerformancePrediction.create({
          data: {
            postId,
            platform: platform.toUpperCase() as any,
            engagementRatePrediction: predictionResult.engagementRate || 2.5,
            viralityScore: predictionResult.viralityScore || 0.3,
            optimalPostingTime: predictionResult.optimalTime || 'tuesday_14:00',
            confidence: predictionResult.confidence || 0.5
          }
        }).catch(console.error)
      }

      return {
        prediction: {
          engagementRate: predictionResult.engagementRate || 2.5,
          viralityScore: predictionResult.viralityScore || 0.3,
          optimalTime: predictionResult.optimalTime || 'tuesday_14:00',
          confidence: predictionResult.confidence || 0.5
        },
        usage: {
          tokensUsed,
          costCents,
          responseTimeMs,
          model: 'gpt-3.5-turbo'
        }
      }
    } catch (error) {
      console.error('AI Performance Prediction Error:', error)
      
      // Store failed usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId,
          userId,
          featureType: 'PERFORMANCE_PREDICTION',
          tokensUsed: 0,
          costCents: 0,
          responseTimeMs: Date.now() - startTime,
          successful: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      }).catch(console.error)

      throw error
    }
  }
}

export const simpleAIService = new SimpleAIService()