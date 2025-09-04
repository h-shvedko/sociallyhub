import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

// POST /api/client-reports/[id]/send - Send report via email
export async function POST(
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
    const body = await request.json()

    const { recipients, subject, message } = body

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients specified' }, { status: 400 })
    }

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

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // For demo purposes, allow sending reports in any status
    // In production, you might want to restrict to 'COMPLETED' status only
    if (report.status === 'GENERATING') {
      return NextResponse.json({ 
        error: 'Report is currently being generated. Please try again in a moment.' 
      }, { status: 400 })
    }

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      } : undefined
    })

    // Prepare email content
    const emailSubject = subject || `${report.name} - ${report.client.name}`
    const emailContent = `
Dear ${report.client.name} Team,

${message || 'Please find attached your latest performance report.'}

Report Details:
- Report Name: ${report.name}
- Client: ${report.client.name}
- Generated: ${new Date().toLocaleDateString()}
- Format: ${report.format}

${report.description ? `Description: ${report.description}` : ''}

You can download the full report using the link provided or contact us for any questions.

Best regards,
SociallyHub Team

---
This email was sent via SociallyHub reporting system.
    `.trim()

    // Send email to each recipient
    const emailPromises = recipients.map(async (email: string) => {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@sociallyhub.com',
          to: email.trim(),
          subject: emailSubject,
          text: emailContent,
          html: emailContent.replace(/\n/g, '<br>')
        })
        return { email, status: 'sent' }
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error)
        return { email, status: 'failed', error: error.message }
      }
    })

    const emailResults = await Promise.all(emailPromises)
    
    // Log the email sending activity
    console.log(`📧 Report ${reportId} sent to ${recipients.length} recipients by user ${userId}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Report sent successfully',
      results: emailResults
    })

  } catch (error) {
    console.error('Error sending client report:', error)
    return NextResponse.json(
      { error: 'Failed to send report' },
      { status: 500 }
    )
  }
}