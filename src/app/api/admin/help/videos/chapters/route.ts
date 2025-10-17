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

    if (videoId) {
      // Get chapters for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        include: {
          chapters: {
            orderBy: { order: 'asc' }
          }
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      // Calculate chapter statistics
      const chapterStats = {
        totalChapters: video.chapters.length,
        totalDuration: video.chapters.reduce((sum, chapter) =>
          sum + ((chapter.endTime || 0) - (chapter.startTime || 0)), 0),
        averageChapterLength: video.chapters.length > 0
          ? video.chapters.reduce((sum, chapter) =>
              sum + ((chapter.endTime || 0) - (chapter.startTime || 0)), 0) / video.chapters.length
          : 0,
        hasGaps: checkForGaps(video.chapters),
        hasOverlaps: checkForOverlaps(video.chapters)
      }

      return NextResponse.json({
        video: {
          id: video.id,
          title: video.title,
          duration: video.duration
        },
        chapters: video.chapters.map(chapter => ({
          ...chapter,
          duration: (chapter.endTime || 0) - (chapter.startTime || 0)
        })),
        stats: chapterStats,
        validation: validateChapters(video.chapters, video.duration || 0)
      })
    }

    // Get all videos with chapter information
    const videos = await prisma.videoTutorial.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId
      },
      include: {
        chapters: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            order: true
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            chapters: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const overallStats = videos.reduce((stats, video) => {
      stats.totalVideos += 1
      stats.totalChapters += video._count.chapters
      if (video._count.chapters > 0) {
        stats.videosWithChapters += 1
      } else {
        stats.videosWithoutChapters += 1
      }
      return stats
    }, {
      totalVideos: 0,
      totalChapters: 0,
      videosWithChapters: 0,
      videosWithoutChapters: 0
    })

    return NextResponse.json({
      videos: videos.map(video => ({
        id: video.id,
        title: video.title,
        duration: video.duration,
        status: video.status,
        chapterCount: video._count.chapters,
        chapters: video.chapters,
        hasChapters: video._count.chapters > 0,
        createdAt: video.createdAt
      })),
      stats: {
        ...overallStats,
        averageChaptersPerVideo: overallStats.totalVideos > 0
          ? Math.round(overallStats.totalChapters / overallStats.totalVideos * 10) / 10
          : 0,
        completionRate: overallStats.totalVideos > 0
          ? Math.round((overallStats.videosWithChapters / overallStats.totalVideos) * 100)
          : 0
      }
    })
  } catch (error) {
    console.error('Error fetching chapters:', error)
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
    const { videoId, chapters, action } = body

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

    if (action === 'bulk_update') {
      // Replace all chapters for the video
      if (!chapters || !Array.isArray(chapters)) {
        return NextResponse.json({
          error: 'Chapters array is required'
        }, { status: 400 })
      }

      // Validate chapters
      const validation = validateChapters(chapters, video.duration || 0)
      if (!validation.isValid) {
        return NextResponse.json({
          error: 'Chapter validation failed',
          issues: validation.issues
        }, { status: 400 })
      }

      // Delete existing chapters
      await prisma.videoChapter.deleteMany({
        where: { videoId }
      })

      // Create new chapters
      const createdChapters = await Promise.all(
        chapters.map(async (chapter: any, index: number) => {
          return await prisma.videoChapter.create({
            data: {
              videoId,
              title: chapter.title,
              description: chapter.description || '',
              startTime: chapter.startTime,
              endTime: chapter.endTime,
              order: index + 1
            }
          })
        })
      )

      return NextResponse.json({
        success: true,
        message: `${createdChapters.length} chapters updated successfully`,
        chapters: createdChapters.sort((a, b) => a.order - b.order)
      })
    }

    if (action === 'auto_generate') {
      // Auto-generate chapters based on video content
      const { method = 'duration', chapterCount = 5 } = body

      let generatedChapters = []

      if (method === 'duration') {
        // Generate chapters by dividing video duration
        generatedChapters = generateChaptersByDuration(video.duration || 300, chapterCount)
      } else if (method === 'transcript') {
        // Generate chapters based on transcript (mock implementation)
        generatedChapters = generateChaptersByTranscript(video.transcript, video.duration || 300)
      } else if (method === 'silence') {
        // Generate chapters based on silence detection (mock implementation)
        generatedChapters = generateChaptersBySilence(video.duration || 300)
      }

      // Delete existing chapters
      await prisma.videoChapter.deleteMany({
        where: { videoId }
      })

      // Create generated chapters
      const createdChapters = await Promise.all(
        generatedChapters.map(async (chapter, index) => {
          return await prisma.videoChapter.create({
            data: {
              videoId,
              title: chapter.title,
              description: chapter.description || '',
              startTime: chapter.startTime,
              endTime: chapter.endTime,
              order: index + 1
            }
          })
        })
      )

      return NextResponse.json({
        success: true,
        message: `${createdChapters.length} chapters auto-generated using ${method} method`,
        chapters: createdChapters.sort((a, b) => a.order - b.order),
        method,
        generationSettings: {
          method,
          chapterCount: method === 'duration' ? chapterCount : 'auto',
          basedOn: method === 'transcript' ? 'content_analysis' : method
        }
      })
    }

    if (action === 'reorder') {
      // Reorder chapters
      const { chapterIds } = body

      if (!chapterIds || !Array.isArray(chapterIds)) {
        return NextResponse.json({
          error: 'Chapter IDs array is required'
        }, { status: 400 })
      }

      // Update order for each chapter
      await Promise.all(
        chapterIds.map(async (chapterId: string, index: number) => {
          return await prisma.videoChapter.update({
            where: { id: chapterId },
            data: { order: index + 1 }
          })
        })
      )

      // Fetch updated chapters
      const updatedChapters = await prisma.videoChapter.findMany({
        where: { videoId },
        orderBy: { order: 'asc' }
      })

      return NextResponse.json({
        success: true,
        message: 'Chapters reordered successfully',
        chapters: updatedChapters
      })
    }

    // Single chapter creation
    const { title, description, startTime, endTime } = body

    if (!title || startTime === undefined || endTime === undefined) {
      return NextResponse.json({
        error: 'Title, startTime, and endTime are required'
      }, { status: 400 })
    }

    // Get current chapter count to determine order
    const chapterCount = await prisma.videoChapter.count({
      where: { videoId }
    })

    const chapter = await prisma.videoChapter.create({
      data: {
        videoId,
        title,
        description: description || '',
        startTime,
        endTime,
        order: chapterCount + 1
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Chapter created successfully',
      chapter
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing chapters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to validate chapters
function validateChapters(chapters: any[], videoDuration: number) {
  const issues = []
  let isValid = true

  // Check for empty chapters
  if (chapters.length === 0) {
    return { isValid: true, issues: [] } // Empty is valid
  }

  // Check each chapter
  chapters.forEach((chapter, index) => {
    // Required fields
    if (!chapter.title) {
      issues.push(`Chapter ${index + 1}: Title is required`)
      isValid = false
    }

    if (chapter.startTime === undefined || chapter.startTime < 0) {
      issues.push(`Chapter ${index + 1}: Valid start time is required`)
      isValid = false
    }

    if (chapter.endTime === undefined || chapter.endTime <= chapter.startTime) {
      issues.push(`Chapter ${index + 1}: End time must be greater than start time`)
      isValid = false
    }

    if (chapter.endTime > videoDuration) {
      issues.push(`Chapter ${index + 1}: End time exceeds video duration`)
      isValid = false
    }
  })

  // Check for overlaps
  const sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime)
  for (let i = 0; i < sortedChapters.length - 1; i++) {
    if (sortedChapters[i].endTime > sortedChapters[i + 1].startTime) {
      issues.push(`Chapters overlap: "${sortedChapters[i].title}" and "${sortedChapters[i + 1].title}"`)
      isValid = false
    }
  }

  return { isValid, issues }
}

// Helper function to check for gaps
function checkForGaps(chapters: any[]) {
  if (chapters.length <= 1) return false

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order)
  for (let i = 0; i < sortedChapters.length - 1; i++) {
    if (sortedChapters[i].endTime < sortedChapters[i + 1].startTime) {
      return true
    }
  }
  return false
}

// Helper function to check for overlaps
function checkForOverlaps(chapters: any[]) {
  if (chapters.length <= 1) return false

  const sortedChapters = [...chapters].sort((a, b) => a.startTime - b.startTime)
  for (let i = 0; i < sortedChapters.length - 1; i++) {
    if (sortedChapters[i].endTime > sortedChapters[i + 1].startTime) {
      return true
    }
  }
  return false
}

// Helper function to generate chapters by duration
function generateChaptersByDuration(duration: number, chapterCount: number) {
  const chapterLength = Math.floor(duration / chapterCount)
  const chapters = []

  for (let i = 0; i < chapterCount; i++) {
    const startTime = i * chapterLength
    const endTime = i === chapterCount - 1 ? duration : (i + 1) * chapterLength

    chapters.push({
      title: `Chapter ${i + 1}`,
      description: `Auto-generated chapter ${i + 1}`,
      startTime,
      endTime
    })
  }

  return chapters
}

// Helper function to generate chapters by transcript
function generateChaptersByTranscript(transcript: string | null, duration: number) {
  // Mock implementation - in production, this would use NLP to analyze content
  if (!transcript) {
    return generateChaptersByDuration(duration, 3)
  }

  const topics = [
    'Introduction',
    'Main Content',
    'Examples',
    'Advanced Topics',
    'Conclusion'
  ]

  const chapters = []
  const chapterCount = Math.min(topics.length, 5)
  const chapterLength = Math.floor(duration / chapterCount)

  for (let i = 0; i < chapterCount; i++) {
    const startTime = i * chapterLength
    const endTime = i === chapterCount - 1 ? duration : (i + 1) * chapterLength

    chapters.push({
      title: topics[i],
      description: `Content covering ${topics[i].toLowerCase()}`,
      startTime,
      endTime
    })
  }

  return chapters
}

// Helper function to generate chapters by silence detection
function generateChaptersBySilence(duration: number) {
  // Mock implementation - in production, this would analyze audio for silence
  const silencePoints = []
  const minChapterLength = 60 // 1 minute minimum

  // Generate some random silence points
  let currentTime = 0
  while (currentTime < duration - minChapterLength) {
    currentTime += Math.floor(Math.random() * 120) + minChapterLength // 1-3 minutes
    if (currentTime < duration) {
      silencePoints.push(currentTime)
    }
  }

  const chapters = []
  let startTime = 0

  silencePoints.forEach((silencePoint, index) => {
    chapters.push({
      title: `Section ${index + 1}`,
      description: `Auto-detected section ${index + 1}`,
      startTime,
      endTime: silencePoint
    })
    startTime = silencePoint
  })

  // Add final chapter if needed
  if (startTime < duration) {
    chapters.push({
      title: `Section ${chapters.length + 1}`,
      description: `Auto-detected section ${chapters.length + 1}`,
      startTime,
      endTime: duration
    })
  }

  return chapters
}