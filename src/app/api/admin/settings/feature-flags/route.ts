import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requirePlatformAdmin, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { canAccessGlobalScope } from '../_lib/global-scope'

// GET /api/admin/settings/feature-flags - List feature flags
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const environment = searchParams.get('environment')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    let includeGlobal = searchParams.get('includeGlobal') === 'true'

    // Two-tier authorization (ADR-0004): workspace scope requires OWNER/ADMIN
    // membership; any global-scope read is platform-admin-only.
    if (workspaceId) {
      const membership = await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])
      if (includeGlobal && !(await canAccessGlobalScope(membership.userId))) {
        // Mixed scope: restrict to the caller's workspace instead of 403ing.
        includeGlobal = false
      }
    } else {
      // Global scope (with includeGlobal=true this lists ALL workspaces' rows).
      await requirePlatformAdmin()
    }

    // Build where clause. Scope and search are composed with AND — the
    // previous code let the search OR overwrite the scope OR, leaking
    // rows from other workspaces when workspaceId+includeGlobal+search
    // were combined.
    const where: any = {}

    if (workspaceId) {
      if (includeGlobal) {
        where.AND = [{
          OR: [
            { workspaceId: workspaceId },
            { workspaceId: null }
          ]
        }]
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
      const searchFilter = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { key: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } }
        ]
      }
      if (where.AND) {
        where.AND.push(searchFilter)
      } else {
        where.OR = searchFilter.OR
      }
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
    return handleApiError(error)
  }
}

// POST /api/admin/settings/feature-flags - Create feature flag
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()
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
      return jsonError(400, 'Missing required fields: name, key, category')
    }

    // Two-tier authorization (ADR-0004): workspace mutation requires
    // OWNER/ADMIN membership; global-scope mutation is platform-admin-only.
    if (workspaceId) {
      await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])
    } else {
      await requirePlatformAdmin()
    }

    // Validate category
    const validCategories = [
      'FEATURE', 'EXPERIMENT', 'ROLLOUT', 'KILL_SWITCH', 'PERMISSION',
      'CONFIGURATION', 'UI_VARIATION', 'INTEGRATION', 'PERFORMANCE', 'SECURITY'
    ]

    if (!validCategories.includes(category)) {
      return jsonError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`)
    }

    // Validate environment
    const validEnvironments = ['DEVELOPMENT', 'STAGING', 'PRODUCTION', 'TEST']
    if (!validEnvironments.includes(environment)) {
      return jsonError(400, `Invalid environment. Must be one of: ${validEnvironments.join(', ')}`)
    }

    // Validate rollout percentage
    if (rolloutPercent < 0 || rolloutPercent > 100) {
      return jsonError(400, 'Rollout percentage must be between 0 and 100')
    }

    // Check for existing flag with same key
    const existingFlag = await prisma.featureFlag.findFirst({
      where: {
        workspaceId: workspaceId || null,
        key
      }
    })

    if (existingFlag) {
      return jsonError(409, 'Feature flag with this key already exists')
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
        createdBy: user.id,
        lastUpdatedBy: user.id
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
    return handleApiError(error)
  }
}
