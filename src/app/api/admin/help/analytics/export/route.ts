import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/help/analytics/export - Export analytics data
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
    const format = searchParams.get('format') || 'csv'
    const articleId = searchParams.get('articleId')
    const categoryId = searchParams.get('categoryId')

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

    // Fetch detailed analytics data
    const analyticsData = await prisma.helpArticleAnalytics.findMany({
      where: analyticsWhere,
      include: {
        article: {
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
        }
      },
      orderBy: { timestamp: 'desc' }
    })

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = [
        'Date',
        'Article ID',
        'Article Title',
        'Category',
        'Event Type',
        'Views',
        'Time on Page (seconds)',
        'Rating',
        'Helpful',
        'Search Query',
        'User Agent',
        'IP Address'
      ].join(',')

      const csvRows = analyticsData.map(item => [
        item.timestamp.toISOString(),
        item.articleId,
        `"${item.article.title.replace(/"/g, '""')}"`,
        `"${item.article.category.name.replace(/"/g, '""')}"`,
        item.eventType,
        item.views || 0,
        item.timeOnPage || 0,
        item.rating || '',
        item.helpful !== null ? (item.helpful ? 'Yes' : 'No') : '',
        item.searchQuery ? `"${item.searchQuery.replace(/"/g, '""')}"` : '',
        item.userAgent ? `"${item.userAgent.replace(/"/g, '""')}"` : '',
        item.ipAddress || ''
      ].join(','))

      const csvContent = [csvHeaders, ...csvRows].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="help-analytics-${period}.csv"`
        }
      })
    }

    if (format === 'pdf') {
      // Generate HTML for PDF (user can print to PDF)
      const summary = {
        totalViews: analyticsData.reduce((sum, item) => sum + (item.views || 0), 0),
        totalRatings: analyticsData.filter(item => item.rating !== null).length,
        averageRating: analyticsData.filter(item => item.rating !== null).reduce((sum, item) => sum + (item.rating || 0), 0) / analyticsData.filter(item => item.rating !== null).length || 0,
        totalSearches: analyticsData.reduce((sum, item) => sum + (item.searches || 0), 0),
        uniqueArticles: new Set(analyticsData.map(item => item.articleId)).size
      }

      // Group by article for top performers
      const articleStats = analyticsData.reduce((acc, item) => {
        if (!acc[item.articleId]) {
          acc[item.articleId] = {
            article: item.article,
            views: 0,
            ratings: [],
            totalTimeOnPage: 0,
            searches: 0
          }
        }
        acc[item.articleId].views += item.views || 0
        if (item.rating) acc[item.articleId].ratings.push(item.rating)
        acc[item.articleId].totalTimeOnPage += item.timeOnPage || 0
        acc[item.articleId].searches += item.searches || 0
        return acc
      }, {} as any)

      const topArticles = Object.values(articleStats)
        .map((stats: any) => ({
          ...stats,
          avgRating: stats.ratings.length > 0 ? stats.ratings.reduce((sum: number, rating: number) => sum + rating, 0) / stats.ratings.length : 0
        }))
        .sort((a: any, b: any) => b.views - a.views)
        .slice(0, 10)

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Help Articles Analytics Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 24px; font-weight: bold; color: #0066cc; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f2f2f2; font-weight: bold; }
        .table tr:nth-child(even) { background-color: #f9f9f9; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        @media print { body { margin: 0; } .header { page-break-after: avoid; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Help Articles Analytics Report</h1>
        <p>Period: ${period} | Generated: ${new Date().toLocaleDateString()}</p>
        <p>Date Range: ${startDate.toLocaleDateString()} - ${now.toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>Summary Statistics</h2>
        <div class="summary">
            <div class="summary-card">
                <h3>Total Views</h3>
                <div class="value">${summary.totalViews.toLocaleString()}</div>
            </div>
            <div class="summary-card">
                <h3>Average Rating</h3>
                <div class="value">${summary.averageRating.toFixed(1)} ⭐</div>
                <small>${summary.totalRatings} ratings</small>
            </div>
            <div class="summary-card">
                <h3>Total Searches</h3>
                <div class="value">${summary.totalSearches.toLocaleString()}</div>
            </div>
            <div class="summary-card">
                <h3>Articles Analyzed</h3>
                <div class="value">${summary.uniqueArticles}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Top Performing Articles</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Article</th>
                    <th>Category</th>
                    <th>Views</th>
                    <th>Avg Rating</th>
                    <th>Total Time</th>
                    <th>Searches</th>
                </tr>
            </thead>
            <tbody>
                ${topArticles.map((article: any, index: number) => `
                    <tr>
                        <td>#${index + 1}</td>
                        <td>${article.article.title}</td>
                        <td>${article.article.category.name}</td>
                        <td>${article.views.toLocaleString()}</td>
                        <td>${article.avgRating.toFixed(1)}</td>
                        <td>${Math.round(article.totalTimeOnPage / 60)}m</td>
                        <td>${article.searches}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Recent Activity</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Article</th>
                    <th>Event</th>
                    <th>Views</th>
                    <th>Rating</th>
                    <th>Time on Page</th>
                </tr>
            </thead>
            <tbody>
                ${analyticsData.slice(0, 50).map(item => `
                    <tr>
                        <td>${item.timestamp.toLocaleDateString()}</td>
                        <td>${item.article.title}</td>
                        <td>${item.eventType}</td>
                        <td>${item.views || 0}</td>
                        <td>${item.rating || '-'}</td>
                        <td>${item.timeOnPage ? `${Math.round(item.timeOnPage)}s` : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <p><small>Report generated by SociallyHub Help Analytics | ${new Date().toISOString()}</small></p>
    </div>
</body>
</html>`

      return new NextResponse(htmlContent, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="help-analytics-${period}.html"`
        }
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
  } catch (error) {
    console.error('Failed to export analytics:', error)
    return NextResponse.json(
      { error: 'Failed to export analytics' },
      { status: 500 }
    )
  }
}