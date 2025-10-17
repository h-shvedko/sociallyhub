import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const video = await prisma.videoTutorial.findFirst({
      where: {
        id: params.id,
        workspaceId: userWorkspace.workspaceId
      },
      include: {
        chapters: {
          orderBy: { order: 'asc' }
        },
        analytics: true,
        playlist: {
          select: {
            id: true,
            title: true,
            description: true
          }
        }
      }
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return NextResponse.json(video)
  } catch (error) {
    console.error('Error fetching video:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify video exists and belongs to workspace
    const existingVideo = await prisma.videoTutorial.findFirst({
      where: {
        id: params.id,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      category,
      tags,
      status,
      isPublic,
      thumbnailUrl,
      duration,
      resolution,
      fileSize,
      mimeType,
      playlistId,
      seoTitle,
      seoDescription,
      seoKeywords,
      allowComments,
      allowRatings,
      chapters
    } = body

    // Update video tutorial
    const video = await prisma.videoTutorial.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(status !== undefined && { status }),
        ...(isPublic !== undefined && { isPublic }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(duration !== undefined && { duration }),
        ...(resolution !== undefined && { resolution }),
        ...(fileSize !== undefined && { fileSize }),
        ...(mimeType !== undefined && { mimeType }),
        ...(playlistId !== undefined && { playlistId }),
        ...(seoTitle !== undefined && { seoTitle }),
        ...(seoDescription !== undefined && { seoDescription }),
        ...(seoKeywords !== undefined && { seoKeywords }),
        ...(allowComments !== undefined && { allowComments }),
        ...(allowRatings !== undefined && { allowRatings }),
        updatedAt: new Date()
      },
      include: {
        chapters: {
          orderBy: { order: 'asc' }
        },
        analytics: true,
        playlist: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    // Update chapters if provided
    if (chapters && Array.isArray(chapters)) {
      // Delete existing chapters
      await prisma.videoChapter.deleteMany({
        where: { videoId: params.id }
      })

      // Create new chapters
      await prisma.videoChapter.createMany({
        data: chapters.map((chapter: any, index: number) => ({
          videoId: params.id,
          title: chapter.title,
          description: chapter.description,
          startTime: chapter.startTime,
          endTime: chapter.endTime,
          order: index + 1
        }))
      })

      // Fetch updated video with new chapters
      const updatedVideo = await prisma.videoTutorial.findUnique({
        where: { id: params.id },
        include: {
          chapters: {
            orderBy: { order: 'asc' }
          },
          analytics: true,
          playlist: {
            select: {
              id: true,
              title: true
            }
          }
        }
      })

      return NextResponse.json(updatedVideo)
    }

    return NextResponse.json(video)
  } catch (error) {
    console.error('Error updating video:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verify video exists and belongs to workspace
    const existingVideo = await prisma.videoTutorial.findFirst({
      where: {
        id: params.id,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Delete video and related data (cascading deletes handled by Prisma)
    await prisma.videoTutorial.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Video deleted successfully' })
  } catch (error) {
    console.error('Error deleting video:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}