import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

interface RouteParams {
  params: Promise<{ chatId: string }>
}

// POST /api/support/chat/[chatId]/messages - Send a message
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params
    const session = await getServerSession()
    const body = await request.json()
    const { content, messageType = 'text', attachments = null } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')

    // Verify access to chat
    const chat = await prisma.supportChat.findFirst({
      where: {
        id: chatId,
        OR: [
          { userId: session?.user?.id },
          { sessionId: sessionId }
        ]
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            isOnline: true
          }
        }
      }
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    if (chat.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot send messages to a closed chat' },
        { status: 400 }
      )
    }

    // Create the message
    const message = await prisma.supportMessage.create({
      data: {
        chatId: chat.id,
        senderId: session?.user?.id || null,
        senderType: 'user',
        senderName: session?.user?.name || chat.guestName || 'Guest',
        content: content.trim(),
        messageType,
        attachments,
        readByUser: true // User's own message is automatically read
      }
    })

    // Update chat's updatedAt timestamp
    await prisma.supportChat.update({
      where: { id: chat.id },
      data: {
        updatedAt: new Date()
      }
    })

    // If this is the first user message and there's no agent assigned, try to assign one
    if (!chat.assignedAgentId) {
      const availableAgent = await prisma.supportAgent.findFirst({
        where: {
          isActive: true,
          isOnline: true,
          autoAssign: true,
          department: chat.department,
          currentChatCount: {
            lt: prisma.supportAgent.fields.maxConcurrentChats
          }
        },
        orderBy: [
          { currentChatCount: 'asc' },
          { lastSeen: 'desc' }
        ]
      })

      if (availableAgent) {
        await prisma.supportChat.update({
          where: { id: chat.id },
          data: {
            assignedAgentId: availableAgent.id,
            assignedAt: new Date(),
            status: 'assigned'
          }
        })

        await prisma.supportAgent.update({
          where: { id: availableAgent.id },
          data: {
            currentChatCount: { increment: 1 }
          }
        })

        // Send agent introduction message
        await prisma.supportMessage.create({
          data: {
            chatId: chat.id,
            senderId: availableAgent.id,
            senderType: 'agent',
            senderName: availableAgent.displayName,
            content: `Hello! I'm ${availableAgent.displayName} and I'll be helping you today. I see your message and will respond shortly.`,
            messageType: 'text'
          }
        })
      }
    }

    return NextResponse.json(message, { status: 201 })

  } catch (error) {
    console.error('Failed to send message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

// GET /api/support/chat/[chatId]/messages - Get chat messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params
    const session = await getServerSession()
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify access to chat
    const chat = await prisma.supportChat.findFirst({
      where: {
        id: chatId,
        OR: [
          { userId: session?.user?.id },
          { sessionId: sessionId }
        ]
      }
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    const messages = await prisma.supportMessage.findMany({
      where: {
        chatId: chat.id
      },
      select: {
        id: true,
        content: true,
        senderType: true,
        senderName: true,
        messageType: true,
        attachments: true,
        readByUser: true,
        readByAgent: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset
    })

    // Mark unread messages as read by user
    await prisma.supportMessage.updateMany({
      where: {
        chatId: chat.id,
        senderType: { not: 'user' },
        readByUser: false
      },
      data: {
        readByUser: true,
        readAt: new Date()
      }
    })

    return NextResponse.json({ messages })

  } catch (error) {
    console.error('Failed to get messages:', error)
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    )
  }
}