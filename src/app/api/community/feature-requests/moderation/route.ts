import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/feature-requests/moderation - List feature requests needing moderation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') || 'PENDING' // PENDING, UNDER_REVIEW, APPROVED, REJECTED
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const sort = searchParams.get('sort') || 'recent' // recent, oldest, votes, priority
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify user has moderation permissions
    if (workspaceId) {
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
    }

    // Build where clause
    const where: any = {
      ...(workspaceId && { workspaceId }),
      ...(status && { status }),
      ...(category && { category }),
      ...(priority && { priority })
    }

    // Build order by clause
    let orderBy: any
    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      case 'votes':
        orderBy = [{ votes: 'desc' }, { createdAt: 'desc' }]
        break
      case 'priority':
        orderBy = [
          { priority: 'desc' }, // HIGH, MEDIUM, LOW
          { votes: 'desc' },
          { createdAt: 'desc' }
        ]
        break
      default: // recent
        orderBy = { createdAt: 'desc' }
    }

    const [requests, totalCount, statusStats, categoryStats] = await Promise.all([
      prisma.featureRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          },
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          votes: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy,
        take: limit,
        skip: offset
      }),
      prisma.featureRequest.count({ where }),
      // Get status statistics
      prisma.featureRequest.groupBy({
        by: ['status'],
        where: workspaceId ? { workspaceId } : {},
        _count: { status: true }
      }),
      // Get category statistics
      prisma.featureRequest.groupBy({
        by: ['category'],
        where: workspaceId ? { workspaceId } : {},
        _count: { category: true }
      })
    ])

    // Get moderation queue statistics
    const moderationStats = await Promise.all([
      prisma.featureRequest.count({
        where: { ...where, status: 'PENDING' }
      }),
      prisma.featureRequest.count({
        where: { ...where, status: 'UNDER_REVIEW' }
      }),
      prisma.featureRequest.count({
        where: { ...where, status: 'APPROVED' }
      }),
      prisma.featureRequest.count({
        where: { ...where, status: 'REJECTED' }
      })
    ])

    const [pendingCount, underReviewCount, approvedCount, rejectedCount] = moderationStats

    return NextResponse.json({
      requests,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + requests.length < totalCount
      },
      statistics: {
        pending: pendingCount,
        underReview: underReviewCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: totalCount
      },
      statusStats,
      categoryStats
    })

  } catch (error) {
    console.error('Failed to fetch feature requests for moderation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature requests for moderation' },
      { status: 500 }
    )
  }
}

