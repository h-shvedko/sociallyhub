import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { socialMediaManager } from '@/services/social-providers'

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

    let stateData
    try {
      stateData = JSON.parse(decodeURIComponent(state))
    } catch (e) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=invalid_state`
      )
    }

    const { workspaceId, userId, provider } = stateData

    if (!workspaceId || !userId || !provider) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=invalid_state_data`
      )
    }

    try {
      // Exchange authorization code for access token
      const redirectUri = `${process.env.NEXTAUTH_URL}/api/accounts/callback`
      const tokenResult = await socialMediaManager.exchangeCodeForToken(
        provider,
        code,
        redirectUri
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
          provider: provider.toUpperCase(),
          accountId: profile.id,
          workspaceId
        }
      })

      if (existingAccount) {
        // Update existing account with new tokens
        await prisma.socialAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: accountData.accessToken,
            refreshToken: accountData.refreshToken,
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
        // Create new account
        await prisma.socialAccount.create({
          data: {
            workspaceId,
            provider: provider.toUpperCase(),
            accountId: profile.id,
            accountType: profile.accountType || 'profile',
            displayName: profile.displayName || profile.username,
            handle: profile.username,
            accessToken: accountData.accessToken,
            refreshToken: accountData.refreshToken,
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