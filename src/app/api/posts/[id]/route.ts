import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { withLogging, BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { AppLogger } from '@/lib/logger'

const updatePostSchema = z.object({
  title: z.string().optional(),
  content: z.object({
    text: z.string(),
    media: z.array(z.object({
      id: z.string(),
      type: z.enum(['image', 'video']),
      url: z.string(),
      alt: z.string().optional()
    })).optional(),
    link: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional()
  }).optional(),
  baseContent: z.string().optional(), // For backward compatibility
  platforms: z.array(z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK'])).optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  scheduledAt: z.string().optional(),
  tags: z.array(z.string()).optional()
})

// GET /api/posts/[id] - Get single post
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: postId } = await params

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        workspaceId: { in: workspaceIds }
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true }
        },
        approver: {
          select: { id: true, name: true, email: true }
        },
        variants: {
          include: {
            socialAccount: {
              select: { 
                id: true, 
                provider: true, 
                handle: true, 
                displayName: true 
              }
            }
          }
        },
        assets: {
          include: {
            asset: true
          }
        },
        campaign: {
          select: { id: true, name: true }
        },
        metrics: {
          select: {
            metricType: true,
            value: true,
            date: true
          }
        }
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Transform post for frontend
    const transformedPost = {
      id: post.id,
      title: post.title,
      baseContent: post.baseContent,
      status: post.status,
      ownerId: post.ownerId,
      owner: post.owner,
      approver: post.approver,
      scheduledAt: post.scheduledAt,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      tags: post.tags,
      campaign: post.campaign,
      platforms: post.variants.map(v => v.socialAccount.provider),
      variants: post.variants.map(variant => ({
        id: variant.id,
        text: variant.text,
        hashtags: variant.hashtags,
        status: variant.status,
        publishedAt: variant.publishedAt,
        failureReason: variant.failureReason,
        socialAccount: variant.socialAccount,
        platformData: variant.platformData
      })),
      media: post.assets.map(pa => pa.asset),
      metrics: post.metrics
    }

    return NextResponse.json({ post: transformedPost })

  } catch (error) {
    const session = await getServerSession(authOptions)
    ErrorLogger.logUnexpectedError(error as Error, {
      operation: 'fetch_single_post',
      userId: session?.user?.id,
      postId: (await params).id
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'posts-get-single')

// PUT /api/posts/[id] - Update post
async function putHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: postId } = await params
    const body = await request.json()
    const validatedData = updatePostSchema.parse(body)
    
    const timer = PerformanceLogger.startTimer('post_update')

    // Get user's workspaces with posting permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { 
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Find the post and verify ownership/permissions
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        workspaceId: { in: workspaceIds }
      }
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if post can be edited (allow archiving/unarchiving published posts)
    if (existingPost.status === 'PUBLISHED' && validatedData.status !== 'ARCHIVED') {
      return NextResponse.json(
        { error: 'Cannot edit published posts except to archive them' },
        { status: 400 }
      )
    }

    // Extract content text from either new format or legacy format
    const contentText = validatedData.content?.text || validatedData.baseContent

    // Update post in a transaction to handle media
    const updatedPost = await prisma.$transaction(async (tx) => {
      // Update the post
      const post = await tx.post.update({
        where: { id: postId },
        data: {
          ...(validatedData.title !== undefined && { title: validatedData.title }),
          ...(contentText !== undefined && { baseContent: contentText }),
          ...(validatedData.status !== undefined && { status: validatedData.status as any }),
          ...(validatedData.scheduledAt !== undefined && { 
            scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null 
          }),
          ...(validatedData.tags !== undefined && { tags: validatedData.tags }),
          updatedAt: new Date()
        }
      })

      // Handle media updates
      if (validatedData.content?.media !== undefined) {
        // First, remove all existing media links
        await tx.postAsset.deleteMany({
          where: { postId }
        })

        // Then add new media links if any
        if (validatedData.content.media.length > 0) {
          // Verify that the asset IDs exist and belong to the user's workspace
          const existingAssets = await tx.asset.findMany({
            where: {
              id: { in: validatedData.content.media.map((media: any) => media.id) },
              workspaceId: { in: workspaceIds }
            },
            select: { id: true }
          })

          if (existingAssets.length > 0) {
            const assetLinks = existingAssets.map(asset => ({
              postId,
              assetId: asset.id
            }))
            
            await tx.postAsset.createMany({
              data: assetLinks,
              skipDuplicates: true
            })
          }
        }
      }

      return post
    })

    // If updating content or platforms, update variants
    if (contentText || validatedData.platforms) {
      if (validatedData.platforms && validatedData.platforms.length > 0) {
        // Get social accounts for selected platforms
        const socialAccounts = await prisma.socialAccount.findMany({
          where: {
            workspaceId: { in: workspaceIds },
            provider: { in: validatedData.platforms },
            status: 'ACTIVE'
          }
        })

        // Delete existing variants and create new ones
        await prisma.postVariant.deleteMany({
          where: { postId: postId }
        })

        // Create new variants for each platform
        const variantPromises = socialAccounts.map(account => {
          const platformText = customizeContentForPlatform(
            contentText || '',
            account.provider,
            validatedData.content?.hashtags || []
          )

          return prisma.postVariant.create({
            data: {
              postId: postId,
              socialAccountId: account.id,
              text: platformText,
              hashtags: validatedData.content?.hashtags || [],
              platformData: getPlatformSpecificData(validatedData.content || {}, account.provider),
              status: validatedData.status === 'PUBLISHED' ? 'PENDING' : 'PENDING'
            }
          })
        })

        await Promise.all(variantPromises)
      } else if (contentText) {
        // Just update existing variants with new text
        await prisma.postVariant.updateMany({
          where: { postId: postId },
          data: {
            text: contentText,
            hashtags: validatedData.content?.hashtags || [],
            updatedAt: new Date()
          }
        })
      }
    }

    // Log the update
    BusinessLogger.logPostUpdated(updatedPost.id, session.user.id, {
      fieldsChanged: Object.keys(validatedData),
      newStatus: validatedData.status,
      contentUpdated: !!contentText
    })
    
    timer.end({ postId: updatedPost.id, status: updatedPost.status })

    return NextResponse.json({
      success: true,
      post: {
        id: updatedPost.id,
        status: updatedPost.status,
        scheduledAt: updatedPost.scheduledAt,
        updatedAt: updatedPost.updatedAt
      }
    })

  } catch (error) {
    const session = await getServerSession(authOptions)
    
    if (error instanceof z.ZodError) {
      ErrorLogger.logValidationError(error, {
        operation: 'update_post',
        userId: session?.user?.id,
        postId: (await params).id,
        body
      })
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    ErrorLogger.logUnexpectedError(error as Error, {
      operation: 'update_post',
      userId: session?.user?.id,
      postId: (await params).id,
      body
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const PUT = withLogging(putHandler, 'posts-update')

// DELETE /api/posts/[id] - Delete post
async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: postId } = await params

    // Get user's workspaces with delete permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { 
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] }
      },
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    // Find the post and verify ownership/permissions
    const existingPost = await prisma.post.findFirst({
      where: {
        id: postId,
        workspaceId: { in: workspaceIds }
      }
    })

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if post can be deleted
    if (existingPost.status === 'PUBLISHED' || existingPost.status === 'ARCHIVED') {
      return NextResponse.json(
        { error: 'Cannot delete published or archived posts' },
        { status: 400 }
      )
    }

    // Log the deletion before deleting
    BusinessLogger.logPostDeleted(postId, session.user.id)
    
    // Delete post (variants and other related records will be cascade deleted)
    await prisma.post.delete({
      where: { id: postId }
    })

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully'
    })

  } catch (error) {
    const session = await getServerSession(authOptions)
    ErrorLogger.logUnexpectedError(error as Error, {
      operation: 'delete_post',
      userId: session?.user?.id,
      postId: (await params).id
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const DELETE = withLogging(deleteHandler, 'posts-delete')

// Helper functions
function customizeContentForPlatform(
  baseContent: string,
  platform: string,
  hashtags: string[]
): string {
  let content = baseContent

  // Platform-specific customizations
  switch (platform) {
    case 'TWITTER':
      // Ensure content fits in character limit
      const maxLength = 280 - hashtags.join(' #').length - 1
      if (content.length > maxLength) {
        content = content.substring(0, maxLength - 3) + '...'
      }
      break
    
    case 'LINKEDIN':
      // Add professional tone adjustments if needed
      break
    
    case 'INSTAGRAM':
      // Instagram-specific hashtag formatting
      break
  }

  return content
}

function getPlatformSpecificData(content: any, platform: string): any {
  const platformData: any = {}

  switch (platform) {
    case 'YOUTUBE':
      platformData.title = content.text?.split('\n')[0] || 'Untitled Video'
      platformData.description = content.text || ''
      break
    
    case 'LINKEDIN':
      platformData.isCompanyPost = false
      break
    
    case 'INSTAGRAM':
      platformData.altText = content.media?.[0]?.alt || ''
      break
  }

  return platformData
}