import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { AudienceSegmentation } from '@/lib/audience/audience-segmentation'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const postingTimesSchema = z.object({
  segmentId: z.string().optional(),
  platform: z.enum(['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK']).optional(),
  timezone: z.string().default('UTC')
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get('segmentId')
    const platform = searchParams.get('platform')
    const timezone = searchParams.get('timezone') || 'UTC'

    const { segmentId: validSegmentId, platform: validPlatform, timezone: validTimezone } = 
      postingTimesSchema.parse({
        segmentId: segmentId || undefined,
        platform: platform || undefined,
        timezone
      })

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const whereClause: any = {
      workspaceId: userWorkspace.workspaceId
    }

    if (validSegmentId) {
      whereClause.segmentId = validSegmentId
    }

    if (validPlatform) {
      whereClause.platform = validPlatform
    }

    const postingTimes = await prisma.postingTimeRecommendation.findMany({
      where: whereClause,
      include: {
        segment: {
          select: {
            id: true,
            name: true,
            estimatedSize: true,
            actualSize: true
          }
        }
      },
      orderBy: [
        { platform: 'asc' },
        { dayOfWeek: 'asc' },
        { hour: 'asc' }
      ]
    })

    // Group by platform and day
    const groupedTimes = postingTimes.reduce((acc: any, time) => {
      const platformKey = time.platform
      const dayKey = time.dayOfWeek
      
      if (!acc[platformKey]) {
        acc[platformKey] = {}
      }
      if (!acc[platformKey][dayKey]) {
        acc[platformKey][dayKey] = []
      }
      
      acc[platformKey][dayKey].push({
        ...time,
        dayName: getDayName(time.dayOfWeek),
        timeString: formatTime(time.hour, validTimezone)
      })
      
      return acc
    }, {})

    // Get top recommendations across all segments
    const topRecommendations = postingTimes
      .sort((a, b) => b.expectedEngagement - a.expectedEngagement)
      .slice(0, 10)
      .map(rec => ({
        ...rec,
        dayName: getDayName(rec.dayOfWeek),
        timeString: formatTime(rec.hour, validTimezone)
      }))

    // Calculate platform-specific insights
    const platformInsights = Object.keys(groupedTimes).map(platform => {
      const platformTimes = postingTimes.filter(t => t.platform === platform)
      const avgEngagement = platformTimes.reduce((sum, t) => sum + t.expectedEngagement, 0) / platformTimes.length
      const bestTime = platformTimes.reduce((best, current) => 
        current.expectedEngagement > best.expectedEngagement ? current : best
      )
      
      return {
        platform,
        avgExpectedEngagement: Math.round(avgEngagement * 10000) / 100,
        bestTime: {
          dayName: getDayName(bestTime.dayOfWeek),
          hour: bestTime.hour,
          expectedEngagement: Math.round(bestTime.expectedEngagement * 10000) / 100
        },
        totalRecommendations: platformTimes.length
      }
    })

    return NextResponse.json({
      success: true,
      postingTimes: groupedTimes,
      topRecommendations,
      platformInsights,
      timezone: validTimezone,
      totalRecommendations: postingTimes.length
    })

  } catch (error) {
    console.error('Get posting times error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get posting times' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { segmentId, platform } = postingTimesSchema.parse(body)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: { userId: session.user.id }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Initialize audience segmentation
    const audienceSegmentation = new AudienceSegmentation()

    // Predict optimal posting times
    const recommendations = await audienceSegmentation.predictOptimalPostingTimes({
      workspaceId: userWorkspace.workspaceId,
      segmentId,
      platform
    })

    return NextResponse.json({
      success: true,
      recommendations,
      message: `Generated ${recommendations.length} posting time recommendations`
    })

  } catch (error) {
    console.error('Generate posting times error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate posting times' },
      { status: 500 }
    )
  }
}

function getDayName(dayOfWeek: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayOfWeek] || 'Unknown'
}

function formatTime(hour: number, timezone: string): string {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone === 'UTC' ? 'UTC' : timezone
  })
}