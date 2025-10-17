import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Moderation Log interfaces
interface ModerationLogEntry {
  id: string
  timestamp: Date
  moderatorId: string
  moderatorName: string
  moderatorAvatar?: string
  actionType: string
  targetType: string
  targetId: string
  targetTitle?: string
  reason?: string
  description: string
  previousData?: any
  newData?: any
  isAutomatic: boolean
  ruleId?: string
  ruleName?: string
  status: string
  ipAddress?: string
  userAgent?: string
  workspaceId: string
  metadata?: any
}

interface LogSummary {
  totalActions: number
  automatedActions: number
  manualActions: number
  actionsByType: { type: string; count: number }[]
  actionsByModerator: { moderatorId: string; moderatorName: string; count: number }[]
  actionsByStatus: { status: string; count: number }[]
  recentActivity: ModerationLogEntry[]
}

interface LogExport {
  format: 'CSV' | 'JSON' | 'PDF'
  filename: string
  downloadUrl: string
  generatedAt: Date
  recordCount: number
}

// GET /api/community/moderation/logs - Get moderation logs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const moderatorId = searchParams.get('moderatorId')
    const actionType = searchParams.get('actionType')
    const targetType = searchParams.get('targetType')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const isAutomatic = searchParams.get('isAutomatic')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search')
    const summary = searchParams.get('summary') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has moderation access
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

    if (moderatorId) where.moderatorId = moderatorId
    if (actionType) where.actionType = actionType
    if (targetType) where.targetType = targetType
    if (status) where.status = status
    if (isAutomatic !== null) where.isAutomatic = isAutomatic === 'true'

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { moderator: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    // If summary requested, return aggregated data
    if (summary) {
      const logSummary = await generateLogSummary(workspaceId, where)
      return NextResponse.json({ summary: logSummary })
    }

    // Get logs with pagination
    const [logs, totalCount] = await Promise.all([
      prisma.moderationAction.findMany({
        where,
        include: {
          moderator: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              image: true
            }
          },
          rule: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.moderationAction.count({ where })
    ])

    // Format logs for response
    const formattedLogs: ModerationLogEntry[] = logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      moderatorId: log.moderatorId || 'system',
      moderatorName: log.moderator?.name || 'System',
      moderatorAvatar: log.moderator?.image || undefined,
      actionType: log.actionType,
      targetType: log.targetType,
      targetId: log.targetId,
      targetTitle: extractTargetTitle(log.newData) || log.description,
      reason: log.reason || undefined,
      description: log.description,
      previousData: log.previousData,
      newData: log.newData,
      isAutomatic: log.isAutomatic,
      ruleId: log.ruleId || undefined,
      ruleName: log.rule?.name || undefined,
      status: log.status,
      ipAddress: log.ipAddress || undefined,
      userAgent: log.userAgent || undefined,
      workspaceId: log.workspaceId,
      metadata: log.metadata
    }))

    return NextResponse.json({
      logs: formattedLogs,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      filters: {
        moderatorId,
        actionType,
        targetType,
        status,
        startDate,
        endDate,
        isAutomatic,
        search
      }
    })

  } catch (error) {
    console.error('Failed to fetch moderation logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch moderation logs' },
      { status: 500 }
    )
  }
}

