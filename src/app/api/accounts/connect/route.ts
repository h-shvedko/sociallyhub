import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'
import { socialMediaManager } from '@/services/social-providers'

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

    // Verify user has access to workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Check if provider is supported and available
    const allProviders = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']

    if (!allProviders.includes(provider.toLowerCase())) {
      return NextResponse.json({
        error: `Provider ${provider} is not supported`
      }, { status: 400 })
    }

    // Check if any real credentials are configured
    const hasTwitterCredentials = !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET)
    const hasFacebookCredentials = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)
    const hasInstagramCredentials = !!(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET)
    const hasLinkedInCredentials = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
    const hasTikTokCredentials = !!(process.env.TIKTOK_CLIENT_ID && process.env.TIKTOK_CLIENT_SECRET)
    const hasYouTubeCredentials = !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)

    const hasAnyCredentials = hasTwitterCredentials || hasFacebookCredentials || hasInstagramCredentials ||
                              hasLinkedInCredentials || hasTikTokCredentials || hasYouTubeCredentials

    // If no real credentials are configured, enable demo mode for all platforms
    if (!hasAnyCredentials) {
      console.log(`🚀 Creating demo connection for ${provider} - no real credentials configured`)
      return await createDemoConnection(provider.toLowerCase(), workspaceId, userId)
    }

    // If some credentials exist, check if this specific provider is supported
    const supportedProviders = socialMediaManager.getSupportedPlatforms().map(p => p.toLowerCase())

    if (!supportedProviders.includes(provider.toLowerCase())) {
      return NextResponse.json({
        error: `${provider} is not available - API credentials not configured`,
        code: 'PROVIDER_NOT_CONFIGURED',
        availablePlatforms: supportedProviders
      }, { status: 400 })
    }

    // Create OAuth URL
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/accounts/callback`
    const state = JSON.stringify({ 
      workspaceId, 
      userId, 
      provider: provider.toLowerCase() 
    })

    try {
      const authUrl = await socialMediaManager.getAuthUrl(
        provider.toLowerCase() as any,
        redirectUri,
        getDefaultScopes(provider.toLowerCase())
      )

      return NextResponse.json({
        success: true,
        authUrl: `${authUrl}&state=${encodeURIComponent(state)}`,
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
    console.error('Connection initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    )
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