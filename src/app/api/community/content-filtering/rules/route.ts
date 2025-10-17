import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/content-filtering/rules - List auto-moderation rules
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

    // Build where clause
    const where: any = {
      ...(workspaceId && { workspaceId }),
      ...(isActive !== null && { isActive: isActive === 'true' }),
      ...(triggerType && { triggerType })
    }

    const rules = await prisma.autoModerationRule.findMany({
      where,
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
      },
      orderBy: [
        { isActive: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Get rule execution statistics
    const ruleStats = await Promise.all(
      rules.map(async (rule) => {
        const [executionCount, recentExecutions] = await Promise.all([
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
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
              }
            }
          })
        ])

        return {
          ruleId: rule.id,
          totalExecutions: executionCount,
          recentExecutions
        }
      })
    )

    const rulesWithStats = rules.map(rule => ({
      ...rule,
      stats: ruleStats.find(stat => stat.ruleId === rule.id)
    }))

    return NextResponse.json({
      rules: rulesWithStats,
      total: rules.length,
      active: rules.filter(r => r.isActive).length,
      inactive: rules.filter(r => !r.isActive).length
    })

  } catch (error) {
    console.error('Failed to fetch auto-moderation rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-moderation rules' },
      { status: 500 }
    )
  }
}

// POST /api/community/content-filtering/rules - Create auto-moderation rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      triggerType, // KEYWORD_MATCH, SPAM_SCORE, USER_HISTORY, LINK_COUNT, etc.
      triggerConditions,
      actionType, // AUTO_APPROVE, AUTO_REJECT, FLAG_FOR_REVIEW, etc.
      actionParameters,
      priority = 'MEDIUM',
      workspaceId,
      isActive = true
    } = body

    // Validation
    if (!name || !triggerType || !actionType || !workspaceId) {
      return NextResponse.json(
        { error: 'Name, trigger type, action type, and workspace ID are required' },
        { status: 400 }
      )
    }

    // Verify user has moderation permissions
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

    // Create the rule
    const rule = await prisma.autoModerationRule.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        triggerType,
        triggerConditions,
        actionType,
        actionParameters,
        priority,
        workspaceId,
        isActive,
        createdById: normalizeUserId(session.user.id),
        updatedById: normalizeUserId(session.user.id)
      },
      include: {
        createdBy: {
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
        title: 'Auto-moderation rule created',
        description: `Created rule: ${name}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Admin',
        userAvatar: session.user.image,
        targetId: rule.id,
        targetType: 'moderation_rule',
        targetTitle: name,
        workspaceId,
        metadata: {
          ruleType: triggerType,
          actionType,
          priority,
          isActive
        }
      }
    })

    return NextResponse.json(rule, { status: 201 })

  } catch (error) {
    console.error('Failed to create auto-moderation rule:', error)
    return NextResponse.json(
      { error: 'Failed to create auto-moderation rule' },
      { status: 500 }
    )
  }
}

// Common rule templates for quick setup
const RULE_TEMPLATES = {
  spam_keywords: {
    name: 'Spam Keywords Filter',
    description: 'Automatically flag posts containing common spam keywords',
    triggerType: 'KEYWORD_MATCH',
    triggerConditions: {
      keywords: ['buy now', 'click here', 'free money', 'make money fast'],
      matchType: 'ANY',
      caseSensitive: false
    },
    actionType: 'FLAG_FOR_REVIEW',
    actionParameters: {
      priority: 'HIGH',
      reason: 'Potential spam content detected'
    },
    priority: 'HIGH'
  },
  profanity_filter: {
    name: 'Profanity Filter',
    description: 'Automatically reject posts with excessive profanity',
    triggerType: 'PROFANITY_SCORE',
    triggerConditions: {
      threshold: 3,
      action: 'REJECT'
    },
    actionType: 'AUTO_REJECT',
    actionParameters: {
      reason: 'Content contains excessive profanity'
    },
    priority: 'HIGH'
  },
  link_limit: {
    name: 'Link Limit Filter',
    description: 'Flag posts with too many external links',
    triggerType: 'LINK_COUNT',
    triggerConditions: {
      maxLinks: 3,
      includeInternal: false
    },
    actionType: 'FLAG_FOR_REVIEW',
    actionParameters: {
      priority: 'MEDIUM',
      reason: 'Post contains multiple external links'
    },
    priority: 'MEDIUM'
  },
  new_user_restriction: {
    name: 'New User Restriction',
    description: 'Require manual approval for posts from users with account age < 7 days',
    triggerType: 'USER_HISTORY',
    triggerConditions: {
      accountAge: 7,
      unit: 'days',
      operator: 'LESS_THAN'
    },
    actionType: 'FLAG_FOR_REVIEW',
    actionParameters: {
      priority: 'MEDIUM',
      reason: 'Post from new user account'
    },
    priority: 'MEDIUM'
  },
  repeat_offender: {
    name: 'Repeat Offender Monitor',
    description: 'Automatically flag content from users with multiple violations',
    triggerType: 'USER_VIOLATIONS',
    triggerConditions: {
      violationCount: 3,
      timeframe: 30,
      unit: 'days'
    },
    actionType: 'FLAG_FOR_REVIEW',
    actionParameters: {
      priority: 'HIGH',
      reason: 'Content from user with multiple violations'
    },
    priority: 'HIGH'
  }
}

// GET /api/community/content-filtering/rules/templates - Get rule templates
export async function GET_TEMPLATES(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      templates: Object.entries(RULE_TEMPLATES).map(([key, template]) => ({
        id: key,
        ...template
      }))
    })

  } catch (error) {
    console.error('Failed to fetch rule templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rule templates' },
      { status: 500 }
    )
  }
}