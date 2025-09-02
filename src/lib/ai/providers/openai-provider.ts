// OpenAI Provider Implementation

import OpenAI from 'openai'
import { SocialProvider } from '@prisma/client'
import { 
  AIProvider, 
  ContentGenerationOptions, 
  HashtagSuggestionOptions, 
  ToneAnalysisResult, 
  PerformancePredictionResult,
  AIUsageMetrics 
} from '../types'
import { RateLimiter } from '../rate-limiter'

export class OpenAIProvider implements AIProvider {
  private client: OpenAI
  private rateLimiter: RateLimiter
  
  constructor(apiKey: string, rateLimitRPM: number = 60, rateLimitTPM: number = 40000) {
    this.client = new OpenAI({
      apiKey: apiKey
    })
    this.rateLimiter = new RateLimiter(rateLimitRPM, rateLimitTPM)
  }

  async generateContent(prompt: string, options: ContentGenerationOptions = {}): Promise<{
    content: string
    usage: AIUsageMetrics
  }> {
    const startTime = Date.now()
    
    // Wait for rate limit
    await this.rateLimiter.acquire()

    const systemPrompt = this.buildContentGenerationPrompt(options)
    
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxLength || 500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      })

      const content = response.choices[0]?.message?.content || ''
      const usage: AIUsageMetrics = {
        tokensUsed: response.usage?.total_tokens || 0,
        costCents: this.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o-mini'),
        responseTimeMs: Date.now() - startTime,
        model: 'gpt-4o-mini'
      }

      return { content, usage }
    } catch (error) {
      throw new Error(`OpenAI content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async suggestHashtags(options: HashtagSuggestionOptions): Promise<{
    hashtags: string[]
    usage: AIUsageMetrics
  }> {
    const startTime = Date.now()
    
    await this.rateLimiter.acquire()

    const systemPrompt = `You are a social media hashtag expert. Generate relevant, trending hashtags for ${options.platform} posts.
    
    Rules:
    - Return only hashtags, one per line
    - No explanations or additional text
    - Maximum ${options.maxHashtags || 10} hashtags
    - Consider platform best practices for ${options.platform}
    - Mix popular and niche hashtags for better reach
    ${options.industry ? `- Focus on ${options.industry} industry` : ''}
    ${options.location ? `- Include location-based hashtags for ${options.location}` : ''}`

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate hashtags for this content: "${options.content}"` }
        ],
        max_tokens: 300,
        temperature: 0.5
      })

      const content = response.choices[0]?.message?.content || ''
      const hashtags = content
        .split('\n')
        .map(tag => tag.trim())
        .filter(tag => tag.startsWith('#'))
        .slice(0, options.maxHashtags || 10)

      const usage: AIUsageMetrics = {
        tokensUsed: response.usage?.total_tokens || 0,
        costCents: this.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o-mini'),
        responseTimeMs: Date.now() - startTime,
        model: 'gpt-4o-mini'
      }

      return { hashtags, usage }
    } catch (error) {
      throw new Error(`OpenAI hashtag generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeTone(content: string): Promise<{
    analysis: ToneAnalysisResult
    usage: AIUsageMetrics
  }> {
    const startTime = Date.now()
    
    await this.rateLimiter.acquire()

    const systemPrompt = `Analyze the tone of the given content and return a JSON response with the following structure:
    {
      "tone": "professional|casual|humorous|inspirational|educational|promotional|conversational|formal",
      "confidence": 0.95,
      "sentiment": 0.2,
      "formality": 0.7,
      "energy": 0.6
    }
    
    Where:
    - tone: the primary detected tone
    - confidence: 0-1 confidence in the tone detection
    - sentiment: -1 (negative) to 1 (positive)
    - formality: 0 (informal) to 1 (formal)
    - energy: 0 (low energy) to 1 (high energy)
    
    Return only the JSON, no explanations.`

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        max_tokens: 150,
        temperature: 0.1
      })

      const jsonResponse = response.choices[0]?.message?.content || '{}'
      const analysis = JSON.parse(jsonResponse) as ToneAnalysisResult

      const usage: AIUsageMetrics = {
        tokensUsed: response.usage?.total_tokens || 0,
        costCents: this.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o-mini'),
        responseTimeMs: Date.now() - startTime,
        model: 'gpt-4o-mini'
      }

      return { analysis, usage }
    } catch (error) {
      throw new Error(`OpenAI tone analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async optimizeForPlatform(content: string, platform: SocialProvider, options: ContentGenerationOptions = {}): Promise<{
    content: string
    usage: AIUsageMetrics
  }> {
    const startTime = Date.now()
    
    await this.rateLimiter.acquire()

    const platformGuidelines = this.getPlatformGuidelines(platform)
    const systemPrompt = `Optimize the given content specifically for ${platform}. 
    
    ${platformGuidelines}
    
    ${options.tone ? `Tone: ${options.tone}` : ''}
    ${options.includeHashtags ? 'Include relevant hashtags' : 'Do not include hashtags'}
    ${options.includeEmojis ? 'Include appropriate emojis' : 'Minimize emoji usage'}
    
    Return only the optimized content, no explanations.`

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        max_tokens: options.maxLength || 500,
        temperature: 0.6
      })

      const optimizedContent = response.choices[0]?.message?.content || content

      const usage: AIUsageMetrics = {
        tokensUsed: response.usage?.total_tokens || 0,
        costCents: this.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o-mini'),
        responseTimeMs: Date.now() - startTime,
        model: 'gpt-4o-mini'
      }

      return { content: optimizedContent, usage }
    } catch (error) {
      throw new Error(`OpenAI platform optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async predictPerformance(content: string, platform: SocialProvider, historicalData?: any[]): Promise<{
    prediction: PerformancePredictionResult
    usage: AIUsageMetrics
  }> {
    const startTime = Date.now()
    
    await this.rateLimiter.acquire()

    // This is a simplified prediction - in production, you'd train on historical data
    const systemPrompt = `Analyze the given content and predict its performance on ${platform}. 
    
    Return a JSON response with predicted metrics:
    {
      "engagementRate": 2.5,
      "reach": 1000,
      "impressions": 5000,
      "likes": 120,
      "comments": 15,
      "shares": 8,
      "confidence": 0.75
    }
    
    Base predictions on:
    - Content quality and relevance
    - Platform best practices
    - Typical ${platform} engagement patterns
    - Content length and format
    
    Return only the JSON, no explanations.`

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Predict performance for this ${platform} content: "${content}"
            ${historicalData ? `Historical context: ${JSON.stringify(historicalData.slice(0, 5))}` : ''}` 
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })

      const jsonResponse = response.choices[0]?.message?.content || '{}'
      const prediction = JSON.parse(jsonResponse) as PerformancePredictionResult

      const usage: AIUsageMetrics = {
        tokensUsed: response.usage?.total_tokens || 0,
        costCents: this.calculateCost(response.usage?.total_tokens || 0, 'gpt-4o-mini'),
        responseTimeMs: Date.now() - startTime,
        model: 'gpt-4o-mini'
      }

      return { prediction, usage }
    } catch (error) {
      throw new Error(`OpenAI performance prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private buildContentGenerationPrompt(options: ContentGenerationOptions): string {
    let prompt = "You are an expert social media content creator. Generate engaging, high-quality content."
    
    if (options.platform) {
      prompt += ` Optimize for ${options.platform}.`
    }
    
    if (options.tone) {
      prompt += ` Use a ${options.tone} tone.`
    }
    
    if (options.maxLength) {
      prompt += ` Keep content under ${options.maxLength} characters.`
    }
    
    if (options.brandVoice) {
      prompt += ` Match this brand voice: ${options.brandVoice}.`
    }
    
    if (options.targetAudience) {
      prompt += ` Target audience: ${options.targetAudience}.`
    }
    
    prompt += "\n\nGuidelines:"
    prompt += "\n- Create engaging, shareable content"
    prompt += "\n- Include call-to-action when appropriate"
    prompt += "\n- Follow platform best practices"
    
    if (options.includeHashtags) {
      prompt += "\n- Include relevant hashtags"
    }
    
    if (options.includeEmojis) {
      prompt += "\n- Use appropriate emojis to enhance engagement"
    }
    
    return prompt
  }

  private getPlatformGuidelines(platform: SocialProvider): string {
    const guidelines = {
      TWITTER: "- Keep under 280 characters\n- Use hashtags strategically (1-2 max)\n- Include mentions when relevant\n- Consider threading for longer content",
      FACEBOOK: "- Longer content performs well\n- Ask questions to drive engagement\n- Use native video when possible\n- Include clear call-to-actions",
      INSTAGRAM: "- Visual-first content\n- Use 3-5 relevant hashtags in comments\n- Include location tags\n- Stories format for behind-the-scenes",
      LINKEDIN: "- Professional tone\n- Industry insights and thought leadership\n- Use native LinkedIn features\n- Tag relevant professionals/companies",
      YOUTUBE: "- Compelling titles and thumbnails\n- Clear video descriptions\n- Use end screens and cards\n- Optimize for search",
      TIKTOK: "- Trend-aware content\n- Quick hooks in first 3 seconds\n- Use popular sounds\n- Vertical video format"
    }
    
    return guidelines[platform] || "Follow general social media best practices"
  }

  private calculateCost(tokens: number, model: string): number {
    // GPT-4o-mini pricing (approximate as of 2024)
    const prices = {
      'gpt-4o-mini': {
        input: 0.00015, // per 1K tokens
        output: 0.0006  // per 1K tokens
      }
    }
    
    const modelPricing = prices[model as keyof typeof prices]
    if (!modelPricing) return 0
    
    // Assuming 50/50 split for input/output tokens
    const inputTokens = tokens * 0.5
    const outputTokens = tokens * 0.5
    
    const inputCost = (inputTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output
    
    return Math.round((inputCost + outputCost) * 100) // Convert to cents
  }
}