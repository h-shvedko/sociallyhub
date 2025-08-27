import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { socialMediaManager } from '@/services/social-providers'
import { withLogging, ErrorLogger, SecurityLogger } from '@/lib/middleware/logging'
import { z } from 'zod'

const validatePostSchema = z.object({
  text: z.string(),
  platforms: z.array(z.enum(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'])).min(1),
  media: z.array(z.object({
    type: z.enum(['image', 'video', 'gif']),
    size: z.number().optional()
  })).optional()
})

async function handleValidatePost(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/post/validate', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate input
    let validatedData
    try {
      validatedData = validatePostSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Validation failed',
            issues: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Validate post content for each platform
    const validationResults = await socialMediaManager.validatePostForPlatforms(
      validatedData.platforms,
      validatedData
    )

    const validPlatforms = Object.entries(validationResults)
      .filter(([_, result]) => result?.valid)
      .map(([platform, _]) => platform)

    const invalidPlatforms = Object.entries(validationResults)
      .filter(([_, result]) => !result?.valid)
      .map(([platform, result]) => ({
        platform,
        issues: result?.issues || []
      }))

    return NextResponse.json({
      success: true,
      data: {
        validationResults,
        summary: {
          totalPlatforms: validatedData.platforms.length,
          validPlatforms: validPlatforms.length,
          invalidPlatforms: invalidPlatforms.length,
          canPost: validPlatforms.length > 0
        },
        recommendations: generateRecommendations(invalidPlatforms)
      }
    })

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/post/validate',
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateRecommendations(invalidPlatforms: Array<{ platform: string; issues: string[] }>): string[] {
  const recommendations: string[] = []

  for (const { platform, issues } of invalidPlatforms) {
    for (const issue of issues) {
      if (issue.includes('character limit')) {
        recommendations.push(`${platform}: Consider shortening your text or enable thread mode for Twitter`)
      }
      if (issue.includes('media')) {
        recommendations.push(`${platform}: Check media format and size requirements`)
      }
      if (issue.includes('GIF')) {
        recommendations.push(`${platform}: GIFs cannot be mixed with other media types`)
      }
    }
  }

  return [...new Set(recommendations)] // Remove duplicates
}

export const POST = withLogging(handleValidatePost, 'social-post-validate')