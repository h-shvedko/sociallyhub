import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
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

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Verify workspace access (ADR-0004): any member of THIS workspace.
    await requireWorkspaceRole(workspaceId)

    const rules = await prisma.automationRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    })

    BusinessLogger.logWorkspaceAction('automation_rules_viewed', workspaceId, session.user.id, {
      rulesCount: rules.length
    })

    return NextResponse.json(rules)
  } catch (error) {
    return handleApiError(error)
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

    // Verify workspace access (ADR-0004): same role set as the old inline check.
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

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
    return handleApiError(error)
  }
}