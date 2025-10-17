import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

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
      // Generate thumbnail from video (mock implementation)
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      // In production, this would use ffmpeg or similar to extract frames
      const mockThumbnails = generateMockThumbnailOptions(videoId, video.duration || 300)

      return NextResponse.json({
        videoId,
        videoTitle: video.title,
        currentThumbnail: video.thumbnailUrl,
        generatedOptions: mockThumbnails,
        extractionSettings: {
          quality: 'high',
          format: 'jpg',
          timestamps: mockThumbnails.map(t => t.timestamp)
        }
      })
    }

    if (videoId) {
      // Get thumbnail options for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          duration: true,
          videoUrl: true,
          status: true
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      return NextResponse.json({
        video,
        thumbnailOptions: generateMockThumbnailOptions(videoId, video.duration || 300),
        hasCustomThumbnail: !!video.thumbnailUrl,
        recommendations: {
          optimalSize: '1280x720',
          aspectRatio: '16:9',
          formats: ['jpg', 'png', 'webp'],
          maxFileSize: '2MB',
          tips: [
            'Use high-contrast images for better visibility',
            'Include text or titles when appropriate',
            'Choose frames that represent the content well',
            'Avoid blurry or dark images'
          ]
        }
      })
    }

    // Get all videos with thumbnail status
    const videos = await prisma.videoTutorial.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId
      },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        status: true,
        createdAt: true,
        analytics: {
          select: {
            views: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const thumbnailStats = videos.reduce((stats, video) => {
      stats.total += 1
      if (video.thumbnailUrl) {
        stats.withThumbnails += 1
      } else {
        stats.withoutThumbnails += 1
      }
      return stats
    }, {
      total: 0,
      withThumbnails: 0,
      withoutThumbnails: 0
    })

    return NextResponse.json({
      videos: videos.map(video => ({
        ...video,
        hasThumbnail: !!video.thumbnailUrl,
        views: video.analytics?.views || 0
      })),
      stats: {
        ...thumbnailStats,
        completionRate: thumbnailStats.total > 0
          ? Math.round((thumbnailStats.withThumbnails / thumbnailStats.total) * 100)
          : 0
      },
      bulkActions: {
        available: ['generate_all', 'optimize_all', 'export_all'],
        supportedFormats: ['jpg', 'png', 'webp'],
        batchSize: 10
      }
    })
  } catch (error) {
    console.error('Error fetching thumbnails:', error)
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

    const contentType = request.headers.get('content-type')

    if (contentType?.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('file') as File
      const videoId = formData.get('videoId') as string

      if (!file || !videoId) {
        return NextResponse.json({
          error: 'File and videoId are required'
        }, { status: 400 })
      }

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

      // Validate file type
      const validImageTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
      ]

      if (!validImageTypes.includes(file.type)) {
        return NextResponse.json({
          error: 'Invalid file type. Supported: JPEG, PNG, WebP'
        }, { status: 400 })
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return NextResponse.json({
          error: 'File too large. Maximum size: 5MB'
        }, { status: 400 })
      }

      // Generate unique filename
      const fileExtension = path.extname(file.name)
      const uniqueId = uuidv4()
      const fileName = `thumbnail_${uniqueId}${fileExtension}`

      // Create upload directory
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos', 'thumbnails')
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      // Write file to disk
      const filePath = path.join(uploadDir, fileName)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Generate public URL
      const publicUrl = `/uploads/videos/thumbnails/${fileName}`

      // Update video with new thumbnail
      const updatedVideo = await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          thumbnailUrl: publicUrl,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        thumbnailUrl: publicUrl,
        fileName,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        video: {
          id: updatedVideo.id,
          title: updatedVideo.title
        }
      })
    }

    // Handle JSON requests (generate, select, optimize)
    const body = await request.json()
    const { action, videoId, timestamp, thumbnailUrl, options } = body

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

    if (action === 'generate') {
      // Generate thumbnail from video at specific timestamp
      const extractedThumbnail = await generateThumbnailFromVideo(video, timestamp || 0)

      await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          thumbnailUrl: extractedThumbnail.url,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Thumbnail generated successfully',
        thumbnailUrl: extractedThumbnail.url,
        timestamp: extractedThumbnail.timestamp,
        extractionMethod: 'video_frame'
      })
    }

    if (action === 'select') {
      // Select from pre-generated options
      if (!thumbnailUrl) {
        return NextResponse.json({
          error: 'Thumbnail URL is required'
        }, { status: 400 })
      }

      await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          thumbnailUrl,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Thumbnail selected successfully',
        thumbnailUrl
      })
    }

    if (action === 'optimize') {
      // Optimize existing thumbnail
      const optimizedThumbnail = await optimizeThumbnail(video.thumbnailUrl, options)

      await prisma.videoTutorial.update({
        where: { id: videoId },
        data: {
          thumbnailUrl: optimizedThumbnail.url,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Thumbnail optimized successfully',
        originalUrl: video.thumbnailUrl,
        optimizedUrl: optimizedThumbnail.url,
        optimizations: optimizedThumbnail.applied,
        sizeDifference: optimizedThumbnail.sizeDifference
      })
    }

    if (action === 'bulk_generate') {
      // Generate thumbnails for multiple videos
      const { videoIds } = body

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
            const thumbnail = await generateThumbnailFromVideo(targetVideo, 0)

            await prisma.videoTutorial.update({
              where: { id },
              data: {
                thumbnailUrl: thumbnail.url,
                updatedAt: new Date()
              }
            })

            results.push({
              videoId: id,
              success: true,
              thumbnailUrl: thumbnail.url
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
        message: `Processed ${results.length} videos`,
        results,
        summary: {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      })
    }

    return NextResponse.json({
      error: 'Invalid action. Supported: generate, select, optimize, bulk_generate'
    }, { status: 400 })
  } catch (error) {
    console.error('Error processing thumbnail:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate mock thumbnail options
function generateMockThumbnailOptions(videoId: string, duration: number) {
  const options = []
  const timestamps = [
    Math.floor(duration * 0.1),   // 10%
    Math.floor(duration * 0.25),  // 25%
    Math.floor(duration * 0.5),   // 50%
    Math.floor(duration * 0.75),  // 75%
    Math.floor(duration * 0.9)    // 90%
  ]

  timestamps.forEach((timestamp, index) => {
    options.push({
      id: `${videoId}_thumb_${index}`,
      url: `/api/placeholder/thumbnail/${videoId}/${timestamp}`,
      timestamp,
      quality: 'high',
      width: 1280,
      height: 720,
      fileSize: Math.floor(Math.random() * 500000) + 100000, // 100KB - 600KB
      score: Math.floor(Math.random() * 30) + 70 // 70-100 quality score
    })
  })

  return options
}

// Helper function to mock thumbnail generation from video
async function generateThumbnailFromVideo(video: any, timestamp: number) {
  // In production, this would use ffmpeg to extract a frame
  const mockUrl = `/api/placeholder/thumbnail/${video.id}/${timestamp}`

  return {
    url: mockUrl,
    timestamp,
    width: 1280,
    height: 720,
    fileSize: Math.floor(Math.random() * 300000) + 200000,
    quality: 'high'
  }
}

// Helper function to mock thumbnail optimization
async function optimizeThumbnail(originalUrl: string, options: any = {}) {
  // In production, this would use image optimization libraries
  const optimizedUrl = originalUrl.replace('.jpg', '_optimized.jpg')

  return {
    url: optimizedUrl,
    applied: [
      'compression',
      'format_optimization',
      'dimension_optimization'
    ],
    sizeDifference: {
      original: Math.floor(Math.random() * 500000) + 200000,
      optimized: Math.floor(Math.random() * 300000) + 100000,
      reduction: '35%'
    }
  }
}