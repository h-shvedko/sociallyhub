import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
// import { ImageAnalyzer } from '@/lib/visual/image-analyzer'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ratelimit } from '@/lib/utils/rate-limit'

const analyzeImageSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']).optional(),
  analysisType: z.enum(['basic', 'detailed', 'brand']).default('basic'),
  brandGuidelineId: z.string().optional()
})

// Mock image analysis function
async function mockImageAnalysis(imageUrl: string, options: any) {
  // Simulate analysis delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  const baseAnalysis = {
    aestheticScore: Math.random() * 40 + 60, // 60-100
    colorAnalysis: {
      dominantColors: ['#FF6B35', '#004E89', '#FFD23F', '#06FFA5', '#7209B7'],
      colorHarmony: 'complementary',
      vibrance: Math.random() * 30 + 70,
      contrast: Math.random() * 40 + 60
    },
    compositionAnalysis: {
      rule: 'rule-of-thirds',
      balance: Math.random() * 30 + 70,
      focusPoints: [
        { x: 33, y: 33, confidence: 0.8 },
        { x: 67, y: 33, confidence: 0.6 }
      ]
    },
    tags: ['professional', 'business', 'modern', 'clean', 'digital']
  }

  if (options.analysisType === 'detailed' || options.analysisType === 'brand') {
    return {
      ...baseAnalysis,
      brandConsistency: {
        overallScore: Math.random() * 20 + 75,
        colorMatch: Math.random() * 30 + 70,
        styleMatch: Math.random() * 25 + 70
      },
      safetyAnalysis: {
        overallScore: Math.random() * 10 + 90,
        appropriateContent: true,
        issues: []
      },
      textOverlayAnalysis: {
        hasText: Math.random() > 0.5,
        readabilityScore: Math.random() * 20 + 75,
        suggestions: [
          'Consider increasing text contrast for better readability',
          'Text placement follows good composition principles'
        ]
      }
    }
  }

  return baseAnalysis
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user exists in database (handles both demo and regular users)
    let existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!existingUser) {
      // Create user record if it doesn't exist
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

    // Mock image analysis for demonstration
    // TODO: Replace with actual image analysis service
    const analysis = await mockImageAnalysis(imageUrl, {
      platform: platform || undefined,
      analysisType,
      brandGuidelineId
    })

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
        fontAnalysis: analysis.textOverlayAnalysis || null,
        aestheticScore: analysis.aestheticScore || null,
        compositonScore: analysis.compositionAnalysis?.balance || null
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

    // Ensure user exists in database (handles both demo and regular users)
    let existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!existingUser) {
      // Create user record if it doesn't exist
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