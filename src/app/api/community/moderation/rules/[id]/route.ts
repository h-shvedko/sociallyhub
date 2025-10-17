import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/moderation/rules/[id] - Get specific auto-moderation rule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const includeActions = searchParams.get('includeActions') === 'true'
    const includeStats = searchParams.get('includeStats') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access
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

    // Get the rule with optional related data
    const rule = await prisma.autoModerationRule.findUnique({
      where: {
        id: params.id,
        workspaceId
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        actions: includeActions ? {
          where: { ruleId: params.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            actionType: true,
            targetType: true,
            targetId: true,
            status: true,
            createdAt: true,
            description: true
          }
        } : false
      }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Get statistics if requested
    let statistics
    if (includeStats) {
      statistics = await getRuleStatistics(params.id, workspaceId)
    }

    return NextResponse.json({
      rule: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        isActive: rule.isActive,
        priority: rule.priority,
        triggerType: rule.triggerType,
        targetTypes: rule.targetTypes,
        conditions: rule.conditions,
        actions: rule.actions,
        schedule: rule.schedule,
        whitelistUsers: rule.whitelistUsers,
        blacklistUsers: rule.blacklistUsers,
        exemptRoles: rule.exemptRoles,
        cooldownPeriod: rule.cooldownPeriod,
        maxTriggersPerHour: rule.maxTriggersPerHour,
        createdBy: rule.createdBy,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
        lastTriggered: rule.lastTriggered,
        triggerCount: rule.triggerCount,
        successRate: rule.successRate,
        metadata: rule.metadata,
        creator: rule.creator,
        recentActions: includeActions ? rule.actions : undefined
      },
      statistics
    })

  } catch (error) {
    console.error('Failed to fetch auto-moderation rule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-moderation rule' },
      { status: 500 }
    )
  }
}

