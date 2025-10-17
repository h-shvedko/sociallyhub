import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Audit Trail interfaces
interface AuditEntry {
  id: string
  timestamp: Date
  entityType: 'USER' | 'POST' | 'COMMENT' | 'FEATURE_REQUEST' | 'REPORT' | 'RULE'
  entityId: string
  entityTitle?: string
  changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'PERMISSION_CHANGE'
  moderatorId: string
  moderatorName: string
  field?: string
  oldValue?: any
  newValue?: any
  reason?: string
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  metadata?: any
}

interface ComplianceReport {
  period: string
  totalChanges: number
  moderatorActivity: {
    moderatorId: string
    moderatorName: string
    actionCount: number
    lastActivity: Date
  }[]
  riskIndicators: {
    type: 'HIGH_ACTIVITY' | 'UNUSUAL_PATTERN' | 'BULK_CHANGES' | 'SUSPICIOUS_TIMING'
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    description: string
    count: number
    relatedActions: string[]
  }[]
  auditSummary: {
    entityType: string
    creates: number
    updates: number
    deletes: number
  }[]
}

interface DataIntegrityCheck {
  checkType: 'ORPHANED_RECORDS' | 'MISSING_REFERENCES' | 'INCONSISTENT_STATUS' | 'DATA_CORRUPTION'
  status: 'PASSED' | 'FAILED' | 'WARNING'
  issues: {
    entityType: string
    entityId: string
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    recommended Action: string
  }[]
  checkedAt: Date
}

// GET /api/community/moderation/audit - Get audit trail with advanced filtering
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const changeType = searchParams.get('changeType')
    const moderatorId = searchParams.get('moderatorId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const field = searchParams.get('field')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const compliance = searchParams.get('compliance') === 'true'
    const integrity = searchParams.get('integrity') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has audit access (higher permission level)
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: normalizeUserId(session.user.id),
          workspaceId
        }
      }
    })

    if (!userWorkspace || userWorkspace.role !== 'OWNER') {
      return NextResponse.json({ error: 'Insufficient permissions - Owner access required' }, { status: 403 })
    }

    // If compliance report requested
    if (compliance) {
      const complianceReport = await generateComplianceReport(workspaceId, startDate, endDate)
      return NextResponse.json({ complianceReport })
    }

    // If data integrity check requested
    if (integrity) {
      const integrityChecks = await performDataIntegrityChecks(workspaceId)
      return NextResponse.json({ integrityChecks })
    }

    // Build audit trail query
    const auditEntries = await buildAuditTrail(workspaceId, {
      entityType,
      entityId,
      changeType,
      moderatorId,
      startDate,
      endDate,
      field,
      page,
      limit
    })

    return NextResponse.json(auditEntries)

  } catch (error) {
    console.error('Failed to fetch audit trail:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit trail' },
      { status: 500 }
    )
  }
}

// POST /api/community/moderation/audit - Create audit entry or run compliance checks
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

    // Verify user has audit access
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: normalizeUserId(session.user.id),
          workspaceId
        }
      }
    })

    if (!userWorkspace || userWorkspace.role !== 'OWNER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (action === 'CREATE_AUDIT_ENTRY') {
      const auditEntry = await createManualAuditEntry(workspaceId, data, session.user.id!)
      return NextResponse.json({ auditEntry })
    }

    if (action === 'RUN_COMPLIANCE_CHECK') {
      const complianceReport = await generateComplianceReport(
        workspaceId,
        data.startDate,
        data.endDate
      )
      return NextResponse.json({ complianceReport })
    }

    if (action === 'RUN_INTEGRITY_CHECK') {
      const integrityChecks = await performDataIntegrityChecks(workspaceId)
      return NextResponse.json({ integrityChecks })
    }

    if (action === 'EXPORT_AUDIT_TRAIL') {
      const exportResult = await exportAuditTrail(workspaceId, data)
      return NextResponse.json({ export: exportResult })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Failed to process audit action:', error)
    return NextResponse.json(
      { error: 'Failed to process audit action' },
      { status: 500 }
    )
  }
}

