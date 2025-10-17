import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Auto-Moderation Rules interfaces
interface AutoModerationRule {
  id: string
  name: string
  description: string
  isActive: boolean
  priority: number
  triggerType: 'CONTENT_FILTER' | 'SPAM_DETECTION' | 'USER_BEHAVIOR' | 'RATE_LIMIT' | 'KEYWORD_MATCH' | 'SENTIMENT_ANALYSIS' | 'LINK_ANALYSIS' | 'IMAGE_ANALYSIS'
  targetTypes: string[]
  conditions: RuleCondition[]
  actions: RuleAction[]
  schedule?: RuleSchedule
  whitelistUsers?: string[]
  blacklistUsers?: string[]
  exemptRoles?: string[]
  cooldownPeriod?: number // minutes
  maxTriggersPerHour?: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  lastTriggered?: Date
  triggerCount: number
  successRate: number
  metadata?: any
}

interface RuleCondition {
  type: 'KEYWORD' | 'REGEX' | 'LENGTH' | 'LINKS' | 'CAPS' | 'REPETITION' | 'SENTIMENT' | 'LANGUAGE' | 'USER_AGE' | 'USER_KARMA' | 'TIME_WINDOW'
  operator: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GREATER_THAN' | 'LESS_THAN' | 'MATCHES' | 'NOT_CONTAINS'
  value: any
  weight?: number // for scoring systems
  caseSensitive?: boolean
  wholeWord?: boolean
}

interface RuleAction {
  type: 'DELETE' | 'FLAG' | 'WARN' | 'SUSPEND' | 'BAN' | 'QUARANTINE' | 'AUTO_REPLY' | 'ESCALATE' | 'NOTIFY_MODERATORS' | 'LOG_ONLY'
  parameters?: {
    duration?: number // for suspensions/bans
    message?: string // for auto-replies/warnings
    notifyUser?: boolean
    requireManualReview?: boolean
    escalationLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
    moderatorIds?: string[]
  }
  weight?: number // for multiple action scoring
}

interface RuleSchedule {
  enabled: boolean
  startTime?: string // HH:MM format
  endTime?: string // HH:MM format
  daysOfWeek?: number[] // 0-6, Sunday=0
  timezone?: string
}

interface RuleTestResult {
  ruleId: string
  matched: boolean
  score: number
  triggeredConditions: string[]
  recommendedActions: string[]
  processingTime: number
  confidence: number
}

// GET /api/community/moderation/rules - List auto-moderation rules
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const isActive = searchParams.get('isActive')
    const triggerType = searchParams.get('triggerType')
    const targetType = searchParams.get('targetType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
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

    // Build filter conditions
    const where: any = { workspaceId }

    if (isActive !== null) where.isActive = isActive === 'true'
    if (triggerType) where.triggerType = triggerType
    if (targetType) {
      where.targetTypes = { has: targetType }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [rules, totalCount] = await Promise.all([
      prisma.autoModerationRule.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          actions: includeStats ? {
            where: { ruleId: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              actionType: true,
              targetId: true,
              status: true,
              createdAt: true
            }
          } : false
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.autoModerationRule.count({ where })
    ])

    // Format rules for response
    const formattedRules = rules.map(rule => ({
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
      recentActions: includeStats ? rule.actions : undefined
    }))

    return NextResponse.json({
      rules: formattedRules,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      filters: {
        isActive,
        triggerType,
        targetType,
        search
      }
    })

  } catch (error) {
    console.error('Failed to fetch auto-moderation rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-moderation rules' },
      { status: 500 }
    )
  }
}

