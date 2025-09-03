import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import nodemailer from 'nodemailer'

// Email transporter setup (using environment variables)
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false, // true for 465, false for other ports
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined,
    // For development with Mailhog
    ignoreTLS: process.env.NODE_ENV === 'development'
  })
}

async function getMessagesHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await params
    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get messages for this client (from InboxItem table)
    const messages = await prisma.inboxItem.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        tags: {
          has: `client-${clientId}`
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    return NextResponse.json({
      messages: messages.map(msg => {
        const notes = JSON.parse(msg.internalNotes || '{}')
        return {
          id: msg.id,
          type: msg.type,
          subject: notes.subject || 'No subject',
          content: msg.content,
          status: msg.status,
          priority: notes.priority || 'normal',
          createdAt: msg.createdAt,
          scheduledAt: notes.scheduledAt || null
        }
      })
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sendMessageHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await params
    const body = await req.json()
    const { 
      type, 
      subject, 
      content, 
      priority, 
      schedule, 
      scheduledDate, 
      scheduledTime 
    } = body

    if (!type || !content) {
      return NextResponse.json({ 
        error: 'Missing required fields: type, content' 
      }, { status: 400 })
    }

    if (type === 'email' && !subject) {
      return NextResponse.json({ 
        error: 'Subject is required for email messages' 
      }, { status: 400 })
    }

    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace and user info
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get client information
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Validate contact information
    if (type === 'email' && !client.email) {
      return NextResponse.json({ 
        error: 'Client has no email address on file' 
      }, { status: 400 })
    }

    if (type === 'sms' && !client.phone) {
      return NextResponse.json({ 
        error: 'Client has no phone number on file' 
      }, { status: 400 })
    }

    // Create scheduled date if scheduling is enabled
    let scheduledAt = null
    if (schedule && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`)
    }

    // For client messages, we'll create a system inbox item with a dummy social account
    // First, let's get or create a system social account for client messages
    let systemAccount = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: userWorkspace.workspaceId,
        provider: 'SYSTEM',
        handle: 'client-messages'
      }
    })

    if (!systemAccount) {
      systemAccount = await prisma.socialAccount.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          provider: 'SYSTEM',
          accountType: 'system',
          handle: 'client-messages',
          displayName: 'Client Messages System',
          accountId: 'system-client-messages',
          accessToken: 'system',
          scopes: [],
          status: 'ACTIVE'
        }
      })
    }

    // Store message in database first
    const messageRecord = await prisma.inboxItem.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        socialAccountId: systemAccount.id,
        type: 'DIRECT_MESSAGE', // All client messages are direct messages
        providerItemId: `client-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: content,
        authorName: client.name,
        authorHandle: client.email || client.phone || 'no-handle',
        status: schedule ? 'SNOOZED' : 'OPEN', // Use SNOOZED for scheduled messages
        tags: [type, 'client-message', `client-${clientId}`],
        internalNotes: JSON.stringify({
          clientId: clientId,
          clientName: client.name,
          subject: subject || null,
          messageType: type,
          priority: priority || 'normal',
          scheduledAt: scheduledAt?.toISOString() || null,
          sentBy: userWorkspace.user.name,
          sentById: userId
        })
      }
    })

    let deliveryResult = { success: true, messageId: messageRecord.id }

    // Send message immediately if not scheduled
    if (!schedule) {
      try {
        if (type === 'email') {
          // Send email using nodemailer
          const transporter = createEmailTransporter()
          
          const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@sociallyhub.dev',
            to: client.email,
            subject: subject,
            text: content,
            html: content.replace(/\n/g, '<br>'),
            headers: {
              'X-Client-ID': clientId,
              'X-Message-ID': messageRecord.id,
              'X-Priority': priority === 'urgent' ? 'high' : priority === 'high' ? 'high' : 'normal'
            }
          }

          const info = await transporter.sendMail(mailOptions)
          console.log('✅ Email sent successfully:', info.messageId)
          
          deliveryResult = {
            success: true,
            messageId: messageRecord.id,
            emailMessageId: info.messageId,
            deliveryInfo: 'Email sent successfully'
          }

        } else if (type === 'sms') {
          // SMS sending would go here (Twilio, AWS SNS, etc.)
          // For now, we'll simulate SMS sending
          console.log('📱 SMS would be sent to:', client.phone, 'Content:', content)
          
          deliveryResult = {
            success: true,
            messageId: messageRecord.id,
            deliveryInfo: 'SMS queued for delivery (simulation mode)'
          }
        }

        // Update message status to DELIVERED
        await prisma.inboxItem.update({
          where: { id: messageRecord.id },
          data: { 
            status: 'CLOSED',
            internalNotes: JSON.stringify({
              ...JSON.parse(messageRecord.internalNotes || '{}'),
              deliveryInfo: deliveryResult.deliveryInfo,
              deliveredAt: new Date().toISOString()
            })
          }
        })

      } catch (deliveryError) {
        console.error('Error sending message:', deliveryError)
        
        // Update message status to FAILED
        await prisma.inboxItem.update({
          where: { id: messageRecord.id },
          data: { 
            status: 'OPEN', // Keep open to allow retry
            internalNotes: JSON.stringify({
              ...JSON.parse(messageRecord.internalNotes || '{}'),
              errorMessage: deliveryError instanceof Error ? deliveryError.message : 'Unknown error',
              failedAt: new Date().toISOString()
            })
          }
        })

        return NextResponse.json({ 
          error: 'Failed to send message',
          details: deliveryError instanceof Error ? deliveryError.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    console.log('✅ Message processed successfully:', {
      type,
      clientName: client.name,
      scheduled: schedule,
      messageId: messageRecord.id
    })

    return NextResponse.json({
      success: true,
      message: schedule ? 'Message scheduled successfully' : 'Message sent successfully',
      messageId: messageRecord.id,
      clientName: client.name,
      scheduled: schedule,
      scheduledAt: scheduledAt,
      deliveryResult: deliveryResult
    })
  } catch (error) {
    console.error('Error processing message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getMessagesHandler, 'client-messages-get')
export const POST = withLogging(sendMessageHandler, 'client-messages-send')