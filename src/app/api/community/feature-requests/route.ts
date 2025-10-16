import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/feature-requests - List feature requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'popular' // popular, recent, oldest
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    if (category && category !== 'all') {
      where.category = category
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Build order by clause
    let orderBy: any
    switch (sort) {
      case 'recent':
        orderBy = { createdAt: 'desc' }
        break
      case 'oldest':
        orderBy = { createdAt: 'asc' }
        break
      default: // popular
        orderBy = [{ votes: 'desc' }, { views: 'desc' }]
    }

    const [requests, totalCount, statusStats] = await Promise.all([
      prisma.featureRequest.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          priority: true,
          status: true,
          estimatedEffort: true,
          targetVersion: true,
          votes: true,
          views: true,
          commentsCount: true,
          guestName: true,
          createdAt: true,
          updatedAt: true,
          implementedAt: true,
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
      prisma.featureRequest.count({ where }),
      // Get status statistics
      prisma.featureRequest.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      })
    ])

    return NextResponse.json({
      requests,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + requests.length < totalCount
      },
      statusStats
    })

  } catch (error) {
    console.error('Failed to fetch feature requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature requests' },
      { status: 500 }
    )
  }
}

// POST /api/community/feature-requests - Create a new feature request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()

    const {
      title,
      description,
      category = 'GENERAL',
      priority = 'MEDIUM',
      workspaceId,
      guestName,
      guestEmail
    } = body

    // Validation
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
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

    const requestData: any = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      guestName: guestName?.trim(),
      guestEmail: guestEmail?.trim()
    }

    // Add user/workspace if authenticated
    if (session?.user?.id) {
      requestData.userId = normalizeUserId(session.user.id)
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
          requestData.workspaceId = workspaceId
        }
      }
    }

    const request_obj = await prisma.featureRequest.create({
      data: requestData,
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
        activityType: 'FEATURE_REQUEST_CREATED',
        title: 'New feature request created',
        description: title,
        userId: session?.user?.id ? normalizeUserId(session.user.id) : null,
        userName: session?.user?.name || guestName || 'Anonymous',
        userAvatar: session?.user?.image,
        targetId: request_obj.id,
        targetType: 'feature_request',
        targetTitle: title,
        workspaceId: workspaceId || null,
        metadata: {
          category,
          priority
        }
      }
    })

    return NextResponse.json(request_obj, { status: 201 })

  } catch (error) {
    console.error('Failed to create feature request:', error)
    return NextResponse.json(
      { error: 'Failed to create feature request' },
      { status: 500 }
    )
  }
}