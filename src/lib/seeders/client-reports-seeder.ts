import { prisma } from '@/lib/prisma'

export async function seedClientReports() {
  try {
    // Get demo workspace
    const demoWorkspace = await prisma.workspace.findFirst({
      where: {
        OR: [
          { name: 'Demo Workspace' },
          { id: 'demo-workspace' },
          { name: { contains: 'demo', mode: 'insensitive' } }
        ]
      }
    })

    if (!demoWorkspace) {
      console.log('Demo workspace not found, skipping client reports seeding')
      return
    }

    // Get some clients to associate with reports
    const clients = await prisma.client.findMany({
      where: {
        workspaceId: demoWorkspace.id
      },
      take: 3
    })

    if (clients.length === 0) {
      console.log('No clients found, skipping client reports seeding')
      return
    }

    // Create default report templates
    const templates = [
      {
        workspaceId: demoWorkspace.id,
        name: 'Executive Summary',
        description: 'High-level monthly overview for executives',
        type: 'EXECUTIVE',
        format: ['PDF'],
        metrics: ['followers', 'engagement_rate', 'reach', 'impressions', 'website_clicks'],
        sections: {
          cover: true,
          overview: true,
          keyMetrics: true,
          insights: true,
          recommendations: true
        },
        isActive: true,
        isDefault: true,
        customDashboard: false,
        autoEmail: true,
        emailTemplate: 'Your monthly executive summary is ready for review.'
      },
      {
        workspaceId: demoWorkspace.id,
        name: 'Performance Analytics',
        description: 'Detailed performance metrics and analytics',
        type: 'PERFORMANCE',
        format: ['PDF', 'EXCEL'],
        metrics: [
          'followers', 'engagement_rate', 'reach', 'impressions', 'saves', 
          'shares', 'comments', 'likes', 'website_clicks', 'profile_visits'
        ],
        sections: {
          demographics: true,
          contentAnalysis: true,
          platformBreakdown: true,
          competitors: false,
          detailed: true
        },
        isActive: true,
        isDefault: false,
        customDashboard: true,
        autoEmail: false
      },
      {
        workspaceId: demoWorkspace.id,
        name: 'Social Media ROI',
        description: 'Return on investment analysis for social media campaigns',
        type: 'ANALYTICS',
        format: ['PDF', 'DASHBOARD_LINK'],
        metrics: ['roi', 'cost_per_click', 'cost_per_engagement', 'conversion_rate', 'revenue'],
        sections: {
          campaignPerformance: true,
          budgetAnalysis: true,
          conversionTracking: true,
          recommendations: true
        },
        isActive: true,
        isDefault: false,
        customDashboard: true,
        autoEmail: true,
        emailTemplate: 'Your social media ROI report shows significant improvements this quarter.'
      }
    ]

    // Create templates
    const createdTemplates = []
    for (const templateData of templates) {
      const existing = await prisma.clientReportTemplate.findFirst({
        where: {
          workspaceId: demoWorkspace.id,
          name: templateData.name
        }
      })

      if (!existing) {
        const template = await prisma.clientReportTemplate.create({
          data: templateData
        })
        createdTemplates.push(template)
        console.log(`📊 Created report template: ${template.name}`)
      }
    }

    // Create some sample reports for clients
    const sampleReports = [
      {
        workspaceId: demoWorkspace.id,
        clientId: clients[0].id,
        templateId: createdTemplates[0]?.id || null,
        name: `Executive Summary - ${clients[0].name} - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        description: 'Monthly executive summary highlighting key achievements and metrics',
        type: 'EXECUTIVE',
        format: 'PDF',
        frequency: 'MONTHLY',
        status: 'COMPLETED',
        config: {
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: new Date()
          },
          includeComparisons: true,
          previousPeriod: true
        },
        data: {
          summary: {
            followers: { current: 12450, change: '+8.2%', previous: 11510 },
            engagement_rate: { current: '4.7%', change: '+0.3%', previous: '4.4%' },
            reach: { current: 89200, change: '+15.2%', previous: 77450 },
            website_clicks: { current: 342, change: '+22.1%', previous: 280 }
          },
          insights: [
            'Instagram Stories drove 45% of total engagement',
            'Video content performed 3x better than static posts',
            'Peak engagement occurs Tuesday-Thursday, 2-4 PM'
          ]
        },
        fileSize: '2.3 MB',
        recipients: [clients[0].email],
        lastGenerated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        downloadCount: 5
      },
      {
        workspaceId: demoWorkspace.id,
        clientId: clients[1].id,
        templateId: createdTemplates[1]?.id || null,
        name: `Performance Analytics - ${clients[1].name} - Q4 2024`,
        description: 'Quarterly performance deep-dive with platform breakdowns',
        type: 'PERFORMANCE',
        format: 'EXCEL',
        frequency: 'QUARTERLY',
        status: 'COMPLETED',
        config: {
          dateRange: {
            start: new Date('2024-10-01'),
            end: new Date('2024-12-31')
          },
          platforms: ['instagram', 'facebook', 'twitter'],
          includeCompetitors: true
        },
        data: {
          platforms: {
            instagram: { followers: 8920, engagement: '5.2%' },
            facebook: { followers: 15600, engagement: '3.1%' },
            twitter: { followers: 4250, engagement: '2.8%' }
          }
        },
        fileSize: '4.1 MB',
        recipients: [clients[1].email, 'marketing@' + clients[1].company?.toLowerCase().replace(/\s+/g, '') + '.com'],
        lastGenerated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        downloadCount: 8
      },
      {
        workspaceId: demoWorkspace.id,
        clientId: clients[2].id,
        name: `Weekly Update - ${clients[2].name}`,
        description: 'Weekly performance snapshot',
        type: 'PERFORMANCE',
        format: 'PDF',
        frequency: 'WEEKLY',
        status: 'GENERATING',
        config: {
          dateRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            end: new Date()
          },
          quickView: true
        },
        recipients: [clients[2].email],
        downloadCount: 0
      }
    ]

    // Create sample reports
    for (const reportData of sampleReports) {
      const existing = await prisma.clientReport.findFirst({
        where: {
          workspaceId: demoWorkspace.id,
          name: reportData.name
        }
      })

      if (!existing) {
        await prisma.clientReport.create({
          data: reportData
        })
        console.log(`📊 Created sample report: ${reportData.name}`)
      }
    }

    // Create some scheduled reports
    if (createdTemplates.length > 0) {
      const schedules = [
        {
          workspaceId: demoWorkspace.id,
          clientId: clients[0].id,
          templateId: createdTemplates[0].id,
          name: `Monthly Executive Summary - ${clients[0].name}`,
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          time: '09:00',
          recipients: [clients[0].email],
          isActive: true,
          nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next week
        },
        {
          workspaceId: demoWorkspace.id,
          clientId: clients[1].id,
          templateId: createdTemplates[1].id,
          name: `Weekly Performance Report - ${clients[1].name}`,
          frequency: 'WEEKLY',
          dayOfWeek: 1, // Monday
          time: '08:00',
          recipients: [clients[1].email],
          isActive: true,
          nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        }
      ]

      for (const scheduleData of schedules) {
        const existing = await prisma.clientReportSchedule.findFirst({
          where: {
            workspaceId: demoWorkspace.id,
            name: scheduleData.name
          }
        })

        if (!existing) {
          await prisma.clientReportSchedule.create({
            data: scheduleData
          })
          console.log(`📊 Created report schedule: ${scheduleData.name}`)
        }
      }
    }

    console.log('✅ Client reports seeding completed!')
  } catch (error) {
    console.error('❌ Error seeding client reports:', error)
  }
}