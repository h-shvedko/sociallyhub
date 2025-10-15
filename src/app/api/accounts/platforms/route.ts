import { NextRequest, NextResponse } from 'next/server'
import { socialMediaManager } from '@/services/social-providers'

// GET /api/accounts/platforms - Get list of supported platforms
export async function GET(request: NextRequest) {
  try {
    // Always enable demo mode for development - check if any real credentials exist
    const hasTwitterCredentials = !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET)
    const hasFacebookCredentials = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)
    const hasInstagramCredentials = !!(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET)
    const hasLinkedInCredentials = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
    const hasTikTokCredentials = !!(process.env.TIKTOK_CLIENT_ID && process.env.TIKTOK_CLIENT_SECRET)
    const hasYouTubeCredentials = !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)

    const hasAnyCredentials = hasTwitterCredentials || hasFacebookCredentials || hasInstagramCredentials ||
                              hasLinkedInCredentials || hasTikTokCredentials || hasYouTubeCredentials

    const allPlatforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube']

    // If no real credentials are configured, enable demo mode for all platforms
    if (!hasAnyCredentials) {
      console.log('🚀 No social media credentials found - enabling demo mode for all platforms')
      const demoPlatforms = allPlatforms.map(platform => ({
        id: platform,
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        displayName: getPlatformDisplayName(platform.toUpperCase()),
        icon: getPlatformIcon(platform.toUpperCase()),
        color: getPlatformColor(platform.toUpperCase()),
        available: true,
        reason: 'Demo mode - simulated connections'
      }))

      return NextResponse.json({
        supported: demoPlatforms,
        unavailable: [],
        total: demoPlatforms.length,
        message: `${demoPlatforms.length} social media platforms available in demo mode.`
      })
    }

    // If some credentials exist, use the real social media manager
    const supportedPlatforms = socialMediaManager.getSupportedPlatforms()

    // Map platform names to display information
    const platformInfo = supportedPlatforms.map(platform => ({
      id: platform.toLowerCase(),
      name: platform.charAt(0) + platform.slice(1).toLowerCase(),
      displayName: getPlatformDisplayName(platform),
      icon: getPlatformIcon(platform),
      color: getPlatformColor(platform),
      available: true
    }))

    // Add unavailable platforms with reasons
    const unavailablePlatforms = allPlatforms
      .filter(platform => !supportedPlatforms.includes(platform as any))
      .map(platform => ({
        id: platform,
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        displayName: getPlatformDisplayName(platform.toUpperCase()),
        icon: getPlatformIcon(platform.toUpperCase()),
        color: getPlatformColor(platform.toUpperCase()),
        available: false,
        reason: 'API credentials not configured'
      }))

    return NextResponse.json({
      supported: platformInfo,
      unavailable: unavailablePlatforms,
      total: platformInfo.length,
      message: platformInfo.length === 0 
        ? 'No social media platforms are configured. Please add API credentials to enable connections.'
        : `${platformInfo.length} social media platform${platformInfo.length === 1 ? '' : 's'} available for connection.`
    })
  } catch (error) {
    console.error('Error getting platform info:', error)
    return NextResponse.json(
      { error: 'Failed to get platform information' },
      { status: 500 }
    )
  }
}

function getPlatformDisplayName(platform: string): string {
  const displayNames: Record<string, string> = {
    'TWITTER': 'Twitter/X',
    'FACEBOOK': 'Facebook',
    'INSTAGRAM': 'Instagram', 
    'LINKEDIN': 'LinkedIn',
    'TIKTOK': 'TikTok',
    'YOUTUBE': 'YouTube'
  }
  return displayNames[platform.toUpperCase()] || platform
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    'TWITTER': '𝕏',
    'FACEBOOK': '󠁦',
    'INSTAGRAM': '📷',
    'LINKEDIN': '💼',
    'TIKTOK': '🎵',
    'YOUTUBE': '📺'
  }
  return icons[platform.toUpperCase()] || '📱'
}

function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    'TWITTER': 'bg-black text-white',
    'FACEBOOK': 'bg-blue-600 text-white',
    'INSTAGRAM': 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    'LINKEDIN': 'bg-blue-700 text-white',
    'TIKTOK': 'bg-black text-white',
    'YOUTUBE': 'bg-red-600 text-white'
  }
  return colors[platform.toUpperCase()] || 'bg-gray-600 text-white'
}