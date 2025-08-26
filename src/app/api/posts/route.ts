import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema for post creation/update
const postSchema = z.object({
  title: z.string().optional(),
  content: z.object({
    text: z.string(),
    media: z.array(z.object({
      id: z.string(),
      type: z.enum(['image', 'video']),
      url: z.string(),
      alt: z.string().optional()
    })).optional().default([]),
    link: z.string().optional(),
    hashtags: z.array(z.string()).optional().default([]),
    mentions: z.array(z.string()).optional().default([])
  }),
  platforms: z.array(z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK'])),
  scheduledAt: z.string().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  campaignId: z.string().optional(),
  tags: z.array(z.string()).default([])
})

// GET /api/posts - Fetch posts
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const workspaceId = searchParams.get('workspaceId')

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)
    const targetWorkspaceId = workspaceId && workspaceIds.includes(workspaceId) 
      ? workspaceId 
      : workspaceIds[0] // Default to first workspace

    if (!targetWorkspaceId) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Build where clause
    const where: any = {
      workspaceId: targetWorkspaceId
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase()
    }

    // Fetch posts
    const posts = await prisma.post.findMany({
      where,
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
          where: {
            metricType: { in: ['reach', 'engagement', 'clicks'] }
          },
          select: {
            metricType: true,
            value: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Transform posts for frontend
    const transformedPosts = posts.map(post => ({
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
      variants: post.variants,
      media: post.assets.map(pa => pa.asset),
      metrics: post.metrics.reduce((acc: any, metric) => {
        acc[metric.metricType] = metric.value
        return acc
      }, {})
    }))

    return NextResponse.json({
      posts: transformedPosts,
      pagination: {
        limit,
        offset,
        total: await prisma.post.count({ where })
      }
    })

  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/posts - Create new post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Post creation request body:', JSON.stringify(body, null, 2))
    
    const validatedData = postSchema.parse(body)
    console.log('Validated data:', JSON.stringify(validatedData, null, 2))

    // Get user's primary workspace with posting permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { 
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json(
        { error: 'No workspace with posting permissions' },
        { status: 403 }
      )
    }

    // Get social accounts for selected platforms
    const socialAccounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        provider: { in: validatedData.platforms },
        status: 'ACTIVE'
      }
    })

    // Only require social accounts for published or scheduled posts
    if (socialAccounts.length === 0 && ['PUBLISHED', 'SCHEDULED'].includes(validatedData.status)) {
      return NextResponse.json(
        { error: 'No active social accounts found for selected platforms. Please connect your social media accounts first.' },
        { status: 400 }
      )
    }

    // Create post in database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create main post
      const post = await tx.post.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          title: validatedData.title,
          baseContent: validatedData.content.text,
          status: validatedData.status as any,
          ownerId: session.user.id,
          scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : null,
          tags: validatedData.tags,
          campaignId: validatedData.campaignId
        }
      })

      // Create post variants for each platform (only if we have social accounts)
      if (socialAccounts.length > 0) {
        const variantPromises = socialAccounts.map(account => {
          const platformText = customizeContentForPlatform(
            validatedData.content.text,
            account.provider,
            validatedData.content.hashtags || []
          )

          return tx.postVariant.create({
            data: {
              postId: post.id,
              socialAccountId: account.id,
              text: platformText,
              hashtags: validatedData.content.hashtags || [],
              platformData: getPlatformSpecificData(validatedData.content, account.provider),
              status: validatedData.status === 'PUBLISHED' ? 'PENDING' : 'PENDING'
            }
          })
        })

        await Promise.all(variantPromises)
      }

      // Handle media assets (if any)
      if (validatedData.content.media && validatedData.content.media.length > 0) {
        // Create placeholder assets for media that doesn't exist in database yet
        const assetIds: string[] = []
        
        for (const media of validatedData.content.media) {
          // Check if asset already exists
          let existingAsset = await tx.asset.findUnique({
            where: { id: media.id },
            select: { id: true }
          })
          
          if (!existingAsset) {
            // Create placeholder asset for blob URLs
            const placeholderAsset = await tx.asset.create({
              data: {
                id: media.id, // Use the frontend-provided ID
                workspaceId: userWorkspace.workspaceId,
                filename: `placeholder-${media.id}`,
                originalName: `image.${media.type === 'image' ? 'jpg' : 'mp4'}`,
                mimeType: media.type === 'image' ? 'image/jpeg' : 'video/mp4',
                size: 0, // Placeholder size
                url: media.url, // Keep the blob URL temporarily
                width: null,
                height: null,
                duration: null,
                metadata: { isPlaceholder: true, originalUrl: media.url },
                tags: []
              }
            })
            console.log('Created placeholder asset:', placeholderAsset.id)
            assetIds.push(placeholderAsset.id)
          } else {
            assetIds.push(existingAsset.id)
          }
        }

        // Create asset links
        if (assetIds.length > 0) {
          const assetLinks = assetIds.map(assetId => ({
            postId: post.id,
            assetId: assetId
          }))
          
          await tx.postAsset.createMany({
            data: assetLinks,
            skipDuplicates: true
          })

          console.log('Created asset links:', assetLinks.length)
        }
      }

      return post
    })

    // If status is PUBLISHED or SCHEDULED, trigger background job
    if (validatedData.status === 'PUBLISHED') {
      // TODO: Trigger immediate publishing job
      console.log('Triggering immediate publish for post:', result.id)
    } else if (validatedData.status === 'SCHEDULED' && validatedData.scheduledAt) {
      // TODO: Schedule background job
      console.log('Scheduling post for:', validatedData.scheduledAt)
    }

    return NextResponse.json({
      success: true,
      post: {
        id: result.id,
        status: result.status,
        scheduledAt: result.scheduledAt,
        createdAt: result.createdAt
      }
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error creating post:', error.errors)
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating post:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper functions
function customizeContentForPlatform(
  baseContent: string,
  platform: string,
  hashtags: string[] = []
): string {
  let content = baseContent

  // Platform-specific customizations
  switch (platform) {
    case 'TWITTER':
      // Ensure content fits in character limit
      const hashtagLength = hashtags.length > 0 ? hashtags.join(' #').length + 1 : 0
      const maxLength = 280 - hashtagLength
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
      platformData.title = content.text.split('\n')[0] || 'Untitled Video'
      platformData.description = content.text
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