// POST /api/community/feature-requests/moderation - Execute moderation actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      action, // APPROVE, REJECT, MERGE, IMPLEMENT, ARCHIVE, UPDATE_STATUS, UPDATE_PRIORITY
      requestIds, // Array of request IDs for bulk actions
      requestId, // Single request ID
      reason,
      workspaceId,
      metadata = {} // Action-specific metadata
    } = body

    // Validation
    if (!action || (!requestId && (!requestIds || requestIds.length === 0))) {
      return NextResponse.json(
        { error: 'Action and request ID(s) are required' },
        { status: 400 }
      )
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
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

    const targetIds = requestIds || [requestId]
    const results = []
    const errors = []

    // Process each feature request
    for (const id of targetIds) {
      try {
        const result = await executeFeatureRequestAction(
          id,
          action,
          reason,
          metadata,
          normalizeUserId(session.user.id),
          workspaceId
        )
        results.push({ requestId: id, success: true, result })
      } catch (error) {
        console.error(`Failed to process request ${id}:`, error)
        errors.push({
          requestId: id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Create moderation activity summary
    await prisma.communityActivity.create({
      data: {
        activityType: 'FEATURE_REQUEST_MODERATION',
        title: `Feature request moderation: ${action}`,
        description: `${action} applied to ${results.length} feature request(s)${reason ? ` - ${reason}` : ''}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: workspaceId,
        targetType: 'workspace',
        targetTitle: 'Feature Request Moderation',
        workspaceId,
        metadata: {
          action,
          requestIds: targetIds,
          successCount: results.length,
          errorCount: errors.length,
          reason,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      totalProcessed: targetIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('Failed to execute feature request moderation action:', error)
    return NextResponse.json(
      { error: 'Failed to execute moderation action' },
      { status: 500 }
    )
  }
}

// Helper function to execute specific moderation actions
async function executeFeatureRequestAction(
  requestId: string,
  action: string,
  reason: string,
  metadata: any,
  moderatorId: string,
  workspaceId: string
) {
  // Get current request
  const currentRequest = await prisma.featureRequest.findUnique({
    where: { id: requestId },
    include: {
      user: true,
      votes: true
    }
  })

  if (!currentRequest) {
    throw new Error('Feature request not found')
  }

  const previousData = {
    status: currentRequest.status,
    priority: currentRequest.priority,
    category: currentRequest.category,
    estimatedEffort: currentRequest.estimatedEffort,
    targetVersion: currentRequest.targetVersion
  }

  let updateData: any = {}
  let actionType = action

  switch (action) {
    case 'APPROVE':
      updateData = {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: moderatorId,
        moderatorNotes: reason
      }
      break

    case 'REJECT':
      updateData = {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: moderatorId,
        moderatorNotes: reason
      }
      break

    case 'IMPLEMENT':
      updateData = {
        status: 'IMPLEMENTED',
        implementedAt: new Date(),
        implementedBy: moderatorId,
        moderatorNotes: reason,
        ...(metadata.version && { targetVersion: metadata.version })
      }
      break

    case 'ARCHIVE':
      updateData = {
        status: 'ARCHIVED',
        archivedAt: new Date(),
        archivedBy: moderatorId,
        moderatorNotes: reason
      }
      break

    case 'UPDATE_PRIORITY':
      updateData = {
        priority: metadata.priority,
        moderatorNotes: reason
      }
      actionType = 'PRIORITY_CHANGE'
      break

    case 'UPDATE_CATEGORY':
      updateData = {
        category: metadata.category,
        moderatorNotes: reason
      }
      actionType = 'CATEGORY_CHANGE'
      break

    case 'UPDATE_EFFORT':
      updateData = {
        estimatedEffort: metadata.estimatedEffort,
        moderatorNotes: reason
      }
      actionType = 'EFFORT_ESTIMATE'
      break

    case 'MERGE':
      // Mark as duplicate and reference the original
      updateData = {
        status: 'DUPLICATE',
        mergedInto: metadata.mergeIntoId,
        moderatorNotes: reason
      }

      // Increase votes on the target request
      if (metadata.mergeIntoId) {
        await prisma.featureRequest.update({
          where: { id: metadata.mergeIntoId },
          data: {
            votes: {
              increment: currentRequest.votes.length
            }
          }
        })
      }
      break

    default:
      throw new Error(`Invalid action: ${action}`)
  }

  // Update the feature request
  const updatedRequest = await prisma.featureRequest.update({
    where: { id: requestId },
    data: updateData
  })

  // Create moderation action record
  const moderationAction = await prisma.moderationAction.create({
    data: {
      workspaceId,
      moderatorId,
      actionType,
      targetType: 'FEATURE_REQUEST',
      targetId: requestId,
      reason: reason || `Feature request ${action.toLowerCase()}`,
      description: `${action} applied to feature request: ${currentRequest.title}`,
      previousData,
      newData: updatedRequest,
      status: 'COMPLETED',
      reviewedBy: moderatorId,
      reviewedAt: new Date(),
      metadata: {
        originalStatus: currentRequest.status,
        newStatus: updatedRequest.status,
        ...metadata
      }
    }
  })

  // Create individual activity for this request
  await prisma.communityActivity.create({
    data: {
      activityType: 'FEATURE_REQUEST_MODERATED',
      title: `Feature request ${action.toLowerCase()}`,
      description: `${currentRequest.title} - ${reason || 'No reason provided'}`,
      userId: moderatorId,
      userName: 'Moderator', // Will be resolved by the calling function
      targetId: requestId,
      targetType: 'feature_request',
      targetTitle: currentRequest.title,
      workspaceId,
      metadata: {
        action,
        previousStatus: currentRequest.status,
        newStatus: updatedRequest.status,
        moderatorAction: true,
        ...metadata
      }
    }
  })

  // If request has a user, notify them (in production, send email/notification)
  if (currentRequest.userId && ['APPROVE', 'REJECT', 'IMPLEMENT'].includes(action)) {
    console.log(`Notify user ${currentRequest.userId} about ${action} on request ${requestId}`)
  }

  return {
    moderationAction,
    updatedRequest,
    previousData
  }
}