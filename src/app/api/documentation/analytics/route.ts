import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/documentation/analytics - Get documentation analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '30d'
    const pageId = searchParams.get('pageId')

    // Calculate date range
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

    // Base where clause
    const where: any = {
      date: {
        gte: startDate,
        lte: now
      }
    }

    // Filter by specific page if provided
    if (pageId) {
      where.pageId = pageId
    }

    // Get analytics data
    const analytics = await prisma.documentationAnalytics.findMany({
      where,
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            section: {
              select: {
                title: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Aggregate data
    const aggregatedData = analytics.reduce((acc, record) => {
      acc.totalViews += record.views
      acc.totalUniqueViews += record.uniqueViews
      acc.totalTimeSpent += record.timeSpent
      acc.totalFeedbackRating += record.feedbackRating

      // Collect search queries
      if (record.searchQueries && Array.isArray(record.searchQueries)) {
        acc.searchQueries.push(...record.searchQueries)
      }

      return acc
    }, {
      totalViews: 0,
      totalUniqueViews: 0,
      totalTimeSpent: 0,
      totalFeedbackRating: 0,
      searchQueries: [] as string[]
    })

    // Calculate averages
    const recordCount = analytics.length || 1
    const averageTimeSpent = aggregatedData.totalTimeSpent / recordCount
    const averageFeedbackRating = aggregatedData.totalFeedbackRating / recordCount

    // Get top search queries
    const searchQueryCounts = aggregatedData.searchQueries.reduce((acc, query) => {
      acc[query] = (acc[query] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topSearchQueries = Object.entries(searchQueryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }))

    // Get page performance
    const pagePerformance = analytics.reduce((acc, record) => {
      if (!record.page) return acc

      const pageId = record.page.id
      if (!acc[pageId]) {
        acc[pageId] = {
          page: record.page,
          views: 0,
          uniqueViews: 0,
          timeSpent: 0,
          feedbackRating: 0,
          recordCount: 0
        }
      }

      acc[pageId].views += record.views
      acc[pageId].uniqueViews += record.uniqueViews
      acc[pageId].timeSpent += record.timeSpent
      acc[pageId].feedbackRating += record.feedbackRating
      acc[pageId].recordCount += 1

      return acc
    }, {} as Record<string, any>)

    // Calculate averages for page performance and sort by views
    const topPages = Object.values(pagePerformance)
      .map((page: any) => ({
        ...page,
        averageTimeSpent: page.timeSpent / page.recordCount,
        averageFeedbackRating: page.feedbackRating / page.recordCount
      }))
      .sort((a: any, b: any) => b.views - a.views)
      .slice(0, 10)

    // Get daily trends for charts
    const dailyTrends = analytics.reduce((acc, record) => {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          views: 0,
          uniqueViews: 0,
          timeSpent: 0
        }
      }

      acc[dateKey].views += record.views
      acc[dateKey].uniqueViews += record.uniqueViews
      acc[dateKey].timeSpent += record.timeSpent

      return acc
    }, {} as Record<string, any>)

    const trendsArray = Object.values(dailyTrends).sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Get section performance
    const sectionPerformance = analytics.reduce((acc, record) => {
      if (!record.page?.section) return acc

      const sectionSlug = record.page.section.slug
      if (!acc[sectionSlug]) {
        acc[sectionSlug] = {
          section: record.page.section,
          views: 0,
          uniqueViews: 0,
          pageCount: 0,
          pages: new Set()
        }
      }

      acc[sectionSlug].views += record.views
      acc[sectionSlug].uniqueViews += record.uniqueViews
      acc[sectionSlug].pages.add(record.page.id)

      return acc
    }, {} as Record<string, any>)

    const sectionStats = Object.values(sectionPerformance)
      .map((section: any) => ({
        ...section,
        pageCount: section.pages.size,
        pages: undefined // Remove the Set
      }))
      .sort((a: any, b: any) => b.views - a.views)

    return NextResponse.json({
      summary: {
        totalViews: aggregatedData.totalViews,
        totalUniqueViews: aggregatedData.totalUniqueViews,
        averageTimeSpent: Math.round(averageTimeSpent),
        averageFeedbackRating: parseFloat(averageFeedbackRating.toFixed(2)),
        totalPages: new Set(analytics.map(a => a.pageId)).size,
        period
      },
      trends: trendsArray,
      topPages,
      sectionPerformance: sectionStats,
      searchInsights: {
        topQueries: topSearchQueries,
        totalSearches: aggregatedData.searchQueries.length
      }
    })
  } catch (error) {
    console.error('Failed to fetch documentation analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation analytics' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/analytics - Record analytics event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      pageId,
      views = 1,
      uniqueViews = 1,
      timeSpent = 0,
      searchQuery,
      feedbackRating,
      exitPage = false
    } = body

    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      )
    }

    // Check if page exists
    const page = await prisma.documentationPage.findUnique({
      where: { id: pageId }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Get today's date
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Update or create analytics record for today
    const existingRecord = await prisma.documentationAnalytics.findUnique({
      where: {
        pageId_date: {
          pageId,
          date: today
        }
      }
    })

    let searchQueries: string[] = []
    if (searchQuery) {
      if (existingRecord?.searchQueries) {
        searchQueries = [...(existingRecord.searchQueries as string[]), searchQuery]
      } else {
        searchQueries = [searchQuery]
      }
    } else if (existingRecord?.searchQueries) {
      searchQueries = existingRecord.searchQueries as string[]
    }

    const analyticsData = {
      pageId,
      date: today,
      views: (existingRecord?.views || 0) + views,
      uniqueViews: (existingRecord?.uniqueViews || 0) + uniqueViews,
      timeSpent: (existingRecord?.timeSpent || 0) + timeSpent,
      searchQueries,
      feedbackRating: feedbackRating !== undefined ? feedbackRating : existingRecord?.feedbackRating || 0,
      exitPage
    }

    const analytics = await prisma.documentationAnalytics.upsert({
      where: {
        pageId_date: {
          pageId,
          date: today
        }
      },
      update: analyticsData,
      create: analyticsData
    })

    // Also update the page's total views
    await prisma.documentationPage.update({
      where: { id: pageId },
      data: {
        views: {
          increment: views
        }
      }
    })

    return NextResponse.json({ success: true, analytics })
  } catch (error) {
    console.error('Failed to record analytics:', error)
    return NextResponse.json(
      { error: 'Failed to record analytics' },
      { status: 500 }
    )
  }
}