import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/users - List community users with moderation info
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const search = searchParams.get('search')
    const status = searchParams.get('status') // ACTIVE, SUSPENDED, BANNED
    const sort = searchParams.get('sort') || 'recent' // recent, activity, violations
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

    // Build where clause for users with community activity
    const userWhere: any = {}

    if (search) {
      userWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Build order by clause
    let orderBy: any
    switch (sort) {
      case 'activity':
        orderBy = { forumPosts: { _count: 'desc' } }
        break
      case 'violations':
        orderBy = { moderationHistory: { _count: 'desc' } }
        break
      default: // recent
        orderBy = { createdAt: 'desc' }
    }

    const users = await prisma.user.findMany({
      where: {
        ...userWhere,
        // Only include users who have community activity
        OR: [
          { forumPosts: { some: workspaceId ? { workspaceId } : {} } },
          { featureRequests: { some: workspaceId ? { workspaceId } : {} } },
          { forumReplies: { some: {} } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        // Community activity counts
        _count: {
          select: {
            forumPosts: workspaceId ? { where: { workspaceId } } : true,
            forumReplies: true,
            featureRequests: workspaceId ? { where: { workspaceId } } : true,
            moderationHistory: workspaceId ? { where: { workspaceId } } : true
          }
        },
        // Recent moderation history
        moderationHistory: {
          where: workspaceId ? { workspaceId } : {},
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            actionType: true,
            reason: true,
            severity: true,
            createdAt: true,
            moderator: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        // Recent forum posts
        forumPosts: {
          where: workspaceId ? { workspaceId } : {},
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            title: true,
            isApproved: true,
            isPinned: true,
            isLocked: true,
            createdAt: true
          }
        }
      },
      orderBy,
      take: limit,
      skip: offset
    })

    // Get total count
    const totalCount = await prisma.user.count({
      where: {
        ...userWhere,
        OR: [
          { forumPosts: { some: workspaceId ? { workspaceId } : {} } },
          { featureRequests: { some: workspaceId ? { workspaceId } : {} } },
          { forumReplies: { some: {} } }
        ]
      }
    })

    // Get user statistics
    const [
      activeUsers,
      suspendedUsers,
      bannedUsers,
      topContributors
    ] = await Promise.all([
      prisma.user.count({
        where: {
          forumPosts: { some: workspaceId ? { workspaceId } : {} },
          moderationHistory: {
            none: {
              actionType: { in: ['SUSPEND', 'BAN'] },
              ...(workspaceId && { workspaceId })
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          moderationHistory: {
            some: {
              actionType: 'SUSPEND',
              ...(workspaceId && { workspaceId })
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          moderationHistory: {
            some: {
              actionType: 'BAN',
              ...(workspaceId && { workspaceId })
            }
          }
        }
      }),
      // Top contributors by post count
      prisma.user.findMany({
        where: {
          forumPosts: { some: workspaceId ? { workspaceId } : {} }
        },
        select: {
          id: true,
          name: true,
          image: true,
          _count: {
            select: {
              forumPosts: workspaceId ? { where: { workspaceId } } : true,
              forumReplies: true
            }
          }
        },
        orderBy: {
          forumPosts: { _count: 'desc' }
        },
        take: 5
      })
    ])

    return NextResponse.json({
      users,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + users.length < totalCount
      },
      statistics: {
        activeUsers,
        suspendedUsers,
        bannedUsers,
        totalCommunityUsers: totalCount
      },
      topContributors
    })

  } catch (error) {
    console.error('Failed to fetch community users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch community users' },
      { status: 500 }
    )
  }
}