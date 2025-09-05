import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

// POST /api/client-reports/schedules/run - Run scheduled reports (webhook endpoint)
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal request or from a cron job
    const authHeader = request.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    console.log(`🕒 Running scheduled reports check at ${now.toISOString()}`)

    // Find all active schedules that are due to run
    const dueSchedules = await prisma.clientReportSchedule.findMany({
      where: {
        isActive: true,
        nextRun: {
          lte: now
        }
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            type: true,
            format: true,
            metrics: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.log(`📅 Found ${dueSchedules.length} schedules due for execution`)

    const results = []

    for (const schedule of dueSchedules) {
      try {
        // Generate report for this schedule
        const report = await generateScheduledReport(schedule)
        
        // Send email if recipients are specified
        if (schedule.recipients && schedule.recipients.length > 0) {
          await sendScheduledReportEmail(report, schedule)
        }

        // Update schedule with new next run time and last run time
        const nextRun = calculateNextRunTime(schedule)
        await prisma.clientReportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRun: now,
            nextRun: nextRun
          }
        })

        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          reportId: report.id,
          status: 'success',
          nextRun: nextRun
        })

        console.log(`✅ Successfully executed schedule ${schedule.id}: ${schedule.name}`)

      } catch (error) {
        console.error(`❌ Failed to execute schedule ${schedule.id}:`, error)
        
        results.push({
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          status: 'failed',
          error: error.message
        })

        // Update next run time even if failed (to prevent infinite retries)
        const nextRun = calculateNextRunTime(schedule)
        await prisma.clientReportSchedule.update({
          where: { id: schedule.id },
          data: {
            nextRun: nextRun
          }
        })
      }
    }

    console.log(`🏁 Completed scheduled reports execution: ${results.length} processed`)

    return NextResponse.json({ 
      success: true,
      processed: results.length,
      results 
    })

  } catch (error) {
    console.error('Error running scheduled reports:', error)
    return NextResponse.json(
      { error: 'Failed to run scheduled reports' },
      { status: 500 }
    )
  }
}

// Generate a report based on a schedule
async function generateScheduledReport(schedule: any) {
  const reportName = `${schedule.template.name} - ${schedule.client.name} - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`

  // Create the report record
  const report = await prisma.clientReport.create({
    data: {
      workspaceId: schedule.workspaceId,
      clientId: schedule.clientId,
      templateId: schedule.templateId,
      name: reportName,
      description: `Automatically generated report from schedule: ${schedule.name}`,
      type: schedule.template.type,
      format: schedule.template.format[0] || 'PDF', // Use first available format
      frequency: schedule.frequency,
      status: 'COMPLETED', // For demo purposes, mark as completed immediately
      recipients: schedule.recipients,
      data: {
        generated: true,
        scheduledBy: schedule.id,
        metrics: generateMockMetrics()
      },
      fileSize: `${Math.floor(Math.random() * 500) + 100}KB`,
      downloadCount: 0
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          company: true
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

  return report
}

// Send scheduled report via email
async function sendScheduledReportEmail(report: any, schedule: any) {
  // Configure email transporter
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false,
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined
  })

  const reportUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3099'}/dashboard/clients?tab=reports&report=${report.id}`
  
  // Generate email content
  const emailSubject = `Scheduled Report: ${report.name}`
  const emailContent = generateScheduledReportEmailTemplate(report, schedule, reportUrl)

  // Send email to all recipients
  const emailPromises = schedule.recipients.map(async (email: string) => {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'SociallyHub Scheduler <scheduler@sociallyhub.com>',
        to: email.trim(),
        subject: emailSubject,
        html: emailContent
      })
      return { email, status: 'sent' }
    } catch (error) {
      console.error(`Failed to send scheduled report email to ${email}:`, error)
      return { email, status: 'failed', error: error.message }
    }
  })

  const emailResults = await Promise.all(emailPromises)
  console.log(`📧 Sent scheduled report ${report.id} to ${schedule.recipients.length} recipients`)
  
  return emailResults
}

