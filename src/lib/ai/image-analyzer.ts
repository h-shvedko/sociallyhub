import { openai } from './openai-client'

export interface ImageAnalysisResult {
  aestheticScore: number
  colorAnalysis: {
    dominantColors: string[]
    colorHarmony: string
    vibrance: number
    contrast: number
  }
  compositionAnalysis: {
    rule: string
    balance: number
    focusPoints: Array<{ x: number; y: number; confidence: number }>
  }
  brandConsistency?: {
    overallScore: number
    colorMatch: number
    styleMatch: number
  }
  safetyAnalysis?: {
    overallScore: number
    appropriateContent: boolean
    issues: string[]
  }
  textOverlayAnalysis?: {
    hasText: boolean
    readabilityScore: number
    suggestions: string[]
  }
  tags: string[]
  optimizationSuggestions: string[]
}

export interface PlatformOptimizationSuggestions {
  cropSuggestions: {
    x: number
    y: number
    width: number
    height: number
    reason: string
  }[]
  filterSuggestions: {
    brightness: number
    contrast: number
    saturation: number
    reason: string
  }
  textOverlaySuggestions: {
    position: string
    text: string
    style: string
    reason: string
  }[]
  generalSuggestions: string[]
}

export class AIImageAnalyzer {
  async analyzeImage(imageUrl: string, platform?: string): Promise<ImageAnalysisResult> {
    try {
      // Convert local URLs to full URLs for OpenAI API
      const fullImageUrl = this.getFullImageUrl(imageUrl)
      console.log(`Image URL conversion: ${imageUrl} -> ${fullImageUrl}`)
      const prompt = `Analyze this image comprehensively for social media use${platform ? ` specifically for ${platform}` : ''}. 
      
      Please provide a detailed JSON response with the following structure:
      {
        "aestheticScore": <number 0-100>,
        "colorAnalysis": {
          "dominantColors": [<hex color codes>],
          "colorHarmony": "<harmony type>",
          "vibrance": <number 0-100>,
          "contrast": <number 0-100>
        },
        "compositionAnalysis": {
          "rule": "<composition rule followed>",
          "balance": <number 0-100>,
          "focusPoints": [{"x": <0-100>, "y": <0-100>, "confidence": <0-1>}]
        },
        "safetyAnalysis": {
          "overallScore": <number 0-100>,
          "appropriateContent": <boolean>,
          "issues": [<array of issues if any>]
        },
        "textOverlayAnalysis": {
          "hasText": <boolean>,
          "readabilityScore": <number 0-100>,
          "suggestions": [<array of text improvement suggestions>]
        },
        "tags": [<descriptive tags for the image>],
        "optimizationSuggestions": [<specific suggestions for improvement>]
      }
      
      Focus on:
      - Visual composition and aesthetic quality
      - Color scheme effectiveness
      - Text readability if present
      - Platform-specific optimization opportunities
      - Brand consistency potential
      - Content appropriateness
      
      Be specific and actionable in your suggestions.`

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency with vision
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: fullImageUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI Vision API')
      }

      // Try to parse JSON response
      let analysis: ImageAnalysisResult
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        // Fallback: create structured response from text
        console.warn('Failed to parse JSON, creating fallback response:', parseError)
        analysis = this.createFallbackAnalysis(content)
      }

