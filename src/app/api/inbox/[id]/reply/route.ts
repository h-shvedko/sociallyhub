import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { socialMediaManager } from '@/services/social-providers/social-media-manager'
import { withLogging } from '@/lib/middleware/logging'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, isPrivateNote = false } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get inbox item with social account details
    const inboxItem = await prisma.inboxItem.findUnique({
      where: { id: params.id },
      include: {
        socialAccount: true,
        conversation: true
      }
    })

    if (!inboxItem) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 })
    }

    try {
      let replyResult = null

      if (!isPrivateNote) {
        // Send reply through social media API
        const provider = socialMediaManager.getProvider(inboxItem.socialAccount.provider)
        
        if (provider) {
          replyResult = await provider.reply({
            accountId: inboxItem.socialAccount.accountId,
            originalItemId: inboxItem.providerItemId,
            threadId: inboxItem.providerThreadId,
            message: message.trim(),
            accessToken: inboxItem.socialAccount.accessToken
          })
        }

        // Update inbox item status to closed if reply was successful
        if (replyResult?.success) {
          await prisma.inboxItem.update({
            where: { id: params.id },
            data: {
              status: 'CLOSED',
              updatedAt: new Date()
            }
          })
        }
      } else {
        // Add private note to internal notes
        const existingNotes = inboxItem.internalNotes || ''
        const timestamp = new Date().toISOString()
        const userName = session.user.name || session.user.email
        const newNote = `[${timestamp}] ${userName}: ${message.trim()}`
        const updatedNotes = existingNotes 
          ? `${existingNotes}\n${newNote}` 
          : newNote

        await prisma.inboxItem.update({
          where: { id: params.id },
          data: {
            internalNotes: updatedNotes,
            updatedAt: new Date()
          }
        })
      }

      return NextResponse.json({
        success: true,
        reply: replyResult,
        isPrivateNote,
        message: isPrivateNote ? 'Private note added successfully' : 'Reply sent successfully'
      })

    } catch (error) {
      console.error('Reply error:', error)
      return NextResponse.json({
        error: 'Failed to send reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }, 'inbox-reply')(request)
}