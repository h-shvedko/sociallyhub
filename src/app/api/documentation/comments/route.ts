import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/comments - Get comments for a page
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    const where: any = { pageId }

    if (type) {
      where.type = type.toUpperCase()
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const comments = await prisma.documentationComment.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        parentComment: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                name: true
              }
            }
          }
        },
        replies: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            replies: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const totalCount = await prisma.documentationComment.count({ where })

    return NextResponse.json({
      comments,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Failed to fetch comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/comments - Create new comment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      pageId,
      content,
      type = 'GENERAL',
      status = 'OPEN',
      parentCommentId,
      metadata = {}
    } = body

    if (!pageId || !content) {
      return NextResponse.json(
        { error: 'Page ID and content are required' },
        { status: 400 }
      )
    }

    // Verify page exists
    const page = await prisma.documentationPage.findUnique({
      where: { id: pageId }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // If replying to a comment, verify parent exists
    if (parentCommentId) {
      const parentComment = await prisma.documentationComment.findUnique({
        where: { id: parentCommentId }
      })

      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }

      if (parentComment.pageId !== pageId) {
        return NextResponse.json(
          { error: 'Parent comment belongs to different page' },
          { status: 400 }
        )
      }
    }

    const comment = await prisma.documentationComment.create({
      data: {
        pageId,
        authorId: normalizedUserId,
        content,
        type: type.toUpperCase() as any,
        status: status.toUpperCase() as any,
        parentCommentId,
        metadata
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        parentComment: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    // Send notification to page author if it's a review comment
    if (type === 'CORRECTION' || type === 'SUGGESTION') {
      // In a real implementation, send notification via email or in-app notification system
      console.log(`Review comment added to page ${page.title} by ${session.user.name}`)
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Failed to create comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/comments/[id] - Update comment
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    const body = await request.json()
    const { content, status, resolvedBy } = body

    // Check if comment exists and user has permission
    const existingComment = await prisma.documentationComment.findUnique({
      where: { id }
    })

    if (!existingComment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Only author can edit content, but anyone can change status
    if (content && existingComment.authorId !== normalizedUserId) {
      return NextResponse.json(
        { error: 'Only comment author can edit content' },
        { status: 403 }
      )
    }

    const updatedComment = await prisma.documentationComment.update({
      where: { id },
      data: {
        ...(content && { content }),
        ...(status && { status: status.toUpperCase() as any }),
        ...(resolvedBy && { resolvedBy }),
        ...(status === 'RESOLVED' && { resolvedAt: new Date() })
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error('Failed to update comment:', error)
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/comments/[id] - Delete comment
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if comment exists and user has permission
    const existingComment = await prisma.documentationComment.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            replies: true
          }
        }
      }
    })

    if (!existingComment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      )
    }

    // Only author can delete their comment
    if (existingComment.authorId !== normalizedUserId) {
      return NextResponse.json(
        { error: 'Only comment author can delete' },
        { status: 403 }
      )
    }

    // Don't allow deleting comments with replies
    if (existingComment._count.replies > 0) {
      return NextResponse.json(
        { error: 'Cannot delete comment with replies' },
        { status: 400 }
      )
    }

    await prisma.documentationComment.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete comment:', error)
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/comments/[id]/resolve - Resolve comment
export async function POST(request: NextRequest) {
  if (request.url.includes('/resolve')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const normalizedUserId = normalizeUserId(session.user.id)
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const id = pathParts[pathParts.length - 2] // Get comment ID from URL

      const body = await request.json()
      const { resolution } = body

      // Check if comment exists
      const comment = await prisma.documentationComment.findUnique({
        where: { id }
      })

      if (!comment) {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        )
      }

      if (comment.status === 'RESOLVED') {
        return NextResponse.json(
          { error: 'Comment is already resolved' },
          { status: 400 }
        )
      }

      const resolvedComment = await prisma.documentationComment.update({
        where: { id },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolvedBy: normalizedUserId,
          metadata: {
            ...comment.metadata,
            resolution
          }
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        }
      })

      return NextResponse.json(resolvedComment)
    } catch (error) {
      console.error('Failed to resolve comment:', error)
      return NextResponse.json(
        { error: 'Failed to resolve comment' },
        { status: 500 }
      )
    }
  }
}