import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
// GET /api/admin/help/categories - List all categories for admin management
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const searchParams = request.nextUrl.searchParams
    const includeStats = searchParams.get('includeStats') === 'true'
    const isActive = searchParams.get('isActive')

    // Build where clause
    const where: any = {}
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Fetch categories with counts
    const categories = await prisma.helpCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            articles: true,
            faqs: true
          }
        },
        ...(includeStats && {
          articles: {
            select: {
              id: true,
              status: true,
              views: true,
              helpfulVotes: true,
              notHelpfulVotes: true,
              publishedAt: true
            }
          }
        })
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    // Calculate additional statistics if requested
    const enrichedCategories = categories.map(category => {
      const baseCategory = {
        ...category,
        articleCount: category._count.articles,
        faqCount: category._count.faqs
      }

      if (includeStats && category.articles) {
        const articles = category.articles
        const publishedArticles = articles.filter(a => a.status === 'published')
        const totalViews = articles.reduce((sum, a) => sum + a.views, 0)
        const totalHelpfulVotes = articles.reduce((sum, a) => sum + a.helpfulVotes, 0)
        const totalNotHelpfulVotes = articles.reduce((sum, a) => sum + a.notHelpfulVotes, 0)

        const helpfulnessRate = totalHelpfulVotes + totalNotHelpfulVotes > 0
          ? (totalHelpfulVotes / (totalHelpfulVotes + totalNotHelpfulVotes)) * 100
          : 0

        return {
          ...baseCategory,
          stats: {
            publishedArticleCount: publishedArticles.length,
            totalViews,
            helpfulnessRate: Math.round(helpfulnessRate * 100) / 100,
            averageViewsPerArticle: articles.length > 0 ? Math.round(totalViews / articles.length) : 0,
            lastArticlePublished: publishedArticles.length > 0
              ? publishedArticles
                  .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())[0]
                  .publishedAt
              : null
          }
        }
      }

      return baseCategory
    })

    return NextResponse.json({
      categories: enrichedCategories.map(({ articles, ...category }) => category), // Remove articles from response
      total: enrichedCategories.length
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/help/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const data = await request.json()
    const {
      name,
      slug,
      description,
      icon,
      sortOrder,
      isActive = true
    } = data

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingCategory = await prisma.helpCategory.findUnique({
      where: { slug }
    })

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this slug already exists' },
        { status: 400 }
      )
    }

    // Get the next sort order if not provided
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined) {
      const lastCategory = await prisma.helpCategory.findFirst({
        orderBy: { sortOrder: 'desc' }
      })
      finalSortOrder = lastCategory ? lastCategory.sortOrder + 1 : 0
    }

    // Create the category
    const category = await prisma.helpCategory.create({
      data: {
        name,
        slug,
        description,
        icon,
        sortOrder: finalSortOrder,
        isActive
      },
      include: {
        _count: {
          select: {
            articles: true,
            faqs: true
          }
        }
      }
    })

    return NextResponse.json({
      ...category,
      articleCount: category._count.articles,
      faqCount: category._count.faqs
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}