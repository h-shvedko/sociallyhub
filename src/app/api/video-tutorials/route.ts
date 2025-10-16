import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/video-tutorials - List video tutorials with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categorySlug = searchParams.get('categorySlug')
    const difficulty = searchParams.get('difficulty')
    const featured = searchParams.get('featured')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      isActive: true,
      isPublished: true
    }

    if (categorySlug && categorySlug !== 'all') {
      where.category = {
        slug: categorySlug
      }
    }

    if (difficulty) {
      where.difficulty = difficulty
    }

    if (featured === 'true') {
      where.isFeatured = true
    }

    const [tutorials, totalCount] = await Promise.all([
      prisma.videoTutorial.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          videoUrl: true,
          videoPlatform: true,
          videoId: true,
          duration: true,
          difficulty: true,
          tags: true,
          views: true,
          likes: true,
          averageRating: true,
          isFeatured: true,
          authorName: true,
          authorAvatar: true,
          publishedAt: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true
            }
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { publishedAt: 'desc' },
          { sortOrder: 'asc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.videoTutorial.count({ where })
    ])

    return NextResponse.json({
      tutorials,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + tutorials.length < totalCount
      }
    })

  } catch (error) {
    console.error('Failed to fetch video tutorials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch video tutorials' },
      { status: 500 }
    )
  }
}

// POST /api/video-tutorials - Create a new video tutorial (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      slug,
      description,
      categoryId,
      thumbnailUrl,
      videoUrl,
      videoPlatform = 'youtube',
      videoId,
      duration,
      difficulty = 'beginner',
      tags = [],
      transcript,
      authorName,
      authorAvatar,
      isPublished = false,
      isFeatured = false
    } = body

    // Validation
    if (!title || !slug || !categoryId || !videoUrl) {
      return NextResponse.json(
        { error: 'Title, slug, category, and video URL are required' },
        { status: 400 }
      )
    }

    // Check if slug is unique
    const existingTutorial = await prisma.videoTutorial.findUnique({
      where: { slug }
    })

    if (existingTutorial) {
      return NextResponse.json(
        { error: 'A tutorial with this slug already exists' },
        { status: 409 }
      )
    }

    const tutorial = await prisma.videoTutorial.create({
      data: {
        title: title.trim(),
        slug: slug.trim(),
        description: description?.trim(),
        categoryId,
        thumbnailUrl,
        videoUrl: videoUrl.trim(),
        videoPlatform,
        videoId,
        duration,
        difficulty,
        tags,
        transcript,
        authorName: authorName?.trim(),
        authorAvatar,
        isPublished,
        isFeatured,
        publishedAt: isPublished ? new Date() : null
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

    return NextResponse.json(tutorial, { status: 201 })

  } catch (error) {
    console.error('Failed to create video tutorial:', error)
    return NextResponse.json(
      { error: 'Failed to create video tutorial' },
      { status: 500 }
    )
  }
}