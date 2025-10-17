import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/community/users/bulk - Bulk user moderation actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      userIds,
      action, // suspend, unsuspend, ban, unban, warn
      reason,
      duration, // for temporary actions (in hours)
      workspaceId
    } = body

    // Validation
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      )
    }

    if (!action || !reason || !workspaceId) {
      return NextResponse.json(
        { error: 'Action, reason, and workspace ID are required' },
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

    // Get all target users
    const targetUsers = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 })
    }

    // Remove current user from the list (cannot moderate self)
    const filteredUsers = targetUsers.filter(
      user => user.id !== normalizeUserId(session.user.id)
    )

    if (filteredUsers.length === 0) {
      return NextResponse.json({ error: 'Cannot moderate yourself' }, { status: 400 })
    }

    // Determine action type and severity
    let actionType = action.toUpperCase()
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'

    switch (action) {
      case 'warn':
        actionType = 'WARN'
        severity = 'LOW'
        break
      case 'suspend':
        actionType = 'SUSPEND'
        severity = 'MEDIUM'
        break
      case 'unsuspend':
        actionType = 'UNSUSPEND'
        severity = 'LOW'
        break
      case 'ban':
        actionType = 'BAN'
        severity = 'HIGH'
        break
      case 'unban':
        actionType = 'UNBAN'
        severity = 'LOW'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Calculate expiry date for temporary actions
    const expiresAt = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null

    const results = []
    const errors = []

    // Process each user
    for (const user of filteredUsers) {
      try {
        // Create user moderation history record
        const moderationRecord = await prisma.userModerationHistory.create({
          data: {
            userId: user.id,
            workspaceId,
            actionType,
            reason: `${reason} (Bulk action)`,
            moderatorId: normalizeUserId(session.user.id),
            targetType: 'USER',
            targetId: user.id,
            severity,
            expiresAt,
            metadata: {
              duration: duration || null,
              bulkAction: true,
              totalUsers: filteredUsers.length,
              userEmail: user.email,
              userName: user.name
            }
          }
        })

        // Create corresponding moderation action
        const moderationAction = await prisma.moderationAction.create({
          data: {
            workspaceId,
            moderatorId: normalizeUserId(session.user.id),
            actionType,
            targetType: 'USER',
            targetId: user.id,
            reason: `${reason} (Bulk action)`,
            description: `Bulk user ${action} - ${reason}`,
            status: 'COMPLETED',
            reviewedBy: normalizeUserId(session.user.id),
            reviewedAt: new Date(),
            ipAddress: request.ip || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        })

        // Apply action effects to user's content
        if (['suspend', 'ban'].includes(action)) {
          await prisma.communityForumPost.updateMany({
            where: {
              userId: user.id,
              workspaceId
            },
            data: {
              isApproved: false
            }
          })
        }

        // Create community activity for each user
        await prisma.communityActivity.create({
          data: {
            activityType: 'MODERATION_ACTION',
            title: `User ${action}ed (bulk action)`,
            description: `${user.name} was ${action}ed via bulk moderation`,
            userId: normalizeUserId(session.user.id),
            userName: session.user.name || 'Moderator',
            userAvatar: session.user.image,
            targetId: user.id,
            targetType: 'user',
            targetTitle: user.name || 'User',
            workspaceId,
            metadata: {
              action,
              reason,
              duration,
              bulkAction: true,
              totalUsers: filteredUsers.length,
              targetUserId: user.id,
              targetUserName: user.name,
              moderatorAction: true
            }
          }
        })

        results.push({
          userId: user.id,
          userName: user.name,
          success: true,
          action: moderationAction,
          moderationRecord
        })

      } catch (error) {
        console.error(`Failed to process user ${user.id}:`, error)
        errors.push({
          userId: user.id,
          userName: user.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Create a summary activity for the bulk action
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: `Bulk user moderation: ${results.length} users ${action}ed`,
        description: `Bulk ${action} action completed on ${results.length} users` +
                    (errors.length > 0 ? `, ${errors.length} failed` : ''),
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: workspaceId,
        targetType: 'workspace',
        targetTitle: 'Bulk User Moderation',
        workspaceId,
        metadata: {
          action,
          reason,
          duration,
          bulkAction: true,
          totalRequested: userIds.length,
          totalSuccessful: results.length,
          totalFailed: errors.length,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      totalRequested: userIds.length,
      totalSuccessful: results.length,
      totalFailed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('Failed to execute bulk user moderation:', error)
    return NextResponse.json(
      { error: 'Failed to execute bulk user moderation' },
      { status: 500 }
    )
  }
}

// GET /api/community/users/bulk - Get user moderation statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get user moderation statistics
    const [
      totalCommunityUsers,
      activeSuspensions,
      activeBans,
      recentWarnings,
      recentModerationActions,
      topModerators
    ] = await Promise.all([
      // Total users with community activity
      prisma.user.count({
        where: {
          OR: [
            { forumPosts: { some: workspaceId ? { workspaceId } : {} } },
            { featureRequests: { some: workspaceId ? { workspaceId } : {} } },
            { forumReplies: { some: {} } }
          ]
        }
      }),
      // Currently suspended users
      prisma.userModerationHistory.count({
        where: {
          workspaceId,
          actionType: 'SUSPEND',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      // Currently banned users
      prisma.userModerationHistory.count({
        where: {
          workspaceId,
          actionType: 'BAN',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      }),
      // Warnings in last 30 days
      prisma.userModerationHistory.count({
        where: {
          workspaceId,
          actionType: 'WARN',
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      // Recent moderation actions
      prisma.userModerationHistory.findMany({
        where: {
          workspaceId,
          createdAt: { gte: sevenDaysAgo }
        },
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
        take: 10
      }),
      // Top moderators by action count (last 30 days)
      prisma.userModerationHistory.groupBy({
        by: ['moderatorId'],
        where: {
          workspaceId,
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

    // Get moderation trend (last 7 days)
    const moderationTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = await prisma.userModerationHistory.count({
        where: {
          workspaceId,
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

    return NextResponse.json({
      statistics: {
        totalCommunityUsers,
        activeSuspensions,
        activeBans,
        recentWarnings,
        totalModerationActions: activeSuspensions + activeBans + recentWarnings
      },
      recentActions: recentModerationActions,
      topModerators: topModeratorsWithNames,
      moderationTrend
    })

  } catch (error) {
    console.error('Failed to fetch user moderation statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}