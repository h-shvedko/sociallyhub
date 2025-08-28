import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { AudienceSegmentation } from '@/lib/audience/audience-segmentation'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const generateRecommendationsSchema = z.object({
  segmentId: z.string(),
  contentGoal: z.enum(['engagement', 'reach', 'conversion', 'awareness']).default('engagement'),
  count: z.number().min(1).max(10).default(5)
})

const updateRecommendationSchema = z.object({
  recommendationId: z.string(),
  status: z.enum(['ACCEPTED', 'REJECTED', 'IMPLEMENTED']),
  feedback: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get('segmentId')
    const status = searchParams.get('status')
    
    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const whereClause: any = {
      workspaceId: userWorkspace.workspaceId
    }

    if (segmentId) {
      whereClause.segmentId = segmentId
    }

    if (status) {
      whereClause.status = status
    }

    const recommendations = await prisma.contentRecommendation.findMany({
      where: whereClause,
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            description: true,
            estimatedSize: true,
            actualSize: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    // Group by segment for better organization
    const groupedRecommendations = recommendations.reduce((acc: any, rec) => {
      const segmentName = rec.segment.name
      if (!acc[segmentName]) {
        acc[segmentName] = {
          segment: rec.segment,
          recommendations: []
        }
      }
      acc[segmentName].recommendations.push(rec)
      return acc
    }, {})

    // Calculate performance statistics
    const implementedRecs = recommendations.filter(r => r.status === 'IMPLEMENTED' && r.actualPerformance)
    const avgPerformance = implementedRecs.length > 0
      ? implementedRecs.reduce((sum, r) => {
          const perf = r.actualPerformance as any
          return sum + (perf?.engagement || 0)
        }, 0) / implementedRecs.length
      : 0

    const stats = {
      total: recommendations.length,
      pending: recommendations.filter(r => r.status === 'PENDING').length,
      accepted: recommendations.filter(r => r.status === 'ACCEPTED').length,
      implemented: implementedRecs.length,
      avgPerformance: Math.round(avgPerformance * 10000) / 100 // Convert to percentage
    }

    return NextResponse.json({
      success: true,
      recommendations: groupedRecommendations,
      stats,
      totalRecommendations: recommendations.length
    })

  } catch (error) {
    console.error('Get recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
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
    const { segmentId, contentGoal, count } = generateRecommendationsSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize audience segmentation
    const audienceSegmentation = new AudienceSegmentation()

    // Generate personalized recommendations
    const recommendations = await audienceSegmentation.generatePersonalizedRecommendations({
      workspaceId: userWorkspace.workspaceId,
      segmentId,
      contentGoal
    })

    return NextResponse.json({
      success: true,
      recommendations: recommendations.slice(0, count),
      segmentId,
      contentGoal,
      generated: recommendations.length
    })

  } catch (error) {
    console.error('Generate recommendations error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
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

    const body = await request.json()
    const { recommendationId, status, feedback } = updateRecommendationSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Update recommendation status
    const recommendation = await prisma.contentRecommendation.update({
      where: {
        id: recommendationId,
        workspaceId: userWorkspace.workspaceId
      },
      data: {
        status,
        ...(status === 'IMPLEMENTED' && { usedAt: new Date() })
      }
    })

    return NextResponse.json({
      success: true,
      recommendation,
      message: `Recommendation ${status.toLowerCase()} successfully`
    })

  } catch (error) {
    console.error('Update recommendation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    )
  }
}