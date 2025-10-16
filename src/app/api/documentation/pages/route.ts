import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/documentation/pages - Get documentation pages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sectionSlug = searchParams.get('sectionSlug')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    const where: any = {
      status: 'published',
      isPublic: true
    }

    // Filter by section if provided
    if (sectionSlug) {
      where.section = {
        slug: sectionSlug
      }
    }

    // Add search functionality
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: search.split(' ') } }
      ]
    }

    const pages = await prisma.documentationPage.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        tags: true,
        views: true,
        helpfulVotes: true,
        estimatedReadTime: true,
        publishedAt: true,
        sortOrder: true,
        section: {
          select: {
            title: true,
            slug: true,
            icon: true
          }
        },
        author: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { publishedAt: 'desc' }
      ],
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const totalCount = await prisma.documentationPage.count({ where })

    return NextResponse.json({
      pages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Failed to fetch documentation pages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation pages' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/pages - Create new documentation page
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      slug,
      content,
      excerpt,
      sectionId,
      tags = [],
      authorId,
      featuredImage,
      sortOrder = 0,
      isPublic = true,
      seoTitle,
      seoDescription,
      keywords = [],
      estimatedReadTime
    } = body

    if (!title || !slug || !content || !sectionId) {
      return NextResponse.json(
        { error: 'Title, slug, content, and sectionId are required' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingPage = await prisma.documentationPage.findUnique({
      where: { slug }
    })

    if (existingPage) {
      return NextResponse.json(
        { error: 'Page with this slug already exists' },
        { status: 409 }
      )
    }

    // Verify section exists
    const section = await prisma.documentationSection.findUnique({
      where: { id: sectionId }
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Documentation section not found' },
        { status: 404 }
      )
    }

    const page = await prisma.documentationPage.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        sectionId,
        tags,
        authorId,
        featuredImage,
        sortOrder,
        isPublic,
        seoTitle,
        seoDescription,
        keywords,
        estimatedReadTime,
        publishedAt: new Date()
      },
      include: {
        section: {
          select: {
            title: true,
            slug: true
          }
        },
        author: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(page, { status: 201 })
  } catch (error) {
    console.error('Failed to create documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to create documentation page' },
      { status: 500 }
    )
  }
}