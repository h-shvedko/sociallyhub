import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { BusinessLogger } from '@/lib/middleware/logging'

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
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
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

    // Mock some performance metrics for demonstration
    const timeSaved = Math.round(successfulExecutions * 0.5) // Assume each successful execution saves 30 minutes
    const engagementIncrease = 15 // Mock engagement increase percentage

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
      }))
    }

    BusinessLogger.logWorkspaceAction('automation_metrics_viewed', workspaceId, session.user.id, {
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
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
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

    BusinessLogger.logWorkspaceAction('automation_execution_logged', workspaceId, session.user.id, {
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