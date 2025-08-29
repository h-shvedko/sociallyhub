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
  // Generate a professional PDF with enhanced styling and branding
  const generatedDate = new Date(data.generatedAt).toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Ensure we have metrics to display
  const metricsToShow = data.metrics && data.metrics.length > 0 ? data.metrics.slice(0, 10) : [
    { label: 'Total Posts', value: 0, metric: 'posts_published' },
    { label: 'Total Reach', value: 0, metric: 'total_reach' },
    { label: 'Engagement Rate', value: '0%', metric: 'engagement_rate' }
  ]
  
  // Calculate content length more accurately
  const baseContentLength = 2000
  const metricsContentLength = metricsToShow.length * 60
  const titleLength = (data.title || 'Analytics Report').length * 8
  const descLength = (data.description || '').length * 6
  const totalContentLength = baseContentLength + metricsContentLength + titleLength + descLength
  
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj

4 0 obj
<< /Length ${totalContentLength} >>
stream
BT

% === HEADER SECTION WITH LOGO ===
% SociallyHub Logo Area (Simulated with text and styling)
/F2 18 Tf
0.2 0.4 0.8 rg
50 750 Td
(SOCIALLYHUB) Tj

% Logo underline
0.2 0.4 0.8 RG
2 w
50 745 150 0 re S

% Analytics Report Title
0 0 0 rg
/F2 24 Tf
50 710 Td
(Analytics Report) Tj

% Report Title
/F1 16 Tf
0 -25 Td
(${data.title || 'Monthly Analytics Report'}) Tj

% === INFO BOX SECTION ===
% Background box for report info
0.95 0.95 0.95 rg
45 630 522 80 re f
0.7 0.7 0.7 RG
1 w
45 630 522 80 re S

% Report Information
0.3 0.3 0.3 rg
/F1 12 Tf
55 695 Td
(Report Generated: ${generatedDate}) Tj
0 -15 Td
(Date Range: ${data.dateRange?.label || 'Last 30 Days'}) Tj
0 -15 Td
(Report Type: ${data.summary?.reportType ? data.summary.reportType.charAt(0).toUpperCase() + data.summary.reportType.slice(1) : 'Summary'}) Tj
0 -15 Td
(Total Metrics: ${metricsToShow.length}) Tj

% === DESCRIPTION SECTION ===
${data.description ? `
0 0 0 rg
/F2 14 Tf
50 600 Td
(Report Description:) Tj
/F1 11 Tf
0 -20 Td
(${data.description.substring(0, 100)}${data.description.length > 100 ? '...' : ''}) Tj
` : ''}

% === METRICS SECTION ===
% Section Header with colored background
0.2 0.4 0.8 rg
45 ${data.description ? '540' : '570'} 522 25 re f
1 1 1 rg
/F2 14 Tf
55 ${data.description ? '550' : '580'} Td
(Key Performance Metrics) Tj

% Metrics Table Header
0.9 0.9 0.9 rg
45 ${data.description ? '520' : '550'} 522 20 re f
0 0 0 rg
/F2 11 Tf
55 ${data.description ? '530' : '560'} Td
(Metric) Tj
400 ${data.description ? '530' : '560'} Td
(Value) Tj

% Individual Metrics Rows
${metricsToShow.map((m: any, i: number) => {
  const yPos = (data.description ? 500 : 530) - (i * 25)
  const value = typeof m.value === 'number' ? m.value.toLocaleString() : (m.value || '0')
  const bgColor = i % 2 === 0 ? '0.98 0.98 0.98' : '1 1 1'
  return `
% Row ${i + 1} Background
${bgColor} rg
45 ${yPos - 5} 522 20 re f

% Row ${i + 1} Content
0 0 0 rg
/F1 10 Tf
55 ${yPos} Td
(${(m.label || 'Unknown Metric').substring(0, 40)}) Tj

% Value (right aligned)
/F2 10 Tf
0.2 0.4 0.8 rg
400 ${yPos} Td
(${value}) Tj`
}).join('')}

% === BRANDING FOOTER ===
% Footer background
0.1 0.1 0.1 rg
45 50 522 40 re f

% Footer content
1 1 1 rg
/F1 10 Tf
55 75 Td
(SociallyHub) Tj
/F2 8 Tf
0.8 0.8 0.8 rg
120 75 Td
(- Social Media Analytics Platform) Tj

% Copyright and page info
/F1 8 Tf
400 75 Td
(Page 1 of 1) Tj
55 60 Td
(© 2025 SociallyHub. Generated automatically from your analytics data.) Tj

ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj

xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000259 00000 n 
0000${totalContentLength + 350} 00000 n 
0000${totalContentLength + 410} 00000 n 
trailer
<< /Size 7 /Root 1 0 R /Info << /Title (${data.title || 'Analytics Report'}) /Author (SociallyHub) /Creator (SociallyHub Analytics Platform) /Subject (Social Media Analytics Report) >> >>
startxref
${totalContentLength + 470}
%%EOF`
  
  return Buffer.from(pdfContent, 'utf-8')
}