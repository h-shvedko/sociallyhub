import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/help/articles/[slug]/comments - Get article comments
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    // Find the article first
    const article = await prisma.helpArticle.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Get comments for this article
    const comments = await prisma.helpArticleComment.findMany({
      where: {
        articleId: article.id,
        isApproved: true // Only show approved comments
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ comments })

  } catch (error) {
    console.error('Failed to fetch article comments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/help/articles/[slug]/comments - Create new comment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()
    const { content, type = 'comment' } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      )
    }

    // Find the article first
    const article = await prisma.helpArticle.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Create comment data
    const commentData: any = {
      articleId: article.id,
      content: content.trim(),
      type, // 'comment', 'feedback', 'question'
      authorEmail: null,
      authorName: null,
      isApproved: false // Comments need approval by default
    }

    // If user is logged in, add their info
    if (session?.user) {
      commentData.authorId = session.user.id
      commentData.isApproved = true // Auto-approve for logged in users
    } else {
      // For anonymous users, we could require email/name
      // For now, we'll allow anonymous feedback
      commentData.authorEmail = 'anonymous@user.com'
      commentData.authorName = 'Anonymous User'
    }

    const comment = await prisma.helpArticleComment.create({
      data: commentData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({ comment })

  } catch (error) {
    console.error('Failed to create article comment:', error)
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    )
  }
}