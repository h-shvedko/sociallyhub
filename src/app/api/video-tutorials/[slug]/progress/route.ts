import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/video-tutorials/[slug]/progress - Update user progress
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { watchTime, lastPosition, isCompleted, rating, feedback } = body

    // Find the video tutorial
    const tutorial = await prisma.videoTutorial.findFirst({
      where: {
        slug,
        isActive: true,
        isPublished: true
      }
    })

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      )
    }

    // Upsert user progress
    const progress = await prisma.videoUserProgress.upsert({
      where: {
        userId_videoId: {
          userId: session.user.id,
          videoId: tutorial.id
        }
      },
      update: {
        watchTime: watchTime ?? undefined,
        lastPosition: lastPosition ?? undefined,
        isCompleted: isCompleted ?? undefined,
        rating: rating ?? undefined,
        feedback: feedback ?? undefined,
        updatedAt: new Date()
      },
      create: {
        userId: session.user.id,
        videoId: tutorial.id,
        watchTime: watchTime || 0,
        lastPosition: lastPosition || 0,
        isCompleted: isCompleted || false,
        rating,
        feedback
      }
    })

    // Update tutorial completion count if user completed it
    if (isCompleted) {
      await prisma.videoTutorial.update({
        where: { id: tutorial.id },
        data: {
          completions: { increment: 1 }
        }
      })
    }

    // Update tutorial rating if user rated it
    if (rating) {
      const ratings = await prisma.videoUserProgress.findMany({
        where: {
          videoId: tutorial.id,
          rating: { not: null }
        },
        select: {
          rating: true
        }
      })

      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
        : 0

      await prisma.videoTutorial.update({
        where: { id: tutorial.id },
        data: {
          averageRating
        }
      })
    }

    return NextResponse.json(progress)

  } catch (error) {
    console.error('Failed to update video progress:', error)
    return NextResponse.json(
      { error: 'Failed to update video progress' },
      { status: 500 }
    )
  }
}

// GET /api/video-tutorials/[slug]/progress - Get user progress
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Find the video tutorial
    const tutorial = await prisma.videoTutorial.findFirst({
      where: {
        slug,
        isActive: true,
        isPublished: true
      }
    })

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      )
    }

    const progress = await prisma.videoUserProgress.findUnique({
      where: {
        userId_videoId: {
          userId: session.user.id,
          videoId: tutorial.id
        }
      }
    })

    return NextResponse.json(progress || {
      userId: session.user.id,
      videoId: tutorial.id,
      watchTime: 0,
      lastPosition: 0,
      isCompleted: false,
      rating: null,
      feedback: null
    })

  } catch (error) {
    console.error('Failed to get video progress:', error)
    return NextResponse.json(
      { error: 'Failed to get video progress' },
      { status: 500 }
    )
  }
}