// Helper functions
async function buildAuditTrail(workspaceId: string, filters: any) {
  // Query moderation actions to build audit trail
  const where: any = { workspaceId }

  if (filters.entityType) {
    where.targetType = filters.entityType
  }
  if (filters.entityId) {
    where.targetId = filters.entityId
  }
  if (filters.changeType) {
    // Map change types to action types
    const actionTypeMap: Record<string, string[]> = {
      'CREATE': ['CREATE', 'SUBMIT'],
      'UPDATE': ['UPDATE', 'EDIT', 'APPROVE', 'PRIORITY_CHANGE', 'CATEGORY_CHANGE'],
      'DELETE': ['DELETE', 'ARCHIVE'],
      'STATUS_CHANGE': ['APPROVE', 'REJECT', 'IMPLEMENT', 'ARCHIVE', 'PUBLISH'],
      'PERMISSION_CHANGE': ['BAN', 'SUSPEND', 'PROMOTE', 'DEMOTE']
    }

    if (actionTypeMap[filters.changeType]) {
      where.actionType = { in: actionTypeMap[filters.changeType] }
    }
  }
  if (filters.moderatorId) {
    where.moderatorId = filters.moderatorId
  }
  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate)
  }

  const [actions, totalCount] = await Promise.all([
    prisma.moderationAction.findMany({
      where,
      include: {
        moderator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit
    }),
    prisma.moderationAction.count({ where })
  ])

  // Convert to audit entries
  const auditEntries: AuditEntry[] = actions.map(action => {
    const changeType = mapActionToChangeType(action.actionType)
    const { field, oldValue, newValue } = extractFieldChanges(action.previousData, action.newData)

    return {
      id: action.id,
      timestamp: action.createdAt,
      entityType: mapTargetToEntityType(action.targetType),
      entityId: action.targetId,
      entityTitle: extractEntityTitle(action.newData || action.previousData),
      changeType,
      moderatorId: action.moderatorId || 'system',
      moderatorName: action.moderator?.name || 'System',
      field,
      oldValue,
      newValue,
      reason: action.reason,
      ipAddress: action.ipAddress,
      userAgent: action.userAgent,
      metadata: action.metadata
    }
  })

  return {
    auditEntries,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: totalCount,
      pages: Math.ceil(totalCount / filters.limit)
    }
  }
}

