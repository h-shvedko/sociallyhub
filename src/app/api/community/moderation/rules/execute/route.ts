import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Rule Execution interfaces
interface ExecutionRequest {
  workspaceId: string
  targetType: string
  targetId: string
  content: {
    text?: string
    title?: string
    author?: {
      id: string
      name: string
      karma?: number
      accountAge?: number // days
      previousViolations?: number
    }
    metadata?: {
      ipAddress?: string
      userAgent?: string
      platform?: string
      links?: string[]
      imageUrls?: string[]
      mentions?: string[]
      hashtags?: string[]
    }
  }
  triggerTypes?: string[] // optional filter for specific rule types
  skipCooldown?: boolean // for testing purposes
}

interface ExecutionResult {
  processed: boolean
  executionId: string
  triggeredRules: {
    ruleId: string
    ruleName: string
    priority: number
    conditions: {
      type: string
      matched: boolean
      score: number
      reason: string
    }[]
    actions: {
      type: string
      executed: boolean
      result?: any
      error?: string
    }[]
    overallScore: number
    confidence: number
  }[]
  finalActions: {
    type: string
    status: 'EXECUTED' | 'FAILED' | 'SKIPPED'
    reason?: string
    data?: any
  }[]
  summary: {
    rulesEvaluated: number
    rulesTriggered: number
    actionsExecuted: number
    highestScore: number
    processingTime: number
    needsManualReview: boolean
    escalationLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  recommendation: 'APPROVE' | 'REJECT' | 'REVIEW' | 'ESCALATE'
}

interface RuleExecutionContext {
  workspaceId: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  timestamp: Date
  debugMode?: boolean
}

// POST /api/community/moderation/rules/execute - Execute auto-moderation rules against content
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const body = await request.json() as ExecutionRequest
    const {
      workspaceId,
      targetType,
      targetId,
      content,
      triggerTypes,
      skipCooldown = false
    } = body

    if (!workspaceId || !targetType || !targetId || !content) {
      return NextResponse.json(
        { error: 'Required fields: workspaceId, targetType, targetId, content' },
        { status: 400 }
      )
    }

    // Create execution context
    const context: RuleExecutionContext = {
      workspaceId,
      userId: session?.user?.id ? normalizeUserId(session.user.id) : undefined,
      ipAddress: content.metadata?.ipAddress,
      userAgent: content.metadata?.userAgent,
      timestamp: new Date(),
      debugMode: process.env.NODE_ENV === 'development'
    }

    // Execute the auto-moderation pipeline
    const result = await executeAutoModerationPipeline(
      body,
      context,
      skipCooldown
    )

    return NextResponse.json(result)

  } catch (error) {
    console.error('Failed to execute auto-moderation rules:', error)
    return NextResponse.json(
      { error: 'Failed to execute auto-moderation rules' },
      { status: 500 }
    )
  }
}