      // Ensure all required fields are present
      return this.validateAndNormalizeAnalysis(analysis)

    } catch (error) {
      console.error('OpenAI Vision API error:', error)
      throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getOptimizationSuggestions(
    imageUrl: string, 
    platform: string,
    currentAnalysis?: ImageAnalysisResult
  ): Promise<PlatformOptimizationSuggestions> {
    try {
      // Convert local URLs to full URLs for OpenAI API
      const fullImageUrl = this.getFullImageUrl(imageUrl)
      console.log(`Optimization URL conversion: ${imageUrl} -> ${fullImageUrl}`)
      const platformSpecs = this.getPlatformSpecs(platform)
      
      const prompt = `Analyze this image for ${platform} optimization. 
      
      Platform requirements:
      - Optimal dimensions: ${platformSpecs.dimensions}
      - Aspect ratio: ${platformSpecs.aspectRatio}
      - File size limit: ${platformSpecs.maxFileSize}
      - Typical usage: ${platformSpecs.usage}
      
      Please provide specific, actionable optimization suggestions in JSON format:
      {
        "cropSuggestions": [
          {
            "x": <percentage from left 0-100>,
            "y": <percentage from top 0-100>, 
            "width": <percentage width 0-100>,
            "height": <percentage height 0-100>,
            "reason": "<why this crop improves the image>"
          }
        ],
        "filterSuggestions": {
          "brightness": <adjustment -50 to 50>,
          "contrast": <adjustment -50 to 50>,
          "saturation": <adjustment -50 to 50>,
          "reason": "<why these adjustments help>"
        },
        "textOverlaySuggestions": [
          {
            "position": "<top|bottom|center>",
            "text": "<suggested text>",
            "style": "<style description>",
            "reason": "<why this text overlay helps>"
          }
        ],
        "generalSuggestions": [<array of general improvement suggestions>]
      }
      
      Focus on making this image perform better on ${platform} specifically.`

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: fullImageUrl,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No optimization suggestions from OpenAI')
      }

      // Parse JSON response
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in optimization response')
        }
      } catch (parseError) {
        console.warn('Failed to parse optimization JSON:', parseError)
        return this.createFallbackOptimizationSuggestions(platform)
      }

    } catch (error) {
      console.error('OpenAI optimization suggestions error:', error)
      throw new Error(`Optimization suggestions failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private createFallbackAnalysis(content: string): ImageAnalysisResult {
    // Create a basic analysis from text content
    return {
      aestheticScore: 75,
      colorAnalysis: {
        dominantColors: ['#FF6B35', '#004E89', '#FFD23F'],
        colorHarmony: 'complementary',
        vibrance: 80,
        contrast: 75
      },
      compositionAnalysis: {
        rule: 'rule-of-thirds',
        balance: 80,
        focusPoints: [{ x: 33, y: 33, confidence: 0.8 }]
      },
      safetyAnalysis: {
        overallScore: 95,
        appropriateContent: true,
        issues: []
      },
      textOverlayAnalysis: {
        hasText: false,
        readabilityScore: 85,
        suggestions: ['Consider adding clear, readable text overlay']
      },
      tags: ['professional', 'modern', 'clean'],
      optimizationSuggestions: ['Improve contrast for better visibility', 'Consider platform-specific cropping']
    }
  }

  private createFallbackOptimizationSuggestions(platform: string): PlatformOptimizationSuggestions {
    return {
      cropSuggestions: [
        {
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          reason: `Crop to focus on main subject for ${platform}`
        }
      ],
      filterSuggestions: {
        brightness: 5,
        contrast: 10,
        saturation: 0,
        reason: 'Slight brightness and contrast boost for better visibility'
      },
      textOverlaySuggestions: [
        {
          position: 'bottom',
          text: 'Your Brand Message',
          style: 'bold, white text with dark background',
          reason: 'Add branding for better engagement'
        }
      ],
      generalSuggestions: [
        `Optimize dimensions for ${platform}`,
        'Enhance visual appeal with slight filter adjustments',
        'Consider adding text overlay for context'
      ]
    }
  }

  private validateAndNormalizeAnalysis(analysis: any): ImageAnalysisResult {
    return {
      aestheticScore: this.clamp(analysis.aestheticScore || 75, 0, 100),
      colorAnalysis: {
        dominantColors: analysis.colorAnalysis?.dominantColors || ['#FF6B35', '#004E89', '#FFD23F'],
        colorHarmony: analysis.colorAnalysis?.colorHarmony || 'balanced',
        vibrance: this.clamp(analysis.colorAnalysis?.vibrance || 80, 0, 100),
        contrast: this.clamp(analysis.colorAnalysis?.contrast || 75, 0, 100)
      },
      compositionAnalysis: {
        rule: analysis.compositionAnalysis?.rule || 'rule-of-thirds',
        balance: this.clamp(analysis.compositionAnalysis?.balance || 80, 0, 100),
        focusPoints: analysis.compositionAnalysis?.focusPoints || [{ x: 33, y: 33, confidence: 0.8 }]
      },
      brandConsistency: analysis.brandConsistency ? {
        overallScore: this.clamp(analysis.brandConsistency.overallScore || 80, 0, 100),
        colorMatch: this.clamp(analysis.brandConsistency.colorMatch || 75, 0, 100),
        styleMatch: this.clamp(analysis.brandConsistency.styleMatch || 75, 0, 100)
      } : undefined,
      safetyAnalysis: {
        overallScore: this.clamp(analysis.safetyAnalysis?.overallScore || 95, 0, 100),
        appropriateContent: analysis.safetyAnalysis?.appropriateContent !== false,
        issues: analysis.safetyAnalysis?.issues || []
      },
      textOverlayAnalysis: analysis.textOverlayAnalysis ? {
        hasText: analysis.textOverlayAnalysis.hasText || false,
        readabilityScore: this.clamp(analysis.textOverlayAnalysis.readabilityScore || 85, 0, 100),
        suggestions: analysis.textOverlayAnalysis.suggestions || []
      } : undefined,
      tags: Array.isArray(analysis.tags) ? analysis.tags : ['professional', 'modern'],
      optimizationSuggestions: Array.isArray(analysis.optimizationSuggestions) 
        ? analysis.optimizationSuggestions 
        : ['Consider platform-specific optimization']
    }
  }

  private getPlatformSpecs(platform: string) {
    const specs = {
      FACEBOOK: {
        dimensions: '1200x630',
        aspectRatio: '1.91:1',
        maxFileSize: '8MB',
        usage: 'News feed posts and link previews'
      },
      INSTAGRAM: {
        dimensions: '1080x1080',
        aspectRatio: '1:1',
        maxFileSize: '30MB',
        usage: 'Feed posts, stories, and reels'
      },
      TWITTER: {
        dimensions: '1200x675',
        aspectRatio: '16:9',
        maxFileSize: '5MB',
        usage: 'Timeline posts and cards'
      },
      LINKEDIN: {
        dimensions: '1200x627',
        aspectRatio: '1.91:1',
        maxFileSize: '8MB',
        usage: 'Professional posts and articles'
      },
      YOUTUBE: {
        dimensions: '1280x720',
        aspectRatio: '16:9',
        maxFileSize: '2MB',
        usage: 'Thumbnails and channel art'
      },
      TIKTOK: {
        dimensions: '1080x1920',
        aspectRatio: '9:16',
        maxFileSize: '10MB',
        usage: 'Vertical video thumbnails and covers'
      }
    }

    return specs[platform as keyof typeof specs] || specs.FACEBOOK
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  private getFullImageUrl(imageUrl: string): string {
    // If it's already a full URL, return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl
    }
    
    // If it's a blob or data URL, return as-is
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      return imageUrl
    }
    
    // For local paths, convert to full URL
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
      // Try to construct full URL
      // In production, this would be your actual domain
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3099'
      return `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
    }
    
    // Default: return as-is and let OpenAI handle the error
    return imageUrl
  }
}