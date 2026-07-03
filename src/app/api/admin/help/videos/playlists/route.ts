import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: any = {
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category) {
      where.category = category
    }

    const playlists = await prisma.videoPlaylist.findMany({
      where,
      include: {
        videos: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            duration: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            videos: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder }
    })

    // Calculate total duration for each playlist
    const playlistsWithStats = playlists.map(playlist => ({
      ...playlist,
      totalDuration: playlist.videos.reduce((sum, video) => sum + (video.duration || 0), 0),
      publishedVideos: playlist.videos.filter(video => video.status === 'PUBLISHED').length
    }))

    return NextResponse.json(playlistsWithStats)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

    const body = await request.json()
    const {
      title,
      description,
      category,
      thumbnailUrl,
      isPublic = false,
      tags = [],
      videoIds = []
    } = body

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json({
        error: 'Missing required fields: title, description'
      }, { status: 400 })
    }

    // Create playlist
    const playlist = await prisma.videoPlaylist.create({
      data: {
        title,
        description,
        category,
        thumbnailUrl,
        isPublic,
        tags
      }
    })

    // Add videos to playlist if provided
    if (videoIds.length > 0) {
      // Verify videos belong to workspace
      const videos = await prisma.videoTutorial.findMany({
        where: {
          id: { in: videoIds },
        }
      })

      if (videos.length !== videoIds.length) {
        return NextResponse.json({
          error: 'Some videos not found or not accessible'
        }, { status: 400 })
      }

      // Update videos to belong to this playlist
      await prisma.videoTutorial.updateMany({
        where: {
          id: { in: videoIds }
        },
        data: {
          playlistId: playlist.id
        }
      })
    }

    // Fetch complete playlist with videos
    const completePlaylist = await prisma.videoPlaylist.findUnique({
      where: { id: playlist.id },
      include: {
        videos: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            duration: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            videos: true
          }
        }
      }
    })

    return NextResponse.json({
      ...completePlaylist,
      totalDuration: completePlaylist.videos.reduce((sum, video) => sum + (video.duration || 0), 0),
      publishedVideos: completePlaylist.videos.filter(video => video.status === 'PUBLISHED').length
    }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}