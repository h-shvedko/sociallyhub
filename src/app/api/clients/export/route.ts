import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/clients/export - Export clients data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv' // csv, excel, pdf
    const search = searchParams.get('search')

    const userId = await normalizeUserId(session.user.id)
    
    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            name: true
          }
        }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Build where clause for filtering
    const where: any = {
      workspaceId: userWorkspace.workspaceId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch clients data
    const clients = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        industry: true,
        website: true,
        status: true,
        totalProjects: true,
        monthlyRetainer: true,
        lastContact: true,
        createdAt: true,
        updatedAt: true,
        onboardingStatus: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    const exportData = clients.map(client => ({
      'Client Name': client.name,
      'Email': client.email || '',
      'Phone': client.phone || '',
      'Company': client.company || '',
      'Industry': client.industry || '',
      'Website': client.website || '',
      'Status': client.status,
      'Onboarding Status': client.onboardingStatus,
      'Total Projects': client.totalProjects || 0,
      'Monthly Retainer': client.monthlyRetainer ? `$${client.monthlyRetainer}` : '',
      'Last Contact': client.lastContact ? new Date(client.lastContact).toLocaleDateString() : '',
      'Created Date': new Date(client.createdAt).toLocaleDateString(),
      'Updated Date': new Date(client.updatedAt).toLocaleDateString()
    }))

    const timestamp = new Date().toISOString().split('T')[0]
    const workspaceName = userWorkspace.workspace.name.replace(/[^a-zA-Z0-9]/g, '_')

    if (format === 'csv') {
      const csv = generateCSV(exportData)
      
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="clients_${workspaceName}_${timestamp}.csv"`
        }
      })
    } 
    
    if (format === 'excel') {
      // For Excel format, we'll return JSON that can be converted to Excel on the frontend
      return NextResponse.json({
        success: true,
        data: exportData,
        filename: `clients_${workspaceName}_${timestamp}.xlsx`,
        format: 'excel'
      })
    }
    
    if (format === 'pdf') {
      const html = generatePDFHTML(exportData, userWorkspace.workspace.name)
      
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="clients_${workspaceName}_${timestamp}.html"`
        }
      })
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 })

  } catch (error) {
    console.error('Error exporting clients:', error)
    return NextResponse.json(
      { error: 'Failed to export clients' },
      { status: 500 }
    )
  }
}

function generateCSV(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Escape values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')
  
  return csvContent
}

function generatePDFHTML(data: any[], workspaceName: string): string {
  const timestamp = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clients Export - ${workspaceName}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #374151; 
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .header h1 {
            color: #1f2937;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            color: #6b7280;
            margin: 5px 0;
            font-size: 14px;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
        }
        .stat-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
            font-size: 12px;
        }
        th {
            background: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        tr:nth-child(even) {
            background: #fafafa;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
        }
        .status-active { background: #d1fae5; color: #065f46; }
        .status-inactive { background: #fee2e2; color: #991b1b; }
        .status-prospect { background: #dbeafe; color: #1e40af; }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }
        @media print {
            body { margin: 0; }
            .header { page-break-after: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Client Directory</h1>
        <p><strong>${workspaceName}</strong></p>
        <p>Generated on ${timestamp}</p>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-number">${data.length}</div>
            <div class="stat-label">Total Clients</div>
        </div>
        <div class="stat">
            <div class="stat-number">${data.filter(c => c['Status'] === 'ACTIVE').length}</div>
            <div class="stat-label">Active Clients</div>
        </div>
        <div class="stat">
            <div class="stat-number">${data.filter(c => c['Monthly Retainer']).length}</div>
            <div class="stat-label">Retainer Clients</div>
        </div>
        <div class="stat">
            <div class="stat-number">${data.filter(c => c['Onboarding Status'] === 'COMPLETED').length}</div>
            <div class="stat-label">Onboarded</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Client Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Industry</th>
                <th>Status</th>
                <th>Monthly Retainer</th>
                <th>Projects</th>
                <th>Last Contact</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(client => `
                <tr>
                    <td><strong>${client['Client Name']}</strong></td>
                    <td>${client['Company']}</td>
                    <td>${client['Email']}</td>
                    <td>${client['Phone']}</td>
                    <td>${client['Industry']}</td>
                    <td><span class="status-badge status-${client['Status'].toLowerCase()}">${client['Status']}</span></td>
                    <td>${client['Monthly Retainer']}</td>
                    <td>${client['Total Projects']}</td>
                    <td>${client['Last Contact']}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>© ${new Date().getFullYear()} SociallyHub. Generated on ${new Date().toLocaleString()}</p>
        <p>This report contains ${data.length} client records from your workspace.</p>
    </div>
</body>
</html>
  `.trim()
}