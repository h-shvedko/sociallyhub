import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/articles/[slug] - Get specific article by slug
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    const article = await prisma.helpArticle.findUnique({
      where: { slug },
      include: {
        category: true,
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

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Increment view count (non-blocking)
    prisma.helpArticle.update({
      where: { id: article.id },
      data: { views: { increment: 1 } }
    }).catch(console.error)

    // Get related articles if any
    let relatedArticles = []
    if (article.relatedArticles.length > 0) {
      relatedArticles = await prisma.helpArticle.findMany({
        where: {
          id: { in: article.relatedArticles },
          status: 'published'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          readingTime: true,
          category: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      })
    }

    return NextResponse.json({
      ...article,
      relatedArticles
    })
  } catch (error) {
    console.error('Failed to fetch help article:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help article' },
      { status: 500 }
    )
  }
}

// PUT /api/help/articles/[slug] - Update article (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const data = await request.json()

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const article = await prisma.helpArticle.findUnique({
      where: { slug }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    // Update article
    const updatedArticle = await prisma.helpArticle.update({
      where: { id: article.id },
      data: {
        ...data,
        publishedAt: data.status === 'published' && !article.publishedAt
          ? new Date()
          : article.publishedAt
      },
      include: {
        category: true,
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

    return NextResponse.json(updatedArticle)
  } catch (error) {
    console.error('Failed to update help article:', error)
    return NextResponse.json(
      { error: 'Failed to update help article' },
      { status: 500 }
    )
  }
}

// DELETE /api/help/articles/[slug] - Delete article (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const article = await prisma.helpArticle.findUnique({
      where: { slug }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      )
    }

    await prisma.helpArticle.delete({
      where: { id: article.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete help article:', error)
    return NextResponse.json(
      { error: 'Failed to delete help article' },
      { status: 500 }
    )
  }
}