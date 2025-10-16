import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/help/articles/[slug]/navigation - Get previous/next article navigation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    // Get current article
    const currentArticle = await prisma.helpArticle.findUnique({
      where: { slug },
      select: {
        id: true,
        categoryId: true,
        publishedAt: true,
        createdAt: true
      }
    })

    if (!currentArticle) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Get previous and next articles in the same category
    // Order by publishedAt (or createdAt if publishedAt is null) descending
    const [previousArticle, nextArticle] = await Promise.all([
      // Previous article (older)
      prisma.helpArticle.findFirst({
        where: {
          categoryId: currentArticle.categoryId,
          status: 'published',
          OR: [
            {
              publishedAt: {
                lt: currentArticle.publishedAt || currentArticle.createdAt
              }
            },
            {
              publishedAt: null,
              createdAt: {
                lt: currentArticle.publishedAt || currentArticle.createdAt
              }
            }
          ]
        },
        select: {
          title: true,
          slug: true
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ]
      }),

      // Next article (newer)
      prisma.helpArticle.findFirst({
        where: {
          categoryId: currentArticle.categoryId,
          status: 'published',
          OR: [
            {
              publishedAt: {
                gt: currentArticle.publishedAt || currentArticle.createdAt
              }
            },
            {
              publishedAt: null,
              createdAt: {
                gt: currentArticle.publishedAt || currentArticle.createdAt
              }
            }
          ]
        },
        select: {
          title: true,
          slug: true
        },
        orderBy: [
          { publishedAt: 'asc' },
          { createdAt: 'asc' }
        ]
      })
    ])

    return NextResponse.json({
      previous: previousArticle,
      next: nextArticle
    })

  } catch (error) {
    console.error('Failed to fetch article navigation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article navigation' },
      { status: 500 }
    )
  }
}