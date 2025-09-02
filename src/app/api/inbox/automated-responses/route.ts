import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Normalize user ID and verify workspace access
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get automated responses (SMART_RESPONSE automation rules)
    const automationRules = await prisma.automationRule.findMany({
      where: {
        workspaceId,
        ruleType: 'SMART_RESPONSE'
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Transform to match frontend interface
    const responses = automationRules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      isEnabled: rule.isActive,
      triggerType: getTriggerType(rule.triggers),
      triggerValue: getTriggerValue(rule.triggers),
      responseTemplate: getResponseTemplate(rule.actions),
      priority: rule.priority,
      delayMinutes: getDelayMinutes(rule.actions),
      conditions: getConditions(rule.conditions),
      createdAt: rule.createdAt.toISOString(),
      lastUsed: rule.lastExecutedAt?.toISOString(),
      usageCount: rule.executionCount
    }))

    return NextResponse.json(responses)
  }, 'inbox-automated-responses-list')(request)
}

export async function POST(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      name,
      isEnabled = true,
      triggerType,
      triggerValue,
      responseTemplate,
      priority = 3,
      delayMinutes = 0,
      conditions = {}
    } = body

    if (!workspaceId || !name || !triggerType || !triggerValue || !responseTemplate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Normalize user ID and verify workspace access
    const userId = await normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Create automation rule
    const automationRule = await prisma.automationRule.create({
      data: {
        workspaceId,
        name,
        description: `Automated response: ${name}`,
        ruleType: 'SMART_RESPONSE',
        isActive: isEnabled,
        priority,
        triggers: buildTriggers(triggerType, triggerValue, conditions),
        conditions: conditions,
        actions: buildActions(responseTemplate, delayMinutes)
      }
    })

    // Transform to match frontend interface
    const response = {
      id: automationRule.id,
      name: automationRule.name,
      isEnabled: automationRule.isActive,
      triggerType,
      triggerValue,
      responseTemplate,
      priority: automationRule.priority,
      delayMinutes,
      conditions,
      createdAt: automationRule.createdAt.toISOString(),
      usageCount: 0
    }

    return NextResponse.json(response, { status: 201 })
  }, 'inbox-automated-responses-create')(request)
}

// Helper functions to transform data between database and frontend formats

function getTriggerType(triggers: any): string {
  const triggerData = triggers as any
  if (triggerData.sentiment) return 'sentiment'
  if (triggerData.keywords) return 'keyword'
  if (triggerData.platforms) return 'platform'
  if (triggerData.timeRanges) return 'time_based'
  return 'keyword'
}

function getTriggerValue(triggers: any): string {
  const triggerData = triggers as any
  if (triggerData.sentiment) return triggerData.sentiment
  if (triggerData.keywords) return triggerData.keywords.join(', ')
  if (triggerData.platforms) return triggerData.platforms.join(', ')
  if (triggerData.timeRanges) return 'custom_schedule'
  return ''
}

function getResponseTemplate(actions: any): string {
  const actionData = actions as any
  return actionData.responseMessage || ''
}

function getDelayMinutes(actions: any): number {
  const actionData = actions as any
  return actionData.delayMinutes || 0
}

function getConditions(conditions: any): any {
  return {
    platforms: conditions.platforms || [],
    messageTypes: conditions.messageTypes || [],
    sentiments: conditions.sentiments || [],
    keywords: conditions.keywords || [],
    timeRanges: conditions.timeRanges || []
  }
}

function buildTriggers(triggerType: string, triggerValue: string, conditions: any): any {
  const triggers: any = {}
  
  switch (triggerType) {
    case 'sentiment':
      triggers.sentiment = triggerValue
      break
    case 'keyword':
      triggers.keywords = triggerValue.split(',').map(k => k.trim())
      break
    case 'platform':
      triggers.platforms = triggerValue.split(',').map(p => p.trim())
      break
    case 'time_based':
      triggers.timeRanges = conditions.timeRanges || []
      break
  }
  
  return triggers
}

function buildActions(responseTemplate: string, delayMinutes: number): any {
  return {
    type: 'send_response',
    responseMessage: responseTemplate,
    delayMinutes
  }
}