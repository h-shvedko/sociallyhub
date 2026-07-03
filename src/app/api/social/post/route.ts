import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { socialMediaManager } from '@/services/social-providers'
import { enqueuePublishJob } from '@/lib/jobs/publish-queue'
import { withLogging, BusinessLogger, ErrorLogger, SecurityLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { z } from 'zod'

// Validation schema for post creation
const createPostSchema = z.object({
  text: z.string().min(1, 'Post text is required').max(10000, 'Post text too long'),
  platforms: z.array(z.enum(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'])).min(1, 'At least one platform is required'),
  media: z.array(z.object({
    id: z.string(),
    type: z.enum(['image', 'video', 'gif']),
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    altText: z.string().optional(),
    duration: z.number().optional(),
    size: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional()
  })).optional(),
  scheduledFor: z.string().datetime().optional(),
  location: z.object({
    name: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }).optional(),
    placeId: z.string().optional()
  }).optional(),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  platformSpecificSettings: z.object({
    twitter: z.object({
      threadMode: z.boolean().optional(),
      replyToTweetId: z.string().optional(),
      quoteTweetId: z.string().optional()
    }).optional(),
    facebook: z.object({
      privacySettings: z.enum(['PUBLIC', 'FRIENDS', 'CUSTOM']).optional()
    }).optional(),
    instagram: z.object({
      altText: z.string().optional(),
      locationId: z.string().optional()
    }).optional(),
    linkedin: z.object({
      visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN_MEMBERS']).optional()
    }).optional(),
    tiktok: z.object({
      privacy: z.enum(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIEND', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY']).optional(),
      allowComments: z.boolean().optional(),
      allowDuet: z.boolean().optional(),
      allowStitch: z.boolean().optional()
    }).optional(),
    youtube: z.object({
      privacy: z.enum(['public', 'unlisted', 'private']).optional(),
      categoryId: z.string().optional(),
      tags: z.array(z.string()).optional(),
      description: z.string().optional(),
      thumbnail: z.string().optional()
    }).optional()
  }).optional()
})

const validatePostSchema = z.object({
  text: z.string(),
  platforms: z.array(z.enum(['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'])).min(1),
  media: z.array(z.object({
    type: z.enum(['image', 'video', 'gif']),
    size: z.number().optional()
  })).optional()
})

