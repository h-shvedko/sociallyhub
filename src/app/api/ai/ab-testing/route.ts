// A/B Testing API Endpoints

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { abTestingService } from '@/lib/ai/ab-testing-service'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ABTestType, ABTestStatus, SocialProvider } from '@prisma/client'

const createABTestSchema = z.object({
  testName: z.string().min(1).max(100),
  description: z.string().optional(),
  testType: z.nativeEnum(ABTestType),
  platform: z.nativeEnum(SocialProvider).optional(),
  
  controlTitle: z.string().optional(),
  controlContent: z.string().min(1).max(5000),
  controlHashtags: z.array(z.string()).optional(),
  controlMediaIds: z.array(z.string()).optional(),
  
  sampleSize: z.number().min(100).max(100000).optional(),
  confidenceLevel: z.number().min(0.8).max(0.99).optional(),
  testDuration: z.number().min(1).max(168).optional(), // 1 hour to 1 week
  autoOptimize: z.boolean().optional(),
  autoPublish: z.boolean().optional()
})

// Create A/B Test
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ 
        error: 'No workspace found', 
        debug: { userId: session.user.id },
        help: 'Make sure you are logged in with the demo account: demo@sociallyhub.com / demo123456'
      }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = createABTestSchema.parse(body)

    const startTime = Date.now()

    try {
      // Create A/B test with AI-generated variants
      const testId = await abTestingService.createABTest({
        workspaceId: userWorkspace.workspaceId,
        userId: session.user.id,
        ...validatedData
      })

      // Track AI usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: session.user.id,
          featureType: 'AB_TEST_CREATION',
          tokensUsed: 500, // Estimated tokens for variant generation
          costCents: 2, // Estimated cost
          responseTimeMs: Date.now() - startTime,
          successful: true
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          testId,
          message: 'A/B test created successfully with AI-generated variants'
        }
      })

    } catch (aiError) {
      // Track failed usage
      await prisma.aIUsageTracking.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          userId: session.user.id,
          featureType: 'AB_TEST_CREATION',
          responseTimeMs: Date.now() - startTime,
          successful: false,
          errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error'
        }
      })

      return NextResponse.json({
        error: 'A/B test creation failed',
        details: aiError instanceof Error ? aiError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Create A/B test API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Get A/B Tests for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as ABTestStatus | null
    const testType = searchParams.get('testType') as ABTestType | null
    const platform = searchParams.get('platform') as SocialProvider | null
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get A/B tests for workspace
    const where = {
      workspaceId: userWorkspace.workspaceId,
      ...(status && { status }),
      ...(testType && { testType }),
      ...(platform && { platform })
    }

    const abTests = await prisma.contentABTest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        executionLogs: {
          select: {
            variant: true,
            viewed: true,
            engaged: true,
            converted: true
          }
        }
      }
    })

    const total = await prisma.contentABTest.count({ where })

    // Calculate summary metrics for each test
    const testsWithMetrics = abTests.map(test => {
      const totalInteractions = test.executionLogs.length
      const engagements = test.executionLogs.filter(log => log.engaged).length
      const conversions = test.executionLogs.filter(log => log.converted).length
      
      return {
        id: test.id,
        testName: test.testName,
        description: test.description,
        testType: test.testType,
        platform: test.platform,
        status: test.status,
        startDate: test.startDate,
        endDate: test.endDate,
        winningVariant: test.winningVariant,
        liftPercentage: test.liftPercentage,
        statisticalSignificance: test.statisticalSignificance,
        totalInteractions,
        engagementRate: totalInteractions > 0 ? engagements / totalInteractions : 0,
        conversionRate: totalInteractions > 0 ? conversions / totalInteractions : 0,
        createdAt: test.createdAt,
        autoOptimize: test.autoOptimize,
        autoPublish: test.autoPublish
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        tests: testsWithMetrics,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error) {
    console.error('Get A/B tests API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}