// POST /api/community/moderation/rules - Create new auto-moderation rule
export async function POST(request: NextRequest) {
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
      triggerType,
      targetTypes,
      conditions,
      actions,
      priority = 5,
      schedule,
      whitelistUsers,
      blacklistUsers,
      exemptRoles,
      cooldownPeriod,
      maxTriggersPerHour,
      metadata
    } = body

    if (!workspaceId || !name || !triggerType || !targetTypes || !conditions || !actions) {
      return NextResponse.json(
        { error: 'Required fields: workspaceId, name, triggerType, targetTypes, conditions, actions' },
        { status: 400 }
      )
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

    // Validate rule configuration
    const validation = validateRuleConfiguration({
      triggerType,
      targetTypes,
      conditions,
      actions,
      schedule
    })

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.errors }, { status: 400 })
    }

    // Create the rule
    const rule = await prisma.autoModerationRule.create({
      data: {
        workspaceId,
        name,
        description,
        isActive: true,
        priority,
        triggerType,
        targetTypes,
        conditions,
        actions,
        schedule: schedule || undefined,
        whitelistUsers: whitelistUsers || [],
        blacklistUsers: blacklistUsers || [],
        exemptRoles: exemptRoles || [],
        cooldownPeriod: cooldownPeriod || undefined,
        maxTriggersPerHour: maxTriggersPerHour || undefined,
        createdBy: normalizeUserId(session.user.id),
        triggerCount: 0,
        successRate: 100,
        metadata: metadata || {}
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

    // Log rule creation
    await prisma.moderationAction.create({
      data: {
        workspaceId,
        moderatorId: normalizeUserId(session.user.id),
        actionType: 'CREATE',
        targetType: 'AUTO_MODERATION_RULE',
        targetId: rule.id,
        reason: 'Auto-moderation rule created',
        description: `Created auto-moderation rule: ${name}`,
        isAutomatic: false,
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        newData: rule,
        metadata: {
          ruleCreation: true,
          triggerType,
          targetTypes
        }
      }
    })

    return NextResponse.json({
      success: true,
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
        createdBy: rule.createdBy,
        createdAt: rule.createdAt,
        creator: rule.creator
      }
    })

  } catch (error) {
    console.error('Failed to create auto-moderation rule:', error)
    return NextResponse.json(
      { error: 'Failed to create auto-moderation rule' },
      { status: 500 }
    )
  }
}

