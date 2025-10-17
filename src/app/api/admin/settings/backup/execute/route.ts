import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// POST /api/admin/settings/backup/execute - Execute backup
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const { configurationId, immediate = false } = body

    if (!configurationId) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      )
    }

    // Get backup configuration
    const configuration = await prisma.backupConfiguration.findUnique({
      where: { id: configurationId },
      include: {
        workspace: {
          select: { id: true, name: true }
        }
      }
    })

    if (!configuration) {
      return NextResponse.json({ error: 'Backup configuration not found' }, { status: 404 })
    }

    // Check permissions
    if (configuration.workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: configuration.workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Check if configuration is active
    if (!configuration.isActive && !immediate) {
      return NextResponse.json(
        { error: 'Cannot execute inactive backup configuration' },
        { status: 400 }
      )
    }

    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${configuration.name}-${timestamp}.${configuration.compression ? 'tar.gz' : 'tar'}`
    const filePath = `/backups/${configuration.workspaceId || 'global'}/${filename}`

    // Mock backup execution
    const executeBackup = async (config: any): Promise<{
      success: boolean
      fileSize: bigint
      duration: number
      recordCount?: number
      checksum: string
      errorMessage?: string
    }> => {
      const startTime = Date.now()

      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))

      // Mock success/failure (95% success rate)
      const success = Math.random() > 0.05

      if (!success) {
        return {
          success: false,
          fileSize: BigInt(0),
          duration: Date.now() - startTime,
          errorMessage: 'Backup failed due to insufficient storage space',
          checksum: ''
        }
      }

      // Mock backup data based on type
      let fileSize = BigInt(0)
      let recordCount = 0

      switch (config.backupType) {
        case 'FULL':
          fileSize = BigInt(Math.floor(Math.random() * 2000000000) + 500000000) // 500MB-2GB
          recordCount = Math.floor(Math.random() * 1000000) + 100000
          break
        case 'INCREMENTAL':
          fileSize = BigInt(Math.floor(Math.random() * 100000000) + 10000000) // 10MB-100MB
          recordCount = Math.floor(Math.random() * 50000) + 5000
          break
        case 'DIFFERENTIAL':
          fileSize = BigInt(Math.floor(Math.random() * 500000000) + 50000000) // 50MB-500MB
          recordCount = Math.floor(Math.random() * 200000) + 20000
          break
        case 'DATABASE_ONLY':
          fileSize = BigInt(Math.floor(Math.random() * 200000000) + 50000000) // 50MB-200MB
          recordCount = Math.floor(Math.random() * 500000) + 50000
          break
        case 'MEDIA_ONLY':
          fileSize = BigInt(Math.floor(Math.random() * 5000000000) + 1000000000) // 1GB-5GB
          recordCount = Math.floor(Math.random() * 10000) + 1000
          break
        case 'CONFIGURATION_ONLY':
          fileSize = BigInt(Math.floor(Math.random() * 10000000) + 1000000) // 1MB-10MB
          recordCount = Math.floor(Math.random() * 1000) + 100
          break
      }

      // Apply compression reduction
      if (config.compression) {
        fileSize = BigInt(Math.floor(Number(fileSize) * 0.3)) // 30% of original size
      }

      // Generate mock checksum
      const checksum = generateMockChecksum(filename)

      return {
        success: true,
        fileSize,
        duration: Date.now() - startTime,
        recordCount,
        checksum
      }
    }

    // Start backup execution
    const startTime = new Date()

    // Create backup record immediately
    const backupRecord = await prisma.backupRecord.create({
      data: {
        configurationId: configuration.id,
        workspaceId: configuration.workspaceId,
        filename,
        filePath,
        fileSize: BigInt(0),
        checksum: '',
        backupType: configuration.backupType,
        status: 'IN_PROGRESS',
        startTime,
        metadata: {
          triggeredBy: normalizedUserId,
          triggerType: immediate ? 'manual' : 'scheduled',
          compression: configuration.compression,
          encryption: configuration.encryption,
          includeMedia: configuration.includeMedia
        }
      }
    })

    // Execute backup (in production, this would be a background job)
    try {
      const result = await executeBackup(configuration)

      const endTime = new Date()

      // Update backup record with results
      const updatedRecord = await prisma.backupRecord.update({
        where: { id: backupRecord.id },
        data: {
          status: result.success ? 'COMPLETED' : 'FAILED',
          endTime,
          duration: Math.floor(result.duration / 1000), // Convert to seconds
          fileSize: result.fileSize,
          recordCount: result.recordCount,
          checksum: result.checksum,
          errorMessage: result.errorMessage,
          ...(result.success && {
            expiresAt: new Date(Date.now() + configuration.retention * 24 * 60 * 60 * 1000)
          })
        },
        include: {
          configuration: {
            select: { name: true, backupType: true }
          }
        }
      })

      // Update configuration statistics
      await prisma.backupConfiguration.update({
        where: { id: configuration.id },
        data: {
          lastRun: endTime,
          ...(result.success ? {
            lastSuccess: endTime,
            successCount: { increment: 1 }
          } : {
            lastFailure: endTime,
            failureCount: { increment: 1 },
            lastError: result.errorMessage
          }),
          avgDuration: await calculateAverageBackupDuration(configuration.id)
        }
      })

      return NextResponse.json({
        record: updatedRecord,
        execution: {
          configurationId: configuration.id,
          configurationName: configuration.name,
          startTime,
          endTime,
          duration: result.duration,
          success: result.success,
          errorMessage: result.errorMessage
        }
      })

    } catch (executionError) {
      console.error('Backup execution failed:', executionError)

      // Update record with failure
      await prisma.backupRecord.update({
        where: { id: backupRecord.id },
        data: {
          status: 'FAILED',
          endTime: new Date(),
          errorMessage: 'Backup execution failed due to system error'
        }
      })

      return NextResponse.json(
        { error: 'Backup execution failed' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to execute backup:', error)
    return NextResponse.json(
      { error: 'Failed to execute backup' },
      { status: 500 }
    )
  }
}

// Helper function to generate mock checksum
function generateMockChecksum(filename: string): string {
  let hash = 0
  for (let i = 0; i < filename.length; i++) {
    const char = filename.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

// Helper function to calculate average backup duration
async function calculateAverageBackupDuration(configurationId: string): Promise<number> {
  const recentBackups = await prisma.backupRecord.findMany({
    where: {
      configurationId,
      status: 'COMPLETED',
      duration: { not: null }
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { duration: true }
  })

  if (recentBackups.length === 0) return 0

  const totalDuration = recentBackups.reduce((sum, backup) => sum + (backup.duration || 0), 0)
  return Math.round(totalDuration / recentBackups.length)
}