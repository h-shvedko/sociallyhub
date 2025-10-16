import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/activity - Get community activity feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const activityType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    if (workspaceId) {
      where.workspaceId = workspaceId
    }

    if (activityType) {
      where.activityType = activityType
    }

    const [activities, totalCount, stats] = await Promise.all([
      prisma.communityActivity.findMany({
        where,
        select: {
          id: true,
          activityType: true,
          title: true,
          description: true,
          userId: true,
          userName: true,
          userAvatar: true,
          targetId: true,
          targetType: true,
          targetTitle: true,
          metadata: true,
          createdAt: true,
          user: {
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
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.communityActivity.count({ where }),
      // Get activity statistics
      prisma.communityActivity.groupBy({
        by: ['activityType'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          },
          ...where
        },
        _count: {
          activityType: true
        }
      })
    ])

    // Get real-time community stats
    const [
      totalForumPosts,
      totalFeatureRequests,
      activeUsersCount,
      recentForumActivity,
      popularFeatureRequests
    ] = await Promise.all([
      prisma.communityForumPost.count({
        where: workspaceId ? { workspaceId } : {}
      }),
      prisma.featureRequest.count({
        where: workspaceId ? { workspaceId } : {}
      }),
      prisma.communityActivity.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          },
          userId: { not: null },
          ...where
        },
        _count: {
          userId: true
        }
      }),
      prisma.communityForumPost.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          },
          ...(workspaceId ? { workspaceId } : {})
        },
        select: {
          id: true,
          title: true,
          views: true,
          replies: true,
          createdAt: true
        },
        orderBy: {
          views: 'desc'
        },
        take: 5
      }),
      prisma.featureRequest.findMany({
        where: {
          ...(workspaceId ? { workspaceId } : {})
        },
        select: {
          id: true,
          title: true,
          votes: true,
          status: true,
          createdAt: true
        },
        orderBy: {
          votes: 'desc'
        },
        take: 5
      })
    ])

    const communityStats = {
      totalForumPosts,
      totalFeatureRequests,
      activeUsers: activeUsersCount.length,
      weeklyActivityByType: stats,
      recentForumActivity,
      popularFeatureRequests
    }

    return NextResponse.json({
      activities,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + activities.length < totalCount
      },
      stats: communityStats
    })

  } catch (error) {
    console.error('Failed to fetch community activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch community activity' },
      { status: 500 }
    )
  }
}

// POST /api/community/activity - Create a community activity (internal use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    const {
      activityType,
      title,
      description,
      targetId,
      targetType,
      targetTitle,
      workspaceId,
      metadata = {}
    } = body

    // Validation
    if (!activityType || !title) {
      return NextResponse.json(
        { error: 'Activity type and title are required' },
        { status: 400 }
      )
    }

    const userId = session?.user?.id ? normalizeUserId(session.user.id) : null

    const activity = await prisma.communityActivity.create({
      data: {
        activityType,
        title,
        description,
        userId,
        userName: session?.user?.name || 'Anonymous',
        userAvatar: session?.user?.image,
        targetId,
        targetType,
        targetTitle,
        workspaceId,
        metadata
      }
    })

    return NextResponse.json(activity, { status: 201 })

  } catch (error) {
    console.error('Failed to create community activity:', error)
    return NextResponse.json(
      { error: 'Failed to create community activity' },
      { status: 500 }
    )
  }
}