// PUT /api/community/moderation/rules - Test rule against content or bulk operations
export async function PUT(request: NextRequest) {
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

    if (action === 'TEST_RULE') {
      const { ruleId, testContent } = data
      const testResult = await testRuleAgainstContent(workspaceId, ruleId, testContent)
      return NextResponse.json({ testResult })
    }

    if (action === 'BULK_TOGGLE') {
      const { ruleIds, isActive } = data
      const result = await bulkToggleRules(workspaceId, ruleIds, isActive, session.user.id!)
      return NextResponse.json({ result })
    }

    if (action === 'BULK_PRIORITY_UPDATE') {
      const { ruleUpdates } = data // [{ ruleId, priority }]
      const result = await bulkUpdatePriorities(workspaceId, ruleUpdates, session.user.id!)
      return NextResponse.json({ result })
    }

    if (action === 'SIMULATE_RULES') {
      const { content, targetType } = data
      const simulation = await simulateAllRules(workspaceId, content, targetType)
      return NextResponse.json({ simulation })
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

// Helper functions for rule processing
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

  config.conditions.forEach((condition: RuleCondition, index: number) => {
    if (!condition.type || !condition.operator || condition.value === undefined) {
      errors.push(`Condition ${index + 1}: type, operator, and value are required`)
    }
  })

  // Validate actions
  if (!Array.isArray(config.actions) || config.actions.length === 0) {
    errors.push('Actions must be a non-empty array')
  }

  config.actions.forEach((action: RuleAction, index: number) => {
    if (!action.type) {
      errors.push(`Action ${index + 1}: type is required`)
    }
  })

  // Validate schedule if provided
  if (config.schedule) {
    const schedule = config.schedule as RuleSchedule
    if (schedule.enabled) {
      if (schedule.startTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.startTime)) {
        errors.push('Invalid start time format (use HH:MM)')
      }
      if (schedule.endTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.endTime)) {
        errors.push('Invalid end time format (use HH:MM)')
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

async function testRuleAgainstContent(workspaceId: string, ruleId: string, testContent: any): Promise<RuleTestResult> {
  const startTime = Date.now()

  // Get the rule
  const rule = await prisma.autoModerationRule.findUnique({
    where: { id: ruleId, workspaceId }
  })

  if (!rule) {
    throw new Error('Rule not found')
  }

  const result: RuleTestResult = {
    ruleId,
    matched: false,
    score: 0,
    triggeredConditions: [],
    recommendedActions: [],
    processingTime: 0,
    confidence: 0
  }

  // Test each condition
  let totalScore = 0
  let maxScore = 0

  for (const condition of rule.conditions as RuleCondition[]) {
    const conditionResult = evaluateCondition(condition, testContent)
    const weight = condition.weight || 1

    maxScore += weight
    if (conditionResult.matched) {
      totalScore += weight * conditionResult.score
      result.triggeredConditions.push(`${condition.type}: ${conditionResult.reason}`)
    }
  }

  result.score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
  result.matched = result.score > 50 // Default threshold

  if (result.matched) {
    // Determine recommended actions based on triggered conditions and rule actions
    result.recommendedActions = (rule.actions as RuleAction[]).map(action => action.type)
  }

  result.confidence = Math.min(result.score, 95) // Cap confidence at 95%
  result.processingTime = Date.now() - startTime

  return result
}

function evaluateCondition(condition: RuleCondition, content: any): { matched: boolean; score: number; reason: string } {
  const { type, operator, value, caseSensitive = false, wholeWord = false } = condition

  let testValue: any
  let targetValue: any = value

  // Extract the test value based on condition type
  switch (type) {
    case 'KEYWORD':
      testValue = content.text || content.content || ''
      break
    case 'LENGTH':
      testValue = (content.text || content.content || '').length
      break
    case 'LINKS':
      const linkRegex = /https?:\/\/[^\s]+/g
      testValue = (content.text || content.content || '').match(linkRegex)?.length || 0
      break
    case 'CAPS':
      const text = content.text || content.content || ''
      const capsCount = (text.match(/[A-Z]/g) || []).length
      testValue = text.length > 0 ? (capsCount / text.length) * 100 : 0
      break
    case 'REPETITION':
      // Check for repeated characters or words
      const repeatRegex = /(.)\1{3,}|(\b\w+\b).*\b\2\b.*\b\2\b/gi
      testValue = (content.text || content.content || '').match(repeatRegex)?.length || 0
      break
    case 'USER_AGE':
      testValue = content.userAge || 0
      break
    case 'USER_KARMA':
      testValue = content.userKarma || 0
      break
    default:
      testValue = content.text || content.content || ''
  }

  // Apply case sensitivity for string operations
  if (typeof testValue === 'string' && !caseSensitive) {
    testValue = testValue.toLowerCase()
    if (typeof targetValue === 'string') {
      targetValue = targetValue.toLowerCase()
    }
  }

  // Evaluate the condition based on operator
  let matched = false
  let reason = ''

  switch (operator) {
    case 'EQUALS':
      matched = testValue === targetValue
      reason = matched ? `Value equals ${targetValue}` : `Value does not equal ${targetValue}`
      break

    case 'CONTAINS':
      if (typeof testValue === 'string') {
        if (wholeWord) {
          const wordRegex = new RegExp(`\\b${targetValue}\\b`, caseSensitive ? 'g' : 'gi')
          matched = wordRegex.test(testValue)
        } else {
          matched = testValue.includes(targetValue)
        }
        reason = matched ? `Contains "${targetValue}"` : `Does not contain "${targetValue}"`
      }
      break

    case 'NOT_CONTAINS':
      if (typeof testValue === 'string') {
        matched = !testValue.includes(targetValue)
        reason = matched ? `Does not contain "${targetValue}"` : `Contains "${targetValue}"`
      }
      break

    case 'STARTS_WITH':
      if (typeof testValue === 'string') {
        matched = testValue.startsWith(targetValue)
        reason = matched ? `Starts with "${targetValue}"` : `Does not start with "${targetValue}"`
      }
      break

    case 'ENDS_WITH':
      if (typeof testValue === 'string') {
        matched = testValue.endsWith(targetValue)
        reason = matched ? `Ends with "${targetValue}"` : `Does not end with "${targetValue}"`
      }
      break

    case 'GREATER_THAN':
      matched = Number(testValue) > Number(targetValue)
      reason = matched ? `${testValue} > ${targetValue}` : `${testValue} <= ${targetValue}`
      break

    case 'LESS_THAN':
      matched = Number(testValue) < Number(targetValue)
      reason = matched ? `${testValue} < ${targetValue}` : `${testValue} >= ${targetValue}`
      break

    case 'MATCHES':
      if (typeof testValue === 'string') {
        try {
          const regex = new RegExp(targetValue, caseSensitive ? 'g' : 'gi')
          matched = regex.test(testValue)
          reason = matched ? `Matches pattern "${targetValue}"` : `Does not match pattern "${targetValue}"`
        } catch (e) {
          matched = false
          reason = `Invalid regex pattern: ${targetValue}`
        }
      }
      break

    default:
      matched = false
      reason = `Unknown operator: ${operator}`
  }

  // Calculate score based on confidence
  const score = matched ? 1 : 0

  return { matched, score, reason }
}

async function bulkToggleRules(workspaceId: string, ruleIds: string[], isActive: boolean, userId: string) {
  const updated = await prisma.autoModerationRule.updateMany({
    where: {
      id: { in: ruleIds },
      workspaceId
    },
    data: { isActive, updatedAt: new Date() }
  })

  // Log the bulk operation
  await prisma.moderationAction.create({
    data: {
      workspaceId,
      moderatorId: normalizeUserId(userId),
      actionType: 'BULK_UPDATE',
      targetType: 'AUTO_MODERATION_RULE',
      targetId: ruleIds.join(','),
      reason: `Bulk ${isActive ? 'enabled' : 'disabled'} rules`,
      description: `Bulk ${isActive ? 'enabled' : 'disabled'} ${updated.count} auto-moderation rules`,
      isAutomatic: false,
      status: 'COMPLETED',
      reviewedBy: normalizeUserId(userId),
      reviewedAt: new Date(),
      metadata: {
        bulkOperation: true,
        ruleIds,
        isActive,
        affectedCount: updated.count
      }
    }
  })

  return {
    success: true,
    updatedCount: updated.count,
    message: `${updated.count} rule(s) ${isActive ? 'enabled' : 'disabled'}`
  }
}

async function bulkUpdatePriorities(workspaceId: string, ruleUpdates: { ruleId: string; priority: number }[], userId: string) {
  const results = []

  for (const update of ruleUpdates) {
    const result = await prisma.autoModerationRule.update({
      where: {
        id: update.ruleId,
        workspaceId
      },
      data: {
        priority: update.priority,
        updatedAt: new Date()
      }
    })
    results.push(result)
  }

  // Log the bulk operation
  await prisma.moderationAction.create({
    data: {
      workspaceId,
      moderatorId: normalizeUserId(userId),
      actionType: 'BULK_UPDATE',
      targetType: 'AUTO_MODERATION_RULE',
      targetId: ruleUpdates.map(u => u.ruleId).join(','),
      reason: 'Bulk priority update',
      description: `Bulk updated priorities for ${results.length} auto-moderation rules`,
      isAutomatic: false,
      status: 'COMPLETED',
      reviewedBy: normalizeUserId(userId),
      reviewedAt: new Date(),
      metadata: {
        bulkOperation: true,
        priorityUpdates: ruleUpdates,
        affectedCount: results.length
      }
    }
  })

  return {
    success: true,
    updatedCount: results.length,
    message: `Updated priorities for ${results.length} rule(s)`
  }
}

async function simulateAllRules(workspaceId: string, content: any, targetType: string) {
  // Get all active rules for the target type
  const rules = await prisma.autoModerationRule.findMany({
    where: {
      workspaceId,
      isActive: true,
      targetTypes: { has: targetType }
    },
    orderBy: { priority: 'desc' }
  })

  const simulation = {
    totalRules: rules.length,
    matchedRules: [] as any[],
    recommendedActions: [] as string[],
    overallScore: 0,
    processingTime: 0
  }

  const startTime = Date.now()
  let totalScore = 0

  for (const rule of rules) {
    const testResult = await testRuleAgainstContent(workspaceId, rule.id, content)

    if (testResult.matched) {
      simulation.matchedRules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        score: testResult.score,
        triggeredConditions: testResult.triggeredConditions,
        actions: (rule.actions as RuleAction[]).map(a => a.type)
      })

      // Add actions to recommendations (avoiding duplicates)
      const ruleActions = (rule.actions as RuleAction[]).map(a => a.type)
      ruleActions.forEach(action => {
        if (!simulation.recommendedActions.includes(action)) {
          simulation.recommendedActions.push(action)
        }
      })
    }

    totalScore += testResult.score
  }

  simulation.overallScore = rules.length > 0 ? totalScore / rules.length : 0
  simulation.processingTime = Date.now() - startTime

  return simulation
}