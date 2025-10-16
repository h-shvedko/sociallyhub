import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'

// Helper function to get request metadata
function getRequestMetadata(request: NextRequest) {
  const headersList = headers()
  const userAgent = headersList.get('user-agent') || ''
  const forwardedFor = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown'
  const referrerUrl = headersList.get('referer') || ''

  return { userAgent, ipAddress, referrerUrl }
}

// POST /api/support/contact - Submit contact form
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
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

    const { userAgent, ipAddress, referrerUrl } = getRequestMetadata(request)

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
        workspaceId: session?.user?.workspaceId || null,
        userId: session?.user?.id || null,
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

    // Send confirmation email (you could implement this with your email service)
    // For now, we'll just return success with ticket info

    return NextResponse.json({
      id: contactForm.id,
      ticketNumber: `TICK-${contactForm.id.slice(-8).toUpperCase()}`,
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
    const session = await getServerSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const contactForms = await prisma.supportContactForm.findMany({
      where: {
        userId: session.user?.id
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