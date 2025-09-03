import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { socialMediaManager } from '@/services/social-providers'
import { withLogging, BusinessLogger, ErrorLogger, SecurityLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { z } from 'zod'

const uploadSchema = z.object({
  platform: z.enum(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']),
  accountId: z.string(),
  media: z.object({
    id: z.string(),
    type: z.enum(['image', 'video', 'gif']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    altText: z.string().optional(),
    duration: z.number().optional(),
    size: z.number(),
    width: z.number().optional(),
    height: z.number().optional()
  })
})

const MAX_FILE_SIZES = {
  twitter: {
    image: 5 * 1024 * 1024, // 5MB
    video: 512 * 1024 * 1024, // 512MB
    gif: 15 * 1024 * 1024 // 15MB
  },
  facebook: {
    image: 4 * 1024 * 1024, // 4MB
    video: 4 * 1024 * 1024 * 1024, // 4GB
    gif: 8 * 1024 * 1024 // 8MB
  },
  instagram: {
    image: 8 * 1024 * 1024, // 8MB
    video: 100 * 1024 * 1024, // 100MB
    gif: 8 * 1024 * 1024 // 8MB
  },
  linkedin: {
    image: 20 * 1024 * 1024, // 20MB
    video: 5 * 1024 * 1024 * 1024, // 5GB
    gif: 20 * 1024 * 1024 // 20MB
  },
  tiktok: {
    video: 500 * 1024 * 1024, // 500MB
    image: 10 * 1024 * 1024, // 10MB
    gif: 10 * 1024 * 1024 // 10MB
  },
  youtube: {
    video: 128 * 1024 * 1024 * 1024, // 128GB
    image: 2 * 1024 * 1024, // 2MB (thumbnails)
    gif: 2 * 1024 * 1024 // 2MB
  }
}

async function handleMediaUpload(request: NextRequest) {
  const timer = PerformanceLogger.startTimer('upload_social_media')
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/media/upload', 
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
      validatedData = uploadSchema.parse(body)
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

    // Validate file size
    const maxSize = MAX_FILE_SIZES[validatedData.platform]?.[validatedData.media.type]
    if (maxSize && validatedData.media.size > maxSize) {
      return NextResponse.json({
        error: 'File size exceeds platform limits',
        details: {
          platform: validatedData.platform,
          type: validatedData.media.type,
          size: validatedData.media.size,
          maxSize,
          maxSizeMB: Math.round(maxSize / (1024 * 1024))
        }
      }, { status: 400 })
    }

    try {
      const result = await socialMediaManager.uploadMedia(
        validatedData.platform,
        validatedData.accountId,
        validatedData.media
      )

      if (!result.success) {
        ErrorLogger.logExternalServiceError(
          validatedData.platform,
          new Error(result.error || 'Media upload failed'),
          { 
            userId: session.user.id, 
            operation: 'upload_media',
            platform: validatedData.platform,
            accountId: validatedData.accountId,
            mediaType: validatedData.media.type,
            mediaSize: validatedData.media.size
          }
        )

        return NextResponse.json({
          success: false,
          error: result.error || 'Media upload failed'
        }, { status: 400 })
      }

      BusinessLogger.logMediaUpload(
        result.data?.mediaId || validatedData.media.id,
        session.user.id,
        `${validatedData.media.type}_upload`,
        validatedData.media.size
      )

      timer.end({
        platform: validatedData.platform,
        mediaType: validatedData.media.type,
        fileSize: validatedData.media.size,
        success: true
      })

      return NextResponse.json({
        success: true,
        data: {
          mediaId: result.data?.mediaId,
          platform: validatedData.platform,
          type: validatedData.media.type,
          originalId: validatedData.media.id,
          uploadedAt: new Date().toISOString()
        }
      })

    } catch (error) {
      timer.end({ 
        platform: validatedData.platform,
        mediaType: validatedData.media.type,
        error: true 
      })
      
      ErrorLogger.logExternalServiceError(
        validatedData.platform,
        error as Error,
        { 
          userId: session.user.id, 
          operation: 'upload_media',
          platform: validatedData.platform,
          accountId: validatedData.accountId
        }
      )

      return NextResponse.json(
        { 
          error: 'Failed to upload media',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    timer.end({ error: true })
    
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/media/upload',
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleGetMediaLimits(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/media/upload', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Convert byte sizes to MB for easier understanding
    const limitsInMB = Object.fromEntries(
      Object.entries(MAX_FILE_SIZES).map(([platform, limits]) => [
        platform,
        Object.fromEntries(
          Object.entries(limits).map(([type, size]) => [
            type,
            {
              bytes: size,
              mb: Math.round(size / (1024 * 1024)),
              gb: size >= 1024 * 1024 * 1024 ? Math.round(size / (1024 * 1024 * 1024)) : 0
            }
          ])
        )
      ])
    )

    return NextResponse.json({
      success: true,
      data: {
        limits: limitsInMB,
        supportedPlatforms: socialMediaManager.getSupportedPlatforms(),
        supportedMediaTypes: ['image', 'video', 'gif'],
        recommendations: [
          'Optimize images for web to reduce file size',
          'Use MP4 format for videos when possible',
          'Consider platform-specific aspect ratios',
          'Add alt text for accessibility'
        ]
      }
    })

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/media/upload',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(handleMediaUpload, 'social-media-upload')
export const GET = withLogging(handleGetMediaLimits, 'social-media-limits')