// POST /api/community/moderation/logs - Create manual log entry or export logs
export async function POST(request: NextRequest) {
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

    // Verify user has moderation access
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

    if (action === 'EXPORT_LOGS') {
      const exportResult = await exportModerationLogs(workspaceId, data, session.user.id!)
      return NextResponse.json({ export: exportResult })
    }

    if (action === 'ADD_MANUAL_ENTRY') {
      const {
        actionType,
        targetType,
        targetId,
        reason,
        description,
        metadata
      } = data

      // Validation
      if (!actionType || !targetType || !targetId || !description) {
        return NextResponse.json(
          { error: 'Action type, target type, target ID, and description are required' },
          { status: 400 }
        )
      }

      // Create manual log entry
      const logEntry = await prisma.moderationAction.create({
        data: {
          workspaceId,
          moderatorId: normalizeUserId(session.user.id),
          actionType,
          targetType,
          targetId,
          reason,
          description,
          isAutomatic: false,
          status: 'COMPLETED',
          reviewedBy: normalizeUserId(session.user.id),
          reviewedAt: new Date(),
          metadata: {
            ...metadata,
            manualEntry: true,
            addedBy: session.user.name
          }
        },
        include: {
          moderator: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        }
      })

      return NextResponse.json({
        success: true,
        logEntry: {
          id: logEntry.id,
          timestamp: logEntry.createdAt,
          moderatorId: logEntry.moderatorId!,
          moderatorName: logEntry.moderator!.name!,
          moderatorAvatar: logEntry.moderator!.image,
          actionType: logEntry.actionType,
          targetType: logEntry.targetType,
          targetId: logEntry.targetId,
          reason: logEntry.reason,
          description: logEntry.description,
          isAutomatic: logEntry.isAutomatic,
          status: logEntry.status,
          workspaceId: logEntry.workspaceId,
          metadata: logEntry.metadata
        }
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Failed to process moderation log action:', error)
    return NextResponse.json(
      { error: 'Failed to process moderation log action' },
      { status: 500 }
    )
  }
}

// Helper functions
async function generateLogSummary(workspaceId: string, baseWhere: any): Promise<LogSummary> {
  const [
    totalActions,
    automatedActions,
    actionsByType,
    actionsByModerator,
    actionsByStatus,
    recentActivity
  ] = await Promise.all([
    // Total actions count
    prisma.moderationAction.count({
      where: baseWhere
    }),
    // Automated actions count
    prisma.moderationAction.count({
      where: { ...baseWhere, isAutomatic: true }
    }),
    // Actions by type
    prisma.moderationAction.groupBy({
      by: ['actionType'],
      where: baseWhere,
      _count: { actionType: true },
      orderBy: { _count: { actionType: 'desc' } }
    }),
    // Actions by moderator
    prisma.moderationAction.groupBy({
      by: ['moderatorId'],
      where: { ...baseWhere, moderatorId: { not: null } },
      _count: { moderatorId: true },
      orderBy: { _count: { moderatorId: 'desc' } },
      take: 10
    }),
    // Actions by status
    prisma.moderationAction.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { status: true }
    }),
    // Recent activity (last 10 actions)
    prisma.moderationAction.findMany({
      where: baseWhere,
      include: {
        moderator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        rule: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ])

  // Get moderator names
  const moderatorIds = actionsByModerator.map(m => m.moderatorId).filter(Boolean) as string[]
  const moderators = await prisma.user.findMany({
    where: { id: { in: moderatorIds } },
    select: { id: true, name: true }
  })

  const actionsByModeratorWithNames = actionsByModerator.map(stat => {
    const moderator = moderators.find(m => m.id === stat.moderatorId)
    return {
      moderatorId: stat.moderatorId!,
      moderatorName: moderator?.name || 'Unknown',
      count: stat._count.moderatorId
    }
  })

  const recentActivityFormatted: ModerationLogEntry[] = recentActivity.map(log => ({
    id: log.id,
    timestamp: log.createdAt,
    moderatorId: log.moderatorId || 'system',
    moderatorName: log.moderator?.name || 'System',
    moderatorAvatar: log.moderator?.image || undefined,
    actionType: log.actionType,
    targetType: log.targetType,
    targetId: log.targetId,
    targetTitle: extractTargetTitle(log.newData),
    reason: log.reason || undefined,
    description: log.description,
    previousData: log.previousData,
    newData: log.newData,
    isAutomatic: log.isAutomatic,
    ruleId: log.ruleId || undefined,
    ruleName: log.rule?.name || undefined,
    status: log.status,
    workspaceId: log.workspaceId,
    metadata: log.metadata
  }))

  return {
    totalActions,
    automatedActions,
    manualActions: totalActions - automatedActions,
    actionsByType: actionsByType.map(a => ({
      type: a.actionType,
      count: a._count.actionType
    })),
    actionsByModerator: actionsByModeratorWithNames,
    actionsByStatus: actionsByStatus.map(a => ({
      status: a.status,
      count: a._count.status
    })),
    recentActivity: recentActivityFormatted
  }
}

async function exportModerationLogs(
  workspaceId: string,
  filters: any,
  userId: string
): Promise<LogExport> {
  const { format, startDate, endDate, moderatorId, actionType } = filters

  // Build filter conditions
  const where: any = { workspaceId }
  if (moderatorId) where.moderatorId = moderatorId
  if (actionType) where.actionType = actionType
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = new Date(startDate)
    if (endDate) where.createdAt.lte = new Date(endDate)
  }

  // Get logs for export
  const logs = await prisma.moderationAction.findMany({
    where,
    include: {
      moderator: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      rule: {
        select: {
          id: true,
          name: true,
          description: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `moderation-logs-${workspaceId}-${timestamp}.${format.toLowerCase()}`

  // Generate export data based on format
  let exportData: any
  switch (format) {
    case 'CSV':
      exportData = generateCSVExport(logs)
      break
    case 'JSON':
      exportData = generateJSONExport(logs)
      break
    case 'PDF':
      exportData = generatePDFExport(logs, workspaceId)
      break
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }

  // In a real implementation, you would:
  // 1. Save the file to cloud storage (S3, etc.)
  // 2. Generate a download URL
  // 3. Optionally send an email with the download link

  // For now, return mock export info
  return {
    format,
    filename,
    downloadUrl: `/api/community/moderation/logs/export/${filename}`,
    generatedAt: new Date(),
    recordCount: logs.length
  }
}

function generateCSVExport(logs: any[]) {
  const headers = [
    'Timestamp',
    'Moderator',
    'Action Type',
    'Target Type',
    'Target ID',
    'Reason',
    'Description',
    'Status',
    'Automatic',
    'Rule'
  ]

  const rows = logs.map(log => [
    log.createdAt.toISOString(),
    log.moderator?.name || 'System',
    log.actionType,
    log.targetType,
    log.targetId,
    log.reason || '',
    log.description,
    log.status,
    log.isAutomatic ? 'Yes' : 'No',
    log.rule?.name || ''
  ])

  return {
    headers,
    rows,
    content: [headers, ...rows].map(row => row.join(',')).join('\n')
  }
}

function generateJSONExport(logs: any[]) {
  return {
    exportedAt: new Date().toISOString(),
    recordCount: logs.length,
    logs: logs.map(log => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      moderator: {
        id: log.moderatorId,
        name: log.moderator?.name,
        email: log.moderator?.email
      },
      action: {
        type: log.actionType,
        targetType: log.targetType,
        targetId: log.targetId,
        reason: log.reason,
        description: log.description,
        status: log.status,
        isAutomatic: log.isAutomatic
      },
      rule: log.rule ? {
        id: log.rule.id,
        name: log.rule.name,
        description: log.rule.description
      } : null,
      metadata: log.metadata,
      previousData: log.previousData,
      newData: log.newData
    }))
  }
}

function generatePDFExport(logs: any[], workspaceId: string) {
  // Generate HTML content for PDF conversion
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Moderation Logs Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .log-entry { border-bottom: 1px solid #ddd; padding: 10px 0; }
        .timestamp { font-weight: bold; color: #666; }
        .action { color: #d63384; font-weight: bold; }
        .moderator { color: #0d6efd; }
        .automatic { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Moderation Logs Report</h1>
        <p>Workspace: ${workspaceId}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total Records: ${logs.length}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Moderator</th>
            <th>Action</th>
            <th>Target</th>
            <th>Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td>${log.createdAt.toLocaleString()}</td>
              <td>${log.moderator?.name || 'System'}</td>
              <td>
                ${log.actionType}
                ${log.isAutomatic ? '<span class="automatic">AUTO</span>' : ''}
              </td>
              <td>${log.targetType}: ${log.targetId}</td>
              <td>${log.status}</td>
              <td>${log.description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `

  return {
    htmlContent,
    css: 'body { font-family: Arial, sans-serif; }',
    metadata: {
      title: 'Moderation Logs Report',
      author: 'SociallyHub',
      subject: `Moderation logs for workspace ${workspaceId}`
    }
  }
}

function extractTargetTitle(data: any): string | undefined {
  if (!data) return undefined

  if (typeof data === 'object') {
    return data.title || data.name || data.content?.substring(0, 50) || undefined
  }

  return undefined
}