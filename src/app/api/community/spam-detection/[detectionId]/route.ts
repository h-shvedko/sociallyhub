import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/spam-detection/[detectionId] - Get specific detection details
export async function GET(
  request: NextRequest,
  { params }: { params: { detectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { detectionId } = params
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

    // Get the detection record
    const detection = await prisma.spamDetection.findUnique({
      where: { id: detectionId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!detection) {
      return NextResponse.json({ error: 'Detection not found' }, { status: 404 })
    }

    // Get related content if targetId exists
    let relatedContent = null
    if (detection.targetId) {
      if (detection.targetType === 'POST') {
        relatedContent = await prisma.communityForumPost.findUnique({
          where: { id: detection.targetId },
          select: {
            id: true,
            title: true,
            content: true,
            isApproved: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        })
      } else if (detection.targetType === 'REPLY') {
        relatedContent = await prisma.communityForumReply.findUnique({
          where: { id: detection.targetId },
          select: {
            id: true,
            content: true,
            isApproved: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            },
            post: {
              select: {
                id: true,
                title: true
              }
            }
          }
        })
      }
    }

    // Get any moderation actions taken based on this detection
    const moderationActions = await prisma.moderationAction.findMany({
      where: {
        targetType: detection.targetType === 'POST' ? 'FORUM_POST' : 'FORUM_REPLY',
        targetId: detection.targetId || undefined,
        reason: { contains: 'spam', mode: 'insensitive' }
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
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      detection,
      relatedContent,
      moderationActions
    })

  } catch (error) {
    console.error('Failed to fetch detection details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch detection details' },
      { status: 500 }
    )
  }
}

// PUT /api/community/spam-detection/[detectionId] - Update detection status (train system)
export async function PUT(
  request: NextRequest,
  { params }: { params: { detectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { detectionId } = params
    const body = await request.json()
    const {
      status, // CONFIRMED, FALSE_POSITIVE, PENDING
      reviewNotes,
      workspaceId
    } = body

    // Validation
    if (!status || !['CONFIRMED', 'FALSE_POSITIVE', 'PENDING'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (CONFIRMED, FALSE_POSITIVE, PENDING)' },
        { status: 400 }
      )
    }

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

    // Get the current detection
    const currentDetection = await prisma.spamDetection.findUnique({
      where: { id: detectionId }
    })

    if (!currentDetection) {
      return NextResponse.json({ error: 'Detection not found' }, { status: 404 })
    }

    // Update the detection status
    const updatedDetection = await prisma.spamDetection.update({
      where: { id: detectionId },
      data: {
        status,
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        reviewNotes,
        metadata: {
          ...currentDetection.metadata,
          reviewHistory: [
            ...(currentDetection.metadata?.reviewHistory || []),
            {
              reviewedBy: normalizeUserId(session.user.id),
              reviewedAt: new Date(),
              previousStatus: currentDetection.status,
              newStatus: status,
              notes: reviewNotes
            }
          ]
        }
      }
    })

    // Create activity log for training data
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: 'Spam detection reviewed',
        description: `Detection status updated to ${status}${reviewNotes ? ` - ${reviewNotes}` : ''}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: detectionId,
        targetType: 'spam_detection',
        targetTitle: `Spam Detection #${detectionId.substring(0, 8)}`,
        workspaceId: workspaceId || currentDetection.workspaceId!,
        metadata: {
          detectionType: currentDetection.detectionType,
          confidence: currentDetection.confidence,
          previousStatus: currentDetection.status,
          newStatus: status,
          reviewNotes,
          trainingData: true
        }
      }
    })

    // If this is training data, we could update ML models here
    // For now, we'll just log it for future model training

    return NextResponse.json({
      success: true,
      detection: updatedDetection,
      message: `Detection status updated to ${status}`
    })

  } catch (error) {
    console.error('Failed to update detection status:', error)
    return NextResponse.json(
      { error: 'Failed to update detection status' },
      { status: 500 }
    )
  }
}

// DELETE /api/community/spam-detection/[detectionId] - Delete detection record
export async function DELETE(
  request: NextRequest,
  { params }: { params: { detectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { detectionId } = params
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

    // Get the detection before deletion
    const detection = await prisma.spamDetection.findUnique({
      where: { id: detectionId }
    })

    if (!detection) {
      return NextResponse.json({ error: 'Detection not found' }, { status: 404 })
    }

    // Delete the detection record
    await prisma.spamDetection.delete({
      where: { id: detectionId }
    })

    // Create activity log
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: 'Spam detection deleted',
        description: `Spam detection record deleted`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: detectionId,
        targetType: 'spam_detection',
        targetTitle: `Spam Detection #${detectionId.substring(0, 8)}`,
        workspaceId: workspaceId || detection.workspaceId!,
        metadata: {
          deletedDetection: {
            detectionType: detection.detectionType,
            confidence: detection.confidence,
            status: detection.status,
            targetType: detection.targetType,
            targetId: detection.targetId
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Detection record deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete detection record:', error)
    return NextResponse.json(
      { error: 'Failed to delete detection record' },
      { status: 500 }
    )
  }
}