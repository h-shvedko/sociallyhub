import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { socialMediaManager } from '@/services/social-providers/social-media-manager'
import { SocialAccount as ProviderSocialAccount, Platform } from '@/services/social-providers/types'
import { decryptToken } from '@/lib/encryption'
import { withLogging } from '@/lib/middleware/logging'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
      if (isPrivateNote) {
        // Add private note to internal notes (no external API call).
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

        return NextResponse.json({
          success: true,
          reply: null,
          isPrivateNote: true,
          message: 'Private note added successfully'
        })
      }

      // --- Public reply: send through the social provider (ADR-0009) ---
      const dbAccount = inboxItem.socialAccount

      // DB stores the provider as an uppercase SocialProvider enum; the provider
      // registry is keyed by the lowercase Platform string.
      const platform = String(dbAccount.provider).toLowerCase() as Platform

      // Resolve the provider. getProvider throws when no credentials are
      // configured for this platform — surface that honestly, never fake a send.
      let provider
      try {
        provider = socialMediaManager.getProvider(platform)
      } catch {
        return NextResponse.json({
          success: false,
          error: `No ${platform} provider is configured on this server. Configure the platform credentials to enable replies.`
        }, { status: 503 })
      }

      // Tokens are stored encrypted (enc:v1, ADR-0006); decrypt before use.
      const accessToken = decryptToken(dbAccount.accessToken)
      if (!accessToken) {
        return NextResponse.json({
          success: false,
          error: 'The connected account has no usable access token. Reconnect the account and try again.'
        }, { status: 409 })
      }

      const providerAccount: ProviderSocialAccount = {
        id: dbAccount.id,
        platform,
        platformId: dbAccount.accountId,
        username: dbAccount.handle,
        displayName: dbAccount.displayName,
        accessToken,
        refreshToken: decryptToken(dbAccount.refreshToken) ?? undefined,
        expiresAt: dbAccount.tokenExpiry ?? undefined,
        isConnected: dbAccount.status === 'ACTIVE',
        permissions: dbAccount.scopes ?? [],
        metadata: (dbAccount.metadata as unknown as Record<string, unknown>) ?? undefined
      }

      const replyResult = await provider.replyToItem(
        providerAccount,
        {
          providerItemId: inboxItem.providerItemId,
          providerThreadId: inboxItem.providerThreadId,
          type: inboxItem.type
        },
        message.trim()
      )

      if (!replyResult.success) {
        // Honest failure: do NOT close the item, do NOT report success.
        return NextResponse.json({
          success: false,
          error: replyResult.error?.message || 'Failed to send reply',
          code: replyResult.error?.code
        }, { status: 502 })
      }

      // Only mark the item closed once the reply actually landed.
      await prisma.inboxItem.update({
        where: { id: params.id },
        data: {
          status: 'CLOSED',
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        reply: replyResult.data,
        isPrivateNote: false,
        message: 'Reply sent successfully'
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
