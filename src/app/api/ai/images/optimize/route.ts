import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { ImageOptimizer } from '@/lib/visual/image-optimizer'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ratelimit } from '@/lib/utils/rate-limit'

const optimizeImageSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  platforms: z.array(z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK'])),
  optimizations: z.array(z.enum(['resize', 'crop', 'filter', 'watermark', 'quality'])).default(['resize']),
  brandGuidelineId: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    const identifier = session.user.id
    const { success } = await ratelimit.limit(identifier)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { imageUrl, platforms, optimizations, brandGuidelineId } = optimizeImageSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize image optimizer
    const optimizer = new ImageOptimizer()

    // Optimize for each platform
    const optimizationResults = []

    for (const platform of platforms) {
      try {
        const result = await optimizer.optimizeForPlatform(imageUrl, platform, {
          optimizations,
          brandGuidelineId
        })

        optimizationResults.push({
          platform,
          ...result
        })

        // Save optimization to database
        await prisma.imageOptimization.create({
          data: {
            workspaceId: userWorkspace.workspaceId,
            userId: session.user.id,
            originalImageUrl: imageUrl,
            optimizedImageUrl: result.optimizedImageUrl,
            platform,
            optimizationSettings: {
              optimizations,
              brandGuidelineId
            } as any,
            performanceImpact: result.performanceImpact as any,
            qualityScore: result.qualityScore
          }
        })
      } catch (error) {
        console.error(`Optimization failed for platform ${platform}:`, error)
        optimizationResults.push({
          platform,
          error: `Optimization failed for ${platform}`,
          success: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      results: optimizationResults
    })

  } catch (error) {
    console.error('Image optimization error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to optimize image' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Get recent optimizations for user
    const optimizations = await prisma.imageOptimization.findMany({
      where: {
        userId: session.user.id,
        ...(platform && { platform: platform as any })
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      optimizations
    })

  } catch (error) {
    console.error('Get image optimizations error:', error)
    return NextResponse.json(
      { error: 'Failed to get optimizations' },
      { status: 500 }
    )
  }
}