import { NextRequest, NextResponse } from 'next/server'
import type { SocialProvider } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { socialMediaManager, type Platform } from '@/services/social-providers'
import { verifyAccountState } from '@/lib/security/oauth-state'
import { encryptToken } from '@/lib/encryption'

// GET /api/accounts/callback - Handle OAuth callback from social platforms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=oauth_error&details=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=missing_params`
      )
    }

    // ADR-0006 Phase 2: verify the HMAC-signed `state` BEFORE trusting anything
    // in it. Fail closed on any missing / malformed / tampered / expired token —
    // this closes the workspace-binding forgery of the old bare-JSON state
    // (anyone could rewrite workspaceId to bind the account + tokens to a foreign
    // workspace). Only after verification do we trust workspaceId/userId.
    const stateCheck = verifyAccountState(state)
    if (!stateCheck.valid || !stateCheck.payload) {
      // Never leak the specific failure reason (missing/expired/mismatch) —
      // it aids CSRF/forgery probing.
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=invalid_state`
      )
    }

    const { workspaceId, userId } = stateCheck.payload
    // ADR-0006 Phase 2 made the verified state payload strongly typed, so
    // `provider` arrives as `string` (was `any` under the old JSON.parse). It is
    // a lowercase platform slug (e.g. "twitter") minted by the connect route.
    // Cast it once here, at the trusted-payload boundary, to the SDK's lowercase
    // `Platform` union; the two Prisma write sites additionally uppercase it to
    // the `SocialProvider` enum. (The remaining `scope`/`accountType`/
    // `followerCount` type errors in this file are pre-existing ADR-0009 schema
    // divergences, not introduced here.)
    const provider = stateCheck.payload.provider as Platform

    try {
      // Exchange authorization code for access token.
      // ADR-0009: pass the same signed `state` we just verified so PKCE
      // providers (Twitter/X) can recover the code_verifier stored keyed by it.
      // This is the SINGLE state that round-tripped — no longer split from the
      // PKCE key by a second appended state.
      const redirectUri = `${process.env.NEXTAUTH_URL}/api/accounts/callback`
      const tokenResult = await socialMediaManager.exchangeCodeForToken(
        provider,
        code,
        redirectUri,
        state
      )

      if (!tokenResult.success || !tokenResult.data) {
        console.error('Token exchange failed:', tokenResult.error)
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=token_exchange_failed`
        )
      }

      const accountData = tokenResult.data

      // Get user profile information
      const profileResult = await socialMediaManager.getUserProfile(
        provider,
        accountData.accessToken
      )

      if (!profileResult.success || !profileResult.data) {
        console.error('Failed to get user profile:', profileResult.error)
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=profile_fetch_failed`
        )
      }

      const profile = profileResult.data

      // Check if this account is already connected
      const existingAccount = await prisma.socialAccount.findFirst({
        where: {
          provider: provider.toUpperCase() as SocialProvider,
          accountId: profile.id,
          workspaceId
        }
      })

      if (existingAccount) {
        // Update existing account with new tokens.
        // ADR-0006 Phase 3: encrypt at rest (enc:v1 AES-256-GCM) before writing.
        // refreshToken is optional — only encrypt when a value is present so a
        // null/undefined is stored as-is rather than encrypting an empty value.
        await prisma.socialAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: encryptToken(accountData.accessToken),
            refreshToken: accountData.refreshToken
              ? encryptToken(accountData.refreshToken)
              : accountData.refreshToken,
            tokenExpiry: accountData.expiresAt ? new Date(accountData.expiresAt) : null,
            scopes: accountData.scope ? accountData.scope.split(' ') : [],
            status: 'ACTIVE',
            displayName: profile.displayName || profile.username,
            handle: profile.username,
            metadata: {
              avatar: profile.avatar,
              followerCount: profile.followerCount,
              updatedAt: new Date().toISOString()
            },
            updatedAt: new Date()
          }
        })

        console.log(`🔄 Updated existing ${provider} account: ${profile.displayName}`)
      } else {
        // Create new account.
        // ADR-0006 Phase 3: encrypt at rest (enc:v1 AES-256-GCM) before writing.
        // refreshToken is optional — only encrypt when a value is present.
        await prisma.socialAccount.create({
          data: {
            workspaceId,
            provider: provider.toUpperCase() as SocialProvider,
            accountId: profile.id,
            accountType: profile.accountType || 'profile',
            displayName: profile.displayName || profile.username,
            handle: profile.username,
            accessToken: encryptToken(accountData.accessToken),
            refreshToken: accountData.refreshToken
              ? encryptToken(accountData.refreshToken)
              : accountData.refreshToken,
            tokenExpiry: accountData.expiresAt ? new Date(accountData.expiresAt) : null,
            scopes: accountData.scope ? accountData.scope.split(' ') : [],
            status: 'ACTIVE',
            metadata: {
              avatar: profile.avatar,
              followerCount: profile.followerCount,
              connectedAt: new Date().toISOString()
            }
          }
        })

        console.log(`✅ Connected new ${provider} account: ${profile.displayName}`)
      }

      // Redirect back to accounts page with success message
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?success=account_connected&provider=${provider}`
      )

    } catch (error) {
      console.error('Account connection error:', error)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=connection_failed&details=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
      )
    }

  } catch (error) {
    console.error('Callback processing error:', error)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=callback_error`
    )
  }
}