async function generateComplianceReport(
  workspaceId: string,
  startDate?: string,
  endDate?: string
): Promise<ComplianceReport> {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const end = endDate ? new Date(endDate) : new Date()

  const [
    totalChanges,
    moderatorActivity,
    allActions
  ] = await Promise.all([
    prisma.moderationAction.count({
      where: {
        workspaceId,
        createdAt: { gte: start, lte: end }
      }
    }),
    // Moderator activity aggregation
    prisma.moderationAction.groupBy({
      by: ['moderatorId'],
      where: {
        workspaceId,
        createdAt: { gte: start, lte: end },
        moderatorId: { not: null }
      },
      _count: { id: true },
      _max: { createdAt: true }
    }),
    // All actions for risk analysis
    prisma.moderationAction.findMany({
      where: {
        workspaceId,
        createdAt: { gte: start, lte: end }
      },
      include: {
        moderator: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ])

  // Get moderator names
  const moderatorIds = moderatorActivity.map(m => m.moderatorId).filter(Boolean) as string[]
  const moderators = await prisma.user.findMany({
    where: { id: { in: moderatorIds } },
    select: { id: true, name: true }
  })

  const moderatorActivityWithNames = moderatorActivity.map(activity => {
    const moderator = moderators.find(m => m.id === activity.moderatorId)
    return {
      moderatorId: activity.moderatorId!,
      moderatorName: moderator?.name || 'Unknown',
      actionCount: activity._count.id,
      lastActivity: activity._max.createdAt!
    }
  })

  // Risk indicator analysis
  const riskIndicators = analyzeRiskIndicators(allActions)

  // Audit summary by entity type
  const auditSummary = await generateAuditSummary(workspaceId, start, end)

  return {
    period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
    totalChanges,
    moderatorActivity: moderatorActivityWithNames,
    riskIndicators,
    auditSummary
  }
}

function analyzeRiskIndicators(actions: any[]) {
  const indicators: ComplianceReport['riskIndicators'] = []

  // High activity analysis (more than 50 actions by single moderator)
  const moderatorCounts: Record<string, number> = {}
  actions.forEach(action => {
    if (action.moderatorId) {
      moderatorCounts[action.moderatorId] = (moderatorCounts[action.moderatorId] || 0) + 1
    }
  })

  Object.entries(moderatorCounts).forEach(([moderatorId, count]) => {
    if (count > 50) {
      indicators.push({
        type: 'HIGH_ACTIVITY',
        severity: count > 100 ? 'HIGH' : 'MEDIUM',
        description: `Moderator ${moderatorId} performed ${count} actions`,
        count,
        relatedActions: actions
          .filter(a => a.moderatorId === moderatorId)
          .slice(0, 5)
          .map(a => a.id)
      })
    }
  })

  // Bulk changes analysis (many actions in short time)
  const timeWindows: Record<string, number> = {}
  actions.forEach(action => {
    const hour = action.createdAt.toISOString().substring(0, 13) // YYYY-MM-DDTHH
    timeWindows[hour] = (timeWindows[hour] || 0) + 1
  })

  Object.entries(timeWindows).forEach(([hour, count]) => {
    if (count > 20) {
      indicators.push({
        type: 'BULK_CHANGES',
        severity: count > 50 ? 'HIGH' : 'MEDIUM',
        description: `${count} actions performed in hour ${hour}`,
        count,
        relatedActions: actions
          .filter(a => a.createdAt.toISOString().substring(0, 13) === hour)
          .slice(0, 5)
          .map(a => a.id)
      })
    }
  })

  // Suspicious timing (actions during off-hours)
  const offHoursActions = actions.filter(action => {
    const hour = action.createdAt.getHours()
    return hour < 6 || hour > 22 // Before 6 AM or after 10 PM
  })

  if (offHoursActions.length > 10) {
    indicators.push({
      type: 'SUSPICIOUS_TIMING',
      severity: offHoursActions.length > 25 ? 'HIGH' : 'MEDIUM',
      description: `${offHoursActions.length} actions performed during off-hours`,
      count: offHoursActions.length,
      relatedActions: offHoursActions.slice(0, 5).map(a => a.id)
    })
  }

  return indicators
}

async function generateAuditSummary(workspaceId: string, start: Date, end: Date) {
  const actionTypes = await prisma.moderationAction.groupBy({
    by: ['targetType', 'actionType'],
    where: {
      workspaceId,
      createdAt: { gte: start, lte: end }
    },
    _count: { id: true }
  })

  const summary: Record<string, { creates: number; updates: number; deletes: number }> = {}

  actionTypes.forEach(action => {
    const entityType = action.targetType
    if (!summary[entityType]) {
      summary[entityType] = { creates: 0, updates: 0, deletes: 0 }
    }

    const changeType = mapActionToChangeType(action.actionType)
    switch (changeType) {
      case 'CREATE':
        summary[entityType].creates += action._count.id
        break
      case 'UPDATE':
      case 'STATUS_CHANGE':
      case 'PERMISSION_CHANGE':
        summary[entityType].updates += action._count.id
        break
      case 'DELETE':
        summary[entityType].deletes += action._count.id
        break
    }
  })

  return Object.entries(summary).map(([entityType, counts]) => ({
    entityType,
    ...counts
  }))
}

async function performDataIntegrityChecks(workspaceId: string): Promise<DataIntegrityCheck[]> {
  const checks: DataIntegrityCheck[] = []

  // Check for orphaned moderation actions
  const orphanedActions = await prisma.moderationAction.findMany({
    where: {
      workspaceId,
      OR: [
        // Actions with non-existent moderators
        {
          moderatorId: { not: null },
          moderator: null
        }
      ]
    },
    take: 100 // Limit for performance
  })

  checks.push({
    checkType: 'ORPHANED_RECORDS',
    status: orphanedActions.length > 0 ? 'FAILED' : 'PASSED',
    issues: orphanedActions.map(action => ({
      entityType: 'MODERATION_ACTION',
      entityId: action.id,
      description: `Moderation action references non-existent moderator ${action.moderatorId}`,
      severity: 'MEDIUM' as const,
      recommendedAction: 'Update moderator reference or mark as system action'
    })),
    checkedAt: new Date()
  })

  // Check for inconsistent status
  const inconsistentStatuses = await prisma.moderationAction.findMany({
    where: {
      workspaceId,
      status: 'COMPLETED',
      reviewedAt: null
    },
    take: 100
  })

  checks.push({
    checkType: 'INCONSISTENT_STATUS',
    status: inconsistentStatuses.length > 0 ? 'WARNING' : 'PASSED',
    issues: inconsistentStatuses.map(action => ({
      entityType: 'MODERATION_ACTION',
      entityId: action.id,
      description: 'Action marked as completed but has no review timestamp',
      severity: 'LOW' as const,
      recommendedAction: 'Update review timestamp or change status'
    })),
    checkedAt: new Date()
  })

  return checks
}

async function createManualAuditEntry(workspaceId: string, data: any, userId: string) {
  const {
    entityType,
    entityId,
    changeType,
    field,
    oldValue,
    newValue,
    reason,
    metadata
  } = data

  // Create a moderation action entry for audit purposes
  const auditEntry = await prisma.moderationAction.create({
    data: {
      workspaceId,
      moderatorId: normalizeUserId(userId),
      actionType: 'AUDIT_ENTRY',
      targetType: entityType,
      targetId: entityId,
      reason,
      description: `Manual audit entry: ${changeType} - ${field || 'general'}`,
      isAutomatic: false,
      status: 'COMPLETED',
      reviewedBy: normalizeUserId(userId),
      reviewedAt: new Date(),
      previousData: { [field || 'value']: oldValue },
      newData: { [field || 'value']: newValue },
      metadata: {
        ...metadata,
        manualAuditEntry: true,
        changeType,
        field
      }
    }
  })

  return auditEntry
}

async function exportAuditTrail(workspaceId: string, filters: any) {
  // Similar to moderation logs export but for audit trail
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `audit-trail-${workspaceId}-${timestamp}.${filters.format.toLowerCase()}`

  return {
    format: filters.format,
    filename,
    downloadUrl: `/api/community/moderation/audit/export/${filename}`,
    generatedAt: new Date(),
    recordCount: 0 // Would be calculated based on actual data
  }
}

// Utility functions
function mapActionToChangeType(actionType: string): AuditEntry['changeType'] {
  const mapping: Record<string, AuditEntry['changeType']> = {
    'CREATE': 'CREATE',
    'SUBMIT': 'CREATE',
    'UPDATE': 'UPDATE',
    'EDIT': 'UPDATE',
    'DELETE': 'DELETE',
    'ARCHIVE': 'DELETE',
    'APPROVE': 'STATUS_CHANGE',
    'REJECT': 'STATUS_CHANGE',
    'IMPLEMENT': 'STATUS_CHANGE',
    'PUBLISH': 'STATUS_CHANGE',
    'BAN': 'PERMISSION_CHANGE',
    'SUSPEND': 'PERMISSION_CHANGE',
    'PROMOTE': 'PERMISSION_CHANGE',
    'DEMOTE': 'PERMISSION_CHANGE',
    'PRIORITY_CHANGE': 'UPDATE',
    'CATEGORY_CHANGE': 'UPDATE'
  }

  return mapping[actionType] || 'UPDATE'
}

function mapTargetToEntityType(targetType: string): AuditEntry['entityType'] {
  const mapping: Record<string, AuditEntry['entityType']> = {
    'COMMUNITY_POST': 'POST',
    'FORUM_POST': 'POST',
    'FORUM_COMMENT': 'COMMENT',
    'FEATURE_REQUEST': 'FEATURE_REQUEST',
    'CONTENT_REPORT': 'REPORT',
    'AUTO_MODERATION_RULE': 'RULE',
    'USER': 'USER'
  }

  return mapping[targetType] || 'POST'
}

function extractFieldChanges(previousData: any, newData: any) {
  if (!previousData || !newData) {
    return { field: undefined, oldValue: undefined, newValue: undefined }
  }

  // Find the first changed field
  for (const key in newData) {
    if (previousData[key] !== newData[key]) {
      return {
        field: key,
        oldValue: previousData[key],
        newValue: newData[key]
      }
    }
  }

  return { field: undefined, oldValue: undefined, newValue: undefined }
}

function extractEntityTitle(data: any): string | undefined {
  if (!data) return undefined
  return data.title || data.name || data.content?.substring(0, 50) || undefined
}