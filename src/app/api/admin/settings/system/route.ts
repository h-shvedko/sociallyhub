import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/system - List system configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const workspaceId = searchParams.get('workspaceId')
    const includeGlobal = searchParams.get('includeGlobal') === 'true'

    // Check admin permissions
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
    if (category) {
      where.category = category
    }

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
      where.workspaceId = null // Global settings only
    }

    const configurations = await prisma.systemConfiguration.findMany({
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
        { key: 'asc' }
      ]
    })

    // Group by category for easier frontend consumption
    const configsByCategory = configurations.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = []
      }
      acc[config.category].push({
        ...config,
        // Mask secret values
        value: config.isSecret ? '***HIDDEN***' : config.value
      })
      return acc
    }, {} as Record<string, any[]>)

    // Get configuration statistics
    const stats = {
      totalConfigurations: configurations.length,
      categories: Object.keys(configsByCategory).length,
      secretConfigurations: configurations.filter(c => c.isSecret).length,
      requiredConfigurations: configurations.filter(c => c.isRequired).length,
      globalConfigurations: configurations.filter(c => !c.workspaceId).length,
      workspaceConfigurations: configurations.filter(c => c.workspaceId).length
    }

    return NextResponse.json({
      configurations: configsByCategory,
      stats,
      total: configurations.length
    })

  } catch (error) {
    console.error('Failed to fetch system configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch system configurations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/system - Create system configuration
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
      key,
      value,
      dataType,
      description,
      isRequired = false,
      isSecret = false,
      validationRules,
      defaultValue
    } = body

    // Validate required fields
    if (!category || !key || value === undefined || !dataType) {
      return NextResponse.json(
        { error: 'Missing required fields: category, key, value, dataType' },
        { status: 400 }
      )
    }

    // Check admin permissions
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

    // Validate data type
    const validDataTypes = ['STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON', 'URL', 'EMAIL', 'PASSWORD', 'TEXT', 'ENUM']
    if (!validDataTypes.includes(dataType)) {
      return NextResponse.json(
        { error: `Invalid dataType. Must be one of: ${validDataTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate value based on data type
    const validateValue = (val: string, type: string): boolean => {
      switch (type) {
        case 'INTEGER':
          return !isNaN(parseInt(val)) && isFinite(parseInt(val))
        case 'FLOAT':
          return !isNaN(parseFloat(val)) && isFinite(parseFloat(val))
        case 'BOOLEAN':
          return val === 'true' || val === 'false'
        case 'JSON':
          try {
            JSON.parse(val)
            return true
          } catch {
            return false
          }
        case 'URL':
          try {
            new URL(val)
            return true
          } catch {
            return false
          }
        case 'EMAIL':
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
        default:
          return true
      }
    }

    if (!validateValue(value, dataType)) {
      return NextResponse.json(
        { error: `Invalid value for data type ${dataType}` },
        { status: 400 }
      )
    }

    // Check for existing configuration
    const existing = await prisma.systemConfiguration.findFirst({
      where: {
        workspaceId: workspaceId || null,
        category,
        key
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Configuration with this category and key already exists' },
        { status: 409 }
      )
    }

    // Create configuration
    const configuration = await prisma.systemConfiguration.create({
      data: {
        workspaceId: workspaceId || null,
        category,
        key,
        value: String(value),
        dataType,
        description,
        isRequired,
        isSecret,
        validationRules,
        defaultValue,
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

    return NextResponse.json({
      configuration: {
        ...configuration,
        // Mask secret values
        value: configuration.isSecret ? '***HIDDEN***' : configuration.value
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to create system configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create system configuration' },
      { status: 500 }
    )
  }
}