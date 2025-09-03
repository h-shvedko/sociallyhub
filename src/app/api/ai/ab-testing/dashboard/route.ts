// A/B Testing Dashboard API

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { abTestingService } from '@/lib/ai/ab-testing-service'
import { ABTestStatus, ABTestType, SocialProvider } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '30d' // 7d, 30d, 90d, 1y

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id },
      include: { workspace: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Calculate date range based on timeframe
    const now = new Date()
    const dateRanges = {
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    }
    const startDate = dateRanges[timeframe as keyof typeof dateRanges] || dateRanges['30d']

    // Get dashboard data using the service
    const dashboardData = await abTestingService.getABTestDashboard(userWorkspace.workspaceId)

    // Get detailed analytics for the timeframe
    const analyticsData = await getAnalyticsData(userWorkspace.workspaceId, startDate, now)

    // Get performance trends
    const trends = await getPerformanceTrends(userWorkspace.workspaceId, startDate, now)

    // Get test recommendations
    const recommendations = await getTestRecommendations(userWorkspace.workspaceId)

    return NextResponse.json({
      success: true,
      data: {
        summary: dashboardData.summary,
        recentTests: dashboardData.recentTests,
        analytics: analyticsData,
        trends,
        recommendations,
        timeframe
      }
    })

  } catch (error) {
    console.error('A/B testing dashboard API error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

async function getAnalyticsData(workspaceId: string, startDate: Date, endDate: Date) {
  // Get all A/B tests in the timeframe
  const tests = await prisma.contentABTest.findMany({
    where: {
      workspaceId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      executionLogs: {
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate
          }
        }
      }
    }
  })

  // Calculate overall metrics
  const totalTests = tests.length
  const runningTests = tests.filter(test => test.status === ABTestStatus.RUNNING).length
  const completedTests = tests.filter(test => test.status === ABTestStatus.COMPLETED).length
  
  const totalInteractions = tests.reduce((sum, test) => sum + test.executionLogs.length, 0)
  const totalEngagements = tests.reduce((sum, test) => 
    sum + test.executionLogs.filter(log => log.engaged).length, 0
  )
  const totalConversions = tests.reduce((sum, test) => 
    sum + test.executionLogs.filter(log => log.converted).length, 0
  )

  const overallEngagementRate = totalInteractions > 0 ? totalEngagements / totalInteractions : 0
  const overallConversionRate = totalInteractions > 0 ? totalConversions / totalInteractions : 0

  // Calculate success rate (tests with positive lift)
  const testsWithPositiveLift = tests.filter(test => (test.liftPercentage || 0) > 0).length
  const successRate = completedTests > 0 ? testsWithPositiveLift / completedTests : 0

  // Platform breakdown
  const platformBreakdown = tests.reduce((acc, test) => {
    const platform = test.platform || 'unknown'
    if (!acc[platform]) {
      acc[platform] = {
        count: 0,
        engagements: 0,
        interactions: 0
      }
    }
    acc[platform].count++
    acc[platform].interactions += test.executionLogs.length
    acc[platform].engagements += test.executionLogs.filter(log => log.engaged).length
    return acc
  }, {} as Record<string, any>)

  // Test type breakdown
  const testTypeBreakdown = tests.reduce((acc, test) => {
    const testType = test.testType
    if (!acc[testType]) {
      acc[testType] = {
        count: 0,
        avgLift: 0,
        successRate: 0
      }
    }
    acc[testType].count++
    return acc
  }, {} as Record<string, any>)

  // Calculate average lift per test type
  Object.keys(testTypeBreakdown).forEach(testType => {
    const typeTests = tests.filter(test => test.testType === testType && test.liftPercentage !== null)
    if (typeTests.length > 0) {
      const avgLift = typeTests.reduce((sum, test) => sum + (test.liftPercentage || 0), 0) / typeTests.length
      const successCount = typeTests.filter(test => (test.liftPercentage || 0) > 0).length
      testTypeBreakdown[testType].avgLift = avgLift
      testTypeBreakdown[testType].successRate = successCount / typeTests.length
    }
  })

  return {
    overview: {
      totalTests,
      runningTests,
      completedTests,
      totalInteractions,
      overallEngagementRate,
      overallConversionRate,
      successRate
    },
    platformBreakdown: Object.keys(platformBreakdown).map(platform => ({
      platform,
      ...platformBreakdown[platform],
      engagementRate: platformBreakdown[platform].interactions > 0 
        ? platformBreakdown[platform].engagements / platformBreakdown[platform].interactions 
        : 0
    })),
    testTypeBreakdown: Object.keys(testTypeBreakdown).map(testType => ({
      testType,
      ...testTypeBreakdown[testType]
    }))
  }
}

