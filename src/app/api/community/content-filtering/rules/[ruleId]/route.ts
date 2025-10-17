import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/content-filtering/rules/[ruleId] - Get specific rule details
export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ruleId } = params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Verify user has moderation permissions
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    // Get the rule with detailed information
    const rule = await prisma.autoModerationRule.findUnique({
      where: { id: ruleId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Get rule execution history
    const executions = await prisma.moderationAction.findMany({
      where: {
        ruleId: rule.id,
        isAutomatic: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        actionType: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true
      }
    })

    // Get rule performance statistics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [
      totalExecutions,
      recentExecutions,
      successfulExecutions,
      failedExecutions
    ] = await Promise.all([
      prisma.moderationAction.count({
        where: {
          ruleId: rule.id,
          isAutomatic: true
        }
      }),
      prisma.moderationAction.count({
        where: {
          ruleId: rule.id,
          isAutomatic: true,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.moderationAction.count({
        where: {
          ruleId: rule.id,
          isAutomatic: true,
          status: 'COMPLETED'
        }
      }),
      prisma.moderationAction.count({
        where: {
          ruleId: rule.id,
          isAutomatic: true,
          status: 'FAILED'
        }
      })
    ])

    // Calculate success rate
    const successRate = totalExecutions > 0 ?
      ((successfulExecutions / totalExecutions) * 100).toFixed(1) : '0'

    // Get daily execution trend (last 7 days)
    const executionTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = await prisma.moderationAction.count({
        where: {
          ruleId: rule.id,
          isAutomatic: true,
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      })

      executionTrend.push({
        date: date.toISOString().split('T')[0],
        count
      })
    }

    return NextResponse.json({
      rule,
      executions,
      statistics: {
        totalExecutions,
        recentExecutions,
        successfulExecutions,
        failedExecutions,
        successRate: parseFloat(successRate)
      },
      executionTrend
    })

  } catch (error) {
    console.error('Failed to fetch rule details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rule details' },
      { status: 500 }
    )
  }
}

// PUT /api/community/content-filtering/rules/[ruleId] - Update rule
export async function PUT(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ruleId } = params
    const body = await request.json()
    const {
      name,
      description,
      triggerConditions,
      actionParameters,
      priority,
      isActive,
      workspaceId
    } = body

    // Verify user has moderation permissions
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    // Get the current rule
    const currentRule = await prisma.autoModerationRule.findUnique({
      where: { id: ruleId }
    })

    if (!currentRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Update the rule
    const updatedRule = await prisma.autoModerationRule.update({
      where: { id: ruleId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
        ...(triggerConditions && { triggerConditions }),
        ...(actionParameters && { actionParameters }),
        ...(priority && { priority }),
        ...(isActive !== undefined && { isActive }),
        updatedById: normalizeUserId(session.user.id)
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // Create activity log
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: 'Auto-moderation rule updated',
        description: `Updated rule: ${updatedRule.name}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Admin',
        userAvatar: session.user.image,
        targetId: ruleId,
        targetType: 'moderation_rule',
        targetTitle: updatedRule.name,
        workspaceId: workspaceId || currentRule.workspaceId,
        metadata: {
          changes: {
            ...(name && name !== currentRule.name && { name: { from: currentRule.name, to: name } }),
            ...(isActive !== undefined && isActive !== currentRule.isActive && {
              isActive: { from: currentRule.isActive, to: isActive }
            }),
            ...(priority && priority !== currentRule.priority && {
              priority: { from: currentRule.priority, to: priority }
            })
          }
        }
      }
    })

    return NextResponse.json(updatedRule)

  } catch (error) {
    console.error('Failed to update rule:', error)
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/community/content-filtering/rules/[ruleId] - Delete rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ruleId } = params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Verify user has moderation permissions
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    // Get the rule before deletion
    const rule = await prisma.autoModerationRule.findUnique({
      where: { id: ruleId }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Delete the rule and update related moderation actions
    await prisma.$transaction([
      // Update moderation actions to remove rule reference
      prisma.moderationAction.updateMany({
        where: { ruleId },
        data: { ruleId: null }
      }),
      // Delete the rule
      prisma.autoModerationRule.delete({
        where: { id: ruleId }
      })
    ])

    // Create activity log
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: 'Auto-moderation rule deleted',
        description: `Deleted rule: ${rule.name}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Admin',
        userAvatar: session.user.image,
        targetId: ruleId,
        targetType: 'moderation_rule',
        targetTitle: rule.name,
        workspaceId: workspaceId || rule.workspaceId,
        metadata: {
          deletedRule: {
            name: rule.name,
            triggerType: rule.triggerType,
            actionType: rule.actionType,
            priority: rule.priority
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    )
  }
}