// PUT /api/community/moderation/rules/[id] - Update auto-moderation rule
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      name,
      description,
      isActive,
      priority,
      triggerType,
      targetTypes,
      conditions,
      actions,
      schedule,
      whitelistUsers,
      blacklistUsers,
      exemptRoles,
      cooldownPeriod,
      maxTriggersPerHour,
      metadata
    } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access
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

    // Get current rule for comparison
    const currentRule = await prisma.autoModerationRule.findUnique({
      where: {
        id: params.id,
        workspaceId
      }
    })

    if (!currentRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Validate updated configuration if provided
    if (conditions && actions) {
      const validation = validateRuleConfiguration({
        triggerType: triggerType || currentRule.triggerType,
        targetTypes: targetTypes || currentRule.targetTypes,
        conditions,
        actions,
        schedule
      })

      if (!validation.isValid) {
        return NextResponse.json({ error: validation.errors }, { status: 400 })
      }
    }

    // Update the rule
    const updatedRule = await prisma.autoModerationRule.update({
      where: {
        id: params.id,
        workspaceId
      },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(priority !== undefined && { priority }),
        ...(triggerType !== undefined && { triggerType }),
        ...(targetTypes !== undefined && { targetTypes }),
        ...(conditions !== undefined && { conditions }),
        ...(actions !== undefined && { actions }),
        ...(schedule !== undefined && { schedule }),
        ...(whitelistUsers !== undefined && { whitelistUsers }),
        ...(blacklistUsers !== undefined && { blacklistUsers }),
        ...(exemptRoles !== undefined && { exemptRoles }),
        ...(cooldownPeriod !== undefined && { cooldownPeriod }),
        ...(maxTriggersPerHour !== undefined && { maxTriggersPerHour }),
        ...(metadata !== undefined && { metadata }),
        updatedAt: new Date()
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // Log the update
    await prisma.moderationAction.create({
      data: {
        workspaceId,
        moderatorId: normalizeUserId(session.user.id),
        actionType: 'UPDATE',
        targetType: 'AUTO_MODERATION_RULE',
        targetId: params.id,
        reason: 'Auto-moderation rule updated',
        description: `Updated auto-moderation rule: ${updatedRule.name}`,
        isAutomatic: false,
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        previousData: currentRule,
        newData: updatedRule,
        metadata: {
          ruleUpdate: true,
          changedFields: getChangedFields(currentRule, updatedRule)
        }
      }
    })

    return NextResponse.json({
      success: true,
      rule: {
        id: updatedRule.id,
        name: updatedRule.name,
        description: updatedRule.description,
        isActive: updatedRule.isActive,
        priority: updatedRule.priority,
        triggerType: updatedRule.triggerType,
        targetTypes: updatedRule.targetTypes,
        conditions: updatedRule.conditions,
        actions: updatedRule.actions,
        schedule: updatedRule.schedule,
        updatedAt: updatedRule.updatedAt,
        creator: updatedRule.creator
      }
    })

  } catch (error) {
    console.error('Failed to update auto-moderation rule:', error)
    return NextResponse.json(
      { error: 'Failed to update auto-moderation rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/community/moderation/rules/[id] - Delete auto-moderation rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const reason = searchParams.get('reason') || 'Rule deleted'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access
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

    // Get the rule before deletion for logging
    const rule = await prisma.autoModerationRule.findUnique({
      where: {
        id: params.id,
        workspaceId
      }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    // Check if rule has been triggered recently (safety check)
    const recentActions = await prisma.moderationAction.count({
      where: {
        ruleId: params.id,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    if (recentActions > 0) {
      return NextResponse.json({
        error: 'Cannot delete rule with recent activity. Disable the rule instead.',
        recentActions
      }, { status: 400 })
    }

    // Delete the rule
    await prisma.autoModerationRule.delete({
      where: {
        id: params.id,
        workspaceId
      }
    })

    // Log the deletion
    await prisma.moderationAction.create({
      data: {
        workspaceId,
        moderatorId: normalizeUserId(session.user.id),
        actionType: 'DELETE',
        targetType: 'AUTO_MODERATION_RULE',
        targetId: params.id,
        reason,
        description: `Deleted auto-moderation rule: ${rule.name}`,
        isAutomatic: false,
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        previousData: rule,
        metadata: {
          ruleDeletion: true,
          triggerCount: rule.triggerCount,
          lastTriggered: rule.lastTriggered
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Rule "${rule.name}" deleted successfully`
    })

  } catch (error) {
    console.error('Failed to delete auto-moderation rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete auto-moderation rule' },
      { status: 500 }
    )
  }
}

// PATCH /api/community/moderation/rules/[id] - Toggle rule status or perform specific operations
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, workspaceId, ...data } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has access
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

    // Get the rule
    const rule = await prisma.autoModerationRule.findUnique({
      where: {
        id: params.id,
        workspaceId
      }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    if (action === 'TOGGLE_STATUS') {
      const updatedRule = await prisma.autoModerationRule.update({
        where: {
          id: params.id,
          workspaceId
        },
        data: {
          isActive: !rule.isActive,
          updatedAt: new Date()
        }
      })

      // Log the status change
      await prisma.moderationAction.create({
        data: {
          workspaceId,
          moderatorId: normalizeUserId(session.user.id),
          actionType: 'UPDATE',
          targetType: 'AUTO_MODERATION_RULE',
          targetId: params.id,
          reason: `Rule ${updatedRule.isActive ? 'enabled' : 'disabled'}`,
          description: `${updatedRule.isActive ? 'Enabled' : 'Disabled'} auto-moderation rule: ${rule.name}`,
          isAutomatic: false,
          status: 'COMPLETED',
          reviewedBy: normalizeUserId(session.user.id),
          reviewedAt: new Date(),
          previousData: { isActive: rule.isActive },
          newData: { isActive: updatedRule.isActive },
          metadata: {
            statusToggle: true,
            previousStatus: rule.isActive,
            newStatus: updatedRule.isActive
          }
        }
      })

      return NextResponse.json({
        success: true,
        isActive: updatedRule.isActive,
        message: `Rule ${updatedRule.isActive ? 'enabled' : 'disabled'} successfully`
      })
    }

    if (action === 'RESET_STATISTICS') {
      const updatedRule = await prisma.autoModerationRule.update({
        where: {
          id: params.id,
          workspaceId
        },
        data: {
          triggerCount: 0,
          successRate: 100,
          lastTriggered: null,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Rule statistics reset successfully'
      })
    }

    if (action === 'DUPLICATE_RULE') {
      const { newName } = data

      if (!newName) {
        return NextResponse.json({ error: 'New name is required for duplication' }, { status: 400 })
      }

      const duplicatedRule = await prisma.autoModerationRule.create({
        data: {
          workspaceId,
          name: newName,
          description: `${rule.description} (Copy)`,
          isActive: false, // Start as inactive
          priority: rule.priority,
          triggerType: rule.triggerType,
          targetTypes: rule.targetTypes,
          conditions: rule.conditions,
          actions: rule.actions,
          schedule: rule.schedule,
          whitelistUsers: rule.whitelistUsers,
          blacklistUsers: rule.blacklistUsers,
          exemptRoles: rule.exemptRoles,
          cooldownPeriod: rule.cooldownPeriod,
          maxTriggersPerHour: rule.maxTriggersPerHour,
          createdBy: normalizeUserId(session.user.id),
          triggerCount: 0,
          successRate: 100,
          metadata: {
            ...rule.metadata,
            duplicatedFrom: rule.id,
            duplicatedAt: new Date()
          }
        }
      })

      return NextResponse.json({
        success: true,
        duplicatedRule: {
          id: duplicatedRule.id,
          name: duplicatedRule.name,
          isActive: duplicatedRule.isActive
        },
        message: 'Rule duplicated successfully'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Failed to process rule operation:', error)
    return NextResponse.json(
      { error: 'Failed to process rule operation' },
      { status: 500 }
    )
  }
}

// Helper functions
async function getRuleStatistics(ruleId: string, workspaceId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalTriggers,
    recentTriggers,
    weeklyTriggers,
    successfulActions,
    failedActions,
    avgProcessingTime,
    triggersByDay
  ] = await Promise.all([
    // Total triggers
    prisma.moderationAction.count({
      where: { ruleId, createdAt: { gte: thirtyDaysAgo } }
    }),
    // Recent triggers (last 24 hours)
    prisma.moderationAction.count({
      where: {
        ruleId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    }),
    // Weekly triggers
    prisma.moderationAction.count({
      where: { ruleId, createdAt: { gte: sevenDaysAgo } }
    }),
    // Successful actions
    prisma.moderationAction.count({
      where: {
        ruleId,
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo }
      }
    }),
    // Failed actions
    prisma.moderationAction.count({
      where: {
        ruleId,
        status: 'FAILED',
        createdAt: { gte: thirtyDaysAgo }
      }
    }),
    // Average processing time (mock for now)
    Promise.resolve(250), // milliseconds
    // Triggers by day (last 7 days)
    Array.from({ length: 7 }, async (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = await prisma.moderationAction.count({
        where: {
          ruleId,
          createdAt: { gte: date, lt: nextDate }
        }
      })

      return {
        date: date.toISOString().split('T')[0],
        count
      }
    })
  ])

  const triggersByDayResolved = await Promise.all(triggersByDay)

  const accuracy = totalTriggers > 0 ? (successfulActions / totalTriggers) * 100 : 100

  return {
    totalTriggers,
    recentTriggers,
    weeklyTriggers,
    successfulActions,
    failedActions,
    accuracy: Math.round(accuracy * 100) / 100,
    avgProcessingTime,
    triggersByDay: triggersByDayResolved.reverse() // Show oldest to newest
  }
}

function validateRuleConfiguration(config: any) {
  const errors: string[] = []

  // Validate trigger type
  const validTriggerTypes = ['CONTENT_FILTER', 'SPAM_DETECTION', 'USER_BEHAVIOR', 'RATE_LIMIT', 'KEYWORD_MATCH', 'SENTIMENT_ANALYSIS', 'LINK_ANALYSIS', 'IMAGE_ANALYSIS']
  if (!validTriggerTypes.includes(config.triggerType)) {
    errors.push(`Invalid trigger type: ${config.triggerType}`)
  }

  // Validate target types
  if (!Array.isArray(config.targetTypes) || config.targetTypes.length === 0) {
    errors.push('Target types must be a non-empty array')
  }

  // Validate conditions
  if (!Array.isArray(config.conditions) || config.conditions.length === 0) {
    errors.push('Conditions must be a non-empty array')
  }

  // Validate actions
  if (!Array.isArray(config.actions) || config.actions.length === 0) {
    errors.push('Actions must be a non-empty array')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

function getChangedFields(oldRule: any, newRule: any): string[] {
  const changedFields: string[] = []
  const fieldsToCheck = ['name', 'description', 'isActive', 'priority', 'triggerType', 'targetTypes', 'conditions', 'actions', 'schedule']

  fieldsToCheck.forEach(field => {
    if (JSON.stringify(oldRule[field]) !== JSON.stringify(newRule[field])) {
      changedFields.push(field)
    }
  })

  return changedFields
}