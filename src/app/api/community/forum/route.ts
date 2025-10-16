import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/forum - List forum posts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'recent' // recent, popular, most_replies, oldest
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      isApproved: true
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ]
    }

    // Build order by clause
    let orderBy: any
    switch (sort) {
      case 'popular':
        orderBy = [{ views: 'desc' }, { likes: 'desc' }]
        break
      case 'most_replies':
        orderBy = [{ replies: 'desc' }, { lastActivity: 'desc' }]
        break
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      default: // recent
        orderBy = [{ isPinned: 'desc' }, { lastActivity: 'desc' }]
    }

    const [posts, totalCount, categoryStats] = await Promise.all([
      prisma.communityForumPost.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          tags: true,
          isPinned: true,
          isLocked: true,
          isResolved: true,
          views: true,
          likes: true,
          replies: true,
          lastActivity: true,
          guestName: true,
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
        orderBy,
        take: limit,
        skip: offset
      }),
      prisma.communityForumPost.count({ where }),
      // Get category statistics
      prisma.communityForumPost.groupBy({
        by: ['category'],
        where: { isApproved: true },
        _count: {
          category: true
        }
      })
    ])

    return NextResponse.json({
      posts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + posts.length < totalCount
      },
      categoryStats
    })

  } catch (error) {
    console.error('Failed to fetch forum posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch forum posts' },
      { status: 500 }
    )
  }
}

// POST /api/community/forum - Create a new forum post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    const {
      title,
      content,
      category = 'GENERAL',
      tags = [],
      workspaceId,
      guestName,
      guestEmail
    } = body

    // Validation
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // For guest users, require name and email
    if (!session?.user?.id && (!guestName || !guestEmail)) {
      return NextResponse.json(
        { error: 'Guest name and email are required for non-logged-in users' },
        { status: 400 }
      )
    }

    const postData: any = {
      title: title.trim(),
      content: content.trim(),
      category,
      tags,
      guestName: guestName?.trim(),
      guestEmail: guestEmail?.trim()
    }

    // Add user/workspace if authenticated
    if (session?.user?.id) {
      postData.userId = normalizeUserId(session.user.id)
      if (workspaceId) {
        // Verify user has access to workspace
        const userWorkspace = await prisma.userWorkspace.findUnique({
          where: {
            userId_workspaceId: {
              userId: normalizeUserId(session.user.id),
              workspaceId
            }
          }
        })
        if (userWorkspace) {
          postData.workspaceId = workspaceId
        }
      }
    }

    const post = await prisma.communityForumPost.create({
      data: postData,
      include: {
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
      }
    })

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'FORUM_POST_CREATED',
        title: 'New forum post created',
        description: title,
        userId: session?.user?.id ? normalizeUserId(session.user.id) : null,
        userName: session?.user?.name || guestName || 'Anonymous',
        userAvatar: session?.user?.image,
        targetId: post.id,
        targetType: 'forum_post',
        targetTitle: title,
        workspaceId: workspaceId || null,
        metadata: {
          category,
          tags
        }
      }
    })

    return NextResponse.json(post, { status: 201 })

  } catch (error) {
    console.error('Failed to create forum post:', error)
    return NextResponse.json(
      { error: 'Failed to create forum post' },
      { status: 500 }
    )
  }
}