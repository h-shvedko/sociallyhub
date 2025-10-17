import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/community/forum/moderation/bulk - Bulk moderation actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      postIds,
      action, // approve, reject, pin, unpin, lock, unlock, delete
      reason,
      workspaceId
    } = body

    // Validation
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'Post IDs array is required' },
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

    // Get all posts to be modified
    const posts = await prisma.communityForumPost.findMany({
      where: {
        id: { in: postIds },
        workspaceId
      },
      include: {
        user: true
      }
    })

    if (posts.length === 0) {
      return NextResponse.json({ error: 'No posts found' }, { status: 404 })
    }

    const results = []
    const errors = []

    // Process each post
    for (const post of posts) {
      try {
        const previousData = {
          isApproved: post.isApproved,
          isPinned: post.isPinned,
          isLocked: post.isLocked,
          isFeatured: post.isFeatured
        }

        // Determine update data based on action
        const updateData: any = {}
        let actionType = ''

        switch (action) {
          case 'approve':
            updateData.isApproved = true
            actionType = 'APPROVE'
            break
          case 'reject':
            updateData.isApproved = false
            actionType = 'REJECT'
            break
          case 'pin':
            updateData.isPinned = true
            actionType = 'PIN'
            break
          case 'unpin':
            updateData.isPinned = false
            actionType = 'UNPIN'
            break
          case 'lock':
            updateData.isLocked = true
            actionType = 'LOCK'
            break
          case 'unlock':
            updateData.isLocked = false
            actionType = 'UNLOCK'
            break
          case 'delete':
            actionType = 'DELETE'
            break
          default:
            throw new Error(`Invalid action: ${action}`)
        }

        if (action === 'delete') {
          // Handle deletion
          await prisma.$transaction([
            // Delete replies first
            prisma.communityForumReply.deleteMany({
              where: { postId: post.id }
            }),
            // Delete votes
            prisma.communityForumVote.deleteMany({
              where: { postId: post.id }
            }),
            // Update moderation queue
            prisma.moderationQueue.updateMany({
              where: {
                targetType: 'FORUM_POST',
                targetId: post.id
              },
              data: {
                status: 'RESOLVED',
                resolvedAt: new Date(),
                resolution: 'Post deleted via bulk action'
              }
            }),
            // Delete the post
            prisma.communityForumPost.delete({
              where: { id: post.id }
            })
          ])
        } else {
          // Handle update
          await prisma.communityForumPost.update({
            where: { id: post.id },
            data: updateData
          })
        }

        // Create moderation action record
        const moderationAction = await prisma.moderationAction.create({
          data: {
            workspaceId,
            moderatorId: normalizeUserId(session.user.id),
            actionType,
            targetType: 'FORUM_POST',
            targetId: post.id,
            reason: reason || `Bulk ${action} action`,
            previousData,
            newData: action === 'delete' ? null : { ...previousData, ...updateData },
            status: 'COMPLETED',
            reviewedBy: normalizeUserId(session.user.id),
            reviewedAt: new Date(),
            ipAddress: request.ip || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        })

        // Update moderation queue
        if (action !== 'delete') {
          await prisma.moderationQueue.updateMany({
            where: {
              targetType: 'FORUM_POST',
              targetId: post.id,
              workspaceId
            },
            data: {
              status: action === 'approve' ? 'APPROVED' :
                      action === 'reject' ? 'REJECTED' : 'RESOLVED',
              resolvedAt: new Date(),
              resolution: reason || `Bulk ${action} action`
            }
          })
        }

        // Add to user moderation history for negative actions
        if (post.userId && ['reject', 'lock', 'delete'].includes(action)) {
          await prisma.userModerationHistory.create({
            data: {
              userId: post.userId,
              workspaceId,
              actionType,
              reason: reason || `Bulk ${action} action`,
              moderatorId: normalizeUserId(session.user.id),
              targetType: 'FORUM_POST',
              targetId: post.id,
              severity: action === 'delete' ? 'HIGH' :
                       action === 'reject' ? 'MEDIUM' : 'LOW'
            }
          })
        }

        // Create community activity
        await prisma.communityActivity.create({
          data: {
            activityType: 'MODERATION_ACTION',
            title: `Forum post ${action}d (bulk action)`,
            description: reason || `Post ${action}d via bulk moderation`,
            userId: normalizeUserId(session.user.id),
            userName: session.user.name || 'Moderator',
            userAvatar: session.user.image,
            targetId: post.id,
            targetType: 'forum_post',
            targetTitle: post.title,
            workspaceId,
            metadata: {
              action,
              reason,
              bulkAction: true,
              totalPosts: postIds.length,
              moderatorAction: true
            }
          }
        })

        results.push({
          postId: post.id,
          success: true,
          action: moderationAction
        })

      } catch (error) {
        console.error(`Failed to process post ${post.id}:`, error)
        errors.push({
          postId: post.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Create a summary activity for the bulk action
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: `Bulk moderation: ${results.length} posts ${action}d`,
        description: `Bulk ${action} action completed on ${results.length} posts` +
                    (errors.length > 0 ? `, ${errors.length} failed` : ''),
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: workspaceId,
        targetType: 'workspace',
        targetTitle: 'Bulk Moderation',
        workspaceId,
        metadata: {
          action,
          reason,
          bulkAction: true,
          totalRequested: postIds.length,
          totalSuccessful: results.length,
          totalFailed: errors.length,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      totalRequested: postIds.length,
      totalSuccessful: results.length,
      totalFailed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('Failed to execute bulk moderation:', error)
    return NextResponse.json(
      { error: 'Failed to execute bulk moderation' },
      { status: 500 }
    )
  }
}

// GET /api/community/forum/moderation/bulk - Get bulk moderation statistics
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

    // Get moderation statistics
    const [
      pendingCount,
      approvedCount,
      rejectedCount,
      totalPosts,
      recentActions
    ] = await Promise.all([
      prisma.communityForumPost.count({
        where: {
          workspaceId,
          isApproved: false
        }
      }),
      prisma.communityForumPost.count({
        where: {
          workspaceId,
          isApproved: true
        }
      }),
      prisma.moderationAction.count({
        where: {
          workspaceId,
          actionType: 'REJECT',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.communityForumPost.count({
        where: { workspaceId }
      }),
      prisma.moderationAction.findMany({
        where: {
          workspaceId,
          actionType: { in: ['APPROVE', 'REJECT', 'DELETE', 'PIN', 'LOCK'] }
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
      })
    ])

    // Get moderator activity stats
    const moderatorStats = await prisma.moderationAction.groupBy({
      by: ['moderatorId'],
      where: {
        workspaceId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
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

    // Get the moderator details
    const moderatorIds = moderatorStats.map(stat => stat.moderatorId).filter(Boolean)
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

    const moderatorStatsWithNames = moderatorStats.map(stat => ({
      ...stat,
      moderator: moderators.find(m => m.id === stat.moderatorId)
    }))

    return NextResponse.json({
      statistics: {
        pendingCount,
        approvedCount,
        rejectedCount,
        totalPosts,
        approvalRate: totalPosts > 0 ? (approvedCount / totalPosts * 100).toFixed(1) : 0
      },
      recentActions,
      moderatorStats: moderatorStatsWithNames
    })

  } catch (error) {
    console.error('Failed to fetch bulk moderation statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}