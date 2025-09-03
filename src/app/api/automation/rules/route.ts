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

    const rules = await prisma.automationRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })

    BusinessLogger.logWorkspaceAction('automation_rules_viewed', workspaceId, session.user.id, {
      rulesCount: rules.length
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching automation rules:', error)
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
    const { 
      workspaceId, 
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

    if (!workspaceId || !name || !ruleType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to workspace and sufficient permissions
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const rule = await prisma.automationRule.create({
      data: {
        workspaceId,
        name,
        description,
        ruleType,
        triggers: triggers || {},
        conditions: conditions || {},
        actions: actions || {},
        isActive: isActive ?? true,
        priority: priority || 3,
        maxExecutionsPerHour: maxExecutionsPerHour || 10,
        maxExecutionsPerDay: maxExecutionsPerDay || 100
      }
    })

    BusinessLogger.logWorkspaceAction('automation_rule_created', workspaceId, session.user.id, {
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.ruleType
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    console.error('Error creating automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}