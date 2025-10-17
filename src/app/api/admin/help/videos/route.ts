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
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const where: any = {
      workspaceId: userWorkspace.workspaceId
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } }
      ]
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    const [videos, total] = await Promise.all([
      prisma.videoTutorial.findMany({
        where,
        include: {
          chapters: {
            orderBy: { startTime: 'asc' }
          },
          analytics: {
            select: {
              views: true,
              uniqueViews: true,
              watchTime: true,
              completionRate: true,
              likes: true,
              dislikes: true
            }
          },
          playlist: {
            select: {
              id: true,
              title: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.videoTutorial.count({ where })
    ])

    return NextResponse.json({
      videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching videos:', error)
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
    const {
      title,
      description,
      category,
      tags,
      status = 'DRAFT',
      isPublic = false,
      videoFile,
      thumbnailUrl,
      duration,
      resolution,
      fileSize,
      mimeType,
      playlistId,
      seoTitle,
      seoDescription,
      seoKeywords,
      allowComments = true,
      allowRatings = true,
      chapters = []
    } = body

    // Validate required fields
    if (!title || !description || !category) {
      return NextResponse.json({
        error: 'Missing required fields: title, description, category'
      }, { status: 400 })
    }

    // Create video tutorial
    const video = await prisma.videoTutorial.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        title,
        description,
        category,
        tags: tags || [],
        status,
        isPublic,
        videoUrl: videoFile?.url || '',
        thumbnailUrl,
        duration: duration || 0,
        resolution,
        fileSize: fileSize || 0,
        mimeType,
        playlistId,
        seoTitle,
        seoDescription,
        seoKeywords,
        allowComments,
        allowRatings,
        chapters: {
          create: chapters.map((chapter: any, index: number) => ({
            title: chapter.title,
            description: chapter.description,
            startTime: chapter.startTime,
            endTime: chapter.endTime,
            order: index + 1
          }))
        },
        analytics: {
          create: {
            views: 0,
            uniqueViews: 0,
            watchTime: 0,
            completionRate: 0,
            likes: 0,
            dislikes: 0,
            shares: 0,
            comments: 0
          }
        }
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

    return NextResponse.json(video, { status: 201 })
  } catch (error) {
    console.error('Error creating video:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}