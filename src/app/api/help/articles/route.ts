import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/articles - List articles with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('categoryId')
    const categorySlug = searchParams.get('categorySlug')
    const status = searchParams.get('status') || 'published'
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sortBy') || 'publishedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {
      status,
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId
    } else if (categorySlug) {
      const category = await prisma.helpCategory.findUnique({
        where: { slug: categorySlug }
      })
      if (category) {
        where.categoryId = category.id
      }
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

    // Execute query with pagination
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
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset
      }),
      prisma.helpArticle.count({ where })
    ])

    return NextResponse.json({
      articles,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('Failed to fetch help articles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help articles' },
      { status: 500 }
    )
  }
}

// POST /api/help/articles - Create new article (Admin only)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

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
      authorId
    } = data

    // Validate required fields
    if (!title || !slug || !content || !categoryId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Create the article
    const article = await prisma.helpArticle.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        categoryId,
        tags,
        status,
        featuredImage,
        readingTime,
        relatedArticles,
        seoTitle,
        seoDescription,
        authorId,
        publishedAt: status === 'published' ? new Date() : null
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

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    console.error('Failed to create help article:', error)
    return NextResponse.json(
      { error: 'Failed to create help article' },
      { status: 500 }
    )
  }
}