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
    const period = searchParams.get('period') || '30d'
    const videoId = searchParams.get('videoId')
    const metric = searchParams.get('metric')

    // Calculate date range based on period
    const now = new Date()
    const startDate = new Date()

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    if (videoId) {
      // Get analytics for specific video
      const video = await prisma.videoTutorial.findFirst({
        where: {
          id: videoId,
          workspaceId: userWorkspace.workspaceId
        },
        include: {
          analytics: true,
          chapters: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              order: true
            },
            orderBy: { order: 'asc' }
          }
        }
      })

      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 })
      }

      // Generate mock time-series data for the video
      const timeSeriesData = generateMockTimeSeriesData(period, video.analytics)

      return NextResponse.json({
        video: {
          id: video.id,
          title: video.title,
          duration: video.duration,
          status: video.status,
          createdAt: video.createdAt
        },
        analytics: video.analytics,
        timeSeries: timeSeriesData,
        chapters: video.chapters,
        engagement: {
          dropoffPoints: generateMockDropoffData(video.chapters),
          heatmap: generateMockHeatmapData(video.duration || 300),
          userFlow: generateMockUserFlowData()
        }
      })
    }

    // Get workspace-wide video analytics
    const videos = await prisma.videoTutorial.findMany({
      where: {
        workspaceId: userWorkspace.workspaceId,
        createdAt: {
          gte: startDate
        }
      },
      include: {
        analytics: true,
        playlist: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate overall statistics
    const totalVideos = videos.length
    const totalViews = videos.reduce((sum, video) => sum + (video.analytics?.views || 0), 0)
    const totalWatchTime = videos.reduce((sum, video) => sum + (video.analytics?.watchTime || 0), 0)
    const totalUniqueViews = videos.reduce((sum, video) => sum + (video.analytics?.uniqueViews || 0), 0)
    const avgCompletionRate = totalVideos > 0
      ? videos.reduce((sum, video) => sum + (video.analytics?.completionRate || 0), 0) / totalVideos
      : 0

    // Top performing videos
    const topVideosByViews = videos
      .sort((a, b) => (b.analytics?.views || 0) - (a.analytics?.views || 0))
      .slice(0, 10)
      .map(video => ({
        id: video.id,
        title: video.title,
        views: video.analytics?.views || 0,
        watchTime: video.analytics?.watchTime || 0,
        completionRate: video.analytics?.completionRate || 0,
        playlist: video.playlist?.title
      }))

    // Category performance
    const categoryStats = videos.reduce((stats, video) => {
      const category = video.category || 'Uncategorized'
      if (!stats[category]) {
        stats[category] = {
          videos: 0,
          views: 0,
          watchTime: 0,
          avgCompletionRate: 0
        }
      }
      stats[category].videos += 1
      stats[category].views += video.analytics?.views || 0
      stats[category].watchTime += video.analytics?.watchTime || 0
      stats[category].avgCompletionRate += video.analytics?.completionRate || 0
      return stats
    }, {})

    // Calculate averages for categories
    Object.keys(categoryStats).forEach(category => {
      const stats = categoryStats[category]
      stats.avgCompletionRate = stats.videos > 0 ? stats.avgCompletionRate / stats.videos : 0
    })

    // Generate trend data
    const trendData = generateMockTrendData(period)

    // Engagement metrics
    const engagementMetrics = {
      averageViewDuration: totalViews > 0 ? totalWatchTime / totalViews : 0,
      bounceRate: Math.random() * 0.3 + 0.1, // 10-40%
      returnViewerRate: Math.random() * 0.4 + 0.2, // 20-60%
      socialShares: videos.reduce((sum, video) => sum + (video.analytics?.shares || 0), 0),
      comments: videos.reduce((sum, video) => sum + (video.analytics?.comments || 0), 0),
      likes: videos.reduce((sum, video) => sum + (video.analytics?.likes || 0), 0),
      dislikes: videos.reduce((sum, video) => sum + (video.analytics?.dislikes || 0), 0)
    }

    return NextResponse.json({
      overview: {
        totalVideos,
        totalViews,
        totalWatchTime,
        totalUniqueViews,
        avgCompletionRate,
        period
      },
      topVideos: topVideosByViews,
      categoryPerformance: Object.entries(categoryStats).map(([category, stats]) => ({
        category,
        ...stats
      })),
      trends: trendData,
      engagement: engagementMetrics,
      videos: videos.map(video => ({
        id: video.id,
        title: video.title,
        category: video.category,
        status: video.status,
        duration: video.duration,
        createdAt: video.createdAt,
        analytics: video.analytics,
        playlist: video.playlist?.title
      }))
    })
  } catch (error) {
    console.error('Error fetching video analytics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to generate mock time-series data
function generateMockTimeSeriesData(period: string, analytics: any) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  const data = []

  const baseViews = analytics?.views || 0
  const baseWatchTime = analytics?.watchTime || 0

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    // Simulate realistic patterns (weekends lower, gradual growth)
    const dayOfWeek = date.getDay()
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1
    const growthFactor = Math.max(0.1, 1 - (i / days) * 0.5) // Newer content performs better

    data.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor((baseViews / days) * weekendMultiplier * growthFactor * (0.5 + Math.random())),
      watchTime: Math.floor((baseWatchTime / days) * weekendMultiplier * growthFactor * (0.5 + Math.random())),
      uniqueViews: Math.floor((analytics?.uniqueViews || 0) / days * weekendMultiplier * growthFactor * (0.5 + Math.random())),
      completionRate: Math.min(100, Math.max(10, (analytics?.completionRate || 50) + (Math.random() - 0.5) * 20))
    })
  }

  return data
}

