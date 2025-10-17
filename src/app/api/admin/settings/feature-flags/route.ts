import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/feature-flags - List feature flags
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const environment = searchParams.get('environment')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    const includeGlobal = searchParams.get('includeGlobal') === 'true'

    // Check workspace permissions if specified
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Build where clause
    const where: any = {}

    if (workspaceId) {
      if (includeGlobal) {
        where.OR = [
          { workspaceId: workspaceId },
          { workspaceId: null }
        ]
      } else {
        where.workspaceId = workspaceId
      }
    } else if (!includeGlobal) {
      where.workspaceId = null // Global flags only
    }

    if (category) {
      where.category = category
    }

    if (environment) {
      where.environment = environment
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ]
    }

    const flags = await prisma.featureFlag.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { evaluations: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group by category
    const flagsByCategory = flags.reduce((acc, flag) => {
      if (!acc[flag.category]) {
        acc[flag.category] = []
      }
      acc[flag.category].push({
        ...flag,
        evaluationCount: flag._count.evaluations
      })
      return acc
    }, {} as Record<string, any[]>)

    // Get statistics
    const stats = {
      totalFlags: flags.length,
      categories: Object.keys(flagsByCategory).length,
      activeFlags: flags.filter(f => f.isActive).length,
      globalFlags: flags.filter(f => !f.workspaceId).length,
      workspaceFlags: flags.filter(f => f.workspaceId).length,
      flagsWithTargeting: flags.filter(f =>
        f.userTargeting || f.groupTargeting || f.geoTargeting || f.timeTargeting
      ).length,
      recentlyEvaluated: flags.filter(f => {
        if (!f.lastEvaluated) return false
        const hoursSinceEval = (Date.now() - new Date(f.lastEvaluated).getTime()) / (1000 * 60 * 60)
        return hoursSinceEval <= 24
      }).length
    }

    return NextResponse.json({
      flags: flagsByCategory,
      stats,
      total: flags.length
    })

  } catch (error) {
    console.error('Failed to fetch feature flags:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/feature-flags - Create feature flag
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      workspaceId,
      name,
      key,
      description,
      category,
      isActive = false,
      rolloutPercent = 0,
      userTargeting,
      groupTargeting,
      geoTargeting,
      timeTargeting,
      conditions,
      variants,
      defaultVariant,
      prerequisites,
      tags = [],
      environment = 'PRODUCTION',
      expiresAt
    } = body

    // Validate required fields
    if (!name || !key || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, key, category' },
        { status: 400 }
      )
    }

    // Check workspace permissions if specified
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Validate category
    const validCategories = [
      'FEATURE', 'EXPERIMENT', 'ROLLOUT', 'KILL_SWITCH', 'PERMISSION',
      'CONFIGURATION', 'UI_VARIATION', 'INTEGRATION', 'PERFORMANCE', 'SECURITY'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate environment
    const validEnvironments = ['DEVELOPMENT', 'STAGING', 'PRODUCTION', 'TEST']
    if (!validEnvironments.includes(environment)) {
      return NextResponse.json(
        { error: `Invalid environment. Must be one of: ${validEnvironments.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate rollout percentage
    if (rolloutPercent < 0 || rolloutPercent > 100) {
      return NextResponse.json(
        { error: 'Rollout percentage must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Check for existing flag with same key
    const existingFlag = await prisma.featureFlag.findFirst({
      where: {
        workspaceId: workspaceId || null,
        key
      }
    })

    if (existingFlag) {
      return NextResponse.json(
        { error: 'Feature flag with this key already exists' },
        { status: 409 }
      )
    }

    // Create flag
    const flag = await prisma.featureFlag.create({
      data: {
        workspaceId: workspaceId || null,
        name,
        key,
        description,
        category,
        isActive,
        rolloutPercent,
        userTargeting,
        groupTargeting,
        geoTargeting,
        timeTargeting,
        conditions,
        variants,
        defaultVariant,
        prerequisites,
        tags,
        environment,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: normalizedUserId,
        lastUpdatedBy: normalizedUserId
      },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ flag }, { status: 201 })

  } catch (error) {
    console.error('Failed to create feature flag:', error)
    return NextResponse.json(
      { error: 'Failed to create feature flag' },
      { status: 500 }
    )
  }
}