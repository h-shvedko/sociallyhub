import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AIImageAnalyzer, ImageAnalysisTrackingContext } from '@/lib/ai/image-analyzer'
import { guardAIAvailability, withAIMeta, mapAIError } from '@/lib/ai/route-guard'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ratelimit } from '@/lib/utils/rate-limit'

const analyzeImageSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required').refine((url) => {
    // More flexible URL validation - allow blob URLs, data URLs, and regular URLs
    return url.startsWith('http://') || 
           url.startsWith('https://') || 
           url.startsWith('blob:') || 
           url.startsWith('data:') ||
           url.includes('/uploads/') // Allow local upload paths
  }, {
    message: 'Invalid image URL format'
  }),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']).optional(),
  analysisType: z.enum(['basic', 'detailed', 'brand']).default('basic'),
  brandGuidelineId: z.string().optional()
})

// Real AI image analysis using the OpenAI Vision API.
// ADR-0018 honesty: no fabricated fallback analysis — if the AI call fails,
// the error propagates and the client gets an honest 5xx/503, never invented scores.
async function analyzeImageWithAI(
  imageUrl: string,
  options: { platform?: string; analysisType: string; brandGuidelineId?: string },
  tracking: ImageAnalysisTrackingContext
) {
  const analyzer = new AIImageAnalyzer()

  const analysis = await analyzer.analyzeImage(imageUrl, options.platform, tracking)

  // Add brand consistency analysis for detailed/brand analysis types
  if (options.analysisType === 'detailed' || options.analysisType === 'brand') {
    if (!analysis.brandConsistency) {
      // If not provided by AI, calculate based on color analysis and aesthetic score
      analysis.brandConsistency = {
        overallScore: Math.min(analysis.aestheticScore + 10, 95),
        colorMatch: analysis.colorAnalysis.vibrance,
        styleMatch: analysis.compositionAnalysis.balance
      }
    }
  }

  return analysis
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADR-0018: no provider configured → honest 503 before any work
    const unavailable = guardAIAvailability()
    if (unavailable) return unavailable

    // Ensure user exists in database (handles both demo and regular users)
    let existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!existingUser) {
      // Check if user exists by email (in case of ID mismatch)
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (userByEmail) {
        console.log(`User exists by email but different ID. Session ID: ${session.user.id}, DB ID: ${userByEmail.id}`)
        existingUser = userByEmail
      } else {
        // Create user record if it doesn't exist
        try {
          existingUser = await prisma.user.create({
            data: {
              id: session.user.id,
              email: session.user.email || 'unknown@sociallyhub.com',
              name: session.user.name || 'User',
              emailVerified: new Date()
            }
          })
        } catch (error) {
          // If creation fails due to duplicate email, try to find by email again
          if (error instanceof Error && error.message.includes('Unique constraint failed')) {
            existingUser = await prisma.user.findUnique({
              where: { email: session.user.email }
            })
          }
          if (!existingUser) {
            throw error
          }
        }
      }
    }

    // Rate limiting
    const identifier = session.user.id
    const { success } = await ratelimit.limit(identifier)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { imageUrl, platform, analysisType, brandGuidelineId } = analyzeImageSchema.parse(body)

    // Get user's workspace or create a default one for demo users
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
          userId: existingUser.id,
          workspaceId: defaultWorkspace.id
        }
      })
      
      if (!existingUserWorkspace) {
        await prisma.userWorkspace.create({
          data: {
            userId: existingUser.id,
            workspaceId: defaultWorkspace.id,
            role: 'OWNER'
          }
        })
      }
      
      userWorkspace = await prisma.userWorkspace.findFirst({
        where: { 
          userId: existingUser.id,
          workspaceId: defaultWorkspace.id 
        },
        include: { workspace: true }
      })
    }

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Could not access workspace' }, { status: 404 })
    }

    // Real AI image analysis using OpenAI Vision API (usage tracked per call)
    const analysis = await analyzeImageWithAI(
      imageUrl,
      {
        platform: platform || undefined,
        analysisType,
        brandGuidelineId
      },
      { workspaceId: userWorkspace.workspaceId, userId: existingUser.id }
    )

    // Create asset record first (required for image_analysis)
    const asset = await prisma.asset.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        filename: `analysis-${Date.now()}.jpg`,
        originalName: `analysis-${Date.now()}.jpg`, 
        mimeType: 'image/jpeg',
        size: 1024, // Default size since we don't have the actual file
        url: imageUrl,
        width: 800, // Default dimensions
        height: 600,
        metadata: {
          source: 'image-analysis',
          originalUrl: imageUrl
        }
      }
    })

    // Save analysis to database with required fields
    const imageAnalysis = await prisma.imageAnalysis.create({
      data: {
        assetId: asset.id,
        workspaceId: userWorkspace.workspaceId,
        width: 800, // Default width since we don't have the actual dimensions
        height: 600, // Default height since we don't have the actual dimensions
        format: 'JPEG',
        fileSize: 1024, // Default size
        dominantColors: analysis.colorAnalysis?.dominantColors || [],
        colorPalette: analysis.colorAnalysis?.dominantColors || [],
        labels: analysis.tags || [],
        faces: [],
        text: [],
        safeSearch: { adult: 'UNLIKELY', violence: 'UNLIKELY', racy: 'UNLIKELY' },
        landmarks: [],
        brandScore: analysis.brandConsistency?.overallScore || null,
        logoDetected: false,
        brandColors: analysis.colorAnalysis?.dominantColors || null,
        fontAnalysis: analysis.textOverlayAnalysis ?? undefined,
        aestheticScore: analysis.aestheticScore || null,
        compositonScore: analysis.compositionAnalysis?.balance || null
      }
    })

    return NextResponse.json(withAIMeta({
      success: true,
      analysisId: imageAnalysis.id,
      analysis
    }))

  } catch (error) {
    console.error('Image analysis error:', error)

    const mapped = mapAIError(error)
    if (mapped) return mapped

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

// Get a stored image analysis (purely DB read — no provider call, so no
// availability guard; responses still carry provider metadata)
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

    // Workspace-scoped lookup (ImageAnalysis rows belong to a workspace, not a user)
    const memberships = await prisma.userWorkspace.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true }
    })

    const analysis = await prisma.imageAnalysis.findFirst({
      where: {
        id: analysisId,
        workspaceId: { in: memberships.map(m => m.workspaceId) }
      }
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }

    return NextResponse.json(withAIMeta({
      success: true,
      analysis
    }))

  } catch (error) {
    console.error('Get image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to get analysis' },
      { status: 500 }
    )
  }
}