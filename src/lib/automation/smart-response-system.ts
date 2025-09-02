import { openai } from '@/lib/ai/config'
import { prisma } from '@/lib/prisma'
import { Platform, ResponseStatus, ResponseTone, ResponseType } from '@prisma/client'
import { z } from 'zod'

const SmartResponseAnalysisSchema = z.object({
  responses: z.array(z.object({
    responseText: z.string(),
    tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'humorous']),
    responseType: z.enum(['answer', 'acknowledgment', 'redirect', 'escalation']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    tags: z.array(z.string()).optional(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    requiresHumanReview: z.boolean()
  }))
})

export interface MessageContext {
  id: string
  content: string
  platform: Platform
  authorName?: string
  authorId?: string
  isPublic: boolean
  parentMessageId?: string
  timestamp: Date
  sentiment?: 'positive' | 'negative' | 'neutral'
  language?: string
  metadata?: any
}

export interface SmartResponseOptions {
  tone?: ResponseTone
  responseType?: ResponseType
  includePersonalization?: boolean
  maxLength?: number
  platform?: Platform
  brandVoice?: string
  escalationThreshold?: number
  autoApprove?: boolean
  templateCategories?: string[]
}

export interface SmartResponseResult {
  responseText: string
  tone: 'professional' | 'friendly' | 'casual' | 'formal' | 'humorous'
  responseType: 'answer' | 'acknowledgment' | 'redirect' | 'escalation'
  confidence: number
  reasoning: string
  tags?: string[]
  urgency: 'low' | 'medium' | 'high' | 'critical'
  requiresHumanReview: boolean
}

export interface ResponseTemplate {
  id: string
  category: string
  keywords: string[]
  template: string
  tone: ResponseTone
  platform?: Platform
  language?: string
  usage_count: number
}

export class SmartResponseSystem {
  private readonly cache = new Map<string, { data: SmartResponseResult[]; timestamp: number }>()
  private readonly CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

  async generateResponse(
    workspaceId: string,
    messageContext: MessageContext,
    options: SmartResponseOptions = {}
  ): Promise<SmartResponseResult[]> {
    const cacheKey = this.generateCacheKey(messageContext.content, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Get workspace brand context
      const brandContext = await this.getBrandContext(workspaceId)
      
      // Get similar past responses
      const similarResponses = await this.getSimilarResponses(workspaceId, messageContext)
      
      // Analyze message for context and intent
      const messageAnalysis = await this.analyzeMessage(messageContext)
      
      // Generate AI responses
      const responses = await this.generateAIResponses(
        messageContext,
        brandContext,
        similarResponses,
        messageAnalysis,
        options
      )
      
      // Store responses for learning
      await this.storeResponsesForLearning(workspaceId, messageContext, responses)
      
      // Cache results
      this.cache.set(cacheKey, { data: responses, timestamp: Date.now() })
      
      return responses
    } catch (error) {
      console.error('Error generating smart responses:', error)
      throw new Error('Failed to generate smart responses')
    }
  }

