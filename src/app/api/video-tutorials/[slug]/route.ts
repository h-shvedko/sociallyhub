import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/video-tutorials/[slug] - Get specific video tutorial
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const session = await getServerSession()

    const tutorial = await prisma.videoTutorial.findFirst({
      where: {
        slug,
        isActive: true,
        isPublished: true
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true
          }
        },
        userProgress: session?.user?.id ? {
          where: {
            userId: session.user.id
          },
          select: {
            watchTime: true,
            lastPosition: true,
            isCompleted: true,
            rating: true,
            feedback: true,
            updatedAt: true
          }
        } : false
      }
    })

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      )
    }

    // Increment view count
    await prisma.videoTutorial.update({
      where: { id: tutorial.id },
      data: {
        views: { increment: 1 }
      }
    })

    return NextResponse.json({
      ...tutorial,
      views: tutorial.views + 1
    })

  } catch (error) {
    console.error('Failed to get video tutorial:', error)
    return NextResponse.json(
      { error: 'Failed to get video tutorial' },
      { status: 500 }
    )
  }
}

// PUT /api/video-tutorials/[slug] - Update video tutorial (admin only)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const body = await request.json()

    const tutorial = await prisma.videoTutorial.findUnique({
      where: { slug }
    })

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      )
    }

    const updatedTutorial = await prisma.videoTutorial.update({
      where: { slug },
      data: {
        ...body,
        updatedAt: new Date(),
        publishedAt: body.isPublished && !tutorial.publishedAt ? new Date() : tutorial.publishedAt
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true
          }
        }
      }
    })

    return NextResponse.json(updatedTutorial)

  } catch (error) {
    console.error('Failed to update video tutorial:', error)
    return NextResponse.json(
      { error: 'Failed to update video tutorial' },
      { status: 500 }
    )
  }
}

// DELETE /api/video-tutorials/[slug] - Delete video tutorial (admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    const tutorial = await prisma.videoTutorial.findUnique({
      where: { slug }
    })

    if (!tutorial) {
      return NextResponse.json(
        { error: 'Video tutorial not found' },
        { status: 404 }
      )
    }

    await prisma.videoTutorial.delete({
      where: { slug }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to delete video tutorial:', error)
    return NextResponse.json(
      { error: 'Failed to delete video tutorial' },
      { status: 500 }
    )
  }
}