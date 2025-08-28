import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { BusinessLogger } from '@/lib/middleware/logging'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rule = await prisma.automationRule.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id
            }
          }
        }
      },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10
        }
      }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error fetching automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Find the rule and verify access
    const existingRule = await prisma.automationRule.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
            }
          }
        }
      }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found or access denied' }, { status: 404 })
    }

    const updatedRule = await prisma.automationRule.update({
      where: { id: params.id },
      data: {
        ...body,
        updatedAt: new Date()
      }
    })

    BusinessLogger.logWorkspaceAction('automation_rule_updated', existingRule.workspaceId, session.user.id, {
      ruleId: updatedRule.id,
      ruleName: updatedRule.name,
      changes: body
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error updating automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      name, 
      description, 
      ruleType, 
      triggers, 
      conditions, 
      actions, 
      isActive,
      priority,
      maxExecutionsPerHour,
      maxExecutionsPerDay
    } = body

    // Find the rule and verify access
    const existingRule = await prisma.automationRule.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
            }
          }
        }
      }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found or access denied' }, { status: 404 })
    }

    const updatedRule = await prisma.automationRule.update({
      where: { id: params.id },
      data: {
        name: name || existingRule.name,
        description: description ?? existingRule.description,
        ruleType: ruleType || existingRule.ruleType,
        triggers: triggers || existingRule.triggers,
        conditions: conditions || existingRule.conditions,
        actions: actions || existingRule.actions,
        isActive: isActive ?? existingRule.isActive,
        priority: priority ?? existingRule.priority,
        maxExecutionsPerHour: maxExecutionsPerHour ?? existingRule.maxExecutionsPerHour,
        maxExecutionsPerDay: maxExecutionsPerDay ?? existingRule.maxExecutionsPerDay,
        updatedAt: new Date()
      }
    })

    BusinessLogger.logWorkspaceAction('automation_rule_updated', existingRule.workspaceId, session.user.id, {
      ruleId: updatedRule.id,
      ruleName: updatedRule.name,
      updateType: 'full_update'
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error updating automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the rule and verify access
    const existingRule = await prisma.automationRule.findFirst({
      where: {
        id: params.id,
        workspace: {
          users: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN'] } // Only owners and admins can delete rules
            }
          }
        }
      }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found or access denied' }, { status: 404 })
    }

    // Delete all executions first due to foreign key constraints
    await prisma.automationExecution.deleteMany({
      where: { ruleId: params.id }
    })

    // Delete the rule
    await prisma.automationRule.delete({
      where: { id: params.id }
    })

    BusinessLogger.logWorkspaceAction('automation_rule_deleted', existingRule.workspaceId, session.user.id, {
      ruleId: existingRule.id,
      ruleName: existingRule.name,
      ruleType: existingRule.ruleType
    })

    return NextResponse.json({ message: 'Rule deleted successfully' })
  } catch (error) {
    console.error('Error deleting automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}