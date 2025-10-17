import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/backup - List backup configurations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const backupType = searchParams.get('backupType')
    const storageLocation = searchParams.get('storageLocation')
    const isActive = searchParams.get('isActive')
    const includeRecords = searchParams.get('includeRecords') === 'true'
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

    if (backupType) {
      where.backupType = backupType
    }

    if (storageLocation) {
      where.storageLocation = storageLocation
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    const configurations = await prisma.backupConfiguration.findMany({
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
        ...(includeRecords && {
          backupRecords: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              filename: true,
              fileSize: true,
              status: true,
              startTime: true,
              endTime: true,
              duration: true
            }
          }
        })
      },
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' }
      ]
    })

    // Group by storage location
    const configsByStorage = configurations.reduce((acc, config) => {
      if (!acc[config.storageLocation]) {
        acc[config.storageLocation] = []
      }
      acc[config.storageLocation].push(config)
      return acc
    }, {} as Record<string, any[]>)

    // Calculate next run times for active configurations
    const configsWithNextRun = configurations.map(config => ({
      ...config,
      nextRunCalculated: config.isActive ? calculateNextRun(config.schedule) : null
    }))

    // Get recent backup records for statistics
    const recentRecords = await prisma.backupRecord.findMany({
      where: {
        workspaceId: workspaceId || null,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate statistics
    const stats = {
      totalConfigurations: configurations.length,
      activeConfigurations: configurations.filter(c => c.isActive).length,
      storageLocations: Object.keys(configsByStorage).length,
      totalBackupSize: recentRecords.reduce((sum, record) => sum + Number(record.fileSize), 0),
      recentBackups: recentRecords.length,
      successfulBackups: recentRecords.filter(r => r.status === 'COMPLETED').length,
      failedBackups: recentRecords.filter(r => r.status === 'FAILED').length,
      lastSuccessfulBackup: recentRecords.find(r => r.status === 'COMPLETED')?.createdAt || null,
      nextScheduledBackup: configsWithNextRun
        .filter(c => c.nextRunCalculated)
        .sort((a, b) => new Date(a.nextRunCalculated!).getTime() - new Date(b.nextRunCalculated!).getTime())[0]?.nextRunCalculated || null,
      averageBackupDuration: recentRecords.filter(r => r.duration)
        .reduce((sum, r, _, arr) => sum + (r.duration! / arr.length), 0) || 0,
      retentionStatus: {
        totalStored: recentRecords.length,
        expiringSoon: recentRecords.filter(r => {
          if (!r.expiresAt) return false
          const daysUntilExpiry = (new Date(r.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          return daysUntilExpiry <= 7
        }).length
      }
    }

    // Calculate success rate
    const totalBackupsWithStatus = stats.successfulBackups + stats.failedBackups
    const successRate = totalBackupsWithStatus > 0
      ? Math.round((stats.successfulBackups / totalBackupsWithStatus) * 100)
      : 100

    return NextResponse.json({
      configurations: configsByStorage,
      stats: {
        ...stats,
        successRate
      },
      recentRecords: recentRecords.slice(0, 10), // Latest 10 records
      total: configurations.length
    })

  } catch (error) {
    console.error('Failed to fetch backup configurations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch backup configurations' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/backup - Create backup configuration
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
      backupType,
      schedule,
      isActive = true,
      retention = 30,
      compression = true,
      encryption = true,
      includeMedia = true,
      excludePatterns,
      storageLocation,
      storageConfig,
      notifications,
      priority = 'NORMAL',
      maxSize,
      parallelJobs = 1
    } = body

    // Validate required fields
    if (!name || !backupType || !schedule || !storageLocation || !storageConfig) {
      return NextResponse.json(
        { error: 'Missing required fields: name, backupType, schedule, storageLocation, storageConfig' },
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

    // Validate backup type
    const validBackupTypes = ['FULL', 'INCREMENTAL', 'DIFFERENTIAL', 'DATABASE_ONLY', 'MEDIA_ONLY', 'CONFIGURATION_ONLY']
    if (!validBackupTypes.includes(backupType)) {
      return NextResponse.json(
        { error: `Invalid backup type. Must be one of: ${validBackupTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate storage location
    const validStorageLocations = ['LOCAL', 'AWS_S3', 'AZURE_BLOB', 'GCP_STORAGE', 'DROPBOX', 'GOOGLE_DRIVE', 'FTP', 'SFTP', 'CUSTOM']
    if (!validStorageLocations.includes(storageLocation)) {
      return NextResponse.json(
        { error: `Invalid storage location. Must be one of: ${validStorageLocations.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate priority
    const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL']
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate cron schedule format (basic validation)
    if (!isValidCronExpression(schedule)) {
      return NextResponse.json(
        { error: 'Invalid cron schedule format. Use standard cron syntax (e.g., "0 2 * * *" for daily at 2 AM)' },
        { status: 400 }
      )
    }

    // Check for existing configuration with same name
    const existingConfig = await prisma.backupConfiguration.findFirst({
      where: {
        workspaceId: workspaceId || null,
        name
      }
    })

    if (existingConfig) {
      return NextResponse.json(
        { error: 'Backup configuration with this name already exists' },
        { status: 409 }
      )
    }

    // Create configuration
    const configuration = await prisma.backupConfiguration.create({
      data: {
        workspaceId: workspaceId || null,
        name,
        backupType,
        schedule,
        isActive,
        retention,
        compression,
        encryption,
        includeMedia,
        excludePatterns,
        storageLocation,
        storageConfig,
        notifications,
        priority,
        maxSize: maxSize ? BigInt(maxSize) : null,
        parallelJobs,
        nextRun: calculateNextRun(schedule),
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

    return NextResponse.json({ configuration }, { status: 201 })

  } catch (error) {
    console.error('Failed to create backup configuration:', error)
    return NextResponse.json(
      { error: 'Failed to create backup configuration' },
      { status: 500 }
    )
  }
}

// Helper function to validate cron expression (basic validation)
function isValidCronExpression(cron: string): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const patterns = [
    /^(\*|[0-5]?[0-9]|[0-5]?[0-9]-[0-5]?[0-9]|[0-5]?[0-9]\/[0-9]+|\*\/[0-9]+)$/, // minute
    /^(\*|[01]?[0-9]|2[0-3]|[01]?[0-9]-[01]?[0-9]|2[0-3]-2[0-3]|[01]?[0-9]\/[0-9]+|\*\/[0-9]+)$/, // hour
    /^(\*|[01]?[0-9]|2[0-9]|3[01]|[01]?[0-9]-[01]?[0-9]|[01]?[0-9]\/[0-9]+|\*\/[0-9]+)$/, // day
    /^(\*|[01]?[0-9]|1[0-2]|[01]?[0-9]-[01]?[0-9]|1[0-2]-1[0-2]|[01]?[0-9]\/[0-9]+|\*\/[0-9]+)$/, // month
    /^(\*|[0-6]|[0-6]-[0-6]|[0-6]\/[0-9]+|\*\/[0-9]+)$/ // day of week
  ]

  return parts.every((part, index) => patterns[index].test(part))
}

// Helper function to calculate next run time from cron schedule
function calculateNextRun(cronSchedule: string): Date {
  // This is a simplified implementation
  // In production, use a proper cron parsing library like 'node-cron' or 'cron-parser'

  const now = new Date()
  const parts = cronSchedule.split(' ')

  // For demo purposes, assume daily backup at specified hour
  if (parts[1] !== '*') {
    const hour = parseInt(parts[1])
    const nextRun = new Date(now)
    nextRun.setHours(hour, 0, 0, 0)

    // If the time has passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }

    return nextRun
  }

  // Default to next hour for other patterns
  const nextRun = new Date(now)
  nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0)
  return nextRun
}