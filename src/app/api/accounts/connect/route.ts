import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { socialMediaManager } from '@/services/social-providers'
import { signAccountState } from '@/lib/security/oauth-state'
import { isDemoMode } from '@/lib/config/demo'
import { assertWithinLimit, LimitExceededError, limitExceededResponse } from '@/lib/billing/entitlements'

// Platforms gated until their own ADR-0009 completion phase (depth-first:
// Twitter/X + Meta first). Reported `unavailable` by /api/accounts/platforms
// and never fabricated here — not even in demo mode (honesty over coverage).
const GATED_PLATFORMS = new Set<string>(['linkedin', 'tiktok', 'youtube'])

// POST /api/accounts/connect - Initiate OAuth connection for a social platform
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()
    const { provider, workspaceId } = body

    if (!provider || !workspaceId) {
      return NextResponse.json({ 
        error: 'Provider and workspaceId are required' 
      }, { status: 400 })
    }

    // Verify user has access to workspace (ADR-0004)
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN', 'PUBLISHER'])

    // ADR-0019: plan entitlement gate — refuse to start a connection (demo or
    // real OAuth) once the workspace is at its socialAccounts limit, so we
    // never create an account row (line ~155) or send the user through OAuth
    // only to fail afterwards. 402 with an upgrade pointer, never a fake 200.
    try {
      await assertWithinLimit(workspaceId, 'socialAccounts')
    } catch (e) {
      if (e instanceof LimitExceededError) return limitExceededResponse(e)
      throw e
    }

    // Check if provider is supported and available
    const allProviders = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']

    if (!allProviders.includes(provider.toLowerCase())) {
      return NextResponse.json({
        error: `Provider ${provider} is not supported`
      }, { status: 400 })
    }

    // ADR-0009 Phase 0.3 — demo gating + availability tiers.
    const providerLc = provider.toLowerCase()
    const displayName = getPlatformDisplayName(providerLc)

    // Gated platforms (LinkedIn/TikTok/YouTube) are not on the real completion
    // path yet. We never fabricate them — not even in demo mode — so the honest
    // signal is a "coming soon" 503 rather than a fake connection.
    if (GATED_PLATFORMS.has(providerLc)) {
      return NextResponse.json({
        error: `${displayName} integration is not yet available. It is coming in a future release.`,
        code: 'PLATFORM_UNAVAILABLE',
      }, { status: 503 })
    }

    // Does this install have a real (env-configured) provider wired for this
    // platform? That is the only path that can complete a live OAuth handshake
    // today. (Workspace BYO `PlatformCredentials` become usable once the manager
    // factory lands in a later ADR-0009 phase; until then env creds are the
    // operative source that `getSupportedPlatforms()` reflects.)
    const supportedProviders = socialMediaManager.getSupportedPlatforms().map(p => p.toLowerCase())
    const hasRealProvider = supportedProviders.includes(providerLc)

    if (!hasRealProvider) {
      // No real credentials for this platform. Only fabricate a demo account
      // when demo mode is explicitly enabled (ADR-0025); otherwise fail with an
      // actionable configuration error instead of silently faking a connection.
      if (isDemoMode()) {
        console.log(`Demo mode enabled — creating flagged demo connection for ${providerLc}`)
        return await createDemoConnection(providerLc, workspaceId, userId)
      }

      return NextResponse.json({
        error: `${displayName} is not configured. Add credentials in Platform Settings or enable demo mode.`,
        code: 'PLATFORM_NOT_CONFIGURED',
      }, { status: 503 })
    }

    // Real credentials present → proceed to the real OAuth flow below.

    // Create OAuth URL
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/accounts/callback`
    // ADR-0006 Phase 2: bind the OAuth `state` to this session user + the
    // workspace we just authorized (requireWorkspaceRole above) with an
    // HMAC-signed, self-contained, 10-minute-expiry token. The callback
    // recovers and trusts workspaceId/userId ONLY from this verified token,
    // closing the workspace-binding forgery in the old bare-JSON state.
    const state = signAccountState({
      workspaceId,
      userId,
      provider: provider.toLowerCase(),
    })

    try {
      // ADR-0009: hand the SIGNED state to getAuthUrl so the provider embeds it
      // as the single `state` param (and, for Twitter/X, keys the PKCE verifier
      // by it). Do NOT append a second `state` here — the old double-state made
      // the callback's verifyAccountState() and PKCE-verifier lookup depend on
      // two different, conflicting values, so real OAuth failed either way.
      const authUrl = await socialMediaManager.getAuthUrl(
        provider.toLowerCase() as any,
        redirectUri,
        getDefaultScopes(provider.toLowerCase()),
        state
      )

      return NextResponse.json({
        success: true,
        authUrl,
        provider,
        redirectUri
      })
    } catch (error) {
      console.error(`Failed to generate ${provider} auth URL:`, error)
      return NextResponse.json({
        error: `Failed to generate ${provider} authentication URL`,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// Demo connection for development/testing
async function createDemoConnection(provider: string, workspaceId: string, userId: string) {
  try {
    // Generate demo account data
    const demoAccounts = {
      twitter: { handle: '@demotwitter', displayName: 'Demo Twitter Account', accountId: 'demo-twitter-123' },
      facebook: { handle: 'demofacebook', displayName: 'Demo Facebook Page', accountId: 'demo-facebook-456' },
      instagram: { handle: '@demoinstagram', displayName: 'Demo Instagram', accountId: 'demo-instagram-789' },
      linkedin: { handle: 'demolinkedin', displayName: 'Demo LinkedIn Company', accountId: 'demo-linkedin-101' },
      tiktok: { handle: '@demotiktok', displayName: 'Demo TikTok Account', accountId: 'demo-tiktok-202' },
      youtube: { handle: 'DemoYouTube', displayName: 'Demo YouTube Channel', accountId: 'demo-youtube-303' }
    }

    const accountData = demoAccounts[provider as keyof typeof demoAccounts]
    if (!accountData) {
      return NextResponse.json({ error: 'Invalid provider for demo' }, { status: 400 })
    }

    // Generate unique account ID for multiple demo accounts
    const timestamp = Date.now()
    const randomId = Math.floor(Math.random() * 1000)
    const uniqueAccountId = `${accountData.accountId}-${timestamp}-${randomId}`

    // Create demo social account
    const socialAccount = await prisma.socialAccount.create({
      data: {
        workspaceId,
        provider: provider.toUpperCase() as any,
        accountId: uniqueAccountId,
        displayName: `${accountData.displayName} #${randomId}`,
        handle: `${accountData.handle}-${randomId}`,
        accountType: 'BUSINESS',
        status: 'ACTIVE',
        scopes: getDefaultScopes(provider),
        metadata: {
          demoAccount: true,
          followers: Math.floor(Math.random() * 10000) + 1000,
          verified: Math.random() > 0.7,
          profilePicture: `https://via.placeholder.com/100x100/4F46E5/FFFFFF?text=${provider.charAt(0).toUpperCase()}`
        },
        tokenExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      }
    })

    return NextResponse.json({
      success: true,
      account: socialAccount,
      demo: true,
      message: `Demo ${provider} account connected successfully`
    })
  } catch (error) {
    console.error('Demo connection error:', error)
    return NextResponse.json({
      error: 'Failed to create demo connection'
    }, { status: 500 })
  }
}

function getDefaultScopes(provider: string): string[] {
  switch (provider) {
    case 'twitter':
      return ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
    case 'facebook':
      return ['pages_manage_posts', 'pages_read_engagement', 'publish_to_groups']
    case 'instagram':
      return ['instagram_basic', 'instagram_content_publish', 'pages_show_list']
    case 'linkedin':
      return ['r_liteprofile', 'w_member_social', 'r_basicprofile']
    case 'tiktok':
      return ['user.info.basic', 'video.publish', 'video.list']
    case 'youtube':
      return ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly']
    default:
      return []
  }
}

function getPlatformDisplayName(provider: string): string {
  const displayNames: Record<string, string> = {
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
  }
  return displayNames[provider.toLowerCase()] || provider
}