// GET /api/community/moderation/rules/execute - Get execution history and statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const targetType = searchParams.get('targetType')
    const ruleId = searchParams.get('ruleId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

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

    // Build filter for execution history
    const where: any = {
      workspaceId,
      isAutomatic: true
    }

    if (targetType) where.targetType = targetType
    if (ruleId) where.ruleId = ruleId

    const [executions, totalCount, statistics] = await Promise.all([
      prisma.moderationAction.findMany({
        where,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              triggerType: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.moderationAction.count({ where }),
      getExecutionStatistics(workspaceId, targetType, ruleId)
    ])

    return NextResponse.json({
      executions: executions.map(exec => ({
        id: exec.id,
        targetType: exec.targetType,
        targetId: exec.targetId,
        actionType: exec.actionType,
        status: exec.status,
        createdAt: exec.createdAt,
        processingTime: exec.metadata?.processingTime || 0,
        ruleId: exec.ruleId,
        ruleName: exec.rule?.name,
        triggerType: exec.rule?.triggerType,
        score: exec.metadata?.score || 0,
        confidence: exec.metadata?.confidence || 0
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      statistics
    })

  } catch (error) {
    console.error('Failed to fetch execution history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch execution history' },
      { status: 500 }
    )
  }
}

// Main execution pipeline
async function executeAutoModerationPipeline(
  request: ExecutionRequest,
  context: RuleExecutionContext,
  skipCooldown: boolean
): Promise<ExecutionResult> {
  const startTime = Date.now()
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const result: ExecutionResult = {
    processed: true,
    executionId,
    triggeredRules: [],
    finalActions: [],
    summary: {
      rulesEvaluated: 0,
      rulesTriggered: 0,
      actionsExecuted: 0,
      highestScore: 0,
      processingTime: 0,
      needsManualReview: false,
      escalationLevel: undefined
    },
    recommendation: 'APPROVE'
  }

  try {
    // 1. Get applicable rules
    const applicableRules = await getApplicableRules(
      request.workspaceId,
      request.targetType,
      request.triggerTypes,
      context
    )

    result.summary.rulesEvaluated = applicableRules.length

    if (applicableRules.length === 0) {
      result.recommendation = 'APPROVE'
      result.summary.processingTime = Date.now() - startTime
      return result
    }

    // 2. Evaluate each rule
    for (const rule of applicableRules) {
      // Check cooldown
      if (!skipCooldown && rule.cooldownPeriod) {
        const lastTriggered = await getLastRuleExecution(rule.id, request.targetId)
        if (lastTriggered && isInCooldown(lastTriggered, rule.cooldownPeriod)) {
          continue
        }
      }

      // Check rate limits
      if (rule.maxTriggersPerHour) {
        const recentTriggers = await getRecentRuleTriggers(rule.id, 60) // last hour
        if (recentTriggers >= rule.maxTriggersPerHour) {
          continue
        }
      }

      // Evaluate rule conditions
      const ruleResult = await evaluateRule(rule, request.content, context)

      if (ruleResult.overallScore > 0.5) { // Rule triggered
        result.triggeredRules.push(ruleResult)
        result.summary.rulesTriggered++
        result.summary.highestScore = Math.max(result.summary.highestScore, ruleResult.overallScore)

        // Execute rule actions
        const actionResults = await executeRuleActions(rule, request, context, ruleResult)
        ruleResult.actions = actionResults
        result.summary.actionsExecuted += actionResults.filter(a => a.executed).length

        // Update rule statistics
        await updateRuleStatistics(rule.id, true, ruleResult.overallScore)
      }
    }

    // 3. Determine final recommendation
    result.recommendation = determineFinalRecommendation(result.triggeredRules)
    result.summary.needsManualReview = shouldRequireManualReview(result.triggeredRules)
    result.summary.escalationLevel = getEscalationLevel(result.summary.highestScore)

    // 4. Consolidate final actions
    result.finalActions = consolidateFinalActions(result.triggeredRules)

    // 5. Log execution results
    await logExecutionResults(request, context, result)

    result.summary.processingTime = Date.now() - startTime

  } catch (error) {
    console.error('Error in auto-moderation pipeline:', error)
    result.processed = false
    result.recommendation = 'REVIEW' // Safe fallback
  }

  return result
}

async function getApplicableRules(
  workspaceId: string,
  targetType: string,
  triggerTypes?: string[],
  context?: RuleExecutionContext
) {
  const where: any = {
    workspaceId,
    isActive: true,
    targetTypes: { has: targetType }
  }

  if (triggerTypes && triggerTypes.length > 0) {
    where.triggerType = { in: triggerTypes }
  }

  // Check schedule if applicable
  const now = new Date()
  const currentHour = now.getHours()
  const currentDay = now.getDay()

  const rules = await prisma.autoModerationRule.findMany({
    where,
    orderBy: { priority: 'desc' }
  })

  // Filter by schedule
  return rules.filter(rule => {
    if (!rule.schedule || !(rule.schedule as any).enabled) {
      return true
    }

    const schedule = rule.schedule as any

    // Check time window
    if (schedule.startTime && schedule.endTime) {
      const [startHour] = schedule.startTime.split(':').map(Number)
      const [endHour] = schedule.endTime.split(':').map(Number)

      if (currentHour < startHour || currentHour > endHour) {
        return false
      }
    }

    // Check days of week
    if (schedule.daysOfWeek && !schedule.daysOfWeek.includes(currentDay)) {
      return false
    }

    return true
  })
}

async function evaluateRule(rule: any, content: any, context: RuleExecutionContext) {
  const ruleResult = {
    ruleId: rule.id,
    ruleName: rule.name,
    priority: rule.priority,
    conditions: [] as any[],
    actions: [] as any[],
    overallScore: 0,
    confidence: 0
  }

  let totalWeight = 0
  let achievedWeight = 0

  // Evaluate each condition
  for (const condition of rule.conditions) {
    const conditionResult = await evaluateCondition(condition, content, context)
    ruleResult.conditions.push(conditionResult)

    const weight = condition.weight || 1
    totalWeight += weight

    if (conditionResult.matched) {
      achievedWeight += weight * conditionResult.score
    }
  }

  ruleResult.overallScore = totalWeight > 0 ? achievedWeight / totalWeight : 0
  ruleResult.confidence = Math.min(ruleResult.overallScore * 100, 95)

  return ruleResult
}

async function evaluateCondition(condition: any, content: any, context: RuleExecutionContext) {
  const { type, operator, value, caseSensitive = false, wholeWord = false } = condition

  let testValue: any
  let targetValue: any = value

  // Extract test value based on condition type
  switch (type) {
    case 'KEYWORD':
      testValue = (content.text || content.title || '').toLowerCase()
      targetValue = caseSensitive ? value : value.toLowerCase()
      break

    case 'LENGTH':
      testValue = (content.text || '').length
      break

    case 'LINKS':
      const linkRegex = /https?:\/\/[^\s]+/g
      testValue = (content.text || '').match(linkRegex)?.length || 0
      break

    case 'CAPS':
      const text = content.text || ''
      const capsCount = (text.match(/[A-Z]/g) || []).length
      testValue = text.length > 0 ? (capsCount / text.length) * 100 : 0
      break

    case 'REPETITION':
      const repeatRegex = /(.)\1{3,}|(\b\w+\b).*\b\2\b.*\b\2\b/gi
      testValue = (content.text || '').match(repeatRegex)?.length || 0
      break

    case 'SENTIMENT':
      // Mock sentiment analysis (in production, use actual NLP service)
      testValue = mockSentimentAnalysis(content.text || '')
      break

    case 'USER_AGE':
      testValue = content.author?.accountAge || 0
      break

    case 'USER_KARMA':
      testValue = content.author?.karma || 0
      break

    case 'TIME_WINDOW':
      // Check if current time is within specified window
      const currentHour = new Date().getHours()
      const [startHour, endHour] = value.split('-').map(Number)
      testValue = currentHour >= startHour && currentHour <= endHour
      break

    default:
      testValue = content.text || ''
  }

  // Evaluate condition
  const matched = evaluateOperator(operator, testValue, targetValue, { caseSensitive, wholeWord })

  return {
    type,
    matched,
    score: matched ? 1 : 0,
    reason: `${type} ${operator} ${value}: ${matched ? 'PASS' : 'FAIL'}`
  }
}

function evaluateOperator(operator: string, testValue: any, targetValue: any, options: any = {}) {
  switch (operator) {
    case 'EQUALS':
      return testValue === targetValue

    case 'CONTAINS':
      if (typeof testValue === 'string') {
        return options.wholeWord
          ? new RegExp(`\\b${targetValue}\\b`, options.caseSensitive ? 'g' : 'gi').test(testValue)
          : testValue.includes(targetValue)
      }
      return false

    case 'NOT_CONTAINS':
      return typeof testValue === 'string' && !testValue.includes(targetValue)

    case 'STARTS_WITH':
      return typeof testValue === 'string' && testValue.startsWith(targetValue)

    case 'ENDS_WITH':
      return typeof testValue === 'string' && testValue.endsWith(targetValue)

    case 'GREATER_THAN':
      return Number(testValue) > Number(targetValue)

    case 'LESS_THAN':
      return Number(testValue) < Number(targetValue)

    case 'MATCHES':
      if (typeof testValue === 'string') {
        try {
          const regex = new RegExp(targetValue, options.caseSensitive ? 'g' : 'gi')
          return regex.test(testValue)
        } catch (e) {
          return false
        }
      }
      return false

    default:
      return false
  }
}

async function executeRuleActions(rule: any, request: ExecutionRequest, context: RuleExecutionContext, ruleResult: any) {
  const actionResults = []

  for (const action of rule.actions) {
    try {
      const executed = await executeAction(action, request, context, ruleResult)
      actionResults.push({
        type: action.type,
        executed: true,
        result: executed
      })
    } catch (error) {
      actionResults.push({
        type: action.type,
        executed: false,
        error: (error as Error).message
      })
    }
  }

  return actionResults
}

async function executeAction(action: any, request: ExecutionRequest, context: RuleExecutionContext, ruleResult: any) {
  const { type, parameters = {} } = action

  switch (type) {
    case 'DELETE':
      return await logModerationAction(
        request.workspaceId,
        'DELETE',
        request.targetType,
        request.targetId,
        context,
        ruleResult,
        'Content deleted by auto-moderation'
      )

    case 'FLAG':
      return await logModerationAction(
        request.workspaceId,
        'FLAG',
        request.targetType,
        request.targetId,
        context,
        ruleResult,
        'Content flagged for review'
      )

    case 'WARN':
      return await logModerationAction(
        request.workspaceId,
        'WARN',
        request.targetType,
        request.targetId,
        context,
        ruleResult,
        parameters.message || 'Automated warning issued'
      )

    case 'QUARANTINE':
      return await logModerationAction(
        request.workspaceId,
        'QUARANTINE',
        request.targetType,
        request.targetId,
        context,
        ruleResult,
        'Content quarantined pending review'
      )

    case 'NOTIFY_MODERATORS':
      // In production, send actual notifications
      return await logModerationAction(
        request.workspaceId,
        'ESCALATE',
        request.targetType,
        request.targetId,
        context,
        ruleResult,
        'Moderators notified for review'
      )

    case 'LOG_ONLY':
      return await logModerationAction(
        request.workspaceId,
        'LOG',
        request.targetType,
        request.targetId,
        context,
        ruleResult,
        'Action logged for analysis'
      )

    default:
      throw new Error(`Unknown action type: ${type}`)
  }
}

async function logModerationAction(
  workspaceId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  context: RuleExecutionContext,
  ruleResult: any,
  description: string
) {
  return await prisma.moderationAction.create({
    data: {
      workspaceId,
      moderatorId: null, // Null for automatic actions
      actionType,
      targetType,
      targetId,
      reason: `Auto-moderation rule: ${ruleResult.ruleName}`,
      description,
      isAutomatic: true,
      ruleId: ruleResult.ruleId,
      status: 'COMPLETED',
      reviewedAt: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        ruleExecution: true,
        executionId: context.timestamp.toISOString(),
        score: ruleResult.overallScore,
        confidence: ruleResult.confidence,
        triggeredConditions: ruleResult.conditions.filter((c: any) => c.matched).map((c: any) => c.type),
        processingTime: Date.now() - context.timestamp.getTime()
      }
    }
  })
}

// Helper functions
function mockSentimentAnalysis(text: string): number {
  // Mock sentiment score (-1 to 1, where -1 is very negative, 1 is very positive)
  const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'worst']
  const positiveWords = ['love', 'great', 'awesome', 'good', 'best']

  const words = text.toLowerCase().split(/\s+/)
  let score = 0

  words.forEach(word => {
    if (negativeWords.some(neg => word.includes(neg))) score -= 1
    if (positiveWords.some(pos => word.includes(pos))) score += 1
  })

  return Math.max(-1, Math.min(1, score / Math.max(words.length / 10, 1)))
}

function determineFinalRecommendation(triggeredRules: any[]): 'APPROVE' | 'REJECT' | 'REVIEW' | 'ESCALATE' {
  if (triggeredRules.length === 0) return 'APPROVE'

  const maxScore = Math.max(...triggeredRules.map(r => r.overallScore))
  const hasHighPriorityRule = triggeredRules.some(r => r.priority >= 8)

  if (maxScore > 0.9 || hasHighPriorityRule) return 'REJECT'
  if (maxScore > 0.7) return 'ESCALATE'
  if (maxScore > 0.5) return 'REVIEW'

  return 'APPROVE'
}

function shouldRequireManualReview(triggeredRules: any[]): boolean {
  return triggeredRules.some(rule =>
    rule.actions.some((action: any) => action.type === 'ESCALATE' || action.parameters?.requireManualReview)
  )
}

function getEscalationLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  if (score < 0.5) return undefined
  if (score < 0.7) return 'LOW'
  if (score < 0.9) return 'MEDIUM'
  return 'HIGH'
}

