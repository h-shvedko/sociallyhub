import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/help/analytics - Get help articles analytics
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '30d'
    const articleId = searchParams.get('articleId')
    const categoryId = searchParams.get('categoryId')

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Build analytics filters
    const analyticsWhere: any = {
      timestamp: { gte: startDate }
    }

    if (articleId) {
      analyticsWhere.articleId = articleId
    }

    if (categoryId) {
      analyticsWhere.article = { categoryId }
    }

    // Get article analytics
    const [
      articleAnalytics,
      categoryAnalytics,
      topArticles,
      searchQueries,
      totalViews,
      totalRatings,
      averageRating,
      totalSearches
    ] = await Promise.all([
      // Article analytics over time
      prisma.helpArticleAnalytics.findMany({
        where: analyticsWhere,
        include: {
          article: {
            select: {
              id: true,
              title: true,
              category: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 100
      }),

      // Category analytics
      prisma.helpCategoryAnalytics.findMany({
        where: {
          timestamp: { gte: startDate },
          ...(categoryId && { categoryId })
        },
        include: {
          category: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      }),

      // Top performing articles
      prisma.helpArticleAnalytics.groupBy({
        by: ['articleId'],
        where: analyticsWhere,
        _sum: {
          views: true,
          timeOnPage: true,
          searches: true
        },
        _avg: {
          rating: true
        },
        _count: {
          rating: true
        },
        orderBy: {
          _sum: {
            views: 'desc'
          }
        },
        take: 10
      }),

      // Popular search queries
      prisma.helpArticleAnalytics.groupBy({
        by: ['searchQuery'],
        where: {
          ...analyticsWhere,
          searchQuery: { not: null }
        },
        _count: {
          searchQuery: true
        },
        orderBy: {
          _count: {
            searchQuery: 'desc'
          }
        },
        take: 10
      }),

      // Total metrics
      prisma.helpArticleAnalytics.aggregate({
        where: analyticsWhere,
        _sum: {
          views: true,
          searches: true
        }
      }),

      prisma.helpArticleAnalytics.count({
        where: {
          ...analyticsWhere,
          rating: { not: null }
        }
      }),

      prisma.helpArticleAnalytics.aggregate({
        where: {
          ...analyticsWhere,
          rating: { not: null }
        },
        _avg: {
          rating: true
        }
      }),

      prisma.helpArticleAnalytics.aggregate({
        where: analyticsWhere,
        _sum: {
          searches: true
        }
      })
    ])

    // Get article details for top articles
    const topArticleIds = topArticles.map(item => item.articleId)
    const articleDetails = await prisma.helpArticle.findMany({
      where: { id: { in: topArticleIds } },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Combine top articles with their details
    const topArticlesWithDetails = topArticles.map(analytics => {
      const article = articleDetails.find(a => a.id === analytics.articleId)
      return {
        article,
        views: analytics._sum.views || 0,
        avgRating: analytics._avg.rating || 0,
        ratingCount: analytics._count.rating || 0,
        totalTimeOnPage: analytics._sum.timeOnPage || 0,
        searches: analytics._sum.searches || 0
      }
    })

    // Group analytics by date for charts
    const dailyAnalytics = articleAnalytics.reduce((acc, item) => {
      const date = item.timestamp.toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = {
          date,
          views: 0,
          ratings: 0,
          searches: 0,
          avgTimeOnPage: 0,
          ratingSum: 0,
          ratingCount: 0,
          timeEntries: 0
        }
      }
      acc[date].views += item.views || 0
      acc[date].searches += item.searches || 0
      if (item.rating) {
        acc[date].ratingSum += item.rating
        acc[date].ratingCount += 1
      }
      if (item.timeOnPage) {
        acc[date].avgTimeOnPage += item.timeOnPage
        acc[date].timeEntries += 1
      }
      return acc
    }, {} as Record<string, any>)

    // Calculate averages and format daily data
    const chartData = Object.values(dailyAnalytics).map((day: any) => ({
      date: day.date,
      views: day.views,
      searches: day.searches,
      avgRating: day.ratingCount > 0 ? day.ratingSum / day.ratingCount : 0,
      avgTimeOnPage: day.timeEntries > 0 ? day.avgTimeOnPage / day.timeEntries : 0
    })).sort((a, b) => a.date.localeCompare(b.date))

    // Category performance
    const categoryPerformance = categoryAnalytics.reduce((acc, item) => {
      const categoryId = item.categoryId
      if (!acc[categoryId]) {
        acc[categoryId] = {
          category: item.category,
          views: 0,
          helpfulVotes: 0,
          notHelpfulVotes: 0,
          avgRating: 0,
          ratingSum: 0,
          ratingCount: 0
        }
      }
      acc[categoryId].views += item.views || 0
      acc[categoryId].helpfulVotes += item.helpfulVotes || 0
      acc[categoryId].notHelpfulVotes += item.notHelpfulVotes || 0
      if (item.avgRating) {
        acc[categoryId].ratingSum += item.avgRating
        acc[categoryId].ratingCount += 1
      }
      return acc
    }, {} as Record<string, any>)

    const categoryStats = Object.values(categoryPerformance).map((cat: any) => ({
      ...cat,
      avgRating: cat.ratingCount > 0 ? cat.ratingSum / cat.ratingCount : 0,
      helpfulnessRatio: cat.helpfulVotes + cat.notHelpfulVotes > 0
        ? cat.helpfulVotes / (cat.helpfulVotes + cat.notHelpfulVotes)
        : 0
    }))

    return NextResponse.json({
      period,
      dateRange: {
        start: startDate,
        end: now
      },
      summary: {
        totalViews: totalViews._sum.views || 0,
        totalRatings: totalRatings,
        averageRating: averageRating._avg.rating || 0,
        totalSearches: totalSearches._sum.searches || 0
      },
      chartData,
      topArticles: topArticlesWithDetails,
      categoryStats,
      popularSearches: searchQueries.map(q => ({
        query: q.searchQuery,
        count: q._count.searchQuery
      }))
    })
  } catch (error) {
    console.error('Failed to fetch analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

// POST /api/admin/help/analytics - Record analytics event
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const {
      articleId,
      eventType,
      views = 0,
      timeOnPage = 0,
      rating = null,
      helpful = null,
      searchQuery = null,
      userAgent = null,
      ipAddress = null
    } = data

    // Validate required fields
    if (!articleId || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields: articleId, eventType' },
        { status: 400 }
      )
    }

    // Verify article exists
    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 400 }
      )
    }

    // Create analytics record
    const analytics = await prisma.helpArticleAnalytics.create({
      data: {
        articleId,
        eventType,
        views,
        timeOnPage,
        rating,
        helpful,
        searchQuery,
        userAgent,
        ipAddress,
        timestamp: new Date()
      }
    })

    return NextResponse.json(analytics, { status: 201 })
  } catch (error) {
    console.error('Failed to record analytics:', error)
    return NextResponse.json(
      { error: 'Failed to record analytics' },
      { status: 500 }
    )
  }
}