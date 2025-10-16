import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/help/articles/analytics - Get article analytics for admin dashboard
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
    const period = searchParams.get('period') || '30' // days
    const categoryId = searchParams.get('categoryId')

    const daysAgo = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    // Build base filters
    const articleWhere: any = {}
    if (categoryId) {
      articleWhere.categoryId = categoryId
    }

    // Get overall article statistics
    const articleStats = await prisma.helpArticle.groupBy({
      by: ['status'],
      _count: true,
      where: articleWhere
    })

    // Get category breakdown
    const categoryStats = await prisma.helpArticle.groupBy({
      by: ['categoryId'],
      _count: true,
      _sum: {
        views: true,
        helpfulVotes: true,
        notHelpfulVotes: true
      },
      where: articleWhere,
      include: {
        category: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    })

    // Get enriched category data
    const categoryData = await Promise.all(
      categoryStats.map(async (stat) => {
        const category = await prisma.helpCategory.findUnique({
          where: { id: stat.categoryId },
          select: { name: true, slug: true }
        })
        return {
          ...stat,
          category
        }
      })
    )

    // Get top performing articles
    const topArticles = await prisma.helpArticle.findMany({
      where: articleWhere,
      include: {
        category: {
          select: {
            name: true,
            slug: true
          }
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { views: 'desc' },
        { helpfulVotes: 'desc' }
      ],
      take: 10
    })

    // Get analytics data for the specified period
    const analyticsData = await prisma.helpArticleAnalytics.findMany({
      where: {
        date: {
          gte: startDate
        },
        ...(categoryId && {
          article: {
            categoryId
          }
        })
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            categoryId: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // Aggregate analytics by date
    const dailyStats = analyticsData.reduce((acc, record) => {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          views: 0,
          uniqueViews: 0,
          helpfulVotes: 0,
          notHelpfulVotes: 0,
          searchImpressions: 0,
          searchClicks: 0,
          averageReadTime: 0,
          articleCount: 0
        }
      }

      acc[dateKey].views += record.views
      acc[dateKey].uniqueViews += record.uniqueViews
      acc[dateKey].helpfulVotes += record.helpfulVotes
      acc[dateKey].notHelpfulVotes += record.notHelpfulVotes
      acc[dateKey].searchImpressions += record.searchImpressions
      acc[dateKey].searchClicks += record.searchClicks

      if (record.averageReadTime) {
        acc[dateKey].averageReadTime =
          (acc[dateKey].averageReadTime * acc[dateKey].articleCount + record.averageReadTime) /
          (acc[dateKey].articleCount + 1)
      }

      acc[dateKey].articleCount += 1

      return acc
    }, {} as Record<string, any>)

    // Get recent article activity
    const recentActivity = await prisma.helpArticleRevision.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true
          }
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    // Get workflow activity
    const workflowActivity = await prisma.helpArticleWorkflow.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    // Calculate summary metrics
    const totalViews = analyticsData.reduce((sum, record) => sum + record.views, 0)
    const totalUniqueViews = analyticsData.reduce((sum, record) => sum + record.uniqueViews, 0)
    const totalHelpfulVotes = analyticsData.reduce((sum, record) => sum + record.helpfulVotes, 0)
    const totalNotHelpfulVotes = analyticsData.reduce((sum, record) => sum + record.notHelpfulVotes, 0)
    const helpfulnessRate = totalHelpfulVotes + totalNotHelpfulVotes > 0
      ? (totalHelpfulVotes / (totalHelpfulVotes + totalNotHelpfulVotes)) * 100
      : 0

    const summary = {
      totalArticles: articleStats.reduce((sum, stat) => sum + stat._count, 0),
      publishedArticles: articleStats.find(stat => stat.status === 'published')?._count || 0,
      draftArticles: articleStats.find(stat => stat.status === 'draft')?._count || 0,
      archivedArticles: articleStats.find(stat => stat.status === 'archived')?._count || 0,
      totalViews,
      totalUniqueViews,
      helpfulnessRate: Math.round(helpfulnessRate * 100) / 100,
      averageViewsPerArticle: topArticles.length > 0
        ? Math.round(totalViews / topArticles.length)
        : 0
    }

    return NextResponse.json({
      summary,
      articleStats: articleStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count
        return acc
      }, {} as Record<string, number>),
      categoryStats: categoryData,
      topArticles,
      dailyStats: Object.values(dailyStats),
      recentActivity,
      workflowActivity,
      period: daysAgo
    })
  } catch (error) {
    console.error('Failed to fetch article analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article analytics' },
      { status: 500 }
    )
  }
}