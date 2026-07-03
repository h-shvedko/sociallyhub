import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
// GET /api/admin/help/articles - List all articles for admin management
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('categoryId')
    const status = searchParams.get('status') // Include all statuses for admin
    const search = searchParams.get('search')
    const authorId = searchParams.get('authorId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sortBy') || 'updatedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause for admin view (can see all articles)
    const where: any = {}

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (status) {
      where.status = status
    }

    if (authorId) {
      where.authorId = authorId
    }

    // Search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ]
    }

    // Execute query with pagination and admin-specific includes
    const [articles, total] = await Promise.all([
      prisma.helpArticle.findMany({
        where,
        include: {
          category: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          _count: {
            select: {
              comments: true,
              bookmarks: true,
              revisions: true,
              workflows: true,
              media: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset
      }),
      prisma.helpArticle.count({ where })
    ])

    // Get additional statistics for admin dashboard
    const stats = await prisma.helpArticle.groupBy({
      by: ['status'],
      _count: true
    })

    return NextResponse.json({
      articles,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      stats: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/help/articles - Create new article (Admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()

    const data = await request.json()
    const {
      title,
      slug,
      content,
      excerpt,
      categoryId,
      tags = [],
      status = 'draft',
      featuredImage,
      readingTime,
      relatedArticles = [],
      seoTitle,
      seoDescription,
      publishNow = false
    } = data

    // Validate required fields
    if (!title || !slug || !content || !categoryId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, slug, content, categoryId' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingArticle = await prisma.helpArticle.findUnique({
      where: { slug }
    })

    if (existingArticle) {
      return NextResponse.json(
        { error: 'Article with this slug already exists' },
        { status: 400 }
      )
    }

    // Verify category exists
    const category = await prisma.helpCategory.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 400 }
      )
    }

    // Determine final status
    const finalStatus = publishNow ? 'published' : status

    // Create the article with transaction to handle revision creation
    const result = await prisma.$transaction(async (tx) => {
      // Create the article
      const article = await tx.helpArticle.create({
        data: {
          title,
          slug,
          content,
          excerpt,
          categoryId,
          tags,
          status: finalStatus,
          featuredImage,
          readingTime,
          relatedArticles,
          seoTitle,
          seoDescription,
          authorId: user.id,
          publishedAt: finalStatus === 'published' ? new Date() : null
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

      // Create initial revision
      await tx.helpArticleRevision.create({
        data: {
          articleId: article.id,
          version: 1,
          title,
          content,
          excerpt,
          categoryId,
          tags,
          status: finalStatus,
          seoTitle,
          seoDescription,
          changeSummary: 'Initial article creation',
          authorId: user.id
        }
      })

      return article
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}