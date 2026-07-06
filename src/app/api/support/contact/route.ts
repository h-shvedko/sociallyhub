import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { getRequestMetadata } from '@/lib/api/request-metadata'
import { emailService } from '@/lib/notifications/email-service'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// POST /api/support/contact - Submit contact form
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    const body = await request.json()
    const {
      name,
      email,
      subject,
      message,
      department = 'support',
      priority = 'medium'
    } = body

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Name, email, subject, and message are required' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    const { userAgent, ipAddress, referrerUrl } = await getRequestMetadata()

    // Find available agent for assignment
    const availableAgent = await prisma.supportAgent.findFirst({
      where: {
        isActive: true,
        department: department,
        autoAssign: true
      },
      orderBy: [
        { isOnline: 'desc' },
        { currentChatCount: 'asc' },
        { lastSeen: 'desc' }
      ]
    })

    // Create contact form entry
    const contactForm = await prisma.supportContactForm.create({
      data: {
        // NOTE(ADR-0003): the session never carried a workspaceId (no session
        // callback populates it), so this was always null at runtime.
        workspaceId: null,
        userId: user?.id || null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        department,
        priority,
        userAgent,
        ipAddress,
        referrerUrl,
        assignedAgentId: availableAgent?.id,
        assignedAt: availableAgent ? new Date() : null
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            displayName: true,
            title: true
          }
        }
      }
    })

    const ticketNumber = `TICK-${contactForm.id.slice(-8).toUpperCase()}`

    // Confirmation email to the submitter (ADR-0011 Phase 1, item 7b). Best-effort:
    // the submission is already persisted, so an SMTP failure is logged loudly but
    // never fails the request.
    try {
      const safeName = escapeHtml(name.trim())
      const safeSubject = escapeHtml(subject.trim())
      const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>')
      await emailService.send({
        to: [email.trim().toLowerCase()],
        subject: `We received your message [${ticketNumber}]`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #2563eb; padding: 16px; border-radius: 12px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">S</span>
              </div>
            </div>
            <h1 style="color: #2563eb;">Thanks for reaching out</h1>
            <p>Hi ${safeName},</p>
            <p>We've received your message and our support team will get back to you soon.
              Your reference number is <strong>${ticketNumber}</strong>.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${safeSubject}</p>
              <p style="margin: 0;">${safeMessage}</p>
            </div>
            <p>Estimated response time: <strong>${availableAgent ? '2-4 hours' : '24-48 hours'}</strong>.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            <p style="color: #64748b; font-size: 14px;">Best regards,<br>The SociallyHub Support Team</p>
          </div>
        `,
        text:
          `Hi ${name.trim()},\n\n` +
          `We've received your message and will get back to you soon. ` +
          `Your reference number is ${ticketNumber}.\n\n` +
          `Subject: ${subject.trim()}\n${message.trim()}\n\n` +
          `Estimated response time: ${availableAgent ? '2-4 hours' : '24-48 hours'}.\n\n` +
          `The SociallyHub Support Team`,
      })
    } catch (emailError) {
      console.error(
        `[support-contact] Failed to send confirmation email to ${email} for ${ticketNumber}:`,
        emailError instanceof Error ? emailError.message : emailError
      )
    }

    return NextResponse.json({
      id: contactForm.id,
      ticketNumber,
      status: contactForm.status,
      assignedAgent: contactForm.assignedAgent,
      estimatedResponseTime: availableAgent ? '2-4 hours' : '24-48 hours',
      message: 'Thank you for contacting us! We\'ve received your message and will respond soon.'
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to submit contact form:', error)
    return NextResponse.json(
      { error: 'Failed to submit contact form. Please try again.' },
      { status: 500 }
    )
  }
}

// GET /api/support/contact - Get contact form submissions (for user)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const contactForms = await prisma.supportContactForm.findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        department: true,
        responseMessage: true,
        responseMethod: true,
        assignedAgent: {
          select: {
            displayName: true,
            title: true
          }
        },
        createdAt: true,
        respondedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    return NextResponse.json({
      contactForms: contactForms.map(form => ({
        ...form,
        ticketNumber: `TICK-${form.id.slice(-8).toUpperCase()}`
      }))
    })

  } catch (error) {
    console.error('Failed to get contact forms:', error)
    return NextResponse.json(
      { error: 'Failed to get contact forms' },
      { status: 500 }
    )
  }
}