// Generate email template for scheduled reports
function generateScheduledReportEmailTemplate(report: any, schedule: any, reportUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scheduled Report - ${report.name}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #374151; 
            margin: 0; 
            padding: 0; 
            background: linear-gradient(180deg, #f0f4f8 0%, #e2e8f0 100%);
        }
        .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: #ffffff; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 40px 24px; 
            text-align: center; 
        }
        .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 700; 
        }
        .schedule-badge {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 8px 16px;
            font-size: 14px;
            margin-top: 8px;
            display: inline-block;
        }
        .content { 
            padding: 32px 24px; 
        }
        .report-details { 
            background: linear-gradient(135deg, #f8fafc 0%, #f0f4f8 100%);
            border-radius: 8px; 
            padding: 24px; 
            margin: 24px 0; 
        }
        .detail-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 8px 0; 
            border-bottom: 1px solid #e5e7eb; 
        }
        .detail-row:last-child { 
            border-bottom: none; 
        }
        .detail-label { 
            font-weight: 600; 
            color: #4b5563; 
        }
        .detail-value { 
            color: #1f2937; 
        }
        .cta-section { 
            text-align: center; 
            margin: 32px 0; 
            padding: 24px;
            background: linear-gradient(135deg, #f6f9fc 0%, #f0f4f8 100%);
            border-radius: 8px;
        }
        .btn { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600; 
            box-shadow: 0 4px 14px 0 rgba(102, 126, 234, 0.4);
        }
        .footer { 
            background: #f9fafb; 
            padding: 24px; 
            text-align: center; 
            color: #6b7280; 
            font-size: 14px; 
            border-top: 1px solid #e5e7eb; 
        }
        .automated-notice {
            background: #fffbeb;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 12px;
            margin: 16px 0;
            color: #92400e;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Scheduled Report</h1>
            <div class="schedule-badge">
                ${schedule.frequency.toLowerCase()} • ${schedule.name}
            </div>
        </div>
        
        <div class="content">
            <p style="font-size: 16px; margin-bottom: 24px;">
                Your scheduled report has been automatically generated and is ready for review.
            </p>
            
            <div class="automated-notice">
                🤖 This is an automated report delivery from your scheduled report: <strong>${schedule.name}</strong>
            </div>
            
            <div class="report-details">
                <h3 style="margin: 0 0 16px 0; color: #1f2937;">Report Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Report Name</span>
                    <span class="detail-value">${report.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Client</span>
                    <span class="detail-value">${report.client.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Schedule</span>
                    <span class="detail-value">${schedule.name} (${schedule.frequency})</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Generated</span>
                    <span class="detail-value">${new Date().toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Format</span>
                    <span class="detail-value">${report.format}</span>
                </div>
            </div>
            
            <div class="cta-section">
                <h3 style="margin: 0 0 12px 0;">Access Your Report</h3>
                <p style="margin: 0 0 16px 0; color: #6b7280;">Click below to view and download your report</p>
                <a href="${reportUrl}" class="btn">View Report Dashboard</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
                To modify or disable this scheduled report, please visit your SociallyHub dashboard and navigate to the Client Reports > Scheduled tab.
            </p>
        </div>
        
        <div class="footer">
            <p>
                © ${new Date().getFullYear()} SociallyHub. All rights reserved.<br>
                This email was sent from our automated reporting system.<br>
                <a href="mailto:support@sociallyhub.com" style="color: #667eea;">Contact Support</a>
            </p>
        </div>
    </div>
</body>
</html>
  `.trim()
}

// Generate mock metrics for demo purposes
function generateMockMetrics() {
  return {
    totalReach: Math.floor(Math.random() * 50000) + 10000,
    engagement: Math.floor(Math.random() * 5000) + 1000,
    conversions: Math.floor(Math.random() * 500) + 50,
    growthRate: (Math.random() * 15 + 2).toFixed(1),
    generatedAt: new Date().toISOString()
  }
}

// Calculate next run time for a schedule
function calculateNextRunTime(schedule: any): Date | null {
  if (!schedule.isActive) {
    return null
  }

  const now = new Date()
  const [hours, minutes] = schedule.time.split(':').map(Number)
  
  let nextRun = new Date()
  nextRun.setHours(hours, minutes, 0, 0)

  switch (schedule.frequency) {
    case 'DAILY':
      nextRun.setDate(nextRun.getDate() + 1)
      break

    case 'WEEKLY':
      nextRun.setDate(nextRun.getDate() + 7)
      break

    case 'MONTHLY':
      nextRun.setMonth(nextRun.getMonth() + 1)
      break

    case 'QUARTERLY':
      nextRun.setMonth(nextRun.getMonth() + 3)
      break

    default:
      nextRun.setDate(nextRun.getDate() + 1)
  }

  return nextRun
}