async function handleCreatePost(request: NextRequest) {
  const timer = PerformanceLogger.startTimer('create_social_post')
  
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/post', 
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
      validatedData = createPostSchema.parse(body)
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
    try {
      const validationResults = await socialMediaManager.validatePostForPlatforms(
        validatedData.platforms,
        validatedData
      )

      const validationIssues: string[] = []
      let hasValidPlatform = false

      for (const [platform, result] of Object.entries(validationResults)) {
        if (!result?.valid) {
          validationIssues.push(`${platform}: ${result?.issues?.join(', ') || 'Validation failed'}`)
        } else {
          hasValidPlatform = true
        }
      }

      if (!hasValidPlatform) {
        return NextResponse.json({
          error: 'Post validation failed for all platforms',
          validationResults,
          issues: validationIssues
        }, { status: 400 })
      }

      // Filter out platforms that failed validation
      const validPlatforms = validatedData.platforms.filter(
        platform => validationResults[platform]?.valid
      )

      if (validPlatforms.length !== validatedData.platforms.length) {
        BusinessLogger.logPostCreated(
          'validation_filtered',
          session.user.id,
          {
            originalPlatforms: validatedData.platforms,
            validPlatforms,
            filteredOut: validatedData.platforms.filter(p => !validPlatforms.includes(p))
          }
        )
      }

      // Route bulk publishing through the DB-backed queue/processor path
      // (ADR-0008) instead of socialMediaManager.bulkPost with in-memory
      // accounts: persist a Post + one PostVariant per resolved account, then
      // enqueue a single publish job. The worker resolves accounts/tokens from
      // the DB and records the true per-variant outcome — it never posts from an
      // in-process account map that only the OAuth-callback process ever filled.
      const userId = await normalizeUserId(session.user.id)

      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId,
          role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] },
        },
        select: { workspaceId: true },
      })

      if (!userWorkspace) {
        return NextResponse.json(
          { error: 'No workspace with posting permissions' },
          { status: 403 }
        )
      }

      // createPostSchema platforms are lowercase; SocialProvider is uppercase.
      const providers = validPlatforms.map(p => p.toUpperCase())

      const socialAccounts = await prisma.socialAccount.findMany({
        where: {
          workspaceId: userWorkspace.workspaceId,
          provider: { in: providers as any },
          status: 'ACTIVE',
        },
      })

      if (socialAccounts.length === 0) {
        return NextResponse.json(
          {
            error:
              'No active social accounts found for the selected platforms. Please connect your accounts first.',
          },
          { status: 400 }
        )
      }

      const scheduledAt = validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null
      const postStatus = scheduledAt ? 'SCHEDULED' : 'PUBLISHED'

      const post = await prisma.$transaction(async (tx) => {
        const created = await tx.post.create({
          data: {
            workspaceId: userWorkspace.workspaceId,
            baseContent: validatedData.text,
            status: postStatus as any,
            ownerId: userId,
            scheduledAt,
            tags: validatedData.hashtags ?? [],
          },
        })

        await Promise.all(
          socialAccounts.map(account =>
            tx.postVariant.create({
              data: {
                postId: created.id,
                socialAccountId: account.id,
                text: validatedData.text,
                hashtags: validatedData.hashtags ?? [],
                // Media (already-uploaded URLs) and per-platform settings ride in
                // platformData so the DB-backed processor can consume them without
                // fabricating Asset rows here (asset handling is ADR-0007/0009).
                platformData: {
                  ...(validatedData.platformSpecificSettings?.[
                    account.provider.toLowerCase() as keyof typeof validatedData.platformSpecificSettings
                  ] ?? {}),
                  ...(validatedData.media ? { media: validatedData.media } : {}),
                } as any,
                status: 'PENDING',
              },
            })
          )
        )

        return created
      })

      // Enqueue after commit; roll back to DRAFT if it fails (ADR-0008 step 3).
      try {
        await enqueuePublishJob({
          postId: post.id,
          workspaceId: userWorkspace.workspaceId,
          userId,
          scheduledAt,
        })
      } catch (enqueueError) {
        await prisma.post
          .update({ where: { id: post.id }, data: { status: 'DRAFT' } })
          .catch(() => {})

        ErrorLogger.logUnexpectedError(enqueueError as Error, {
          operation: 'enqueue_publish_job',
          postId: post.id,
          userId,
        })

        timer.end({ error: true, enqueueFailed: true })

        return NextResponse.json(
          {
            error:
              'Post saved as a draft, but it could not be queued for publishing. Please try again.',
          },
          { status: 503 }
        )
      }

      const results = socialAccounts.map(account => ({
        platform: account.provider.toLowerCase(),
        accountId: account.id,
        success: true,
        status: 'queued' as const,
      }))

      BusinessLogger.logBulkOperation(
        'bulk_post_queued',
        results.length,
        userId,
        {
          postId: post.id,
          platforms: results.map(r => r.platform),
          scheduled: postStatus === 'SCHEDULED',
        }
      )

      timer.end({
        platformCount: results.length,
        queued: results.length,
        scheduled: postStatus === 'SCHEDULED',
      })

      return NextResponse.json({
        success: true,
        data: {
          postId: post.id,
          status: postStatus === 'SCHEDULED' ? 'scheduled' : 'queued',
          results,
          summary: {
            total: results.length,
            successful: results.length,
            failed: 0,
            queued: results.length,
            validationIssues: validationIssues.length > 0 ? validationIssues : undefined,
          },
        },
      })

    } catch (error) {
      timer.end({ error: true })
      
      ErrorLogger.logExternalServiceError(
        'social_media_manager',
        error as Error,
        { 
          userId: session.user.id, 
          operation: 'bulk_post',
          platforms: validatedData.platforms
        }
      )

      return NextResponse.json(
        { 
          error: 'Failed to create posts',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    timer.end({ error: true })
    
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/post',
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    return NextResponse.json({
      success: true,
      data: {
        validationResults,
        summary: {
          totalPlatforms: validatedData.platforms.length,
          validPlatforms: Object.values(validationResults).filter(r => r?.valid).length,
          invalidPlatforms: Object.values(validationResults).filter(r => !r?.valid).length
        }
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

// Export wrapped handlers
export const POST = withLogging(handleCreatePost, 'social-post-create')

// For validation endpoint, we'll create a separate route file