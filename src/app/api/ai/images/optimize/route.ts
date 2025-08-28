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

    // Ensure user exists in database (same as image analysis fix)
    let existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!existingUser) {
      existingUser = await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email || 'unknown@sociallyhub.com',
          name: session.user.name || 'User',
          emailVerified: new Date()
        }
      })
    }

    // Rate limiting
    const identifier = session.user.id
    const { success } = await ratelimit.limit(identifier)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { imageUrl, platforms, optimizations, brandGuidelineId } = optimizeImageSchema.parse(body)

    // Get user's workspace or create one
    let userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      // Create a default workspace for any user without one
      let defaultWorkspace
      
      if (session.user.email === 'demo@sociallyhub.com' || session.user.id === 'demo-user-id') {
        // For demo users, use shared Demo Workspace
        defaultWorkspace = await prisma.workspace.findFirst({
          where: { name: 'Demo Workspace' }
        })
        
        if (!defaultWorkspace) {
          defaultWorkspace = await prisma.workspace.create({
            data: { name: 'Demo Workspace' }
          })
        }
      } else {
        // For regular users, create personal workspace
        defaultWorkspace = await prisma.workspace.create({
          data: { name: `${session.user.name || session.user.email}'s Workspace` }
        })
      }
      
      // Always ensure UserWorkspace relationship exists
      let existingUserWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: session.user.id,
          workspaceId: defaultWorkspace.id
        }
      })
      
      if (!existingUserWorkspace) {
        await prisma.userWorkspace.create({
          data: {
            userId: session.user.id,
            workspaceId: defaultWorkspace.id,
            role: 'OWNER',
            permissions: {}
          }
        })
      }
      
      userWorkspace = await prisma.userWorkspace.findFirst({
        where: { 
          userId: session.user.id,
          workspaceId: defaultWorkspace.id 
        },
        include: { workspace: true }
      })
    }

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Could not access workspace' }, { status: 404 })
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

        // Create asset record for the original image first
        const originalAsset = await prisma.asset.create({
          data: {
            workspaceId: userWorkspace.workspaceId,
            filename: `optimization-original-${Date.now()}.jpg`,
            originalName: `optimization-original-${Date.now()}.jpg`, 
            mimeType: 'image/jpeg',
            size: 1024, // Default size since we don't have the actual file
            url: imageUrl,
            width: 800, // Default dimensions
            height: 600,
            metadata: {
              source: 'image-optimization',
              originalUrl: imageUrl
            }
          }
        })

        // Save optimization to database (note: correct table name is image_optimizations)
        await prisma.imageOptimizations.create({
          data: {
            originalAssetId: originalAsset.id,
            workspaceId: userWorkspace.workspaceId,
            platform: platform as any,
            sizeBefore: 1024, // Mock original size
            sizeAfter: 900,   // Mock optimized size
            compressionLevel: 0.9,
            format: 'JPEG',
            cropped: optimizations.includes('crop'),
            resized: optimizations.includes('resize'),
            compressed: optimizations.includes('quality'),
            filtered: optimizations.includes('filter'),
            textOverlay: optimizations.includes('watermark'),
            qualityScore: result.qualityScore,
            loadTimeImprovement: result.performanceImpact?.loadTimeImprovement,
            engagementPredict: null
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

    // Ensure user exists in database
    let existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!existingUser) {
      existingUser = await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email || 'unknown@sociallyhub.com',
          name: session.user.name || 'User',
          emailVerified: new Date()
        }
      })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // Get workspace for user
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ 
        success: true,
        optimizations: [] 
      })
    }
    
    // Get recent optimizations for user (note: correct table name)
    const optimizations = await prisma.imageOptimizations.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
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