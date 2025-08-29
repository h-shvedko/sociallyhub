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
          const engagementMetrics = await prisma.analyticsMetric.groupBy({
            by: ['metricType'],
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: { in: ['likes', 'comments', 'shares', 'reach'] }
            },
            _sum: { value: true }
          })

          const metricTotals = engagementMetrics.reduce((acc, metric) => {
            acc[metric.metricType] = metric._sum.value || 0
            return acc
          }, {} as Record<string, number>)

          const totalEngagement = (metricTotals.likes || 0) + (metricTotals.comments || 0) + (metricTotals.shares || 0)
          const totalReach = metricTotals.reach || 0
          
          return totalReach > 0 ? ((totalEngagement / totalReach) * 100) : 0

        case 'total_reach':
          const reachResult = await prisma.analyticsMetric.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: 'reach'
            },
            _sum: { value: true }
          })
          return reachResult._sum.value || 0

        case 'page_views':
          const pageViewsResult = await prisma.analyticsMetric.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: 'page_views'
            },
            _sum: { value: true }
          })
          return pageViewsResult._sum.value || 0

        case 'total_comments':
          const commentsResult = await prisma.analyticsMetric.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: 'comments'
            },
            _sum: { value: true }
          })
          return commentsResult._sum.value || 0

        case 'total_shares':
          const sharesResult = await prisma.analyticsMetric.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: 'shares'
            },
            _sum: { value: true }
          })
          return sharesResult._sum.value || 0

        case 'total_likes':
          const likesResult = await prisma.analyticsMetric.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: 'likes'
            },
            _sum: { value: true }
          })
          return likesResult._sum.value || 0

        case 'follower_growth':
          const followerGrowthResult = await prisma.analyticsMetric.aggregate({
            where: {
              workspaceId: { in: workspaceIds },
              date: { gte: startDate, lte: endDate },
              metricType: 'follower_growth'
            },
            _sum: { value: true }
          })
          return followerGrowthResult._sum.value || 0

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
    const generateExportData = (): string | Buffer => {
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
    
    // Generate proper filename with correct extension
    const getFileExtension = (format: string) => {
      switch (format) {
        case 'excel': return 'xlsx'
        case 'pdf': return 'pdf'
        case 'csv': return 'csv'
        default: return format
      }
    }
    
    const properFilename = `analytics-report-${new Date().toISOString().split('T')[0]}.${getFileExtension(exportRequest.format)}`

    // Set appropriate headers for file download
    const headers = new Headers()
    headers.set('Content-Disposition', `attachment; filename="${properFilename}"`)
    
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

function generatePDFData(data: any): Buffer {
  // Generate a professional PDF with styling (in production, use jsPDF or similar)
  const brandColor = '#3b82f6' // Blue color from app design
  const generatedDate = new Date(data.generatedAt).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Calculate content length dynamically
  const titleLength = data.title.length * 8
  const descLength = (data.description || '').length * 6
  const metricsLength = data.metrics.length * 30
  const contentLength = 600 + titleLength + descLength + metricsLength
  
  const pdfContent = `%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /ViewerPreferences << /DisplayDocTitle true >> >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> 
   /ColorSpace << /CS1 << /Type /Separation /ColorSpace /DeviceRGB /TintTransform 8 0 R >> >> >>
endobj

4 0 obj
<< /Length ${contentLength} >>
stream
BT

% Header Section with Brand Colors
/F2 24 Tf
0.231 0.511 0.965 rg
50 740 Td
(SociallyHub Analytics Report) Tj

% Subtitle
0 0 0 rg
/F1 14 Tf
0 -30 Td
(${data.title}) Tj

% Generated info box
0.97 0.97 0.97 rg
45 645 522 60 re f
0.8 0.8 0.8 RG
45 645 522 60 re S

0.4 0.4 0.4 rg
/F1 10 Tf
55 685 Td
(Generated: ${generatedDate}) Tj
0 -15 Td
(Date Range: ${data.dateRange.label}) Tj
0 -15 Td
(Report Type: ${data.summary.reportType.charAt(0).toUpperCase() + data.summary.reportType.slice(1)}) Tj

% Section Divider
0.231 0.511 0.965 RG
2 w
50 625 512 0 re S

% Description (if available)
${data.description ? `
0 0 0 rg
/F1 12 Tf
50 600 Td
(Description:) Tj
/F1 10 Tf
0 -18 Td
(${data.description.substring(0, 80)}${data.description.length > 80 ? '...' : ''}) Tj
` : ''}

% Metrics Section Header
0 0 0 rg
/F2 16 Tf
50 ${data.description ? '560' : '590'} Td
(Key Metrics) Tj

% Metrics Grid Background
0.98 0.98 0.98 rg
45 ${data.description ? '320' : '350'} 522 ${data.description ? '220' : '220'} re f
0.9 0.9 0.9 RG
45 ${data.description ? '320' : '350'} 522 ${data.description ? '220' : '220'} re S

% Individual Metrics
${data.metrics.map((m: any, i: number) => {
  const yPos = (data.description ? 520 : 550) - (i * 35)
  const value = typeof m.value === 'number' ? m.value.toLocaleString() : m.value
  return `
% Metric ${i + 1}: ${m.label}
0.231 0.511 0.965 rg
55 ${yPos} 8 8 re f
0 0 0 rg
/F2 12 Tf
75 ${yPos - 2} Td
(${m.label}) Tj
/F1 14 Tf
0.2 0.4 0.8 rg
350 ${yPos - 2} Td
(${value}) Tj`
}).join('')}

% Footer Section
0.95 0.95 0.95 rg
45 50 522 40 re f
0.8 0.8 0.8 RG
45 50 522 40 re S

0.5 0.5 0.5 rg
/F1 8 Tf
50 75 Td
(SociallyHub - Social Media Analytics Platform) Tj
350 75 Td
(Page 1 of 1) Tj
50 60 Td
(Generated automatically from your social media data) Tj

ET
endstream
endobj

% Font Resources
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj

7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>
endobj

% Color Space for Brand Colors
8 0 obj
<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0] /C1 [0.231 0.511 0.965] /N 1 >>
endobj

% Cross-reference table
xref
0 9
0000000000 65535 f 
0000000010 00000 n 
0000000100 00000 n 
0000000157 00000 n 
0000000350 00000 n 
0000${contentLength + 400} 00000 n 
0000${contentLength + 460} 00000 n 
0000${contentLength + 525} 00000 n 
0000${contentLength + 590} 00000 n 

trailer
<< /Size 9 /Root 1 0 R /Info << /Title (${data.title}) /Creator (SociallyHub Analytics) /Producer (SociallyHub Platform) >> >>
startxref
${contentLength + 650}
%%EOF`
  
  return Buffer.from(pdfContent, 'utf-8')
}