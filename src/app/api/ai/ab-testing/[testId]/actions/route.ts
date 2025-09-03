// A/B Test Actions API (Start, Analyze, Optimize, Publish)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { abTestingService } from '@/lib/ai/ab-testing-service'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ABTestStatus } from '@prisma/client'

const actionSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'analyze', 'optimize', 'publish']),
  variant: z.string().optional(), // For recording interactions
  interactionData: z.object({
    viewed: z.boolean().optional(),
    clicked: z.boolean().optional(),
    engaged: z.boolean().optional(),
    converted: z.boolean().optional(),
    engagementScore: z.number().optional(),
    timeSpent: z.number().optional(),
    deviceType: z.string().optional(),
    location: z.string().optional()
  }).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: { testId: string } }
) {
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
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, variant, interactionData } = actionSchema.parse(body)

    // Verify test exists and user has access
    const abTest = await prisma.contentABTest.findFirst({
      where: {
        id: params.testId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!abTest) {
      return NextResponse.json({ error: 'A/B test not found' }, { status: 404 })
    }

    const startTime = Date.now()

    try {
      let result: any = { success: true }

      switch (action) {
        case 'start':
          if (abTest.status !== ABTestStatus.DRAFT) {
            return NextResponse.json({
              error: 'Test can only be started from DRAFT status'
            }, { status: 400 })
          }
          
          await abTestingService.startABTest(params.testId)
          result.message = 'A/B test started successfully'
          break

        case 'pause':
          if (abTest.status !== ABTestStatus.RUNNING) {
            return NextResponse.json({
              error: 'Test must be running to pause'
            }, { status: 400 })
          }
          
          await prisma.contentABTest.update({
            where: { id: params.testId },
            data: { status: ABTestStatus.PAUSED }
          })
          result.message = 'A/B test paused successfully'
          break

        case 'resume':
          if (abTest.status !== ABTestStatus.PAUSED) {
            return NextResponse.json({
              error: 'Test must be paused to resume'
            }, { status: 400 })
          }
          
          await prisma.contentABTest.update({
            where: { id: params.testId },
            data: { status: ABTestStatus.RUNNING }
          })
          result.message = 'A/B test resumed successfully'
          break

        case 'analyze':
          if (abTest.status === ABTestStatus.DRAFT) {
            return NextResponse.json({
              error: 'Cannot analyze test that has not started'
            }, { status: 400 })
          }
          
          const insights = await abTestingService.analyzeTestResults(params.testId)
          result.insights = insights
          result.message = 'A/B test analysis completed'
          
          // Track AI usage for analysis
          await prisma.aIUsageTracking.create({
            data: {
              workspaceId: userWorkspace.workspaceId,
              userId: session.user.id,
              featureType: 'AB_TEST_ANALYSIS',
              tokensUsed: 300,
              costCents: 1,
              responseTimeMs: Date.now() - startTime,
              successful: true
            }
          })
          break

        case 'optimize':
          if (abTest.status !== ABTestStatus.RUNNING) {
            return NextResponse.json({
              error: 'Test must be running to optimize'
            }, { status: 400 })
          }
          
          if (!abTest.autoOptimize) {
            return NextResponse.json({
              error: 'Auto-optimization is not enabled for this test'
            }, { status: 400 })
          }
          
          await abTestingService.autoOptimize(params.testId)
          result.message = 'A/B test optimized - traffic shifted to winning variant'
          break

        case 'publish':
          if (abTest.status === ABTestStatus.DRAFT) {
            return NextResponse.json({
              error: 'Cannot publish test that has not started'
            }, { status: 400 })
          }
          
          if (!abTest.autoPublish) {
            return NextResponse.json({
              error: 'Auto-publish is not enabled for this test'
            }, { status: 400 })
          }
          
          await abTestingService.autoPublishWinner(params.testId)
          result.message = 'Winning variant published successfully'
          break

        default:
          return NextResponse.json({
            error: 'Invalid action'
          }, { status: 400 })
      }

      // If variant and interaction data provided, record the interaction
      if (variant && interactionData) {
        await abTestingService.recordInteraction(
          params.testId,
          variant,
          session.user.id,
          `session-${Date.now()}`, // Simple session ID
          {
            ...interactionData,
            platform: abTest.platform || undefined
          }
        )
      }

      return NextResponse.json({
        success: true,
        data: result
      })

    } catch (actionError) {
      // Track failed AI usage for analysis actions
      if (action === 'analyze') {
        await prisma.aIUsageTracking.create({
          data: {
            workspaceId: userWorkspace.workspaceId,
            userId: session.user.id,
            featureType: 'AB_TEST_ANALYSIS',
            responseTimeMs: Date.now() - startTime,
            successful: false,
            errorMessage: actionError instanceof Error ? actionError.message : 'Unknown error'
          }
        })
      }

      return NextResponse.json({
        error: `Action '${action}' failed`,
        details: actionError instanceof Error ? actionError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    console.error('A/B test action API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}