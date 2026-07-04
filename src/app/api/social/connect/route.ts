import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { socialMediaManager } from '@/services/social-providers'
import { withLogging } from '@/lib/middleware/logging'
import { SecurityLogger, ErrorLogger } from '@/lib/middleware/logging'
import { signState, verifyState } from '@/lib/security/oauth-state'

async function handleConnect(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/connect', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const redirectUri = searchParams.get('redirectUri')

    if (!platform || !redirectUri) {
      return NextResponse.json(
        { error: 'Platform and redirectUri are required' },
        { status: 400 }
      )
    }

    // Validate platform is supported
    const supportedPlatforms = socialMediaManager.getSupportedPlatforms()
    if (!supportedPlatforms.includes(platform as any)) {
      return NextResponse.json(
        { error: `Platform ${platform} is not supported. Supported platforms: ${supportedPlatforms.join(', ')}` },
        { status: 400 }
      )
    }

    try {
      // ADR-0005 item 4 / ADR-0009: bind the OAuth `state` to this session +
      // platform FIRST, then hand it to getAuthUrl so the provider embeds it as
      // the single `state` param (and, for Twitter/X, keys the PKCE verifier by
      // it). Previously the provider minted its own state, keyed the PKCE
      // verifier by that value, and we overwrote the URL's `state` afterwards —
      // so the verifier was keyed by a discarded state and token exchange could
      // never find it. One signed state now serves both needs.
      const signedState = signState({
        userId: session.user.id,
        provider: platform,
      })

      const authUrl = await socialMediaManager.getAuthUrl(
        platform as any,
        redirectUri,
        getDefaultScopes(platform),
        signedState
      )

      return NextResponse.json({
        success: true,
        data: {
          authUrl,
          platform,
          redirectUri,
          // Also returned explicitly for clients that track state themselves;
          // this is the value the callback POST must return.
          state: signedState
        }
      })
    } catch (error) {
      ErrorLogger.logExternalServiceError(
        platform,
        error as Error,
        { userId: session.user.id, operation: 'get_auth_url' }
      )

      return NextResponse.json(
        { 
          error: 'Failed to generate authentication URL',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/connect',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleCallback(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/social/connect', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { platform, code, redirectUri, state } = body

    if (!platform || !code || !redirectUri) {
      return NextResponse.json(
        { error: 'Platform, code, and redirectUri are required' },
        { status: 400 }
      )
    }

    // ADR-0005 item 4: verify the signed OAuth `state` — bound to this session
    // user + platform — BEFORE any token exchange. Fail closed on any invalid,
    // tampered, expired, or mismatched-identity state (OAuth CSRF defense).
    const stateCheck = verifyState(state, {
      userId: session.user.id,
      provider: platform,
    })
    if (!stateCheck.valid) {
      SecurityLogger.logUnauthorizedAccess(
        session.user.id,
        '/api/social/connect',
        request.headers.get('x-forwarded-for') || undefined
      )

      // Never leak the specific failure reason (missing/expired/mismatch) —
      // it aids CSRF probing. A single opaque code is returned.
      return NextResponse.json(
        { error: 'Invalid OAuth state', code: 'INVALID_STATE' },
        { status: 400 }
      )
    }

    try {
      // ADR-0009: pass the verified signed `state` so PKCE providers (Twitter/X)
      // can recover the code_verifier stored keyed by it.
      const result = await socialMediaManager.exchangeCodeForToken(
        platform,
        code,
        redirectUri,
        state
      )

      if (!result.success || !result.data) {
        ErrorLogger.logExternalServiceError(
          platform,
          new Error(result.error?.message || 'Token exchange failed'),
          { userId: session.user.id, operation: 'exchange_code_for_token' }
        )

        return NextResponse.json({
          success: false,
          error: result.error?.message || 'Failed to connect account'
        }, { status: 400 })
      }

      // TODO: Store the account in the database
      // For now, we'll just return the account info
      
      return NextResponse.json({
        success: true,
        data: {
          account: {
            id: result.data.id,
            platform: result.data.platform,
            username: result.data.username,
            displayName: result.data.displayName,
            avatar: result.data.avatar,
            isConnected: result.data.isConnected
          }
        }
      })
    } catch (error) {
      ErrorLogger.logExternalServiceError(
        platform,
        error as Error,
        { userId: session.user.id, operation: 'exchange_code_for_token' }
      )

      return NextResponse.json(
        { 
          error: 'Failed to connect account',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/social/connect',
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getDefaultScopes(platform: string): string[] {
  switch (platform) {
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

// Export wrapped handlers
export const GET = withLogging(handleConnect, 'social-connect')
export const POST = withLogging(handleCallback, 'social-callback')