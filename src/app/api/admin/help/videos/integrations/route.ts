import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth-utils'

// YouTube API integration
async function importFromYouTube(videoUrl: string, apiKey?: string) {
  try {
    // Extract video ID from YouTube URL
    const videoIdMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    if (!videoIdMatch) {
      throw new Error('Invalid YouTube URL')
    }

    const videoId = videoIdMatch[1]

    // In production, you would use the YouTube API to fetch video metadata
    // For now, we'll return mock data structure
    return {
      platform: 'YOUTUBE',
      platformVideoId: videoId,
      title: `YouTube Video ${videoId}`,
      description: 'Imported from YouTube',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      duration: 0, // Would be fetched from API
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      originalUrl: videoUrl,
      metadata: {
        channelTitle: 'Channel Name',
        publishedAt: new Date().toISOString(),
        viewCount: 0,
        likeCount: 0,
        tags: []
      }
    }
  } catch (error) {
    throw new Error(`YouTube import failed: ${error.message}`)
  }
}

// Vimeo API integration
async function importFromVimeo(videoUrl: string, accessToken?: string) {
  try {
    // Extract video ID from Vimeo URL
    const videoIdMatch = videoUrl.match(/vimeo\.com\/(\d+)/)
    if (!videoIdMatch) {
      throw new Error('Invalid Vimeo URL')
    }

    const videoId = videoIdMatch[1]

    // In production, you would use the Vimeo API to fetch video metadata
    // For now, we'll return mock data structure
    return {
      platform: 'VIMEO',
      platformVideoId: videoId,
      title: `Vimeo Video ${videoId}`,
      description: 'Imported from Vimeo',
      thumbnailUrl: `https://vumbnail.com/${videoId}.jpg`,
      duration: 0, // Would be fetched from API
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      originalUrl: videoUrl,
      metadata: {
        userTitle: 'User Name',
        createdTime: new Date().toISOString(),
        stats: {
          plays: 0
        },
        tags: []
      }
    }
  } catch (error) {
    throw new Error(`Vimeo import failed: ${error.message}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId },
      select: { workspaceId: true }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const body = await request.json()
    const { action, videoUrl, platform, apiKey, accessToken } = body

    if (action === 'import') {
      let videoData

      // Import video metadata based on platform
      if (platform === 'YOUTUBE' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        videoData = await importFromYouTube(videoUrl, apiKey)
      } else if (platform === 'VIMEO' || videoUrl.includes('vimeo.com')) {
        videoData = await importFromVimeo(videoUrl, accessToken)
      } else {
        return NextResponse.json({
          error: 'Unsupported platform. Supported: YouTube, Vimeo'
        }, { status: 400 })
      }

      // Create video tutorial with imported data
      const video = await prisma.videoTutorial.create({
        data: {
          workspaceId: userWorkspace.workspaceId,
          title: videoData.title,
          description: videoData.description,
          category: 'TUTORIAL', // Default category
          tags: videoData.metadata?.tags || [],
          status: 'DRAFT',
          isPublic: false,
          videoUrl: videoData.embedUrl,
          thumbnailUrl: videoData.thumbnailUrl,
          duration: videoData.duration,
          platform: videoData.platform,
          platformVideoId: videoData.platformVideoId,
          originalUrl: videoData.originalUrl,
          seoTitle: videoData.title,
          seoDescription: videoData.description,
          allowComments: true,
          allowRatings: true,
          analytics: {
            create: {
              views: 0,
              uniqueViews: 0,
              watchTime: 0,
              completionRate: 0,
              likes: 0,
              dislikes: 0,
              shares: 0,
              comments: 0
            }
          }
        },
        include: {
          analytics: true
        }
      })

      return NextResponse.json({
        success: true,
        video,
        importedData: videoData
      })
    }

    if (action === 'validate') {
      // Validate video URL without importing
      try {
        let videoData

        if (platform === 'YOUTUBE' || videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
          videoData = await importFromYouTube(videoUrl, apiKey)
        } else if (platform === 'VIMEO' || videoUrl.includes('vimeo.com')) {
          videoData = await importFromVimeo(videoUrl, accessToken)
        } else {
          return NextResponse.json({
            valid: false,
            error: 'Unsupported platform'
          })
        }

        return NextResponse.json({
          valid: true,
          preview: videoData
        })
      } catch (error) {
        return NextResponse.json({
          valid: false,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      error: 'Invalid action. Supported: import, validate'
    }, { status: 400 })
  } catch (error) {
    console.error('Error with video integration:', error)
    return NextResponse.json({ error: 'Integration failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    if (platform === 'youtube') {
      return NextResponse.json({
        platform: 'YouTube',
        supportedUrls: [
          'https://www.youtube.com/watch?v=VIDEO_ID',
          'https://youtu.be/VIDEO_ID',
          'https://www.youtube.com/embed/VIDEO_ID'
        ],
        apiRequired: true,
        quotaLimits: {
          daily: 10000,
          perSecond: 100
        },
        features: [
          'Video metadata import',
          'Thumbnail extraction',
          'Channel information',
          'View counts and statistics',
          'Automatic transcription',
          'Chapter detection'
        ]
      })
    }

    if (platform === 'vimeo') {
      return NextResponse.json({
        platform: 'Vimeo',
        supportedUrls: [
          'https://vimeo.com/VIDEO_ID',
          'https://player.vimeo.com/video/VIDEO_ID'
        ],
        apiRequired: true,
        quotaLimits: {
          hourly: 1000,
          daily: 10000
        },
        features: [
          'Video metadata import',
          'High-quality thumbnails',
          'User information',
          'Privacy settings',
          'Custom player options',
          'Advanced analytics'
        ]
      })
    }

    // Return all supported platforms
    return NextResponse.json({
      supportedPlatforms: [
        {
          name: 'YouTube',
          id: 'youtube',
          apiRequired: true,
          features: ['metadata', 'thumbnails', 'transcripts', 'chapters']
        },
        {
          name: 'Vimeo',
          id: 'vimeo',
          apiRequired: true,
          features: ['metadata', 'thumbnails', 'privacy', 'analytics']
        }
      ],
      integrationStatus: {
        youtube: {
          configured: false, // Would check for API key
          rateLimitRemaining: 10000
        },
        vimeo: {
          configured: false, // Would check for access token
          rateLimitRemaining: 1000
        }
      }
    })
  } catch (error) {
    console.error('Error getting integration info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}