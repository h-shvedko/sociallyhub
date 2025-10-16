import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

interface RouteParams {
  params: Promise<{ chatId: string }>
}

// GET /api/support/chat/[chatId] - Get specific chat
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params
    const session = await getServerSession()
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
            displayName: true,
            title: true,
            isOnline: true,
            statusMessage: true,
            user: {
              select: {
                image: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' },
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
      }
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    // Mark messages as read by user
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

    return NextResponse.json(chat)

  } catch (error) {
    console.error('Failed to get chat:', error)
    return NextResponse.json(
      { error: 'Failed to get chat' },
      { status: 500 }
    )
  }
}

// PUT /api/support/chat/[chatId] - Update chat (close, rate, etc.)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params
    const session = await getServerSession()
    const body = await request.json()
    const { action, rating, feedback } = body

    // Verify access to chat
    const chat = await prisma.supportChat.findFirst({
      where: {
        id: chatId,
        userId: session?.user?.id
      }
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    let updateData: any = {}

    switch (action) {
      case 'close':
        updateData = {
          status: 'closed',
          closedAt: new Date()
        }
        break

      case 'rate':
        if (rating >= 1 && rating <= 5) {
          updateData = {
            rating,
            feedback: feedback || null
          }
        } else {
          return NextResponse.json(
            { error: 'Rating must be between 1 and 5' },
            { status: 400 }
          )
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    const updatedChat = await prisma.supportChat.update({
      where: { id: chatId },
      data: updateData
    })

    // If closing chat, update agent's current chat count
    if (action === 'close' && chat.assignedAgentId) {
      await prisma.supportAgent.update({
        where: { id: chat.assignedAgentId },
        data: {
          currentChatCount: { decrement: 1 }
        }
      })

      // Add system message about chat closure
      await prisma.supportMessage.create({
        data: {
          chatId: chat.id,
          senderType: 'system',
          senderName: 'SociallyHub Support',
          content: 'This chat has been closed. Thank you for contacting us!',
          messageType: 'system'
        }
      })
    }

    return NextResponse.json(updatedChat)

  } catch (error) {
    console.error('Failed to update chat:', error)
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    )
  }
}