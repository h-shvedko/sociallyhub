import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { socialMediaManager } from '@/services/social-providers'

// POST /api/accounts/[id]/refresh - Refresh account token
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
    const { id: accountId } = await params

    // Get user's workspace access
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get the account
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Fast-path: no refresh token stored → nothing to refresh with.
    // (refreshAccount also enforces this; the early check avoids extra work and
    // preserves the existing response.)
    if (!account.refreshToken) {
      return NextResponse.json({
        error: 'No refresh token available. Please reconnect the account.',
        code: 'NO_REFRESH_TOKEN',
        needsReconnection: true
      }, { status: 400 })
    }

    // Refresh via the DB-backed manager: it loads the account, decrypts the
    // current tokens, resolves the workspace's provider credentials
    // (PlatformCredentials → env), calls the provider's real refresh, and
    // persists the ROTATED tokens ENCRYPTED (ADR-0006/0009). It returns an
    // honest APIResponse — never a fabricated success.
    const refreshResult = await socialMediaManager.refreshAccount(accountId)

    if (!refreshResult.success) {
      const code = refreshResult.error?.code
      const message =
        refreshResult.error?.message ||
        'Failed to refresh token. Please reconnect the account.'

      // Configuration/capability failures are NOT expired-token situations and
      // must not surface as an opaque 500 — report the actionable reason.
      if (code === 'PROVIDER_NOT_CONFIGURED') {
        return NextResponse.json(
          { error: message, code, needsReconnection: false },
          { status: 400 }
        )
      }
      if (code === 'PROVIDER_NOT_SUPPORTED' || code === 'REFRESH_NOT_SUPPORTED') {
        return NextResponse.json(
          { error: message, code, needsReconnection: true },
          { status: 400 }
        )
      }

      // Real token failures (no/blocked refresh token, decrypt failure, provider
      // refused): flag the account so the UI prompts a reconnect.
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { status: 'TOKEN_EXPIRED', updatedAt: new Date() }
      })

      return NextResponse.json(
        { error: message, code, needsReconnection: true },
        { status: 400 }
      )
    }

    // Success: refreshAccount already persisted the rotated (encrypted) tokens,
    // tokenExpiry and status=ACTIVE. Return the sanitized account.
    const updatedAccount = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: { client: { select: { id: true, name: true } } }
    })

    console.log(`🔄 Refreshed token for ${account.displayName} (${account.provider})`)

    return NextResponse.json({
      success: true,
      account: updatedAccount
        ? {
            ...updatedAccount,
            // Don't expose sensitive token data
            accessToken: undefined,
            refreshToken: undefined
          }
        : undefined
    })
  } catch (error) {
    console.error('Account refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh account' },
      { status: 500 }
    )
  }
}