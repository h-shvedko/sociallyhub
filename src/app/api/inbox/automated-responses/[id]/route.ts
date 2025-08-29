import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const userId = await normalizeUserId(session.user.id)

    // Get automation rule with workspace access check
    const automationRule = await prisma.automationRule.findFirst({
      where: {
        id,
        ruleType: 'SMART_RESPONSE',
        workspace: {
          users: {
            some: {
              userId
            }
          }
        }
      }
    })

    if (!automationRule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Transform to match frontend interface
    const response = {
      id: automationRule.id,
      name: automationRule.name,
      description: automationRule.description || '',
      isEnabled: automationRule.isActive,
      triggerType: getTriggerType(automationRule.triggers),
      triggerValue: getTriggerValue(automationRule.triggers),
      responseTemplate: getResponseTemplate(automationRule.actions),
      priority: automationRule.priority,
      delayMinutes: getDelayMinutes(automationRule.actions),
      conditions: getConditions(automationRule.conditions),
      createdAt: automationRule.createdAt.toISOString(),
      lastUsed: automationRule.lastExecutedAt?.toISOString(),
      usageCount: automationRule.executionCount
    }

    return NextResponse.json(response)
  }, 'inbox-automated-responses-get')(request)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const userId = await normalizeUserId(session.user.id)

    // Verify automation rule exists and user has access
    const existingRule = await prisma.automationRule.findFirst({
      where: {
        id,
        ruleType: 'SMART_RESPONSE',
        workspace: {
          users: {
            some: {
              userId
            }
          }
        }
      }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.isEnabled !== undefined) updateData.isActive = body.isEnabled
    if (body.priority !== undefined) updateData.priority = body.priority

    if (body.triggerType && body.triggerValue) {
      updateData.triggers = buildTriggers(body.triggerType, body.triggerValue, body.conditions || {})
    }

    if (body.responseTemplate || body.delayMinutes !== undefined) {
      const delayMinutes = body.delayMinutes || getDelayMinutes(existingRule.actions)
      const responseTemplate = body.responseTemplate || getResponseTemplate(existingRule.actions)
      updateData.actions = buildActions(responseTemplate, delayMinutes)
    }

    if (body.conditions) {
      updateData.conditions = body.conditions
    }

    // Update automation rule
    const updatedRule = await prisma.automationRule.update({
      where: { id },
      data: updateData
    })

    // Transform to match frontend interface
    const response = {
      id: updatedRule.id,
      name: updatedRule.name,
      isEnabled: updatedRule.isActive,
      triggerType: getTriggerType(updatedRule.triggers),
      triggerValue: getTriggerValue(updatedRule.triggers),
      responseTemplate: getResponseTemplate(updatedRule.actions),
      priority: updatedRule.priority,
      delayMinutes: getDelayMinutes(updatedRule.actions),
      conditions: getConditions(updatedRule.conditions),
      createdAt: updatedRule.createdAt.toISOString(),
      lastUsed: updatedRule.lastExecutedAt?.toISOString(),
      usageCount: updatedRule.executionCount
    }

    return NextResponse.json(response)
  }, 'inbox-automated-responses-update')(request)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const userId = await normalizeUserId(session.user.id)

    // Verify automation rule exists and user has access
    const existingRule = await prisma.automationRule.findFirst({
      where: {
        id,
        ruleType: 'SMART_RESPONSE',
        workspace: {
          users: {
            some: {
              userId
            }
          }
        }
      }
    })

    if (!existingRule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Delete automation rule
    await prisma.automationRule.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  }, 'inbox-automated-responses-delete')(request)
}

// Helper functions (same as in the main route file)

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