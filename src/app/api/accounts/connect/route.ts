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
    const supportedProviders = socialMediaManager.getSupportedPlatforms().map(p => p.toLowerCase())
    const allProviders = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']
    
    if (!allProviders.includes(provider.toLowerCase())) {
      return NextResponse.json({ 
        error: `Provider ${provider} is not supported` 
      }, { status: 400 })
    }

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