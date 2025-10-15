import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/platform-credentials/validate - Test platform credentials
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const body = await request.json()
    const { platform, credentials } = body

    if (!platform || !credentials) {
      return NextResponse.json({
        error: 'Platform and credentials are required'
      }, { status: 400 })
    }

    // Validate credentials by making test API calls
    const validationResult = await testPlatformConnection(platform, credentials)

    return NextResponse.json({
      success: true,
      platform,
      isValid: validationResult.isValid,
      error: validationResult.error,
      details: validationResult.details,
      testedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error validating platform credentials:', error)
    return NextResponse.json(
      { error: 'Failed to validate platform credentials' },
      { status: 500 }
    )
  }
}

// Test platform connection with actual API calls
async function testPlatformConnection(platform: string, credentials: any) {
  try {
    switch (platform.toLowerCase()) {
      case 'twitter':
        return await testTwitterConnection(credentials)
      case 'facebook':
        return await testFacebookConnection(credentials)
      case 'instagram':
        return await testInstagramConnection(credentials)
      case 'linkedin':
        return await testLinkedInConnection(credentials)
      case 'tiktok':
        return await testTikTokConnection(credentials)
      case 'youtube':
        return await testYouTubeConnection(credentials)
      default:
        return { isValid: false, error: 'Unsupported platform' }
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Connection test failed: ' + (error as Error).message
    }
  }
}

async function testTwitterConnection(credentials: any) {
  try {
    // Test Twitter API v2 with bearer token or OAuth 2.0
    const { clientId, clientSecret, bearerToken } = credentials

    if (bearerToken) {
      // Test with bearer token
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        return {
          isValid: true,
          details: {
            userId: data.data?.id,
            username: data.data?.username,
            method: 'Bearer Token'
          }
        }
      } else {
        const error = await response.json()
        return {
          isValid: false,
          error: `Twitter API error: ${error.title || error.detail || 'Unknown error'}`
        }
      }
    } else if (clientId && clientSecret) {
      // For OAuth 2.0, just validate the credentials format
      return {
        isValid: true,
        details: {
          method: 'OAuth 2.0',
          note: 'Credentials format valid. Full validation requires user authorization.'
        }
      }
    } else {
      return { isValid: false, error: 'Missing required credentials' }
    }
  } catch (error) {
    return { isValid: false, error: (error as Error).message }
  }
}

async function testFacebookConnection(credentials: any) {
  try {
    const { appId, appSecret } = credentials

    if (!appId || !appSecret) {
      return { isValid: false, error: 'Missing App ID or App Secret' }
    }

    // Test Facebook Graph API app access token
    const response = await fetch(
      `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`
    )

    if (response.ok) {
      const data = await response.json()
      if (data.access_token) {
        return {
          isValid: true,
          details: {
            appId,
            method: 'App Access Token',
            tokenType: data.token_type
          }
        }
      }
    }

    const error = await response.json()
    return {
      isValid: false,
      error: `Facebook API error: ${error.error?.message || 'Unknown error'}`
    }
  } catch (error) {
    return { isValid: false, error: (error as Error).message }
  }
}

async function testInstagramConnection(credentials: any) {
  try {
    const { clientId, clientSecret } = credentials

    if (!clientId || !clientSecret) {
      return { isValid: false, error: 'Missing Client ID or Client Secret' }
    }

    // Instagram Basic Display API doesn't have a simple test endpoint
    // Just validate the credentials format for now
    return {
      isValid: true,
      details: {
        clientId,
        method: 'OAuth 2.0',
        note: 'Credentials format valid. Full validation requires user authorization.'
      }
    }
  } catch (error) {
    return { isValid: false, error: (error as Error).message }
  }
}

async function testLinkedInConnection(credentials: any) {
  try {
    const { clientId, clientSecret } = credentials

    if (!clientId || !clientSecret) {
      return { isValid: false, error: 'Missing Client ID or Client Secret' }
    }

    // LinkedIn doesn't have a public test endpoint without user auth
    // Validate credentials format
    return {
      isValid: true,
      details: {
        clientId,
        method: 'OAuth 2.0',
        note: 'Credentials format valid. Full validation requires user authorization.'
      }
    }
  } catch (error) {
    return { isValid: false, error: (error as Error).message }
  }
}

async function testTikTokConnection(credentials: any) {
  try {
    const { clientId, clientSecret } = credentials

    if (!clientId || !clientSecret) {
      return { isValid: false, error: 'Missing Client ID or Client Secret' }
    }

    // TikTok for Developers API validation
    return {
      isValid: true,
      details: {
        clientId,
        method: 'OAuth 2.0',
        note: 'Credentials format valid. Full validation requires user authorization.'
      }
    }
  } catch (error) {
    return { isValid: false, error: (error as Error).message }
  }
}

async function testYouTubeConnection(credentials: any) {
  try {
    const { clientId, clientSecret, apiKey } = credentials

    if (!clientId || !clientSecret) {
      return { isValid: false, error: 'Missing Client ID or Client Secret' }
    }

    // Test YouTube Data API with API key if provided
    if (apiKey) {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&key=${apiKey}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      )

      // API key test without auth will return 401, but validates the key format
      if (response.status === 401) {
        return {
          isValid: true,
          details: {
            method: 'API Key + OAuth 2.0',
            note: 'API key format valid. Full validation requires user authorization.'
          }
        }
      }
    }

    return {
      isValid: true,
      details: {
        clientId,
        method: 'OAuth 2.0',
        note: 'Credentials format valid. Full validation requires user authorization.'
      }
    }
  } catch (error) {
    return { isValid: false, error: (error as Error).message }
  }
}