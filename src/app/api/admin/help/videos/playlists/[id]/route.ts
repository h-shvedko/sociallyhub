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

    const playlist = await prisma.videoPlaylist.findFirst({
      where: {
        id: params.id,
        workspaceId: userWorkspace.workspaceId
      },
      include: {
        videos: {
          include: {
            analytics: {
              select: {
                views: true,
                uniqueViews: true,
                watchTime: true,
                completionRate: true
              }
            },
            chapters: {
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true
              },
              orderBy: { order: 'asc' }
            }
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

    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    // Calculate playlist statistics
    const stats = {
      totalDuration: playlist.videos.reduce((sum, video) => sum + (video.duration || 0), 0),
      totalViews: playlist.videos.reduce((sum, video) => sum + (video.analytics?.views || 0), 0),
      totalWatchTime: playlist.videos.reduce((sum, video) => sum + (video.analytics?.watchTime || 0), 0),
      avgCompletionRate: playlist.videos.length > 0
        ? playlist.videos.reduce((sum, video) => sum + (video.analytics?.completionRate || 0), 0) / playlist.videos.length
        : 0,
      publishedVideos: playlist.videos.filter(video => video.status === 'PUBLISHED').length,
      draftVideos: playlist.videos.filter(video => video.status === 'DRAFT').length
    }

    return NextResponse.json({
      ...playlist,
      stats
    })
  } catch (error) {
    console.error('Error fetching playlist:', error)
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

    // Verify playlist exists and belongs to workspace
    const existingPlaylist = await prisma.videoPlaylist.findFirst({
      where: {
        id: params.id,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingPlaylist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      title,
      description,
      category,
      thumbnailUrl,
      isPublic,
      tags,
      videoIds,
      action
    } = body

    // Handle video reordering
    if (action === 'reorder' && videoIds && Array.isArray(videoIds)) {
      // Update video order by temporarily removing from playlist, then adding back in order
      await prisma.videoTutorial.updateMany({
        where: {
          playlistId: params.id
        },
        data: {
          playlistId: null
        }
      })

      // Add videos back in the specified order
      for (let i = 0; i < videoIds.length; i++) {
        await prisma.videoTutorial.update({
          where: { id: videoIds[i] },
          data: { playlistId: params.id }
        })
      }

      // Return updated playlist
      const updatedPlaylist = await prisma.videoPlaylist.findUnique({
        where: { id: params.id },
        include: {
          videos: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      return NextResponse.json(updatedPlaylist)
    }

    // Handle adding/removing videos
    if (action === 'manage_videos' && videoIds && Array.isArray(videoIds)) {
      // Remove all videos from playlist first
      await prisma.videoTutorial.updateMany({
        where: {
          playlistId: params.id
        },
        data: {
          playlistId: null
        }
      })

      // Verify videos belong to workspace
      if (videoIds.length > 0) {
        const videos = await prisma.videoTutorial.findMany({
          where: {
            id: { in: videoIds },
            workspaceId: userWorkspace.workspaceId
          }
        })

        if (videos.length !== videoIds.length) {
          return NextResponse.json({
            error: 'Some videos not found or not accessible'
          }, { status: 400 })
        }

        // Add videos to playlist
        await prisma.videoTutorial.updateMany({
          where: {
            id: { in: videoIds }
          },
          data: {
            playlistId: params.id
          }
        })
      }
    }

    // Update playlist metadata
    const updateData: any = {
      updatedAt: new Date()
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl
    if (isPublic !== undefined) updateData.isPublic = isPublic
    if (tags !== undefined) updateData.tags = tags

    const playlist = await prisma.videoPlaylist.update({
      where: { id: params.id },
      data: updateData,
      include: {
        videos: {
          include: {
            analytics: {
              select: {
                views: true,
                uniqueViews: true,
                watchTime: true,
                completionRate: true
              }
            }
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

    // Calculate stats
    const stats = {
      totalDuration: playlist.videos.reduce((sum, video) => sum + (video.duration || 0), 0),
      totalViews: playlist.videos.reduce((sum, video) => sum + (video.analytics?.views || 0), 0),
      publishedVideos: playlist.videos.filter(video => video.status === 'PUBLISHED').length
    }

    return NextResponse.json({
      ...playlist,
      stats
    })
  } catch (error) {
    console.error('Error updating playlist:', error)
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

    // Verify playlist exists and belongs to workspace
    const existingPlaylist = await prisma.videoPlaylist.findFirst({
      where: {
        id: params.id,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!existingPlaylist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    // Remove videos from playlist (don't delete videos, just unassign)
    await prisma.videoTutorial.updateMany({
      where: {
        playlistId: params.id
      },
      data: {
        playlistId: null
      }
    })

    // Delete playlist
    await prisma.videoPlaylist.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Playlist deleted successfully' })
  } catch (error) {
    console.error('Error deleting playlist:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}