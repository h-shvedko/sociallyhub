import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/forum/moderation/[postId] - Get post moderation details
export async function GET(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = params
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

    // Get the forum post with full details
    const post = await prisma.communityForumPost.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
            createdAt: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Get moderation history for this post
    const moderationHistory = await prisma.moderationAction.findMany({
      where: {
        targetType: 'FORUM_POST',
        targetId: postId
      },
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
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get any pending queue items
    const queueItem = await prisma.moderationQueue.findFirst({
      where: {
        targetType: 'FORUM_POST',
        targetId: postId,
        status: { in: ['PENDING', 'UNDER_REVIEW'] }
      },
      include: {
        assignedModerator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // Get content reports for this post
    const reports = await prisma.contentReport.findMany({
      where: {
        targetType: 'FORUM_POST',
        targetId: postId
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get user's moderation history (for context)
    const userModerationHistory = post.userId ? await prisma.userModerationHistory.findMany({
      where: {
        userId: post.userId,
        workspaceId: post.workspaceId || undefined
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }) : []

    return NextResponse.json({
      post,
      moderationHistory,
      queueItem,
      reports,
      userModerationHistory
    })

  } catch (error) {
    console.error('Failed to fetch post moderation details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post moderation details' },
      { status: 500 }
    )
  }
}

// PUT /api/community/forum/moderation/[postId] - Update post moderation status
export async function PUT(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = params
    const body = await request.json()
    const {
      action, // approve, reject, pin, unpin, lock, unlock, feature, unfeature
      reason,
      workspaceId,
      assignToModeratorId,
      priority,
      notifyUser = false
    } = body

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

    // Get the current post
    const currentPost = await prisma.communityForumPost.findUnique({
      where: { id: postId },
      include: {
        user: true
      }
    })

    if (!currentPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const previousData = {
      isApproved: currentPost.isApproved,
      isPinned: currentPost.isPinned,
      isLocked: currentPost.isLocked,
      isFeatured: currentPost.isFeatured
    }

    // Apply the moderation action
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
      case 'feature':
        updateData.isFeatured = true
        actionType = 'FEATURE'
        break
      case 'unfeature':
        updateData.isFeatured = false
        actionType = 'UNFEATURE'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update the post
    const updatedPost = await prisma.communityForumPost.update({
      where: { id: postId },
      data: updateData
    })

    // Create moderation action record
    const moderationAction = await prisma.moderationAction.create({
      data: {
        workspaceId: workspaceId || currentPost.workspaceId!,
        moderatorId: normalizeUserId(session.user.id),
        actionType,
        targetType: 'FORUM_POST',
        targetId: postId,
        reason,
        previousData,
        newData: updatedPost,
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // Update or create moderation queue item
    if (assignToModeratorId || priority) {
      await prisma.moderationQueue.upsert({
        where: {
          targetType_targetId_workspaceId: {
            targetType: 'FORUM_POST',
            targetId: postId,
            workspaceId: workspaceId || currentPost.workspaceId!
          }
        },
        update: {
          ...(assignToModeratorId && { assignedModeratorId: assignToModeratorId }),
          ...(priority && { priority }),
          status: action === 'approve' ? 'APPROVED' :
                  action === 'reject' ? 'REJECTED' : 'UNDER_REVIEW'
        },
        create: {
          targetType: 'FORUM_POST',
          targetId: postId,
          workspaceId: workspaceId || currentPost.workspaceId!,
          title: currentPost.title,
          priority: priority || 'MEDIUM',
          assignedModeratorId: assignToModeratorId,
          status: action === 'approve' ? 'APPROVED' :
                  action === 'reject' ? 'REJECTED' : 'UNDER_REVIEW'
        }
      })
    }

    // Add to user moderation history if this affects the user
    if (currentPost.userId && ['reject', 'lock'].includes(action)) {
      await prisma.userModerationHistory.create({
        data: {
          userId: currentPost.userId,
          workspaceId: workspaceId || currentPost.workspaceId!,
          actionType,
          reason,
          moderatorId: normalizeUserId(session.user.id),
          targetType: 'FORUM_POST',
          targetId: postId,
          severity: action === 'reject' ? 'MEDIUM' : 'LOW'
        }
      })
    }

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: `Forum post ${action}d`,
        description: reason || `Post ${action}d by moderator`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: postId,
        targetType: 'forum_post',
        targetTitle: currentPost.title,
        workspaceId: workspaceId || currentPost.workspaceId!,
        metadata: {
          action,
          reason,
          previousData,
          moderatorAction: true
        }
      }
    })

    return NextResponse.json({
      success: true,
      post: updatedPost,
      action: moderationAction
    })

  } catch (error) {
    console.error('Failed to update post moderation status:', error)
    return NextResponse.json(
      { error: 'Failed to update post moderation status' },
      { status: 500 }
    )
  }
}

// DELETE /api/community/forum/moderation/[postId] - Delete post (moderation action)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId } = params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const reason = searchParams.get('reason')

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

    // Get the post before deletion for logging
    const post = await prisma.communityForumPost.findUnique({
      where: { id: postId },
      include: {
        user: true
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Create moderation action record before deletion
    const moderationAction = await prisma.moderationAction.create({
      data: {
        workspaceId: workspaceId || post.workspaceId!,
        moderatorId: normalizeUserId(session.user.id),
        actionType: 'DELETE',
        targetType: 'FORUM_POST',
        targetId: postId,
        reason: reason || 'Post deleted by moderator',
        previousData: {
          title: post.title,
          content: post.content,
          isApproved: post.isApproved,
          isPinned: post.isPinned,
          isLocked: post.isLocked
        },
        status: 'COMPLETED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // Add to user moderation history
    if (post.userId) {
      await prisma.userModerationHistory.create({
        data: {
          userId: post.userId,
          workspaceId: workspaceId || post.workspaceId!,
          actionType: 'DELETE',
          reason: reason || 'Post deleted by moderator',
          moderatorId: normalizeUserId(session.user.id),
          targetType: 'FORUM_POST',
          targetId: postId,
          severity: 'HIGH'
        }
      })
    }

    // Delete the post and related data
    await prisma.$transaction([
      // Delete replies first (due to foreign key constraints)
      prisma.communityForumReply.deleteMany({
        where: { postId }
      }),
      // Delete votes
      prisma.communityForumVote.deleteMany({
        where: { postId }
      }),
      // Update moderation queue
      prisma.moderationQueue.updateMany({
        where: {
          targetType: 'FORUM_POST',
          targetId: postId
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolution: 'Post deleted by moderator'
        }
      }),
      // Finally delete the post
      prisma.communityForumPost.delete({
        where: { id: postId }
      })
    ])

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: 'Forum post deleted',
        description: reason || 'Post deleted by moderator',
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: postId,
        targetType: 'forum_post',
        targetTitle: post.title,
        workspaceId: workspaceId || post.workspaceId!,
        metadata: {
          action: 'delete',
          reason,
          moderatorAction: true,
          deletedPost: {
            title: post.title,
            content: post.content.substring(0, 200) + '...'
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
      action: moderationAction
    })

  } catch (error) {
    console.error('Failed to delete post:', error)
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    )
  }
}