function consolidateFinalActions(triggeredRules: any[]) {
  const actions = new Map()

  triggeredRules.forEach(rule => {
    rule.actions.forEach((action: any) => {
      if (action.executed) {
        actions.set(action.type, {
          type: action.type,
          status: 'EXECUTED' as const,
          data: action.result
        })
      }
    })
  })

  return Array.from(actions.values())
}

async function updateRuleStatistics(ruleId: string, triggered: boolean, score: number) {
  await prisma.autoModerationRule.update({
    where: { id: ruleId },
    data: {
      triggerCount: { increment: 1 },
      lastTriggered: new Date(),
      // Update success rate based on score (simplified)
      successRate: score > 0.8 ? { increment: 1 } : { decrement: 0.5 }
    }
  })
}

async function logExecutionResults(request: ExecutionRequest, context: RuleExecutionContext, result: ExecutionResult) {
  // Log overall execution for analytics
  if (result.triggeredRules.length > 0) {
    await prisma.moderationAction.create({
      data: {
        workspaceId: request.workspaceId,
        moderatorId: null,
        actionType: 'AUTO_MODERATE',
        targetType: request.targetType,
        targetId: request.targetId,
        reason: 'Auto-moderation pipeline execution',
        description: `Processed ${result.summary.rulesEvaluated} rules, ${result.summary.rulesTriggered} triggered`,
        isAutomatic: true,
        status: 'COMPLETED',
        reviewedAt: new Date(),
        metadata: {
          executionSummary: result.summary,
          recommendation: result.recommendation,
          executionId: result.executionId
        }
      }
    })
  }
}