async function getPerformanceTrends(workspaceId: string, startDate: Date, endDate: Date) {
  // Get daily aggregated data
  const dailyData = await prisma.$queryRaw`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as tests_created,
      AVG(lift_percentage) as avg_lift,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_tests,
      COUNT(CASE WHEN lift_percentage > 0 THEN 1 END) as successful_tests
    FROM content_ab_tests
    WHERE workspace_id = ${workspaceId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `

  // Get hourly interaction data for the last 7 days
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const hourlyInteractions = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('hour', timestamp) as hour,
      COUNT(*) as interactions,
      COUNT(CASE WHEN engaged = true THEN 1 END) as engagements,
      COUNT(CASE WHEN converted = true THEN 1 END) as conversions
    FROM ab_test_executions e
    JOIN content_ab_tests t ON e.ab_test_id = t.id
    WHERE t.workspace_id = ${workspaceId}
      AND e.timestamp >= ${last7Days}
    GROUP BY DATE_TRUNC('hour', timestamp)
    ORDER BY hour ASC
  `

  return {
    daily: dailyData,
    hourly: hourlyInteractions
  }
}

async function getTestRecommendations(workspaceId: string) {
  // Analyze past test performance to generate recommendations
  const recentTests = await prisma.contentABTest.findMany({
    where: {
      workspaceId,
      status: ABTestStatus.COMPLETED,
      NOT: { liftPercentage: null }
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      executionLogs: {
        select: {
          variant: true,
          engaged: true,
          platform: true,
          deviceType: true
        }
      }
    }
  })

  const recommendations = []

  // Analyze successful test patterns
  const successfulTests = recentTests.filter(test => (test.liftPercentage || 0) > 5)
  const unsuccessfulTests = recentTests.filter(test => (test.liftPercentage || 0) <= 0)

  // Platform recommendations
  const platformPerformance = [SocialProvider.TWITTER, SocialProvider.INSTAGRAM, SocialProvider.LINKEDIN, SocialProvider.FACEBOOK]
    .map(platform => {
      const platformTests = recentTests.filter(test => test.platform === platform)
      const avgLift = platformTests.length > 0 
        ? platformTests.reduce((sum, test) => sum + (test.liftPercentage || 0), 0) / platformTests.length
        : 0
      return { platform, avgLift, testCount: platformTests.length }
    })
    .sort((a, b) => b.avgLift - a.avgLift)

  if (platformPerformance[0]?.avgLift > 10) {
    recommendations.push({
      type: 'platform',
      priority: 'high',
      title: `Focus more tests on ${platformPerformance[0].platform}`,
      description: `${platformPerformance[0].platform} shows the highest average lift (${platformPerformance[0].avgLift.toFixed(1)}%)`,
      action: `Create more A/B tests for ${platformPerformance[0].platform} content`
    })
  }

  // Test type recommendations
  const testTypePerformance = [ABTestType.CONTENT, ABTestType.HASHTAGS, ABTestType.TIMING, ABTestType.VISUAL]
    .map(testType => {
      const typeTests = recentTests.filter(test => test.testType === testType)
      const avgLift = typeTests.length > 0 
        ? typeTests.reduce((sum, test) => sum + (test.liftPercentage || 0), 0) / typeTests.length
        : 0
      return { testType, avgLift, testCount: typeTests.length }
    })
    .sort((a, b) => b.avgLift - a.avgLift)

  if (testTypePerformance[0]?.avgLift > 8) {
    recommendations.push({
      type: 'testType',
      priority: 'medium',
      title: `${testTypePerformance[0].testType} tests perform best`,
      description: `${testTypePerformance[0].testType} tests show ${testTypePerformance[0].avgLift.toFixed(1)}% average lift`,
      action: `Consider running more ${testTypePerformance[0].testType} focused tests`
    })
  }

  // Sample size recommendations
  const avgSampleSize = recentTests.reduce((sum, test) => sum + test.executionLogs.length, 0) / recentTests.length
  if (avgSampleSize < 500) {
    recommendations.push({
      type: 'sampleSize',
      priority: 'high',
      title: 'Increase test sample sizes',
      description: `Current average sample size (${Math.round(avgSampleSize)}) may be too small for reliable results`,
      action: 'Run tests longer or with broader audience targeting'
    })
  }

  // Test duration recommendations
  const shortTests = recentTests.filter(test => test.testDuration && test.testDuration < 24).length
  if (shortTests > recentTests.length * 0.5) {
    recommendations.push({
      type: 'duration',
      priority: 'medium',
      title: 'Consider longer test durations',
      description: 'Short tests may not capture all audience segments and behaviors',
      action: 'Run tests for at least 24-48 hours to account for daily patterns'
    })
  }

  // New test suggestions
  const testedPlatforms = [...new Set(recentTests.map(test => test.platform))]
  const untestedPlatforms = [SocialProvider.TWITTER, SocialProvider.INSTAGRAM, SocialProvider.LINKEDIN, SocialProvider.FACEBOOK, SocialProvider.TIKTOK, SocialProvider.YOUTUBE]
    .filter(platform => !testedPlatforms.includes(platform))

  if (untestedPlatforms.length > 0) {
    recommendations.push({
      type: 'exploration',
      priority: 'low',
      title: `Test new platforms`,
      description: `Consider A/B testing on ${untestedPlatforms.slice(0, 2).join(', ')}`,
      action: 'Expand testing to new platforms to identify growth opportunities'
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder]
  })
}