  private async getBrandContext(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, settings: true }
    })

    // Get recent approved responses to understand brand voice
    const recentResponses = await prisma.smartResponse.findMany({
      where: {
        workspaceId,
        status: ResponseStatus.APPROVED,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      take: 20,
      orderBy: { createdAt: 'desc' }
    })

    return {
      workspaceName: workspace?.name || 'Our Brand',
      brandVoice: workspace?.settings?.brandVoice || 'professional',
      responseExamples: recentResponses.map(r => r.responseText),
      commonTone: this.analyzeToneFromResponses(recentResponses)
    }
  }

  private async getSimilarResponses(workspaceId: string, messageContext: MessageContext) {
    // Simple keyword-based similarity (in production, would use vector similarity)
    const keywords = this.extractKeywords(messageContext.content)
    
    const similarResponses = await prisma.smartResponse.findMany({
      where: {
        workspaceId,
        status: ResponseStatus.APPROVED,
        OR: keywords.map(keyword => ({
          originalMessage: {
            contains: keyword,
            mode: 'insensitive' as const
          }
        }))
      },
      take: 5,
      orderBy: { confidence: 'desc' }
    })

    return similarResponses
  }

  private async analyzeMessage(messageContext: MessageContext) {
    const prompt = `
Analyze this social media message for context, intent, and response requirements:

MESSAGE CONTEXT:
- Platform: ${messageContext.platform}
- Content: "${messageContext.content}"
- Author: ${messageContext.authorName || 'Unknown'}
- Is Public: ${messageContext.isPublic}
- Sentiment: ${messageContext.sentiment || 'Unknown'}
- Language: ${messageContext.language || 'Unknown'}

Analyze for:
1. Intent (question, complaint, compliment, request, etc.)
2. Urgency level
3. Emotional tone
4. Keywords and topics
5. Required response type
6. Escalation need
7. Language and cultural considerations

Return analysis as JSON with structured insights.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert customer service analyst specializing in social media communication analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })

      const response = completion.choices[0]?.message?.content
      return response ? JSON.parse(response) : {}
    } catch (error) {
      console.error('Error analyzing message:', error)
      return {
        intent: 'general_inquiry',
        urgency: 'medium',
        emotionalTone: 'neutral',
        keywords: this.extractKeywords(messageContext.content),
        responseType: 'answer',
        needsEscalation: false
      }
    }
  }

  private async generateAIResponses(
    messageContext: MessageContext,
    brandContext: any,
    similarResponses: any[],
    messageAnalysis: any,
    options: SmartResponseOptions
  ): Promise<SmartResponseResult[]> {
    const prompt = `
Generate appropriate responses for this social media message:

MESSAGE: "${messageContext.content}"
PLATFORM: ${messageContext.platform}
IS PUBLIC: ${messageContext.isPublic}
AUTHOR: ${messageContext.authorName || 'User'}

MESSAGE ANALYSIS:
- Intent: ${messageAnalysis.intent}
- Urgency: ${messageAnalysis.urgency}
- Emotional Tone: ${messageAnalysis.emotionalTone}
- Keywords: ${messageAnalysis.keywords?.join(', ')}
- Needs Escalation: ${messageAnalysis.needsEscalation}

BRAND CONTEXT:
- Brand Name: ${brandContext.workspaceName}
- Brand Voice: ${brandContext.brandVoice}
- Common Tone: ${brandContext.commonTone}

SIMILAR PAST RESPONSES (for reference):
${similarResponses.slice(0, 3).map(r => `- "${r.responseText}"`).join('\n')}

RESPONSE REQUIREMENTS:
- Tone: ${options.tone || 'match brand voice'}
- Response Type: ${options.responseType || 'appropriate to context'}
- Max Length: ${options.maxLength || '280 characters'}
- Include Personalization: ${options.includePersonalization || true}
- Platform: ${options.platform || messageContext.platform}

Generate 3 different response options with varying approaches:
1. Direct/Professional response
2. Friendly/Engaging response  
3. Brief/Efficient response

For each response, provide:
- Response text (optimized for ${messageContext.platform})
- Tone classification
- Response type
- Confidence score (0-1)
- Reasoning for approach
- Urgency level
- Whether human review is needed
- Relevant tags

Consider platform-specific best practices:
- Twitter: Concise, can use mentions/hashtags
- Facebook: Can be longer, more conversational
- Instagram: Visual-first, emoji-friendly
- LinkedIn: Professional tone
- TikTok: Casual, trend-aware

Return as JSON with "responses" array.
`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media manager creating contextually appropriate responses that maintain brand voice while addressing user needs effectively.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from AI')
      }

      const parsedResponse = JSON.parse(response)
      const validatedResponse = SmartResponseAnalysisSchema.parse(parsedResponse)

      return validatedResponse.responses
    } catch (error) {
      console.error('Error generating AI responses:', error)
      
      // Fallback responses
      return this.getFallbackResponses(messageContext, options)
    }
  }

  private getFallbackResponses(
    messageContext: MessageContext,
    options: SmartResponseOptions
  ): SmartResponseResult[] {
    const fallbackResponses: SmartResponseResult[] = []

    // Generic professional response
    fallbackResponses.push({
      responseText: `Thank you for reaching out! We appreciate your message and will get back to you soon.`,
      tone: 'professional',
      responseType: 'acknowledgment',
      confidence: 0.6,
      reasoning: 'Generic professional acknowledgment for fallback',
      urgency: 'medium',
      requiresHumanReview: true
    })

    // Platform-specific friendly response
    if (messageContext.platform === Platform.TWITTER) {
      fallbackResponses.push({
        responseText: `Hi ${messageContext.authorName || 'there'}! Thanks for reaching out 👋 We'll be in touch soon!`,
        tone: 'friendly',
        responseType: 'acknowledgment',
        confidence: 0.5,
        reasoning: 'Twitter-optimized friendly acknowledgment',
        urgency: 'medium',
        requiresHumanReview: true
      })
    }

    return fallbackResponses
  }

  private async storeResponsesForLearning(
    workspaceId: string,
    messageContext: MessageContext,
    responses: SmartResponseResult[]
  ): Promise<void> {
    try {
      for (const response of responses) {
        await prisma.smartResponse.create({
          data: {
            workspaceId,
            originalMessage: messageContext.content,
            responseText: response.responseText,
            platform: messageContext.platform,
            tone: response.tone.toUpperCase() as any,
            responseType: response.responseType.toUpperCase() as any,
            confidence: response.confidence,
            reasoning: response.reasoning,
            tags: response.tags || [],
            urgencyLevel: response.urgency.toUpperCase() as any,
            requiresHumanReview: response.requiresHumanReview,
            status: ResponseStatus.PENDING,
            metadata: {
              messageContext: {
                authorName: messageContext.authorName,
                isPublic: messageContext.isPublic,
                sentiment: messageContext.sentiment,
                language: messageContext.language
              }
            }
          }
        })
      }
    } catch (error) {
      console.error('Error storing responses for learning:', error)
    }
  }

  async approveResponse(responseId: string, userId: string, feedback?: string) {
    const updatedResponse = await prisma.smartResponse.update({
      where: { id: responseId },
      data: {
        status: ResponseStatus.APPROVED,
        approvedBy: userId,
        approvedAt: new Date(),
        feedback
      }
    })

    // Learn from approved response
    await this.updateResponseLearning(updatedResponse)
    
    return updatedResponse
  }

  async rejectResponse(responseId: string, userId: string, reason: string) {
    return prisma.smartResponse.update({
      where: { id: responseId },
      data: {
        status: ResponseStatus.REJECTED,
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason
      }
    })
  }

  async getResponsesByStatus(
    workspaceId: string,
    status: ResponseStatus,
    options: {
      platform?: Platform
      limit?: number
      offset?: number
    } = {}
  ) {
    return prisma.smartResponse.findMany({
      where: {
        workspaceId,
        status,
        platform: options.platform
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 20,
      skip: options.offset || 0,
      include: {
        workspace: { select: { name: true } }
      }
    })
  }

  async createResponseTemplate(
    workspaceId: string,
    template: {
      category: string
      keywords: string[]
      template: string
      tone: ResponseTone
      platform?: Platform
      language?: string
    },
    userId: string
  ) {
    return prisma.responseTemplate.create({
      data: {
        workspaceId,
        category: template.category,
        keywords: template.keywords,
        template: template.template,
        tone: template.tone,
        platform: template.platform,
        language: template.language || 'en',
        createdBy: userId,
        usageCount: 0
      }
    })
  }

  async getResponseTemplates(workspaceId: string, category?: string) {
    return prisma.responseTemplate.findMany({
      where: {
        workspaceId,
        category: category ? { contains: category, mode: 'insensitive' } : undefined,
        isActive: true
      },
      orderBy: { usageCount: 'desc' }
    })
  }

  async generateResponseFromTemplate(
    templateId: string,
    messageContext: MessageContext,
    variables?: Record<string, string>
  ) {
    const template = await prisma.responseTemplate.findUnique({
      where: { id: templateId }
    })

    if (!template) {
      throw new Error('Template not found')
    }

    let responseText = template.template

    // Replace variables
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        responseText = responseText.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      })
    }

    // Replace common placeholders
    responseText = responseText
      .replace(/\{\{authorName\}\}/g, messageContext.authorName || 'there')
      .replace(/\{\{platform\}\}/g, messageContext.platform.toLowerCase())

    // Update usage count
    await prisma.responseTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } }
    })

    return {
      responseText,
      tone: template.tone.toLowerCase(),
      responseType: 'template' as const,
      confidence: 0.8,
      reasoning: `Generated from template: ${template.category}`,
      urgency: 'medium' as const,
      requiresHumanReview: false
    }
  }

  private async updateResponseLearning(approvedResponse: any) {
    // In a production system, this would update ML models
    // For now, we'll just log for future model training
    console.log('Learning from approved response:', {
      originalMessage: approvedResponse.originalMessage,
      responseText: approvedResponse.responseText,
      tone: approvedResponse.tone,
      confidence: approvedResponse.confidence
    })
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production would use NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
    
    // Remove common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'were'])
    
    return Array.from(new Set(words.filter(word => !stopWords.has(word))))
  }

  private analyzeToneFromResponses(responses: any[]): string {
    if (responses.length === 0) return 'professional'
    
    const tones = responses.map(r => r.tone?.toLowerCase()).filter(Boolean)
    const toneCount = tones.reduce((acc, tone) => {
      acc[tone] = (acc[tone] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(toneCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'professional'
  }

  private generateCacheKey(messageContent: string, options: SmartResponseOptions): string {
    return `smart-response:${messageContent.substring(0, 50)}:${JSON.stringify(options)}`
  }
}