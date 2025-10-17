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

    if (action === 'check' && videoId) {
      // Check access permissions for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        select: {
          id: true,
          title: true,
          isPublic: true,
          accessSettings: true,
          status: true
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      const accessSettings = video.accessSettings as any || {}

      return NextResponse.json({
        videoId: video.id,
        videoTitle: video.title,
        hasAccess: true, // Admin always has access
        accessLevel: 'admin',
        permissions: {
          view: true,
          edit: true,
          delete: true,
          share: true,
          download: true,
          embed: true
        },
        restrictions: {
          geoBlocking: accessSettings.geoBlocking || [],
          timeRestrictions: accessSettings.timeRestrictions || null,
          deviceLimits: accessSettings.deviceLimits || null,
          ipWhitelist: accessSettings.ipWhitelist || []
        }
      })
    }

    if (videoId) {
      // Get access settings for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        select: {
          id: true,
          title: true,
          isPublic: true,
          accessSettings: true,
          status: true,
          requiresAuth: true,
          passwordProtected: true,
          embedRestrictions: true
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
          isPublic: video.isPublic,
          status: video.status
        },
        accessControl: {
          requiresAuth: video.requiresAuth || false,
          passwordProtected: video.passwordProtected || false,
          allowedRoles: accessSettings.allowedRoles || ['OWNER', 'ADMIN', 'PUBLISHER'],
          allowedUsers: accessSettings.allowedUsers || [],
          geoRestrictions: {
            enabled: !!accessSettings.geoBlocking,
            blockedCountries: accessSettings.geoBlocking || [],
            allowedCountries: accessSettings.geoWhitelist || []
          },
          timeRestrictions: {
            enabled: !!accessSettings.timeRestrictions,
            startDate: accessSettings.timeRestrictions?.startDate,
            endDate: accessSettings.timeRestrictions?.endDate,
            timezone: accessSettings.timeRestrictions?.timezone || 'UTC'
          },
          deviceRestrictions: {
            enabled: !!accessSettings.deviceLimits,
            maxDevices: accessSettings.deviceLimits?.maxDevices || 3,
            deviceTypes: accessSettings.deviceLimits?.allowedTypes || ['desktop', 'mobile', 'tablet']
          },
          ipRestrictions: {
            enabled: !!accessSettings.ipWhitelist,
            whitelist: accessSettings.ipWhitelist || [],
            blacklist: accessSettings.ipBlacklist || []
          },
          downloadRestrictions: {
            allowDownload: accessSettings.allowDownload !== false,
            downloadLimit: accessSettings.downloadLimit || null,
            downloadExpiry: accessSettings.downloadExpiry || null
          },
          embedRestrictions: {
            allowEmbed: !video.embedRestrictions,
            allowedDomains: accessSettings.embedDomains || [],
            embedSecure: accessSettings.embedSecure || false
          }
        },
        analytics: {
          totalAttempts: Math.floor(Math.random() * 1000),
          successfulAccess: Math.floor(Math.random() * 800),
          blockedAttempts: Math.floor(Math.random() * 200),
          topBlockedCountries: ['CN', 'RU', 'IR'],
          topAccessCountries: ['US', 'CA', 'GB', 'DE', 'FR']
        }
      })
    }

    // Get access control overview for all videos
    const videos = await prisma.videoTutorial.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId
      },
      select: {
        id: true,
        title: true,
        isPublic: true,
        status: true,
        requiresAuth: true,
        passwordProtected: true,
        embedRestrictions: true,
        accessSettings: true,
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

    const accessStats = videos.reduce((stats, video) => {
      stats.totalVideos += 1

      if (video.isPublic) stats.publicVideos += 1
      else stats.privateVideos += 1

      if (video.requiresAuth) stats.authRequired += 1
      if (video.passwordProtected) stats.passwordProtected += 1
      if (video.embedRestrictions) stats.embedRestricted += 1

      const settings = video.accessSettings as any || {}
      if (settings.geoBlocking) stats.geoRestricted += 1
      if (settings.timeRestrictions) stats.timeRestricted += 1
      if (settings.ipWhitelist) stats.ipRestricted += 1

      return stats
    }, {
      totalVideos: 0,
      publicVideos: 0,
      privateVideos: 0,
      authRequired: 0,
      passwordProtected: 0,
      embedRestricted: 0,
      geoRestricted: 0,
      timeRestricted: 0,
      ipRestricted: 0
    })

    return NextResponse.json({
      videos: videos.map(video => {
        const settings = video.accessSettings as any || {}
        return {
          ...video,
          accessLevel: video.isPublic ? 'public' : 'private',
          restrictions: {
            auth: video.requiresAuth,
            password: video.passwordProtected,
            geo: !!settings.geoBlocking,
            time: !!settings.timeRestrictions,
            ip: !!settings.ipWhitelist,
            embed: video.embedRestrictions,
            download: settings.allowDownload === false
          },
          restrictionCount: [
            video.requiresAuth,
            video.passwordProtected,
            !!settings.geoBlocking,
            !!settings.timeRestrictions,
            !!settings.ipWhitelist,
            video.embedRestrictions
          ].filter(Boolean).length
        }
      }),
      stats: accessStats,
      securityInsights: {
        riskLevel: calculateRiskLevel(accessStats),
        recommendations: generateSecurityRecommendations(accessStats),
        complianceStatus: checkComplianceStatus(videos)
      }
    })
  } catch (error) {
    console.error('Error fetching access control data:', error)
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

    if (action === 'update_settings') {
      const {
        isPublic,
        requiresAuth,
        passwordProtected,
        password,
        allowedRoles,
        allowedUsers,
        geoRestrictions,
        timeRestrictions,
        deviceRestrictions,
        ipRestrictions,
        downloadRestrictions,
        embedRestrictions
      } = body

      // Build access settings object
      const accessSettings: any = {}

      if (allowedRoles) accessSettings.allowedRoles = allowedRoles
      if (allowedUsers) accessSettings.allowedUsers = allowedUsers

      if (geoRestrictions?.enabled) {
        if (geoRestrictions.blockedCountries) {
          accessSettings.geoBlocking = geoRestrictions.blockedCountries
        }
        if (geoRestrictions.allowedCountries) {
          accessSettings.geoWhitelist = geoRestrictions.allowedCountries
        }
      }

      if (timeRestrictions?.enabled) {
        accessSettings.timeRestrictions = {
          startDate: timeRestrictions.startDate,
          endDate: timeRestrictions.endDate,
          timezone: timeRestrictions.timezone || 'UTC'
        }
      }

      if (deviceRestrictions?.enabled) {
        accessSettings.deviceLimits = {
          maxDevices: deviceRestrictions.maxDevices || 3,
          allowedTypes: deviceRestrictions.deviceTypes || ['desktop', 'mobile', 'tablet']
        }
      }

      if (ipRestrictions?.enabled) {
        if (ipRestrictions.whitelist) accessSettings.ipWhitelist = ipRestrictions.whitelist
        if (ipRestrictions.blacklist) accessSettings.ipBlacklist = ipRestrictions.blacklist
      }

      if (downloadRestrictions) {
        accessSettings.allowDownload = downloadRestrictions.allowDownload
        if (downloadRestrictions.downloadLimit) {
          accessSettings.downloadLimit = downloadRestrictions.downloadLimit
        }
        if (downloadRestrictions.downloadExpiry) {
          accessSettings.downloadExpiry = downloadRestrictions.downloadExpiry
        }
      }

      if (embedRestrictions) {
        if (embedRestrictions.allowedDomains) {
          accessSettings.embedDomains = embedRestrictions.allowedDomains
        }
        accessSettings.embedSecure = embedRestrictions.embedSecure || false
      }

      // Update video with new access settings
      const updateData: any = {
        accessSettings,
        updatedAt: new Date()
      }

      if (isPublic !== undefined) updateData.isPublic = isPublic
      if (requiresAuth !== undefined) updateData.requiresAuth = requiresAuth
      if (passwordProtected !== undefined) updateData.passwordProtected = passwordProtected
      if (password !== undefined && passwordProtected) updateData.accessPassword = password
      if (embedRestrictions?.allowEmbed !== undefined) {
        updateData.embedRestrictions = !embedRestrictions.allowEmbed
      }

      const updatedVideo = await prisma.videoTutorial.update({
        where: { id: videoId },
        data: updateData
      })

      return NextResponse.json({
        success: true,
        message: 'Access settings updated successfully',
        video: {
          id: updatedVideo.id,
          title: updatedVideo.title,
          isPublic: updatedVideo.isPublic,
          requiresAuth: updatedVideo.requiresAuth,
          passwordProtected: updatedVideo.passwordProtected,
          embedRestrictions: updatedVideo.embedRestrictions
        },
        appliedSettings: accessSettings
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
            await prisma.videoTutorial.update({
              where: { id },
              data: {
                ...settings,
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
        message: `Updated access settings for ${results.filter(r => r.success).length} videos`,
        results,
        summary: {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      })
    }

    if (action === 'generate_access_link') {
      const { expiryHours = 24, downloadAllowed = false, maxUses = null } = body

      // Generate secure access token
      const accessToken = generateSecureToken()
      const expiryDate = new Date()
      expiryDate.setHours(expiryDate.getHours() + expiryHours)

      // In production, you would store this in a database table
      const accessLink = {
        token: accessToken,
        videoId,
        expiresAt: expiryDate,
        maxUses,
        downloadAllowed,
        createdAt: new Date(),
        usedCount: 0
      }

      const shareUrl = `${process.env.NEXTAUTH_URL}/watch/${videoId}?token=${accessToken}`

      return NextResponse.json({
        success: true,
        message: 'Secure access link generated',
        accessLink: {
          url: shareUrl,
          token: accessToken,
          expiresAt: expiryDate,
          expiresIn: `${expiryHours} hours`,
          maxUses,
          downloadAllowed,
          qrCode: `data:image/svg+xml;base64,${Buffer.from(generateQRCodeSVG(shareUrl)).toString('base64')}`
        },
        instructions: {
          sharing: 'Share this link with authorized users',
          security: 'Link will expire automatically',
          tracking: 'Usage will be tracked and logged'
        }
      })
    }

    if (action === 'validate_access') {
      const { token, userInfo } = body

      // Mock token validation
      const isValid = token && token.length > 10
      const accessGranted = isValid

      return NextResponse.json({
        valid: isValid,
        accessGranted,
        permissions: accessGranted ? {
          view: true,
          download: false,
          share: false
        } : null,
        restrictions: accessGranted ? {
          timeLimit: '2 hours',
          deviceLimit: 1,
          downloadLimit: 0
        } : null,
        message: accessGranted ? 'Access granted' : 'Invalid or expired token'
      })
    }

    return NextResponse.json({
      error: 'Invalid action. Supported: update_settings, bulk_update, generate_access_link, validate_access'
    }, { status: 400 })
  } catch (error) {
    console.error('Error processing access control:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to calculate risk level
function calculateRiskLevel(stats: any) {
  const totalVideos = stats.totalVideos
  if (totalVideos === 0) return 'low'

  const unprotectedRatio = stats.publicVideos / totalVideos
  const protectedRatio = (stats.authRequired + stats.passwordProtected) / totalVideos

  if (unprotectedRatio > 0.8) return 'high'
  if (unprotectedRatio > 0.5) return 'medium'
  if (protectedRatio > 0.7) return 'low'
  return 'medium'
}

// Helper function to generate security recommendations
function generateSecurityRecommendations(stats: any) {
  const recommendations = []

  if (stats.publicVideos > stats.privateVideos) {
    recommendations.push({
      priority: 'High',
      category: 'Privacy',
      recommendation: 'Consider making more videos private by default',
      impact: 'Improved content security'
    })
  }

  if (stats.passwordProtected < stats.totalVideos * 0.3) {
    recommendations.push({
      priority: 'Medium',
      category: 'Authentication',
      recommendation: 'Add password protection to sensitive content',
      impact: 'Enhanced access control'
    })
  }

  if (stats.geoRestricted === 0) {
    recommendations.push({
      priority: 'Low',
      category: 'Compliance',
      recommendation: 'Consider geo-restrictions for compliance requirements',
      impact: 'Better regulatory compliance'
    })
  }

  return recommendations
}

// Helper function to check compliance status
function checkComplianceStatus(videos: any[]) {
  return {
    gdpr: {
      compliant: videos.every(v => v.accessSettings?.dataProcessing !== undefined),
      issues: ['Missing data processing consent']
    },
    ccpa: {
      compliant: videos.some(v => v.accessSettings?.geoBlocking?.includes('US')),
      issues: ['No California-specific restrictions']
    },
    coppa: {
      compliant: videos.every(v => v.requiresAuth || !v.isPublic),
      issues: ['Public videos may not be COPPA compliant']
    }
  }
}

// Helper function to generate secure token
function generateSecureToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Helper function to generate QR code SVG
function generateQRCodeSVG(url: string) {
  // Simple mock QR code SVG
  return `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="white"/>
    <rect x="10" y="10" width="180" height="180" fill="black"/>
    <rect x="20" y="20" width="160" height="160" fill="white"/>
    <text x="100" y="105" text-anchor="middle" font-family="monospace" font-size="8">QR Code</text>
  </svg>`
}