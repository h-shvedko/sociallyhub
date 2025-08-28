import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { ImageAnalyzer } from '@/lib/visual/image-analyzer'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { ratelimit } from '@/lib/utils/rate-limit'

const analyzeImageSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']).optional(),
  analysisType: z.enum(['basic', 'detailed', 'brand']).default('basic'),
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
    const { imageUrl, platform, analysisType, brandGuidelineId } = analyzeImageSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize image analyzer
    const analyzer = new ImageAnalyzer()

    // Perform image analysis
    const analysis = await analyzer.analyzeImage(imageUrl, {
      platform: platform || undefined,
      analysisType,
      brandGuidelineId
    })

    // Save analysis to database
    const imageAnalysis = await prisma.imageAnalysis.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        userId: session.user.id,
        imageUrl,
        platform: platform || null,
        analysisData: analysis as any,
        colorPalette: analysis.colorAnalysis?.dominantColors || [],
        tags: analysis.tags || [],
        aestheticScore: analysis.aestheticScore,
        brandConsistencyScore: analysis.brandConsistency?.overallScore,
        safetyScore: analysis.safetyAnalysis?.overallScore,
        textReadabilityScore: analysis.textOverlayAnalysis?.readabilityScore
      }
    })

    return NextResponse.json({
      success: true,
      analysisId: imageAnalysis.id,
      analysis
    })

  } catch (error) {
    console.error('Image analysis error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to analyze image' },
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
    const analysisId = searchParams.get('id')
    
    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 })
    }

    // Get analysis from database
    const analysis = await prisma.imageAnalysis.findFirst({
      where: {
        id: analysisId,
        userId: session.user.id
      }
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('Get image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to get analysis' },
      { status: 500 }
    )
  }
}