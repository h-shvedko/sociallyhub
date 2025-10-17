import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/users/[userId] - Get detailed user information
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = params
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

    // Get detailed user information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        timezone: true,
        locale: true,
        // Community activity
        forumPosts: {
          where: workspaceId ? { workspaceId } : {},
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            content: true,
            category: true,
            isApproved: true,
            isPinned: true,
            isLocked: true,
            views: true,
            likes: true,
            repliesCount: true,
            createdAt: true
          }
        },
        forumReplies: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            content: true,
            isApproved: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true
              }
            }
          }
        },
        featureRequests: {
          where: workspaceId ? { workspaceId } : {},
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            votes: true,
            createdAt: true
          }
        },
        // Moderation history
        moderationHistory: {
          where: workspaceId ? { workspaceId } : {},
          orderBy: { createdAt: 'desc' },
          include: {
            moderator: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        // Community activity counts
        _count: {
          select: {
            forumPosts: workspaceId ? { where: { workspaceId } } : true,
            forumReplies: true,
            featureRequests: workspaceId ? { where: { workspaceId } } : true,
            forumVotes: true,
            featureVotes: true,
            moderationHistory: workspaceId ? { where: { workspaceId } } : true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's current moderation status
    const currentModerationStatus = await prisma.userModerationHistory.findFirst({
      where: {
        userId,
        ...(workspaceId && { workspaceId }),
        actionType: { in: ['SUSPEND', 'BAN', 'UNSUSPEND', 'UNBAN'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate user reputation score
    const reputationFactors = {
      approvedPosts: user._count.forumPosts,
      totalReplies: user._count.forumReplies,
      totalVotes: user._count.forumVotes + user._count.featureVotes,
      violations: user._count.moderationHistory
    }

    const reputationScore = Math.max(0,
      (reputationFactors.approvedPosts * 10) +
      (reputationFactors.totalReplies * 5) +
      (reputationFactors.totalVotes * 2) -
      (reputationFactors.violations * 20)
    )

    // Get user's community engagement metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [recentPosts, recentReplies, recentVotes] = await Promise.all([
      prisma.communityForumPost.count({
        where: {
          userId,
          ...(workspaceId && { workspaceId }),
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.communityForumReply.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.communityForumVote.count({
        where: {
          userId,
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ])

    return NextResponse.json({
      user,
      moderationStatus: currentModerationStatus,
      reputation: {
        score: reputationScore,
        factors: reputationFactors
      },
      recentActivity: {
        posts: recentPosts,
        replies: recentReplies,
        votes: recentVotes,
        period: '30 days'
      }
    })

  } catch (error) {
    console.error('Failed to fetch user details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    )
  }
}

// PUT /api/community/users/[userId] - Apply moderation action to user
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = params
    const body = await request.json()
    const {
      action, // suspend, unsuspend, ban, unban, warn, promote
      reason,
      duration, // for temporary actions (in hours)
      workspaceId,
      notifyUser = true
    } = body

    // Validation
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

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cannot moderate self
    if (targetUser.id === normalizeUserId(session.user.id)) {
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
      case 'promote':
        actionType = 'PROMOTE'
        severity = 'LOW'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Calculate expiry date for temporary actions
    const expiresAt = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : null

    // Create user moderation history record
    const moderationRecord = await prisma.userModerationHistory.create({
      data: {
        userId: targetUser.id,
        workspaceId,
        actionType,
        reason,
        moderatorId: normalizeUserId(session.user.id),
        targetType: 'USER',
        targetId: targetUser.id,
        severity,
        expiresAt,
        metadata: {
          duration: duration || null,
          notifyUser,
          userEmail: targetUser.email,
          userName: targetUser.name
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
        targetId: targetUser.id,
        reason,
        description: `User ${action} - ${reason}`,
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // Apply action effects (if needed for other systems)
    // For example, if you have a user status field, update it here

    // Hide/show user's content based on action
    if (['suspend', 'ban'].includes(action)) {
      await prisma.communityForumPost.updateMany({
        where: {
          userId: targetUser.id,
          workspaceId
        },
        data: {
          isApproved: false
        }
      })
    } else if (['unsuspend', 'unban'].includes(action)) {
      // Optionally re-approve posts (or leave for manual review)
    }

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: `User ${action}ed`,
        description: `${targetUser.name} was ${action}ed by moderator`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: targetUser.id,
        targetType: 'user',
        targetTitle: targetUser.name || 'User',
        workspaceId,
        metadata: {
          action,
          reason,
          duration,
          targetUserId: targetUser.id,
          targetUserName: targetUser.name,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      action: moderationAction,
      moderationRecord,
      message: `User ${action}ed successfully`
    })

  } catch (error) {
    console.error('Failed to apply user moderation action:', error)
    return NextResponse.json(
      { error: 'Failed to apply moderation action' },
      { status: 500 }
    )
  }
}