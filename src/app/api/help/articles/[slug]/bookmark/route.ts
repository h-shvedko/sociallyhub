import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/help/articles/[slug]/bookmark - Check if article is bookmarked
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    // Check if bookmarked
    const bookmark = await prisma.helpArticleBookmark.findUnique({
      where: {
        userId_articleId: {
          userId: session.user.id,
          articleId: article.id
        }
      }
    })

    return NextResponse.json({
      isBookmarked: !!bookmark,
      bookmarkId: bookmark?.id || null
    })

  } catch (error) {
    console.error('Failed to check bookmark status:', error)
    return NextResponse.json(
      { error: 'Failed to check bookmark status' },
      { status: 500 }
    )
  }
}

// POST /api/help/articles/[slug]/bookmark - Bookmark article
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    // Create bookmark (upsert to handle duplicates)
    const bookmark = await prisma.helpArticleBookmark.upsert({
      where: {
        userId_articleId: {
          userId: session.user.id,
          articleId: article.id
        }
      },
      update: {
        updatedAt: new Date()
      },
      create: {
        userId: session.user.id,
        articleId: article.id
      }
    })

    return NextResponse.json({
      success: true,
      bookmark,
      isBookmarked: true
    })

  } catch (error) {
    console.error('Failed to bookmark article:', error)
    return NextResponse.json(
      { error: 'Failed to bookmark article' },
      { status: 500 }
    )
  }
}

// DELETE /api/help/articles/[slug]/bookmark - Remove bookmark
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
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

    // Remove bookmark
    await prisma.helpArticleBookmark.deleteMany({
      where: {
        userId: session.user.id,
        articleId: article.id
      }
    })

    return NextResponse.json({
      success: true,
      isBookmarked: false
    })

  } catch (error) {
    console.error('Failed to remove bookmark:', error)
    return NextResponse.json(
      { error: 'Failed to remove bookmark' },
      { status: 500 }
    )
  }
}