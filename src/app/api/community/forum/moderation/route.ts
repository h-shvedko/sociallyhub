import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/forum/moderation - List posts pending moderation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') || 'PENDING' // PENDING, APPROVED, REJECTED, UNDER_REVIEW
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const sort = searchParams.get('sort') || 'oldest' // oldest, newest, priority
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

    // Build where clause for moderation queue
    const where: any = {
      ...(workspaceId && { workspaceId }),
      ...(status && { status }),
      ...(category && { category }),
      ...(priority && { priority })
    }

    // Build order by clause
    let orderBy: any
    switch (sort) {
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      case 'priority':
        orderBy = [{ priority: 'desc' }, { createdAt: 'asc' }]
        break
      default: // oldest
        orderBy = { createdAt: 'asc' }
    }

    const [queueItems, totalCount, statusStats] = await Promise.all([
      prisma.moderationQueue.findMany({
        where,
        include: {
          workspace: {
            select: { id: true, name: true }
          },
          assignedModerator: {
            select: { id: true, name: true, image: true }
          },
          // Get the actual forum post data
          ...(where.targetType === 'FORUM_POST' && {
            targetPost: {
              select: {
                id: true,
                title: true,
                content: true,
                category: true,
                tags: true,
                views: true,
                likes: true,
                repliesCount: true,
                createdAt: true,
                user: {
                  select: { id: true, name: true, image: true }
                }
              }
            }
          })
        },
        orderBy,
        take: limit,
        skip: offset
      }),
      prisma.moderationQueue.count({ where }),
      // Get status statistics
      prisma.moderationQueue.groupBy({
        by: ['status'],
        where: workspaceId ? { workspaceId } : {},
        _count: { status: true }
      })
    ])

    return NextResponse.json({
      queueItems,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + queueItems.length < totalCount
      },
      statusStats
    })

  } catch (error) {
    console.error('Failed to fetch moderation queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch moderation queue' },
      { status: 500 }
    )
  }
}

// POST /api/community/forum/moderation - Create moderation action
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      actionType, // APPROVE, REJECT, PIN, UNPIN, LOCK, UNLOCK, DELETE, EDIT
      targetType, // FORUM_POST, FORUM_REPLY
      targetId,
      reason,
      description,
      workspaceId,
      newData // For edit actions
    } = body

    // Validation
    if (!actionType || !targetType || !targetId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Get the target entity to store previous data
    let previousData = null
    let targetEntity = null

    if (targetType === 'FORUM_POST') {
      targetEntity = await prisma.communityForumPost.findUnique({
        where: { id: targetId }
      })
      if (targetEntity) {
        previousData = {
          title: targetEntity.title,
          content: targetEntity.content,
          isApproved: targetEntity.isApproved,
          isPinned: targetEntity.isPinned,
          isLocked: targetEntity.isLocked
        }
      }
    }

    if (!targetEntity) {
      return NextResponse.json(
        { error: 'Target entity not found' },
        { status: 404 }
      )
    }

    // Execute the moderation action
    let updatedEntity = null

    if (targetType === 'FORUM_POST') {
      const updateData: any = {}

      switch (actionType) {
        case 'APPROVE':
          updateData.isApproved = true
          break
        case 'REJECT':
          updateData.isApproved = false
          break
        case 'PIN':
          updateData.isPinned = true
          break
        case 'UNPIN':
          updateData.isPinned = false
          break
        case 'LOCK':
          updateData.isLocked = true
          break
        case 'UNLOCK':
          updateData.isLocked = false
          break
        case 'EDIT':
          if (newData) {
            Object.assign(updateData, newData)
          }
          break
        case 'DELETE':
          await prisma.communityForumPost.delete({
            where: { id: targetId }
          })
          break
      }

      if (actionType !== 'DELETE' && Object.keys(updateData).length > 0) {
        updatedEntity = await prisma.communityForumPost.update({
          where: { id: targetId },
          data: updateData
        })
      }
    }

    // Create moderation action record
    const moderationAction = await prisma.moderationAction.create({
      data: {
        workspaceId,
        moderatorId: normalizeUserId(session.user.id),
        actionType,
        targetType,
        targetId,
        reason,
        description,
        previousData,
        newData: updatedEntity || newData,
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // Update moderation queue if exists
    await prisma.moderationQueue.updateMany({
      where: {
        targetType,
        targetId,
        workspaceId
      },
      data: {
        status: actionType === 'APPROVE' ? 'APPROVED' :
                actionType === 'REJECT' ? 'REJECTED' : 'RESOLVED',
        assignedModeratorId: normalizeUserId(session.user.id),
        resolvedAt: new Date(),
        resolution: description || reason
      }
    })

    // Create community activity for the moderation action
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: `Forum post ${actionType.toLowerCase()}`,
        description: description || reason || `Post ${actionType.toLowerCase()} by moderator`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: targetId,
        targetType: 'forum_post',
        targetTitle: targetEntity.title,
        workspaceId,
        metadata: {
          actionType,
          reason,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      action: moderationAction,
      updatedEntity
    })

  } catch (error) {
    console.error('Failed to execute moderation action:', error)
    return NextResponse.json(
      { error: 'Failed to execute moderation action' },
      { status: 500 }
    )
  }
}