import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/security - List security configurations
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
    const severity = searchParams.get('severity')
    const isEnabled = searchParams.get('isEnabled')
    const includeGlobal = searchParams.get('includeGlobal') === 'true'
    const auditStatus = searchParams.get('auditStatus')

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
      where.workspaceId = null
    }

    if (category) {
      where.category = category
    }

    if (severity) {
      where.severity = severity
    }

    if (isEnabled !== null) {
      where.isEnabled = isEnabled === 'true'
    }

    if (auditStatus) {
      where.auditResult = auditStatus
    }

    const configurations = await prisma.securityConfiguration.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [
        { severity: 'desc' },
        { category: 'asc' },
        { setting: 'asc' }
      ]
    })

    // Group by category
    const configsByCategory = configurations.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = []
      }
      acc[config.category].push(config)
      return acc
    }, {} as Record<string, any[]>)

    // Security compliance status
    const complianceStats = configurations.reduce((acc, config) => {
      if (config.complianceStandards) {
        const standards = Array.isArray(config.complianceStandards)
          ? config.complianceStandards
          : Object.keys(config.complianceStandards as any)

        standards.forEach((standard: string) => {
          if (!acc[standard]) {
            acc[standard] = { total: 0, passing: 0, failing: 0, warning: 0 }
          }
          acc[standard].total++

          if (config.auditResult === 'PASS') acc[standard].passing++
          else if (config.auditResult === 'FAIL') acc[standard].failing++
          else if (config.auditResult === 'WARNING') acc[standard].warning++
        })
      }
      return acc
    }, {} as Record<string, any>)

    // Get statistics
    const stats = {
      totalConfigurations: configurations.length,
      categories: Object.keys(configsByCategory).length,
      enabledConfigurations: configurations.filter(c => c.isEnabled).length,
      criticalConfigurations: configurations.filter(c => c.severity === 'CRITICAL').length,
      highSeverity: configurations.filter(c => c.severity === 'HIGH').length,
      recentViolations: configurations.filter(c => {
        if (!c.lastViolation) return false
        const daysSinceViolation = (Date.now() - new Date(c.lastViolation).getTime()) / (1000 * 60 * 60 * 24)
        return daysSinceViolation <= 7
      }).length,
      passedAudits: configurations.filter(c => c.auditResult === 'PASS').length,
      failedAudits: configurations.filter(c => c.auditResult === 'FAIL').length,
      lastAudit: configurations
        .filter(c => c.lastAudit)
        .sort((a, b) => new Date(b.lastAudit!).getTime() - new Date(a.lastAudit!).getTime())[0]?.lastAudit || null
    }

    // Calculate security score (0-100)
    const totalAudited = stats.passedAudits + stats.failedAudits
    const securityScore = totalAudited > 0
      ? Math.round((stats.passedAudits / totalAudited) * 100)
      : 0

    return NextResponse.json({
      configurations: configsByCategory,
      complianceStats,
      stats: {
        ...stats,
        securityScore
      },
      total: configurations.length
    })

  } catch (error) {
    console.error('Failed to fetch security configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch security configurations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/security - Create security configuration
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
      category,
      setting,
      value,
      isEnabled = true,
      severity = 'MEDIUM',
      description,
      recommendedValue,
      complianceStandards,
      autoRemediation = false,
      remediationScript,
      alertThreshold
    } = body

    // Validate required fields
    if (!category || !setting || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: category, setting, value' },
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
      'AUTHENTICATION', 'AUTHORIZATION', 'ENCRYPTION', 'NETWORK', 'COMPLIANCE',
      'AUDIT', 'PASSWORD_POLICY', 'SESSION_MANAGEMENT', 'API_SECURITY',
      'DATA_PROTECTION', 'INCIDENT_RESPONSE', 'VULNERABILITY'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate severity
    const validSeverities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for existing configuration
    const existingConfig = await prisma.securityConfiguration.findFirst({
      where: {
        workspaceId: workspaceId || null,
        category,
        setting
      }
    })

    if (existingConfig) {
      return NextResponse.json(
        { error: 'Security configuration with this category and setting already exists' },
        { status: 409 }
      )
    }

    // Create configuration
    const configuration = await prisma.securityConfiguration.create({
      data: {
        workspaceId: workspaceId || null,
        category,
        setting,
        value: String(value),
        isEnabled,
        severity,
        description,
        recommendedValue,
        complianceStandards,
        autoRemediation,
        remediationScript,
        alertThreshold,
        lastUpdatedBy: normalizedUserId
      },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ configuration }, { status: 201 })

  } catch (error) {
    console.error('Failed to create security configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create security configuration' },
      { status: 500 }
    )
  }
}