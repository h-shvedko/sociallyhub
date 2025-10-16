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

// Helper function to find available agent
async function findAvailableAgent(department: string) {
  const availableAgents = await prisma.supportAgent.findMany({
    where: {
      isActive: true,
      isOnline: true,
      autoAssign: true,
      department: department,
      currentChatCount: {
        lt: prisma.supportAgent.fields.maxConcurrentChats
      }
    },
    orderBy: [
      { currentChatCount: 'asc' },
      { lastSeen: 'desc' }
    ],
    take: 1
  })

  return availableAgents[0] || null
}

// POST /api/support/chat - Start a new chat session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    const body = await request.json()
    const {
      subject,
      department = 'support',
      priority = 'medium',
      guestName,
      guestEmail
    } = body

    const { userAgent, ipAddress, referrerUrl } = getRequestMetadata(request)

    // Generate session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Find available agent
    const availableAgent = await findAvailableAgent(department)

    // Create chat
    const chat = await prisma.supportChat.create({
      data: {
        workspaceId: session?.user?.workspaceId || null,
        userId: session?.user?.id || null,
        guestName: session ? null : guestName,
        guestEmail: session ? null : guestEmail,
        subject,
        department,
        priority,
        sessionId,
        userAgent,
        ipAddress,
        referrerUrl,
        assignedAgentId: availableAgent?.id,
        assignedAt: availableAgent ? new Date() : null,
        status: availableAgent ? 'assigned' : 'open'
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            user: {
              select: {
                image: true
              }
            }
          }
        }
      }
    })

    // Update agent's current chat count if assigned
    if (availableAgent) {
      await prisma.supportAgent.update({
        where: { id: availableAgent.id },
        data: {
          currentChatCount: { increment: 1 }
        }
      })

      // Send welcome message from agent
      await prisma.supportMessage.create({
        data: {
          chatId: chat.id,
          senderId: availableAgent.id,
          senderType: 'agent',
          senderName: availableAgent.displayName,
          content: `Hello! I'm ${availableAgent.displayName} and I'll be helping you today. How can I assist you?`,
          messageType: 'text'
        }
      })
    } else {
      // Send automated message when no agents available
      await prisma.supportMessage.create({
        data: {
          chatId: chat.id,
          senderType: 'system',
          senderName: 'SociallyHub Support',
          content: 'Thank you for contacting us! All our agents are currently busy, but we\'ll be with you shortly. Your estimated wait time is less than 5 minutes.',
          messageType: 'system'
        }
      })
    }

    return NextResponse.json({
      chatId: chat.id,
      sessionId: chat.sessionId,
      status: chat.status,
      assignedAgent: chat.assignedAgent,
      estimatedWaitTime: availableAgent ? 0 : 5 // minutes
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to start chat:', error)
    return NextResponse.json(
      { error: 'Failed to start chat session' },
      { status: 500 }
    )
  }
}

// GET /api/support/chat - Get user's active chats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')

    if (!session && !sessionId) {
      return NextResponse.json(
        { error: 'Session or sessionId required' },
        { status: 400 }
      )
    }

    const where: any = {
      status: { in: ['open', 'assigned'] }
    }

    if (session) {
      where.userId = session.user?.id
    } else if (sessionId) {
      where.sessionId = sessionId
    }

    const chats = await prisma.supportChat.findMany({
      where,
      include: {
        assignedAgent: {
          select: {
            id: true,
            displayName: true,
            title: true,
            isOnline: true,
            user: {
              select: {
                image: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Latest 50 messages
          select: {
            id: true,
            content: true,
            senderType: true,
            senderName: true,
            messageType: true,
            attachments: true,
            readByUser: true,
            readByAgent: true,
            createdAt: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({ chats })

  } catch (error) {
    console.error('Failed to get chats:', error)
    return NextResponse.json(
      { error: 'Failed to get chats' },
      { status: 500 }
    )
  }
}