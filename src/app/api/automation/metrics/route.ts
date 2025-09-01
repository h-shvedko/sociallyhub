import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { BusinessLogger } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const period = searchParams.get('period') || '30' // days

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - parseInt(period))

    // Get automation rule statistics
    const [
      totalRules,
      activeRules,
      recentExecutions,
      successfulExecutions
    ] = await Promise.all([
      prisma.automationRule.count({
        where: { workspaceId }
      }),
      prisma.automationRule.count({
        where: { workspaceId, isActive: true }
      }),
      prisma.automationExecution.findMany({
        where: {
          workspaceId,
          startedAt: { gte: periodStart }
        },
        include: {
          rule: {
            select: { name: true }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: 10
      }),
      prisma.automationExecution.count({
        where: {
          workspaceId,
          startedAt: { gte: periodStart },
          status: 'SUCCESS'
        }
      })
    ])

    const totalExecutions = recentExecutions.length

    // Calculate average response time
    const executionsWithDuration = recentExecutions.filter(exec => exec.duration)
    const averageResponseTime = executionsWithDuration.length > 0
      ? executionsWithDuration.reduce((acc, exec) => acc + (exec.duration || 0), 0) / executionsWithDuration.length
      : 0

    // Calculate error rate
    const failedExecutions = recentExecutions.filter(exec => exec.status === 'FAILED').length
    const errorRate = totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0

    // Calculate real performance metrics from database
    // Time saved: Each successful automation saves approximately 5 minutes of manual work
    const timeSaved = Math.round((successfulExecutions * 5) / 60) // Convert minutes to hours
    
    // Calculate engagement increase from automation-triggered interactions
    const [automationPosts, totalPosts] = await Promise.all([
      prisma.post.count({
        where: {
          workspaceId,
          createdAt: { gte: periodStart },
          metadata: {
            path: ['automationTriggered'],
            equals: true
          }
        }
      }),
      prisma.post.count({
        where: {
          workspaceId,
          createdAt: { gte: periodStart }
        }
      })
    ])
    
    // Calculate engagement increase percentage
    const engagementIncrease = totalPosts > 0 
      ? Math.round((automationPosts / totalPosts) * 100)
      : 0

    // Get top performing rules
    const topRules = await prisma.automationRule.findMany({
      where: { 
        workspaceId,
        executionCount: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        ruleType: true,
        executionCount: true,
        successCount: true
      },
      orderBy: [
        { successCount: 'desc' },
        { executionCount: 'desc' }
      ],
      take: 3
    })

    const topPerformingRules = topRules.map(rule => ({
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      successRate: rule.executionCount > 0 
        ? ((rule.successCount / rule.executionCount) * 100).toFixed(1)
        : '0.0',
      executionCount: rule.executionCount
    }))

    // Generate dynamic recommendations based on metrics
    const recommendations = []
    
    if (averageResponseTime > 1000) {
      recommendations.push({
        type: 'warning',
        title: 'Optimize Response Times',
        message: 'Response times are above 1 second. Consider optimizing your automation rules.'
      })
    }
    
    if (errorRate > 10) {
      recommendations.push({
        type: 'error',
        title: 'High Error Rate',
        message: `${errorRate.toFixed(1)}% of automations are failing. Review error logs for details.`
      })
    }
    
    if (successRate > 90) {
      recommendations.push({
        type: 'success',
        title: 'Great Performance!',
        message: 'Your automation rules are performing excellently.'
      })
    }
    
    if (activeRules === 0 && totalRules > 0) {
      recommendations.push({
        type: 'info',
        title: 'Activate Your Rules',
        message: 'You have automation rules but none are active. Enable them to start automating.'
      })
    }

    const metrics = {
      totalRules,
      activeRules,
      totalExecutions,
      successfulExecutions,
      averageResponseTime: Math.round(averageResponseTime),
      timeSaved,
      engagementIncrease,
      errorRate,
      recentExecutions: recentExecutions.map(execution => ({
        id: execution.id,
        ruleName: execution.rule.name,
        status: execution.status,
        executedAt: execution.startedAt.toISOString(),
        duration: execution.duration || 0
      })),
      topPerformingRules,
      recommendations
    }

    BusinessLogger.logWorkspaceAction('automation_metrics_viewed', workspaceId, userId, {
      period: parseInt(period),
      metricsRequested: Object.keys(metrics)
    })

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching automation metrics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { ruleId, workspaceId, triggeredBy, triggerData, results } = body

    // Verify user has access to workspace
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create execution record
    const execution = await prisma.automationExecution.create({
      data: {
        ruleId,
        workspaceId,
        triggeredBy,
        triggerData: triggerData || {},
        status: 'PENDING',
        results: results || {}
      }
    })

    // Update rule execution count
    await prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date()
      }
    })

    const postUserId = await normalizeUserId(session.user.id)
    BusinessLogger.logWorkspaceAction('automation_execution_logged', workspaceId, postUserId, {
      ruleId,
      executionId: execution.id,
      triggeredBy
    })

    return NextResponse.json(execution, { status: 201 })
  } catch (error) {
    console.error('Error logging automation execution:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}