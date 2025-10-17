import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/performance - List performance configurations
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
    const isAutoTuning = searchParams.get('isAutoTuning')
    const includeGlobal = searchParams.get('includeGlobal') === 'true'
    const includeMetrics = searchParams.get('includeMetrics') === 'true'

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

    if (isAutoTuning !== null) {
      where.isAutoTuning = isAutoTuning === 'true'
    }

    const configurations = await prisma.performanceConfiguration.findMany({
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

    // Get current performance metrics if requested
    let currentMetrics = {}
    if (includeMetrics) {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const metricsData = await prisma.systemHealthMetric.findMany({
        where: {
          workspaceId: workspaceId || null,
          category: 'PERFORMANCE',
          collectedAt: { gte: last24Hours }
        },
        orderBy: { collectedAt: 'desc' },
        take: 100
      })

      currentMetrics = metricsData.reduce((acc, metric) => {
        if (!acc[metric.metric]) {
          acc[metric.metric] = []
        }
        acc[metric.metric].push({
          value: metric.value,
          timestamp: metric.collectedAt,
          status: metric.status
        })
        return acc
      }, {} as Record<string, any[]>)
    }

    // Performance analysis
    const performanceAnalysis = configurations.reduce((acc, config) => {
      const category = config.category

      if (!acc[category]) {
        acc[category] = {
          configurations: 0,
          optimized: 0,
          needsAttention: 0,
          autoTuning: 0,
          lastOptimized: null,
          avgImpactScore: 0
        }
      }

      acc[category].configurations++

      if (config.isAutoTuning) acc[category].autoTuning++

      if (config.currentMetric && config.threshold) {
        if (config.currentMetric < config.threshold) acc[category].optimized++
        else acc[category].needsAttention++
      }

      if (config.lastOptimized) {
        if (!acc[category].lastOptimized ||
            new Date(config.lastOptimized) > new Date(acc[category].lastOptimized)) {
          acc[category].lastOptimized = config.lastOptimized
        }
      }

      if (config.impactScore) {
        acc[category].avgImpactScore =
          (acc[category].avgImpactScore * (acc[category].configurations - 1) + config.impactScore) /
          acc[category].configurations
      }

      return acc
    }, {} as Record<string, any>)

    // Get statistics
    const stats = {
      totalConfigurations: configurations.length,
      categories: Object.keys(configsByCategory).length,
      autoTuningEnabled: configurations.filter(c => c.isAutoTuning).length,
      optimizedConfigurations: configurations.filter(c => {
        return c.currentMetric && c.threshold && c.currentMetric < c.threshold
      }).length,
      recentlyOptimized: configurations.filter(c => {
        if (!c.lastOptimized) return false
        const hoursAgo = (Date.now() - new Date(c.lastOptimized).getTime()) / (1000 * 60 * 60)
        return hoursAgo <= 24
      }).length,
      avgPerformanceScore: configurations.length > 0
        ? configurations.reduce((sum, c) => {
            if (!c.currentMetric || !c.benchmarkValue) return sum
            return sum + Math.min(100, (c.benchmarkValue / c.currentMetric) * 100)
          }, 0) / configurations.length
        : 100,
      criticalIssues: configurations.filter(c => {
        return c.currentMetric && c.criticalThreshold && c.currentMetric >= c.criticalThreshold
      }).length
    }

    return NextResponse.json({
      configurations: configsByCategory,
      performanceAnalysis,
      currentMetrics,
      stats,
      total: configurations.length
    })

  } catch (error) {
    console.error('Failed to fetch performance configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance configurations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/performance - Create performance configuration
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
      dataType,
      unit,
      threshold,
      criticalThreshold,
      isAutoTuning = false,
      autoTuningRules,
      impactScore,
      benchmarkValue,
      recommendations,
      dependencies
    } = body

    // Validate required fields
    if (!category || !setting || value === undefined || !dataType) {
      return NextResponse.json(
        { error: 'Missing required fields: category, setting, value, dataType' },
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
      'DATABASE', 'CACHE', 'STORAGE', 'NETWORK', 'CPU', 'MEMORY',
      'DISK', 'API', 'FRONTEND', 'QUEUE', 'SEARCH', 'CDN'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate data type
    const validDataTypes = ['STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON', 'URL', 'EMAIL', 'PASSWORD', 'TEXT', 'ENUM']
    if (!validDataTypes.includes(dataType)) {
      return NextResponse.json(
        { error: `Invalid dataType. Must be one of: ${validDataTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate impact score
    if (impactScore !== undefined && (impactScore < 1 || impactScore > 10)) {
      return NextResponse.json(
        { error: 'Impact score must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Validate thresholds
    if (threshold !== undefined && criticalThreshold !== undefined && criticalThreshold <= threshold) {
      return NextResponse.json(
        { error: 'Critical threshold must be greater than warning threshold' },
        { status: 400 }
      )
    }

    // Check for existing configuration
    const existingConfig = await prisma.performanceConfiguration.findFirst({
      where: {
        workspaceId: workspaceId || null,
        category,
        setting
      }
    })

    if (existingConfig) {
      return NextResponse.json(
        { error: 'Performance configuration with this category and setting already exists' },
        { status: 409 }
      )
    }

    // Create configuration
    const configuration = await prisma.performanceConfiguration.create({
      data: {
        workspaceId: workspaceId || null,
        category,
        setting,
        value: String(value),
        dataType,
        unit,
        threshold,
        criticalThreshold,
        isAutoTuning,
        autoTuningRules,
        impactScore,
        benchmarkValue,
        recommendations,
        dependencies,
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
    console.error('Failed to create performance configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create performance configuration' },
      { status: 500 }
    )
  }
}