import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/reports/[reportId] - Get specific report details
export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportId } = params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Get the report
    const report = await prisma.contentReport.findUnique({
      where: { id: reportId },
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
            createdAt: true
          }
        },
        assignedModerator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Check permissions - moderators can see all reports, users can only see their own
    const isOwnReport = report.submittedById === normalizeUserId(session.user.id)
    let isModerator = false

    if (workspaceId || report.workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId: workspaceId || report.workspaceId!
          }
        }
      })
      isModerator = userWorkspace && ['OWNER', 'ADMIN'].includes(userWorkspace.role)
    }

    if (!isOwnReport && !isModerator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get target content details
    let targetContent = null
    if (report.targetId) {
      try {
        if (report.targetType === 'FORUM_POST') {
          targetContent = await prisma.communityForumPost.findUnique({
            where: { id: report.targetId },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          })
        } else if (report.targetType === 'FORUM_REPLY') {
          targetContent = await prisma.communityForumReply.findUnique({
            where: { id: report.targetId },
            include: {
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
      } catch (error) {
        console.error('Failed to fetch target content:', error)
      }
    }

    // Get moderation history for this report
    const moderationHistory = []
    if (isModerator) {
      const history = await prisma.moderationAction.findMany({
        where: {
          targetType: report.targetType,
          targetId: report.targetId || undefined,
          reason: { contains: 'report', mode: 'insensitive' }
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
      moderationHistory.push(...history)
    }

    // Get similar reports (for moderators)
    let similarReports = []
    if (isModerator && report.reportedUserId) {
      similarReports = await prisma.contentReport.findMany({
        where: {
          reportedUserId: report.reportedUserId,
          id: { not: reportId },
          workspaceId: report.workspaceId
        },
        select: {
          id: true,
          category: true,
          reason: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    }

    // Get user's moderation history (for moderators)
    let userModerationHistory = []
    if (isModerator && report.reportedUserId) {
      userModerationHistory = await prisma.userModerationHistory.findMany({
        where: {
          userId: report.reportedUserId,
          workspaceId: report.workspaceId || undefined
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
    }

    return NextResponse.json({
      report,
      targetContent,
      moderationHistory,
      similarReports,
      userModerationHistory,
      permissions: {
        canModerate: isModerator,
        isOwnReport
      }
    })

  } catch (error) {
    console.error('Failed to fetch report details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report details' },
      { status: 500 }
    )
  }
}

// PUT /api/community/reports/[reportId] - Update report status/assignment
export async function PUT(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportId } = params
    const body = await request.json()
    const {
      status, // PENDING, INVESTIGATING, RESOLVED, DISMISSED
      priority, // LOW, MEDIUM, HIGH, URGENT
      assignedModeratorId,
      moderatorNotes,
      resolution,
      actionTaken,
      workspaceId
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

    // Get current report
    const currentReport = await prisma.contentReport.findUnique({
      where: { id: reportId },
      include: {
        reportedUser: true,
        submittedBy: true
      }
    })

    if (!currentReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Update the report
    const updateData: any = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assignedModeratorId && { assignedModeratorId }),
      ...(moderatorNotes && { moderatorNotes }),
      ...(resolution && { resolution }),
      lastUpdatedById: normalizeUserId(session.user.id)
    }

    // If resolving or dismissing, set resolved timestamp
    if (status === 'RESOLVED' || status === 'DISMISSED') {
      updateData.resolvedAt = new Date()
      updateData.resolvedById = normalizeUserId(session.user.id)
    }

    const updatedReport = await prisma.contentReport.update({
      where: { id: reportId },
      data: updateData,
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        assignedModerator: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // If action was taken, create moderation records
    if (actionTaken && status === 'RESOLVED') {
      // Create moderation action for the target content
      if (currentReport.targetId) {
        await prisma.moderationAction.create({
          data: {
            workspaceId: workspaceId || currentReport.workspaceId!,
            moderatorId: normalizeUserId(session.user.id),
            actionType: actionTaken.toUpperCase(),
            targetType: currentReport.targetType,
            targetId: currentReport.targetId,
            reason: `Action taken based on report: ${currentReport.reason}`,
            description: resolution || moderatorNotes || 'Action taken based on user report',
            status: 'COMPLETED',
            reviewedBy: normalizeUserId(session.user.id),
            reviewedAt: new Date(),
            ipAddress: request.ip || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
          }
        })

        // Update target content based on action
        if (actionTaken === 'REMOVE' || actionTaken === 'REJECT') {
          if (currentReport.targetType === 'FORUM_POST') {
            await prisma.communityForumPost.update({
              where: { id: currentReport.targetId },
              data: { isApproved: false }
            })
          } else if (currentReport.targetType === 'FORUM_REPLY') {
            await prisma.communityForumReply.update({
              where: { id: currentReport.targetId },
              data: { isApproved: false }
            })
          }
        }
      }

      // Create user moderation history if action affects the user
      if (currentReport.reportedUserId && ['WARN', 'SUSPEND', 'BAN'].includes(actionTaken.toUpperCase())) {
        await prisma.userModerationHistory.create({
          data: {
            userId: currentReport.reportedUserId,
            workspaceId: workspaceId || currentReport.workspaceId!,
            actionType: actionTaken.toUpperCase(),
            reason: `Action taken based on report: ${currentReport.reason}`,
            moderatorId: normalizeUserId(session.user.id),
            targetType: currentReport.targetType,
            targetId: currentReport.targetId,
            severity: currentReport.priority === 'URGENT' ? 'HIGH' :
                     currentReport.priority === 'HIGH' ? 'MEDIUM' : 'LOW'
          }
        })
      }
    }

    // Create activity log
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: `Report ${status.toLowerCase()}`,
        description: resolution || moderatorNotes || `Report status updated to ${status}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Moderator',
        userAvatar: session.user.image,
        targetId: reportId,
        targetType: 'content_report',
        targetTitle: `Report #${reportId.substring(0, 8)}`,
        workspaceId: workspaceId || currentReport.workspaceId!,
        metadata: {
          reportId,
          previousStatus: currentReport.status,
          newStatus: status,
          actionTaken,
          category: currentReport.category,
          priority: priority || currentReport.priority
        }
      }
    })

    return NextResponse.json({
      success: true,
      report: updatedReport,
      message: `Report ${status.toLowerCase()} successfully`
    })

  } catch (error) {
    console.error('Failed to update report:', error)
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    )
  }
}

// DELETE /api/community/reports/[reportId] - Delete report (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { reportId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportId } = params
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // Verify user has admin permissions (only admins can delete reports)
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findUnique({
        where: {
          userId_workspaceId: {
            userId: normalizeUserId(session.user.id),
            workspaceId
          }
        }
      })

      if (!userWorkspace || userWorkspace.role !== 'OWNER') {
        return NextResponse.json({ error: 'Only workspace owners can delete reports' }, { status: 403 })
      }
    }

    // Get the report before deletion
    const report = await prisma.contentReport.findUnique({
      where: { id: reportId }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Delete the report
    await prisma.contentReport.delete({
      where: { id: reportId }
    })

    // Create activity log
    await prisma.communityActivity.create({
      data: {
        activityType: 'MODERATION_ACTION',
        title: 'Report deleted',
        description: `Report deleted: ${report.reason}`,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Admin',
        userAvatar: session.user.image,
        targetId: reportId,
        targetType: 'content_report',
        targetTitle: `Report #${reportId.substring(0, 8)}`,
        workspaceId: workspaceId || report.workspaceId!,
        metadata: {
          deletedReport: {
            category: report.category,
            reason: report.reason,
            status: report.status,
            priority: report.priority,
            targetType: report.targetType,
            targetId: report.targetId
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    })

  } catch (error) {
    console.error('Failed to delete report:', error)
    return NextResponse.json(
      { error: 'Failed to delete report' },
      { status: 500 }
    )
  }
}