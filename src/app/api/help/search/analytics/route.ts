import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/search/analytics - Get search analytics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '7d' // 1d, 7d, 30d, 90d
    const limit = parseInt(searchParams.get('limit') || '20')

    // Calculate date range based on period
    const now = new Date()
    const periodMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    }

    const days = periodMap[period] || 7
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    // Get popular queries
    const popularQueries = await prisma.helpSearchQuery.groupBy({
      by: ['query'],
      where: {
        createdAt: {
          gte: fromDate
        }
      },
      _count: {
        query: true
      },
      _avg: {
        resultsCount: true
      },
      orderBy: {
        _count: {
          query: 'desc'
        }
      },
      take: limit
    })

    // Get no-result searches
    const noResultQueries = await prisma.helpSearchQuery.groupBy({
      by: ['query'],
      where: {
        resultsCount: 0,
        createdAt: {
          gte: fromDate
        }
      },
      _count: {
        query: true
      },
      orderBy: {
        _count: {
          query: 'desc'
        }
      },
      take: limit
    })

    // Get search volume over time
    const searchVolume = await prisma.helpSearchQuery.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: fromDate
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Process daily search volume
    const dailyVolume: Record<string, number> = {}
    for (let i = 0; i < days; i++) {
      const date = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dateKey = date.toISOString().split('T')[0]
      dailyVolume[dateKey] = 0
    }

    searchVolume.forEach(item => {
      const dateKey = item.createdAt.toISOString().split('T')[0]
      if (dailyVolume[dateKey] !== undefined) {
        dailyVolume[dateKey] += item._count.id
      }
    })

    // Get total statistics
    const totalSearches = await prisma.helpSearchQuery.count({
      where: {
        createdAt: {
          gte: fromDate
        }
      }
    })

    const totalNoResults = await prisma.helpSearchQuery.count({
      where: {
        resultsCount: 0,
        createdAt: {
          gte: fromDate
        }
      }
    })

    const avgResultsCount = await prisma.helpSearchQuery.aggregate({
      _avg: {
        resultsCount: true
      },
      where: {
        createdAt: {
          gte: fromDate
        }
      }
    })

    // Get unique users (based on sessionId)
    const uniqueSessions = await prisma.helpSearchQuery.groupBy({
      by: ['sessionId'],
      where: {
        createdAt: {
          gte: fromDate
        }
      }
    })

    return NextResponse.json({
      period,
      fromDate,
      statistics: {
        totalSearches,
        totalNoResults,
        noResultRate: totalSearches > 0 ? (totalNoResults / totalSearches) * 100 : 0,
        avgResultsCount: avgResultsCount._avg.resultsCount || 0,
        uniqueSessions: uniqueSessions.length
      },
      popularQueries: popularQueries.map(item => ({
        query: item.query,
        count: item._count.query,
        avgResults: Math.round(item._avg.resultsCount || 0)
      })),
      noResultQueries: noResultQueries.map(item => ({
        query: item.query,
        count: item._count.query
      })),
      dailyVolume: Object.entries(dailyVolume).map(([date, count]) => ({
        date,
        count
      }))
    })
  } catch (error) {
    console.error('Failed to fetch search analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch search analytics' },
      { status: 500 }
    )
  }
}