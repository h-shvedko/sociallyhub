import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/notifications - List notification configurations
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
    const eventType = searchParams.get('eventType')
    const isEnabled = searchParams.get('isEnabled')
    const priority = searchParams.get('priority')
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
      where.workspaceId = null
    }

    if (category) {
      where.category = category
    }

    if (eventType) {
      where.eventType = { contains: eventType, mode: 'insensitive' }
    }

    if (isEnabled !== null) {
      where.isEnabled = isEnabled === 'true'
    }

    if (priority) {
      where.priority = priority
    }

    const configurations = await prisma.notificationConfiguration.findMany({
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
        { priority: 'desc' },
        { category: 'asc' },
        { eventType: 'asc' }
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

    // Channel analysis
    const channelStats = configurations.reduce((acc, config) => {
      config.channels.forEach((channel: string) => {
        if (!acc[channel]) {
          acc[channel] = { total: 0, enabled: 0, disabled: 0 }
        }
        acc[channel].total++
        if (config.isEnabled) acc[channel].enabled++
        else acc[channel].disabled++
      })
      return acc
    }, {} as Record<string, any>)

    // Frequency analysis
    const frequencyStats = configurations.reduce((acc, config) => {
      if (!acc[config.frequency]) {
        acc[config.frequency] = 0
      }
      acc[config.frequency]++
      return acc
    }, {} as Record<string, number>)

    // Get statistics
    const stats = {
      totalConfigurations: configurations.length,
      categories: Object.keys(configsByCategory).length,
      enabledConfigurations: configurations.filter(c => c.isEnabled).length,
      criticalPriority: configurations.filter(c => c.priority === 'CRITICAL').length,
      emergencyPriority: configurations.filter(c => c.priority === 'EMERGENCY').length,
      recentlyTriggered: configurations.filter(c => {
        if (!c.lastTriggered) return false
        const hoursAgo = (Date.now() - new Date(c.lastTriggered).getTime()) / (1000 * 60 * 60)
        return hoursAgo <= 24
      }).length,
      totalTriggers: configurations.reduce((sum, c) => sum + c.triggerCount, 0),
      channelDistribution: channelStats,
      frequencyDistribution: frequencyStats
    }

    return NextResponse.json({
      configurations: configsByCategory,
      stats,
      total: configurations.length
    })

  } catch (error) {
    console.error('Failed to fetch notification configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification configurations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/notifications - Create notification configuration
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
      eventType,
      isEnabled = true,
      channels = ['EMAIL'],
      defaultRecipients,
      template,
      frequency = 'INSTANT',
      quietHours,
      conditions,
      customMessage,
      priority = 'NORMAL',
      retryAttempts = 3,
      batchSize
    } = body

    // Validate required fields
    if (!category || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields: category, eventType' },
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
      'SECURITY', 'SYSTEM', 'USER_ACTIVITY', 'CONTENT', 'CAMPAIGNS',
      'BILLING', 'INTEGRATIONS', 'PERFORMANCE', 'ALERTS', 'REPORTS',
      'COMPLIANCE', 'BACKUP', 'MAINTENANCE'
    ]

    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate channels
    const validChannels = ['EMAIL', 'PUSH', 'IN_APP', 'SMS', 'WEBHOOK', 'SLACK', 'DISCORD', 'TEAMS']
    const invalidChannels = channels.filter((ch: string) => !validChannels.includes(ch))
    if (invalidChannels.length > 0) {
      return NextResponse.json(
        { error: `Invalid channels: ${invalidChannels.join(', ')}. Valid channels: ${validChannels.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate frequency
    const validFrequencies = ['INSTANT', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate priority
    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL', 'EMERGENCY']
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      )
    }

    // Check for existing configuration
    const existingConfig = await prisma.notificationConfiguration.findFirst({
      where: {
        workspaceId: workspaceId || null,
        category,
        eventType
      }
    })

    if (existingConfig) {
      return NextResponse.json(
        { error: 'Notification configuration for this category and event type already exists' },
        { status: 409 }
      )
    }

    // Validate quiet hours format if provided
    if (quietHours) {
      const isValidQuietHours = (qh: any) => {
        return qh.startTime && qh.endTime && qh.timezone &&
               Array.isArray(qh.days) && qh.days.every((day: string) =>
                 ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day.toLowerCase())
               )
      }

      if (!isValidQuietHours(quietHours)) {
        return NextResponse.json(
          { error: 'Invalid quiet hours format. Must include startTime, endTime, timezone, and days array' },
          { status: 400 }
        )
      }
    }

    // Create configuration
    const configuration = await prisma.notificationConfiguration.create({
      data: {
        workspaceId: workspaceId || null,
        category,
        eventType,
        isEnabled,
        channels,
        defaultRecipients,
        template,
        frequency,
        quietHours,
        conditions,
        customMessage,
        priority,
        retryAttempts,
        batchSize,
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
    console.error('Failed to create notification configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create notification configuration' },
      { status: 500 }
    )
  }
}