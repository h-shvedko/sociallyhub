import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/reports - List content reports
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') // PENDING, INVESTIGATING, RESOLVED, DISMISSED
    const category = searchParams.get('category') // SPAM, HARASSMENT, INAPPROPRIATE, COPYRIGHT, etc.
    const priority = searchParams.get('priority') // LOW, MEDIUM, HIGH, URGENT
    const targetType = searchParams.get('targetType') // FORUM_POST, FORUM_REPLY, USER
    const sort = searchParams.get('sort') || 'recent' // recent, priority, oldest
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // For moderators, show all reports; for regular users, show only their reports
    let userFilter = {}
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
        // Regular user - only show their reports
        userFilter = { submittedById: normalizeUserId(session.user.id) }
      }
    } else {
      // No workspace specified - show only user's reports
      userFilter = { submittedById: normalizeUserId(session.user.id) }
    }

    // Build where clause
    const where: any = {
      ...userFilter,
      ...(workspaceId && { workspaceId }),
      ...(status && { status }),
      ...(category && { category }),
      ...(priority && { priority }),
      ...(targetType && { targetType })
    }

    // Build order by clause
    let orderBy: any
    switch (sort) {
      case 'priority':
        orderBy = [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
        break
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      default: // recent
        orderBy = { createdAt: 'desc' }
    }

    const [reports, totalCount, statusStats] = await Promise.all([
      prisma.contentReport.findMany({
        where,
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
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy,
        take: limit,
        skip: offset
      }),
      prisma.contentReport.count({ where }),
      // Get status statistics
      prisma.contentReport.groupBy({
        by: ['status'],
        where: workspaceId ? { workspaceId, ...userFilter } : userFilter,
        _count: { status: true }
      })
    ])

    // Get target content details for each report
    const reportsWithContent = await Promise.all(
      reports.map(async (report) => {
        let targetContent = null

        if (report.targetId) {
          try {
            if (report.targetType === 'FORUM_POST') {
              targetContent = await prisma.communityForumPost.findUnique({
                where: { id: report.targetId },
                select: {
                  id: true,
                  title: true,
                  content: true,
                  isApproved: true,
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
                select: {
                  id: true,
                  content: true,
                  isApproved: true,
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
            console.error(`Failed to fetch target content for report ${report.id}:`, error)
          }
        }

        return {
          ...report,
          targetContent
        }
      })
    )

    return NextResponse.json({
      reports: reportsWithContent,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + reports.length < totalCount
      },
      statusStats
    })

  } catch (error) {
    console.error('Failed to fetch reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}

// POST /api/community/reports - Submit a new report
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const {
      targetType, // FORUM_POST, FORUM_REPLY, USER
      targetId,
      reportedUserId, // For user reports
      category, // SPAM, HARASSMENT, INAPPROPRIATE, COPYRIGHT, etc.
      reason,
      description,
      workspaceId,
      attachments = [],
      anonymous = false
    } = body

    // Validation
    if (!targetType || !category || !reason) {
      return NextResponse.json(
        { error: 'Target type, category, and reason are required' },
        { status: 400 }
      )
    }

    if (!targetId && !reportedUserId) {
      return NextResponse.json(
        { error: 'Either target ID or reported user ID is required' },
        { status: 400 }
      )
    }

    // Check if user is authenticated for non-anonymous reports
    if (!anonymous && !session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required for non-anonymous reports' }, { status: 401 })
    }

    // Validate target exists
    let targetExists = false
    if (targetId) {
      if (targetType === 'FORUM_POST') {
        const post = await prisma.communityForumPost.findUnique({
          where: { id: targetId },
          select: { id: true, userId: true }
        })
        if (post) {
          targetExists = true
          if (!reportedUserId && post.userId) {
            reportedUserId = post.userId
          }
        }
      } else if (targetType === 'FORUM_REPLY') {
        const reply = await prisma.communityForumReply.findUnique({
          where: { id: targetId },
          select: { id: true, userId: true }
        })
        if (reply) {
          targetExists = true
          if (!reportedUserId && reply.userId) {
            reportedUserId = reply.userId
          }
        }
      }
    } else if (targetType === 'USER' && reportedUserId) {
      const user = await prisma.user.findUnique({
        where: { id: reportedUserId },
        select: { id: true }
      })
      targetExists = !!user
    }

    if (!targetExists) {
      return NextResponse.json({ error: 'Target content or user not found' }, { status: 404 })
    }

    // Check for duplicate reports (same user reporting same target within 24 hours)
    if (session?.user?.id) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const existingReport = await prisma.contentReport.findFirst({
        where: {
          submittedById: normalizeUserId(session.user.id),
          targetType,
          targetId: targetId || null,
          reportedUserId: reportedUserId || null,
          createdAt: { gte: twentyFourHoursAgo }
        }
      })

      if (existingReport) {
        return NextResponse.json(
          { error: 'You have already reported this content within the last 24 hours' },
          { status: 400 }
        )
      }
    }

    // Determine priority based on category
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
    switch (category) {
      case 'HARASSMENT':
      case 'THREATS':
      case 'DOXXING':
        priority = 'HIGH'
        break
      case 'SPAM':
      case 'COPYRIGHT':
        priority = 'MEDIUM'
        break
      case 'INAPPROPRIATE':
      case 'OFF_TOPIC':
        priority = 'LOW'
        break
      case 'ILLEGAL_CONTENT':
      case 'SELF_HARM':
        priority = 'URGENT'
        break
    }

    // Create the report
    const report = await prisma.contentReport.create({
      data: {
        workspaceId: workspaceId || null,
        targetType,
        targetId: targetId || null,
        reportedUserId: reportedUserId || null,
        submittedById: anonymous ? null : (session?.user?.id ? normalizeUserId(session.user.id) : null),
        category,
        reason: reason.trim(),
        description: description?.trim(),
        priority,
        status: 'PENDING',
        attachments,
        metadata: {
          anonymous,
          userAgent: request.headers.get('user-agent'),
          ipAddress: request.ip || 'unknown',
          submissionTimestamp: new Date().toISOString()
        }
      },
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
        }
      }
    })

    // Auto-assign to moderators if high priority
    if (priority === 'HIGH' || priority === 'URGENT') {
      // Find available moderators in the workspace
      if (workspaceId) {
        const moderators = await prisma.userWorkspace.findMany({
          where: {
            workspaceId,
            role: { in: ['OWNER', 'ADMIN'] }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          },
          take: 1 // Assign to first available moderator
        })

        if (moderators.length > 0) {
          await prisma.contentReport.update({
            where: { id: report.id },
            data: {
              assignedModeratorId: moderators[0].userId,
              status: 'INVESTIGATING'
            }
          })
        }
      }
    }

    // Create community activity for the report
    await prisma.communityActivity.create({
      data: {
        activityType: 'REPORT_SUBMITTED',
        title: `Content report submitted`,
        description: `${category.toLowerCase()} report: ${reason}`,
        userId: anonymous ? null : (session?.user?.id ? normalizeUserId(session.user.id) : null),
        userName: anonymous ? 'Anonymous' : (session?.user?.name || 'Anonymous'),
        userAvatar: anonymous ? null : session?.user?.image,
        targetId: targetId || reportedUserId || '',
        targetType: targetType.toLowerCase(),
        targetTitle: `${targetType} Report`,
        workspaceId: workspaceId || null,
        metadata: {
          reportId: report.id,
          category,
          priority,
          targetType,
          anonymous
        }
      }
    })

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        status: report.status,
        priority: report.priority,
        category: report.category
      },
      message: 'Report submitted successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to submit report:', error)
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}