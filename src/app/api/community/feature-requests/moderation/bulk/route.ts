import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/community/feature-requests/moderation/bulk - Bulk moderation actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      requestIds,
      action, // BULK_APPROVE, BULK_REJECT, BULK_ARCHIVE, BULK_UPDATE_PRIORITY, BULK_UPDATE_CATEGORY
      reason,
      workspaceId,
      parameters = {} // Action-specific parameters
    } = body

    // Validation
    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return NextResponse.json(
        { error: 'Request IDs array is required' },
        { status: 400 }
      )
    }

    if (!action || !workspaceId) {
      return NextResponse.json(
        { error: 'Action and workspace ID are required' },
        { status: 400 }
      )
    }

    // Verify user has moderation permissions
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

    // Get all target feature requests
    const requests = await prisma.featureRequest.findMany({
      where: {
        id: { in: requestIds },
        workspaceId
      },
      include: {
        user: true,
        votes: true
      }
    })

    if (requests.length === 0) {
      return NextResponse.json({ error: 'No valid feature requests found' }, { status: 404 })
    }

    const results = []
    const errors = []

    // Process each request
    for (const request of requests) {
      try {
        const result = await executeBulkAction(
          request,
          action,
          reason,
          parameters,
          normalizeUserId(session.user.id),
          workspaceId
        )
        results.push({
          requestId: request.id,
          title: request.title,
          success: true,
          result
        })
      } catch (error) {
        console.error(`Failed to process request ${request.id}:`, error)
        errors.push({
          requestId: request.id,
          title: request.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Create bulk moderation activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'FEATURE_REQUEST_BULK_MODERATION',
        title: `Bulk feature request moderation: ${action}`,
        description: `Bulk ${action.replace('BULK_', '').toLowerCase()} applied to ${results.length} feature request(s)`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: workspaceId,
        targetType: 'workspace',
        targetTitle: 'Bulk Feature Request Moderation',
        workspaceId,
        metadata: {
          action,
          requestIds,
          reason,
          parameters,
          totalRequested: requestIds.length,
          totalSuccessful: results.length,
          totalFailed: errors.length,
          bulkAction: true,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      totalRequested: requestIds.length,
      totalSuccessful: results.length,
      totalFailed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('Failed to execute bulk feature request moderation:', error)
    return NextResponse.json(
      { error: 'Failed to execute bulk moderation' },
      { status: 500 }
    )
  }
}

// GET /api/community/feature-requests/moderation/bulk - Get bulk moderation statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has moderation permissions
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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get moderation statistics
    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      implementedRequests,
      archivedRequests,
      duplicateRequests,
      recentModerationActions,
      topModerators
    ] = await Promise.all([
      // Total feature requests
      prisma.featureRequest.count({
        where: { workspaceId }
      }),
      // Pending moderation
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'PENDING'
        }
      }),
      // Approved
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'APPROVED'
        }
      }),
      // Rejected
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'REJECTED'
        }
      }),
      // Implemented
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'IMPLEMENTED'
        }
      }),
      // Archived
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'ARCHIVED'
        }
      }),
      // Duplicates
      prisma.featureRequest.count({
        where: {
          workspaceId,
          status: 'DUPLICATE'
        }
      }),
      // Recent moderation actions
      prisma.moderationAction.count({
        where: {
          workspaceId,
          targetType: 'FEATURE_REQUEST',
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      // Top moderators (last 30 days)
      prisma.moderationAction.groupBy({
        by: ['moderatorId'],
        where: {
          workspaceId,
          targetType: 'FEATURE_REQUEST',
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 5
      })
    ])

    // Get moderator details
    const moderatorIds = topModerators.map(tm => tm.moderatorId).filter(Boolean)
    const moderators = await prisma.user.findMany({
      where: {
        id: { in: moderatorIds }
      },
      select: {
        id: true,
        name: true,
        image: true
      }
    })

    const topModeratorsWithNames = topModerators.map(tm => ({
      ...tm,
      moderator: moderators.find(m => m.id === tm.moderatorId)
    }))

    // Get priority distribution
    const priorityStats = await prisma.featureRequest.groupBy({
      by: ['priority'],
      where: {
        workspaceId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] }
      },
      _count: {
        priority: true
      }
    })

    // Get category distribution
    const categoryStats = await prisma.featureRequest.groupBy({
      by: ['category'],
      where: {
        workspaceId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] }
      },
      _count: {
        category: true
      }
    })

    // Get daily moderation trend (last 7 days)
    const moderationTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = await prisma.moderationAction.count({
        where: {
          workspaceId,
          targetType: 'FEATURE_REQUEST',
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      })

      moderationTrend.push({
        date: date.toISOString().split('T')[0],
        count
      })
    }

    // Calculate approval rate
    const totalModerated = approvedRequests + rejectedRequests + implementedRequests + archivedRequests
    const approvalRate = totalModerated > 0 ?
      ((approvedRequests + implementedRequests) / totalModerated * 100).toFixed(1) : '0'

    return NextResponse.json({
      statistics: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        implementedRequests,
        archivedRequests,
        duplicateRequests,
        recentModerationActions,
        approvalRate: parseFloat(approvalRate)
      },
      topModerators: topModeratorsWithNames,
      priorityDistribution: priorityStats,
      categoryDistribution: categoryStats,
      moderationTrend
    })

  } catch (error) {
    console.error('Failed to fetch bulk moderation statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

// Helper function to execute bulk actions
async function executeBulkAction(
  request: any,
  action: string,
  reason: string,
  parameters: any,
  moderatorId: string,
  workspaceId: string
) {
  const previousData = {
    status: request.status,
    priority: request.priority,
    category: request.category,
    estimatedEffort: request.estimatedEffort
  }

  let updateData: any = {}
  let actionType = ''

  switch (action) {
    case 'BULK_APPROVE':
      updateData = {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: moderatorId,
        moderatorNotes: reason || 'Bulk approval'
      }
      actionType = 'APPROVE'
      break

    case 'BULK_REJECT':
      updateData = {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: moderatorId,
        moderatorNotes: reason || 'Bulk rejection'
      }
      actionType = 'REJECT'
      break

    case 'BULK_ARCHIVE':
      updateData = {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: moderatorId,
        moderatorNotes: reason || 'Bulk archive'
      }
      actionType = 'ARCHIVE'
      break

    case 'BULK_UPDATE_PRIORITY':
      updateData = {
        priority: parameters.priority,
        moderatorNotes: reason || `Bulk priority update to ${parameters.priority}`
      }
      actionType = 'PRIORITY_CHANGE'
      break

    case 'BULK_UPDATE_CATEGORY':
      updateData = {
        category: parameters.category,
        moderatorNotes: reason || `Bulk category update to ${parameters.category}`
      }
      actionType = 'CATEGORY_CHANGE'
      break

    case 'BULK_UPDATE_EFFORT':
      updateData = {
        estimatedEffort: parameters.estimatedEffort,
        moderatorNotes: reason || `Bulk effort estimate update`
      }
      actionType = 'EFFORT_ESTIMATE'
      break

    default:
      throw new Error(`Invalid bulk action: ${action}`)
  }

  // Update the feature request
  const updatedRequest = await prisma.featureRequest.update({
    where: { id: request.id },
    data: updateData
  })

  // Create moderation action record
  const moderationAction = await prisma.moderationAction.create({
    data: {
      workspaceId,
      moderatorId,
      actionType,
      targetType: 'FEATURE_REQUEST',
      targetId: request.id,
      reason: reason || `Bulk ${actionType.toLowerCase()}`,
      description: `Bulk ${actionType.toLowerCase()}: ${request.title}`,
      previousData,
      newData: updatedRequest,
      status: 'COMPLETED',
      reviewedBy: moderatorId,
      reviewedAt: new Date(),
      metadata: {
        bulkAction: true,
        originalAction: action,
        parameters
      }
    }
  })

  // Create individual activity
  await prisma.communityActivity.create({
    data: {
      activityType: 'FEATURE_REQUEST_MODERATED',
      title: `Feature request ${actionType.toLowerCase()} (bulk)`,
      description: `${request.title} - ${reason || 'Bulk action'}`,
      userId: moderatorId,
      userName: 'Moderator',
      targetId: request.id,
      targetType: 'feature_request',
      targetTitle: request.title,
      workspaceId,
      metadata: {
        action: actionType,
        bulkAction: true,
        previousStatus: request.status,
        newStatus: updatedRequest.status,
        moderatorAction: true,
        parameters
      }
    }
  })

  return {
    moderationAction,
    updatedRequest,
    previousData
  }
}