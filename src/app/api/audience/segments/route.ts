import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { AudienceSegmentation } from '@/lib/audience/audience-segmentation'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const createSegmentationSchema = z.object({
  timeframe: z.string().default('90d'),
  minSegmentSize: z.number().min(10).max(1000).default(50),
  maxSegments: z.number().min(2).max(10).default(6)
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Get existing audience segments
    const segments = await prisma.audienceSegment.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' },
      include: {
        contentRecommendations: {
          where: { status: 'PENDING' },
          take: 3
        },
        postingRecommendations: {
          take: 5
        }
      }
    })

    // Calculate segment performance metrics
    const segmentsWithMetrics = await Promise.all(
      segments.map(async (segment) => {
        const recentRecommendations = await prisma.contentRecommendation.findMany({
          where: {
            segmentId: segment.id,
            status: 'IMPLEMENTED',
            actualPerformance: { not: null }
          },
          take: 10,
          orderBy: { createdAt: 'desc' }
        })

        const avgPerformance = recentRecommendations.length > 0
          ? recentRecommendations.reduce((sum, rec) => {
              const performance = rec.actualPerformance as any
              return sum + (performance?.engagement || 0)
            }, 0) / recentRecommendations.length
          : null

        return {
          ...segment,
          performanceMetrics: {
            avgActualPerformance: avgPerformance,
            implementedRecommendations: recentRecommendations.length,
            pendingRecommendations: segment.contentRecommendations.length
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      segments: segmentsWithMetrics,
      totalSegments: segments.length,
      totalAudienceSize: segments.reduce((sum, s) => sum + (s.actualSize || s.estimatedSize), 0)
    })

  } catch (error) {
    console.error('Get audience segments error:', error)
    return NextResponse.json(
      { error: 'Failed to get audience segments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { timeframe, minSegmentSize, maxSegments } = createSegmentationSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize audience segmentation
    const audienceSegmentation = new AudienceSegmentation()

    // Perform audience clustering
    const result = await audienceSegmentation.clusterAudience({
      workspaceId: userWorkspace.workspaceId,
      timeframe,
      minSegmentSize,
      maxSegments
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.message,
        recommendations: result.recommendations
      }, { status: 400 })
    }

    // Generate initial recommendations for each segment
    const segmentRecommendations = await Promise.all(
      result.segments.map(async (segment) => {
        try {
          const recommendations = await audienceSegmentation.generatePersonalizedRecommendations({
            workspaceId: userWorkspace.workspaceId,
            segmentId: segment.id
          })
          return { segmentId: segment.id, recommendations }
        } catch (error) {
          console.error(`Failed to generate recommendations for segment ${segment.id}:`, error)
          return { segmentId: segment.id, recommendations: [] }
        }
      })
    )

    return NextResponse.json({
      success: true,
      segments: result.segments,
      insights: result.insights,
      recommendations: result.recommendations,
      segmentRecommendations,
      message: `Successfully created ${result.segments.length} audience segments`
    })

  } catch (error) {
    console.error('Create audience segments error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create audience segments' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize audience segmentation
    const audienceSegmentation = new AudienceSegmentation()

    // Update all segments with fresh data
    await audienceSegmentation.updateAudienceSegments(userWorkspace.workspaceId)

    return NextResponse.json({
      success: true,
      message: 'Audience segments updated successfully'
    })

  } catch (error) {
    console.error('Update audience segments error:', error)
    return NextResponse.json(
      { error: 'Failed to update audience segments' },
      { status: 500 }
    )
  }
}