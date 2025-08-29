import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

interface ExportRequest {
  format: 'pdf' | 'excel' | 'csv'
  type: 'summary' | 'detailed' | 'engagement' | 'performance' | 'custom'
  timeRange: '7d' | '30d' | '90d' | '1y' | 'custom'
  customStartDate?: string
  customEndDate?: string
  metrics: string[]
  title: string
  description?: string
  options: {
    includeCharts?: boolean
    includeTables?: boolean
    includeComparisons?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const exportRequest: ExportRequest = await request.json()

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true }
    })

    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Calculate date range
    const getDateRange = () => {
      const now = new Date()
      if (exportRequest.timeRange === 'custom') {
        return {
          startDate: exportRequest.customStartDate ? new Date(exportRequest.customStartDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: exportRequest.customEndDate ? new Date(exportRequest.customEndDate) : now
        }
      }

      const days = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365
      }[exportRequest.timeRange] || 30

      return {
        startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
        endDate: now
      }
    }

    const { startDate, endDate } = getDateRange()

    // Fetch data based on selected metrics
    const fetchMetricData = async (metric: string) => {
      switch (metric) {
        case 'posts_published':
          return await prisma.post.count({
            where: {
              workspaceId: { in: workspaceIds },
              publishedAt: { gte: startDate, lte: endDate },
              status: 'PUBLISHED'
            }
          })

        case 'engagement_rate':
          const posts = await prisma.post.findMany({
            where: {
              workspaceId: { in: workspaceIds },
              publishedAt: { gte: startDate, lte: endDate },
              status: 'PUBLISHED'
            },
            select: { likes: true, comments: true, shares: true, reach: true }
          })

          const totalEngagement = posts.reduce((sum, post) => 
            sum + (post.likes || 0) + (post.comments || 0) + (post.shares || 0), 0
          )
          const totalReach = posts.reduce((sum, post) => sum + (post.reach || 0), 0)
          
          return totalReach > 0 ? ((totalEngagement / totalReach) * 100) : 0

        case 'total_reach':
          return await prisma.post.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              publishedAt: { gte: startDate, lte: endDate },
              status: 'PUBLISHED'
            },
            _sum: { reach: true }
          }).then(result => result._sum.reach || 0)

        case 'page_views':
          // Simulate page views (would be from analytics service in real implementation)
          return Math.floor(Math.random() * 10000) + 5000

        case 'total_comments':
          return await prisma.post.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              publishedAt: { gte: startDate, lte: endDate },
              status: 'PUBLISHED'
            },
            _sum: { comments: true }
          }).then(result => result._sum.comments || 0)

        case 'total_shares':
          return await prisma.post.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              publishedAt: { gte: startDate, lte: endDate },
              status: 'PUBLISHED'
            },
            _sum: { shares: true }
          }).then(result => result._sum.shares || 0)

        case 'total_likes':
          return await prisma.post.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              publishedAt: { gte: startDate, lte: endDate },
              status: 'PUBLISHED'
            },
            _sum: { likes: true }
          }).then(result => result._sum.likes || 0)

        case 'follower_growth':
          // Simulate follower growth (would be from social platform APIs in real implementation)
          return Math.floor(Math.random() * 500) + 100

        default:
          return 0
      }
    }

    // Fetch all selected metrics
    const metricsData = await Promise.all(
      exportRequest.metrics.map(async (metric) => ({
        metric,
        value: await fetchMetricData(metric),
        label: getMetricLabel(metric)
      }))
    )

    // Generate export data based on format
    const generateExportData = () => {
      const reportData = {
        title: exportRequest.title,
        description: exportRequest.description,
        generatedAt: new Date().toISOString(),
        dateRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          label: getTimeRangeLabel(exportRequest.timeRange)
        },
        metrics: metricsData,
        options: exportRequest.options,
        summary: {
          totalMetrics: metricsData.length,
          reportType: exportRequest.type,
          format: exportRequest.format
        }
      }

      switch (exportRequest.format) {
        case 'csv':
          return generateCSV(reportData)
        case 'excel':
          return generateExcelData(reportData)
        case 'pdf':
          return generatePDFData(reportData)
        default:
          return JSON.stringify(reportData, null, 2)
      }
    }

    const exportData = generateExportData()
    const filename = `analytics-report-${new Date().toISOString().split('T')[0]}.${exportRequest.format}`

    // Set appropriate headers for file download
    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)
    
    switch (exportRequest.format) {
      case 'csv':
        headers.set('Content-Type', 'text/csv')
        break
      case 'excel':
        headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        break
      case 'pdf':
        headers.set('Content-Type', 'application/pdf')
        break
      default:
        headers.set('Content-Type', 'application/json')
    }

    return new NextResponse(exportData, { headers })

  } catch (error) {
    console.error('Export analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to export analytics report' },
      { status: 500 }
    )
  }
}

function getMetricLabel(metric: string): string {
  const labels = {
    'posts_published': 'Posts Published',
    'engagement_rate': 'Engagement Rate (%)',
    'total_reach': 'Total Reach',
    'page_views': 'Page Views',
    'total_comments': 'Total Comments',
    'total_shares': 'Total Shares',
    'total_likes': 'Total Likes',
    'follower_growth': 'Follower Growth'
  }
  return labels[metric as keyof typeof labels] || metric
}

function getTimeRangeLabel(timeRange: string): string {
  const labels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '1y': 'Last Year',
    'custom': 'Custom Range'
  }
  return labels[timeRange as keyof typeof labels] || 'Unknown Range'
}

function generateCSV(data: any): string {
  const rows = [
    ['Metric', 'Value', 'Label'],
    ...data.metrics.map((m: any) => [m.metric, m.value, m.label])
  ]
  
  return [
    `Report: ${data.title}`,
    `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
    `Date Range: ${data.dateRange.label}`,
    '',
    ...rows.map(row => row.join(','))
  ].join('\n')
}

function generateExcelData(data: any): string {
  // In a real implementation, this would generate actual Excel file using libraries like xlsx
  return JSON.stringify({
    type: 'excel',
    data: data,
    note: 'This would be a real Excel file in production'
  }, null, 2)
}

function generatePDFData(data: any): string {
  // In a real implementation, this would generate actual PDF using libraries like puppeteer or jsPDF
  return JSON.stringify({
    type: 'pdf',
    data: data,
    note: 'This would be a real PDF file in production'
  }, null, 2)
}