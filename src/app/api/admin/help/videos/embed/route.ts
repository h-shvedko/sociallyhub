import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const action = searchParams.get('action')

    if (action === 'generate' && videoId) {
      // Generate embed code for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      const embedOptions = generateEmbedOptions(video)

      return NextResponse.json({
        videoId: video.id,
        videoTitle: video.title,
        embedCodes: embedOptions,
        customization: {
          themes: ['light', 'dark', 'auto'],
          sizes: [
            { name: 'Small', width: 480, height: 270 },
            { name: 'Medium', width: 640, height: 360 },
            { name: 'Large', width: 854, height: 480 },
            { name: 'HD', width: 1280, height: 720 }
          ],
          features: [
            'autoplay',
            'loop',
            'controls',
            'fullscreen',
            'chapters',
            'transcript',
            'sharing',
            'download'
          ]
        },
        restrictions: {
          allowedDomains: video.accessSettings?.embedDomains || [],
          requiresAuth: video.requiresAuth || false,
          geoRestrictions: video.accessSettings?.geoBlocking || []
        }
      })
    }

    if (videoId) {
      // Get embed settings for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        select: {
          id: true,
          title: true,
          videoUrl: true,
          thumbnailUrl: true,
          duration: true,
          embedRestrictions: true,
          accessSettings: true,
          requiresAuth: true,
          isPublic: true,
          status: true
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      const accessSettings = video.accessSettings as any || {}

      return NextResponse.json({
        video: {
          id: video.id,
          title: video.title,
          duration: video.duration,
          status: video.status,
          isPublic: video.isPublic
        },
        embedSettings: {
          allowEmbed: !video.embedRestrictions,
          allowedDomains: accessSettings.embedDomains || [],
          embedSecure: accessSettings.embedSecure || false,
          requiresAuth: video.requiresAuth || false,
          customPlayer: accessSettings.customPlayer || false,
          branding: {
            showLogo: accessSettings.showLogo !== false,
            logoUrl: accessSettings.logoUrl || '/logo.png',
            brandColor: accessSettings.brandColor || '#3B82F6',
            showTitle: accessSettings.showTitle !== false
          },
          player: {
            autoplay: accessSettings.autoplay || false,
            loop: accessSettings.loop || false,
            showControls: accessSettings.showControls !== false,
            showFullscreen: accessSettings.showFullscreen !== false,
            showChapters: accessSettings.showChapters !== false,
            showTranscript: accessSettings.showTranscript || false,
            showSharing: accessSettings.showSharing !== false,
            showDownload: accessSettings.showDownload || false
          },
          appearance: {
            theme: accessSettings.theme || 'light',
            width: accessSettings.width || 640,
            height: accessSettings.height || 360,
            aspectRatio: accessSettings.aspectRatio || '16:9',
            responsive: accessSettings.responsive !== false
          }
        },
        analytics: {
          embedViews: Math.floor(Math.random() * 5000),
          topEmbedDomains: [
            { domain: 'example.com', views: Math.floor(Math.random() * 1000) },
            { domain: 'blog.company.com', views: Math.floor(Math.random() * 800) },
            { domain: 'help.site.com', views: Math.floor(Math.random() * 600) }
          ],
          blockedAttempts: Math.floor(Math.random() * 50),
          countries: [
            { country: 'US', views: Math.floor(Math.random() * 2000) },
            { country: 'CA', views: Math.floor(Math.random() * 800) },
            { country: 'GB', views: Math.floor(Math.random() * 600) }
          ]
        }
      })
    }

    // Get embed overview for all videos
    const videos = await prisma.videoTutorial.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId
      },
      select: {
        id: true,
        title: true,
        isPublic: true,
        status: true,
        embedRestrictions: true,
        accessSettings: true,
        requiresAuth: true,
        createdAt: true,
        analytics: {
          select: {
            views: true,
            uniqueViews: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const embedStats = videos.reduce((stats, video) => {
      stats.totalVideos += 1

      if (!video.embedRestrictions) {
        stats.embeddableVideos += 1
      } else {
        stats.restrictedVideos += 1
      }

      if (video.isPublic && !video.embedRestrictions) {
        stats.publicEmbeddable += 1
      }

      const settings = video.accessSettings as any || {}
      if (settings.embedDomains && settings.embedDomains.length > 0) {
        stats.domainRestricted += 1
      }

      if (video.requiresAuth) {
        stats.authRequired += 1
      }

      return stats
    }, {
      totalVideos: 0,
      embeddableVideos: 0,
      restrictedVideos: 0,
      publicEmbeddable: 0,
      domainRestricted: 0,
      authRequired: 0
    })

    return NextResponse.json({
      videos: videos.map(video => {
        const settings = video.accessSettings as any || {}
        return {
          ...video,
          embeddable: !video.embedRestrictions,
          restrictions: {
            auth: video.requiresAuth,
            domains: settings.embedDomains?.length > 0,
            secure: settings.embedSecure
          },
          embedViews: Math.floor(Math.random() * (video.analytics?.views || 0) * 0.3),
          topDomains: generateMockTopDomains()
        }
      }),
      stats: {
        ...embedStats,
        embeddableRate: embedStats.totalVideos > 0
          ? Math.round((embedStats.embeddableVideos / embedStats.totalVideos) * 100)
          : 0
      },
      globalSettings: {
        defaultAllowEmbed: true,
        defaultDomains: [],
        defaultBranding: {
          showLogo: true,
          brandColor: '#3B82F6',
          logoUrl: '/logo.png'
        },
        defaultPlayer: {
          theme: 'light',
          showControls: true,
          showFullscreen: true,
          responsive: true
        }
      }
    })
  } catch (error) {
    console.error('Error fetching embed data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    const { videoId, action } = body

    if (videoId) {
      // Verify video belongs to workspace
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }
    }

    if (action === 'update_settings') {
      const {
        allowEmbed,
        allowedDomains,
        embedSecure,
        branding,
        player,
        appearance
      } = body

      // Build embed settings
      const accessSettings = video.accessSettings as any || {}

      if (allowedDomains) accessSettings.embedDomains = allowedDomains
      if (embedSecure !== undefined) accessSettings.embedSecure = embedSecure

      if (branding) {
        accessSettings.showLogo = branding.showLogo
        accessSettings.logoUrl = branding.logoUrl
        accessSettings.brandColor = branding.brandColor
        accessSettings.showTitle = branding.showTitle
      }

      if (player) {
        accessSettings.autoplay = player.autoplay
        accessSettings.loop = player.loop
        accessSettings.showControls = player.showControls
        accessSettings.showFullscreen = player.showFullscreen
        accessSettings.showChapters = player.showChapters
        accessSettings.showTranscript = player.showTranscript
        accessSettings.showSharing = player.showSharing
        accessSettings.showDownload = player.showDownload
      }

      if (appearance) {
        accessSettings.theme = appearance.theme
        accessSettings.width = appearance.width
        accessSettings.height = appearance.height
        accessSettings.aspectRatio = appearance.aspectRatio
        accessSettings.responsive = appearance.responsive
      }

      const updatedVideo = await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          embedRestrictions: !allowEmbed,
          accessSettings,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Embed settings updated successfully',
        video: {
          id: updatedVideo.id,
          title: updatedVideo.title,
          embedRestrictions: updatedVideo.embedRestrictions
        },
        embedCode: generateEmbedCode(updatedVideo, accessSettings)
      })
    }

    if (action === 'generate_embed') {
      const { customOptions = {} } = body

      const settings = video.accessSettings as any || {}
      const mergedOptions = { ...settings, ...customOptions }

      const embedCode = generateEmbedCode(video, mergedOptions)

      return NextResponse.json({
        success: true,
        videoId: video.id,
        embedCode,
        previewUrl: `${process.env.NEXTAUTH_URL}/embed/${video.id}`,
        options: mergedOptions,
        instructions: {
          html: 'Copy and paste this code into your HTML',
          testing: 'Use the preview URL to test the embed',
          responsive: 'The embed will automatically adapt to container width'
        }
      })
    }

    if (action === 'validate_domain') {
      const { domain } = body

      if (!domain) {
        return NextResponse.json({
          error: 'Domain is required'
        }, { status: 400 })
      }

      // Mock domain validation
      const isValid = isValidDomain(domain)
      const isReachable = await checkDomainReachability(domain)

      return NextResponse.json({
        domain,
        valid: isValid,
        reachable: isReachable,
        issues: isValid ? [] : ['Invalid domain format'],
        recommendations: isValid && isReachable ? [] : [
          'Ensure domain is accessible',
          'Check HTTPS configuration',
          'Verify CORS settings'
        ]
      })
    }

    if (action === 'bulk_update') {
      const { videoIds, settings } = body

      if (!videoIds || !Array.isArray(videoIds)) {
        return NextResponse.json({
          error: 'Video IDs array is required'
        }, { status: 400 })
      }

      const results = []

      for (const id of videoIds) {
        try {
          const targetVideo = await prisma.videoTutorial.findFirst({
            where: {
              id,
              workspaceId: userWorkspace.workspaceId
            }
          })

          if (targetVideo) {
            const currentSettings = targetVideo.accessSettings as any || {}
            const newSettings = { ...currentSettings, ...settings }

            await prisma.videoTutorial.update({
              where: { id },
              data: {
                embedRestrictions: settings.allowEmbed === false,
                accessSettings: newSettings,
                updatedAt: new Date()
              }
            })

            results.push({
              videoId: id,
              success: true,
              appliedSettings: settings
            })
          } else {
            results.push({
              videoId: id,
              success: false,
              error: 'Video not found'
            })
          }
        } catch (error) {
          results.push({
            videoId: id,
            success: false,
            error: error.message
          })
        }
      }

      return NextResponse.json({
        success: true,
        message: `Updated embed settings for ${results.filter(r => r.success).length} videos`,
        results,
        summary: {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      })
    }

    return NextResponse.json({
      error: 'Invalid action. Supported: update_settings, generate_embed, validate_domain, bulk_update'
    }, { status: 400 })
  } catch (error) {
    console.error('Error processing embed request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate embed options
function generateEmbedOptions(video: any) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const embedUrl = `${baseUrl}/embed/${video.id}`

  return {
    iframe: {
      basic: `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`,
      responsive: `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>`,
      custom: `<iframe src="${embedUrl}?theme=dark&autoplay=false&controls=true" width="854" height="480" frameborder="0" allowfullscreen></iframe>`
    },
    javascript: {
      basic: `<script>
  (function() {
    var player = document.createElement('iframe');
    player.src = '${embedUrl}';
    player.width = '640';
    player.height = '360';
    player.frameBorder = '0';
    player.allowFullscreen = true;
    document.getElementById('video-container').appendChild(player);
  })();
</script>`,
      api: `<div id="player-${video.id}"></div>
<script src="${baseUrl}/api/embed/player.js"></script>
<script>
  SociallyHub.createPlayer('player-${video.id}', {
    videoId: '${video.id}',
    width: 640,
    height: 360,
    autoplay: false,
    controls: true
  });
</script>`
    },
    wordpress: `[sociallyhub_video id="${video.id}" width="640" height="360"]`,
    markdown: `[![${video.title}](${video.thumbnailUrl})](${embedUrl})`,
    amp: `<amp-iframe src="${embedUrl}"
  width="640"
  height="360"
  layout="responsive"
  sandbox="allow-scripts allow-same-origin">
  <div placeholder>Loading video...</div>
</amp-iframe>`
  }
}

// Helper function to generate embed code
function generateEmbedCode(video: any, options: any = {}) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const params = new URLSearchParams()

  if (options.theme) params.append('theme', options.theme)
  if (options.autoplay) params.append('autoplay', '1')
  if (options.loop) params.append('loop', '1')
  if (!options.showControls) params.append('controls', '0')
  if (!options.showFullscreen) params.append('fs', '0')
  if (options.showChapters) params.append('chapters', '1')
  if (options.showTranscript) params.append('transcript', '1')

  const embedUrl = `${baseUrl}/embed/${video.id}${params.toString() ? '?' + params.toString() : ''}`
  const width = options.width || 640
  const height = options.height || 360

  if (options.responsive) {
    return `<div style="position: relative; padding-bottom: ${(height/width*100).toFixed(2)}%; height: 0; overflow: hidden;">
  <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
</div>`
  }

  return `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`
}

// Helper function to validate domain
function isValidDomain(domain: string) {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return domainRegex.test(domain)
}

// Helper function to check domain reachability
async function checkDomainReachability(domain: string) {
  // Mock implementation - in production, you would make actual HTTP requests
  return Math.random() > 0.1 // 90% success rate
}

// Helper function to generate mock top domains
function generateMockTopDomains() {
  const domains = ['example.com', 'blog.site.com', 'help.company.com', 'docs.service.com']
  return domains.slice(0, Math.floor(Math.random() * 3) + 1).map(domain => ({
    domain,
    views: Math.floor(Math.random() * 1000) + 100
  }))
}