import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

// GET /api/client-reports/[id]/download - Download client report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: reportId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Get the report with full details
    const report = await prisma.clientReport.findFirst({
      where: {
        id: reportId,
        workspaceId: userWorkspace.workspaceId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            industry: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Only allow download for completed reports
    if (report.status !== 'COMPLETED') {
      return NextResponse.json({ 
        error: 'Report is not ready for download' 
      }, { status: 400 })
    }

    // Generate mock report content based on format
    let content = ''
    let contentType = ''
    let fileName = ''

    if (report.format === 'PDF' || report.format === 'HTML') {
      contentType = 'text/html'
      fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`
      
      // Generate HTML report content
      content = generateHTMLReport(report)
    } else if (report.format === 'CSV') {
      contentType = 'text/csv'
      fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
      
      // Generate CSV report content
      content = generateCSVReport(report)
    } else if (report.format === 'EXCEL') {
      contentType = 'application/vnd.ms-excel'
      fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
      
      // For demo purposes, return CSV content with Excel content type
      content = generateCSVReport(report)
    }

    // Update download count
    await prisma.clientReport.update({
      where: { id: reportId },
      data: {
        downloadCount: {
          increment: 1
        }
      }
    })

    console.log(`📊 Report ${reportId} downloaded by user ${userId}`)

    // Return file content
    const buffer = Buffer.from(content, 'utf-8')
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error downloading client report:', error)
    return NextResponse.json(
      { error: 'Failed to download report' },
      { status: 500 }
    )
  }
}

function generateHTMLReport(report: any): string {
  const config = report.config || {}
  const metrics = config.metrics || []
  const dateRange = config.dateRange || {}

  return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.name}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6; 
            color: #333;
        }
        .header { 
            border-bottom: 3px solid #2563eb; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .logo { 
            font-size: 24px; 
            font-weight: bold; 
            color: #2563eb; 
        }
        .report-title { 
            font-size: 28px; 
            margin: 10px 0; 
            color: #1f2937;
        }
        .client-info { 
            background: #f8fafc; 
            padding: 15px; 
            border-left: 4px solid #2563eb; 
            margin: 20px 0; 
        }
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin: 30px 0; 
        }
        .metric-card { 
            background: #fff; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            padding: 20px; 
            text-align: center; 
        }
        .metric-value { 
            font-size: 32px; 
            font-weight: bold; 
            color: #2563eb; 
        }
        .metric-label { 
            color: #6b7280; 
            margin-top: 5px; 
        }
        .section { 
            margin: 30px 0; 
        }
        .section-title { 
            font-size: 20px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            color: #1f2937;
        }
        .footer { 
            margin-top: 50px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            text-align: center; 
            color: #6b7280; 
            font-size: 12px; 
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">SociallyHub</div>
        <h1 class="report-title">${report.name}</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="client-info">
        <h3>Client Information</h3>
        <p><strong>Name:</strong> ${report.client.name}</p>
        <p><strong>Company:</strong> ${report.client.company || 'N/A'}</p>
        <p><strong>Industry:</strong> ${report.client.industry || 'N/A'}</p>
        <p><strong>Email:</strong> ${report.client.email || 'N/A'}</p>
    </div>

    <div class="section">
        <h2 class="section-title">Report Details</h2>
        <p><strong>Report Type:</strong> ${report.type}</p>
        <p><strong>Frequency:</strong> ${report.frequency}</p>
        <p><strong>Date Range:</strong> ${dateRange.start || 'N/A'} to ${dateRange.end || 'N/A'}</p>
        ${report.description ? `<p><strong>Description:</strong> ${report.description}</p>` : ''}
    </div>

    <div class="section">
        <h2 class="section-title">Key Metrics</h2>
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${Math.floor(Math.random() * 10000) + 1000}</div>
                <div class="metric-label">Total Reach</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.floor(Math.random() * 1000) + 100}</div>
                <div class="metric-label">Engagement</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.floor(Math.random() * 100) + 10}</div>
                <div class="metric-label">Conversions</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(Math.random() * 10 + 1).toFixed(1)}%</div>
                <div class="metric-label">Growth Rate</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2 class="section-title">Selected Metrics</h2>
        <ul>
            ${metrics.map((metric: string) => `<li>${metric.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</li>`).join('')}
        </ul>
    </div>

    <div class="footer">
        <p>Report generated by SociallyHub | ${new Date().toLocaleDateString()}</p>
        <p>This is a demo report with sample data for testing purposes.</p>
    </div>
</body>
</html>
  `.trim()
}

function generateCSVReport(report: any): string {
  const config = report.config || {}
  const metrics = config.metrics || []

  let csv = 'Metric,Value,Period\n'
  csv += `Total Reach,${Math.floor(Math.random() * 10000) + 1000},${config.dateRange?.start || 'N/A'} to ${config.dateRange?.end || 'N/A'}\n`
  csv += `Engagement,${Math.floor(Math.random() * 1000) + 100},${config.dateRange?.start || 'N/A'} to ${config.dateRange?.end || 'N/A'}\n`
  csv += `Conversions,${Math.floor(Math.random() * 100) + 10},${config.dateRange?.start || 'N/A'} to ${config.dateRange?.end || 'N/A'}\n`
  csv += `Growth Rate,${(Math.random() * 10 + 1).toFixed(1)}%,${config.dateRange?.start || 'N/A'} to ${config.dateRange?.end || 'N/A'}\n`
  
  return csv
}