// Individual A/B Test Management API

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { abTestingService } from '@/lib/ai/ab-testing-service'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ABTestStatus } from '@prisma/client'

const updateABTestSchema = z.object({
  status: z.nativeEnum(ABTestStatus).optional(),
  endDate: z.string().datetime().optional(),
  autoOptimize: z.boolean().optional(),
  autoPublish: z.boolean().optional()
})

// Get A/B Test Details
export async function GET(
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

    const abTest = await prisma.contentABTest.findFirst({
      where: {
        id: params.testId,
        workspaceId: userWorkspace.workspaceId
      },
      include: {
        executionLogs: {
          orderBy: { timestamp: 'desc' },
          take: 100 // Get recent interactions for analysis
        }
      }
    })

    if (!abTest) {
      return NextResponse.json({ error: 'A/B test not found' }, { status: 404 })
    }

    // Calculate detailed metrics
    const variantMetrics = calculateDetailedMetrics(abTest.executionLogs)
    
    // Calculate confidence intervals and statistical data
    const statisticalData = calculateStatisticalData(abTest.executionLogs, abTest.confidenceLevel)

    return NextResponse.json({
      success: true,
      data: {
        test: {
          id: abTest.id,
          testName: abTest.testName,
          description: abTest.description,
          testType: abTest.testType,
          platform: abTest.platform,
          status: abTest.status,
          startDate: abTest.startDate,
          endDate: abTest.endDate,
          confidenceLevel: abTest.confidenceLevel,
          
          // Content
          controlContent: {
            title: abTest.controlTitle,
            content: abTest.controlContent,
            hashtags: abTest.controlHashtags,
            mediaIds: abTest.controlMediaIds
          },
          variants: abTest.variants,
          
          // Configuration
          trafficSplit: abTest.trafficSplit,
          testDuration: abTest.testDuration,
          autoOptimize: abTest.autoOptimize,
          autoPublish: abTest.autoPublish,
          
          // Results
          totalViews: abTest.totalViews,
          winningVariant: abTest.winningVariant,
          liftPercentage: abTest.liftPercentage,
          statisticalSignificance: abTest.statisticalSignificance,
          publishedAt: abTest.publishedAt,
          
          // AI Insights
          aiRecommendations: abTest.aiRecommendations,
          nextTestSuggestions: abTest.nextTestSuggestions,
          
          createdAt: abTest.createdAt,
          updatedAt: abTest.updatedAt
        },
        
        // Real-time metrics
        metrics: {
          variants: variantMetrics,
          statistical: statisticalData,
          timeline: generateTimelineData(abTest.executionLogs)
        }
      }
    })

  } catch (error) {
    console.error('Get A/B test details API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Update A/B Test
export async function PATCH(
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
    const validatedData = updateABTestSchema.parse(body)

    // Verify test exists and user has access
    const existingTest = await prisma.contentABTest.findFirst({
      where: {
        id: params.testId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingTest) {
      return NextResponse.json({ error: 'A/B test not found' }, { status: 404 })
    }

    // Update the test
    const updatedTest = await prisma.contentABTest.update({
      where: { id: params.testId },
      data: {
        ...validatedData,
        ...(validatedData.endDate && { endDate: new Date(validatedData.endDate) })
      }
    })

    // If status changed to RUNNING, start the test
    if (validatedData.status === ABTestStatus.RUNNING && existingTest.status === ABTestStatus.DRAFT) {
      await abTestingService.startABTest(params.testId)
    }

    return NextResponse.json({
      success: true,
      data: {
        test: updatedTest,
        message: 'A/B test updated successfully'
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Update A/B test API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Delete A/B Test
export async function DELETE(
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

    // Verify test exists and user has access
    const existingTest = await prisma.contentABTest.findFirst({
      where: {
        id: params.testId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingTest) {
      return NextResponse.json({ error: 'A/B test not found' }, { status: 404 })
    }

    // Don't allow deletion of running tests
    if (existingTest.status === ABTestStatus.RUNNING) {
      return NextResponse.json({
        error: 'Cannot delete running A/B test',
        message: 'Please pause or complete the test first'
      }, { status: 400 })
    }

    // Delete the test (cascade will handle execution logs)
    await prisma.contentABTest.delete({
      where: { id: params.testId }
    })

    return NextResponse.json({
      success: true,
      message: 'A/B test deleted successfully'
    })

  } catch (error) {
    console.error('Delete A/B test API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Helper functions for metrics calculation

function calculateDetailedMetrics(executionLogs: any[]): Record<string, any> {
  const metrics: Record<string, any> = {}
  
  // Group executions by variant
  const groupedLogs = executionLogs.reduce((acc, log) => {
    if (!acc[log.variant]) acc[log.variant] = []
    acc[log.variant].push(log)
    return acc
  }, {} as Record<string, any[]>)

  Object.keys(groupedLogs).forEach(variant => {
    const logs = groupedLogs[variant]
    const totalViews = logs.length
    const viewed = logs.filter(log => log.viewed).length
    const clicked = logs.filter(log => log.clicked).length
    const engaged = logs.filter(log => log.engaged).length
    const converted = logs.filter(log => log.converted).length
    
    const avgEngagementScore = logs.reduce((sum, log) => sum + (log.engagementScore || 0), 0) / totalViews
    const avgTimeSpent = logs.reduce((sum, log) => sum + (log.timeSpent || 0), 0) / totalViews

    metrics[variant] = {
      totalInteractions: totalViews,
      views: viewed,
      clicks: clicked,
      engagements: engaged,
      conversions: converted,
      
      viewRate: totalViews > 0 ? viewed / totalViews : 0,
      clickRate: totalViews > 0 ? clicked / totalViews : 0,
      engagementRate: totalViews > 0 ? engaged / totalViews : 0,
      conversionRate: totalViews > 0 ? converted / totalViews : 0,
      
      avgEngagementScore,
      avgTimeSpent,
      
      // Device and platform breakdown
      devices: getDeviceBreakdown(logs),
      platforms: getPlatformBreakdown(logs)
    }
  })

  return metrics
}

function calculateStatisticalData(executionLogs: any[], confidenceLevel: number): any {
  // Simplified statistical calculations
  // In production, use proper statistical libraries
  
  const variants = [...new Set(executionLogs.map(log => log.variant))]
  const control = variants.find(v => v === 'control') || variants[0]
  
  const results: any = {
    confidenceLevel,
    sampleSizeRecommendation: calculateRequiredSampleSize(confidenceLevel),
    currentSampleSize: executionLogs.length,
    testPower: calculateTestPower(executionLogs),
    significanceResults: {}
  }

  variants.forEach(variant => {
    if (variant !== control) {
      const significance = calculateSignificance(
        executionLogs.filter(log => log.variant === control),
        executionLogs.filter(log => log.variant === variant),
        confidenceLevel
      )
      results.significanceResults[variant] = significance
    }
  })

  return results
}

function generateTimelineData(executionLogs: any[]): any[] {
  // Group logs by hour for timeline visualization
  const timeline = executionLogs.reduce((acc, log) => {
    const hour = new Date(log.timestamp).getHours()
    const date = new Date(log.timestamp).toDateString()
    const key = `${date}-${hour}`
    
    if (!acc[key]) {
      acc[key] = {
        timestamp: new Date(log.timestamp),
        variants: {}
      }
    }
    
    if (!acc[key].variants[log.variant]) {
      acc[key].variants[log.variant] = {
        views: 0,
        engagements: 0,
        conversions: 0
      }
    }
    
    acc[key].variants[log.variant].views++
    if (log.engaged) acc[key].variants[log.variant].engagements++
    if (log.converted) acc[key].variants[log.variant].conversions++
    
    return acc
  }, {} as Record<string, any>)

  return Object.values(timeline).sort((a: any, b: any) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  )
}

function getDeviceBreakdown(logs: any[]): Record<string, number> {
  return logs.reduce((acc, log) => {
    const device = log.deviceType || 'unknown'
    acc[device] = (acc[device] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function getPlatformBreakdown(logs: any[]): Record<string, number> {
  return logs.reduce((acc, log) => {
    const platform = log.platform || 'unknown'
    acc[platform] = (acc[platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

function calculateRequiredSampleSize(confidenceLevel: number): number {
  // Simplified sample size calculation
  // Formula: n = (Z^2 * p * (1-p)) / E^2
  // Where Z is confidence level, p is expected conversion rate, E is margin of error
  
  const z = confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.58 : 1.64
  const p = 0.1 // Assume 10% baseline conversion rate
  const e = 0.05 // 5% margin of error
  
  return Math.ceil((z * z * p * (1 - p)) / (e * e))
}

function calculateTestPower(executionLogs: any[]): number {
  // Simplified test power calculation
  // In practice, this would be much more complex
  const sampleSize = executionLogs.length
  const recommendedSize = 1000
  
  return Math.min(sampleSize / recommendedSize, 1)
}

function calculateSignificance(controlLogs: any[], variantLogs: any[], confidenceLevel: number): any {
  const controlEngagements = controlLogs.filter(log => log.engaged).length
  const controlTotal = controlLogs.length
  const variantEngagements = variantLogs.filter(log => log.engaged).length
  const variantTotal = variantLogs.length
  
  if (controlTotal === 0 || variantTotal === 0) {
    return {
      significant: false,
      pValue: 1,
      liftPercentage: 0,
      confidenceInterval: [0, 0]
    }
  }
  
  const controlRate = controlEngagements / controlTotal
  const variantRate = variantEngagements / variantTotal
  
  // Simplified significance test (in production, use proper Chi-square test)
  const difference = Math.abs(variantRate - controlRate)
  const significant = difference > 0.05 && (controlTotal + variantTotal) > 100
  const liftPercentage = controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0
  
  return {
    significant,
    pValue: significant ? 0.95 : 0.5,
    liftPercentage,
    confidenceInterval: [
      liftPercentage - 10, // Simplified confidence interval
      liftPercentage + 10
    ]
  }
}