async function getLastRuleExecution(ruleId: string, targetId: string) {
  const lastExecution = await prisma.moderationAction.findFirst({
    where: { ruleId, targetId },
    orderBy: { createdAt: 'desc' }
  })

  return lastExecution?.createdAt
}

function isInCooldown(lastTriggered: Date, cooldownMinutes: number): boolean {
  const cooldownMs = cooldownMinutes * 60 * 1000
  return Date.now() - lastTriggered.getTime() < cooldownMs
}

async function getRecentRuleTriggers(ruleId: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60 * 1000)
  return await prisma.moderationAction.count({
    where: {
      ruleId,
      createdAt: { gte: since }
    }
  })
}

async function getExecutionStatistics(workspaceId: string, targetType?: string, ruleId?: string) {
  const where: any = { workspaceId, isAutomatic: true }
  if (targetType) where.targetType = targetType
  if (ruleId) where.ruleId = ruleId

  const [
    totalExecutions,
    successfulExecutions,
    avgProcessingTime,
    topRules
  ] = await Promise.all([
    prisma.moderationAction.count({ where }),
    prisma.moderationAction.count({ where: { ...where, status: 'COMPLETED' } }),
    // Mock average processing time
    Promise.resolve(245),
    prisma.moderationAction.groupBy({
      by: ['ruleId'],
      where,
      _count: { ruleId: true },
      orderBy: { _count: { ruleId: 'desc' } },
      take: 5
    })
  ])

  return {
    totalExecutions,
    successfulExecutions,
    successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 100,
    avgProcessingTime,
    topRules: topRules.map(rule => ({
      ruleId: rule.ruleId,
      executionCount: rule._count.ruleId
    }))
  }
}