// Helper function to generate mock dropoff data
function generateMockDropoffData(chapters: any[]) {
  if (!chapters.length) return []

  return chapters.map((chapter, index) => ({
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    startTime: chapter.startTime,
    endTime: chapter.endTime,
    retentionRate: Math.max(20, 100 - (index * 15) - Math.random() * 10), // Decreasing retention
    dropoffRate: Math.min(80, (index * 15) + Math.random() * 10)
  }))
}

// Helper function to generate mock heatmap data
function generateMockHeatmapData(duration: number) {
  const segments = Math.min(100, Math.floor(duration / 10)) // 10-second segments
  const heatmap = []

  for (let i = 0; i < segments; i++) {
    const timestamp = (i * 10)
    // Simulate attention peaks at beginning, middle, and end
    const attentionScore = Math.sin((i / segments) * Math.PI) * 0.5 + 0.5
    const engagement = Math.max(0.1, attentionScore + (Math.random() - 0.5) * 0.3)

    heatmap.push({
      timestamp,
      engagement: Math.round(engagement * 100),
      replays: Math.floor(Math.random() * 5),
      skips: Math.floor(Math.random() * 3)
    })
  }

  return heatmap
}

// Helper function to generate mock user flow data
function generateMockUserFlowData() {
  return {
    entryPoints: [
      { source: 'Direct', users: Math.floor(Math.random() * 100) + 50 },
      { source: 'Search', users: Math.floor(Math.random() * 80) + 30 },
      { source: 'Playlist', users: Math.floor(Math.random() * 60) + 20 },
      { source: 'Recommended', users: Math.floor(Math.random() * 40) + 10 }
    ],
    exitPoints: [
      { action: 'Completed', users: Math.floor(Math.random() * 50) + 25 },
      { action: 'Early Exit', users: Math.floor(Math.random() * 30) + 15 },
      { action: 'Skipped to Next', users: Math.floor(Math.random() * 20) + 10 },
      { action: 'Closed Player', users: Math.floor(Math.random() * 15) + 5 }
    ],
    averageSessionDuration: Math.floor(Math.random() * 300) + 180, // 3-8 minutes
    returnRate: Math.floor(Math.random() * 40) + 20 // 20-60%
  }
}

// Helper function to generate mock trend data
function generateMockTrendData(period: string) {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  const data = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)

    data.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor(Math.random() * 1000) + 100,
      watchTime: Math.floor(Math.random() * 10000) + 1000,
      newVideos: Math.floor(Math.random() * 5),
      engagementRate: Math.floor(Math.random() * 30) + 40 // 40-70%
    })
  }

  return data
}