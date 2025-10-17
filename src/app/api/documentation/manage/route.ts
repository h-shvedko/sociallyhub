import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/manage - Get documentation pages for management (with drafts)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'all'
    const sectionSlug = searchParams.get('sectionSlug')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    const where: any = {}

    // Filter by status
    if (status !== 'all') {
      where.status = status.toUpperCase()
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
        status: true,
        visibility: true,
        views: true,
        helpfulVotes: true,
        estimatedReadTime: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        sortOrder: true,
        section: {
          select: {
            id: true,
            title: true,
            slug: true,
            icon: true
          }
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            versions: true,
            comments: true,
            collaborators: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const totalCount = await prisma.documentationPage.count({ where })

    // Get status statistics
    const statusStats = await prisma.documentationPage.groupBy({
      by: ['status'],
      _count: true
    })

    return NextResponse.json({
      pages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      stats: {
        total: totalCount,
        byStatus: statusStats.reduce((acc, stat) => {
          acc[stat.status.toLowerCase()] = stat._count
          return acc
        }, {} as Record<string, number>)
      }
    })
  } catch (error) {
    console.error('Failed to fetch documentation pages for management:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation pages' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/manage - Create new documentation page with advanced features
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      title,
      slug,
      content,
      excerpt,
      sectionId,
      tags = [],
      status = 'DRAFT',
      visibility = 'INTERNAL',
      featuredImage,
      sortOrder = 0,
      seoTitle,
      seoDescription,
      keywords = [],
      estimatedReadTime,
      templateId,
      metadata = {}
    } = body

    if (!title || !content || !sectionId) {
      return NextResponse.json(
        { error: 'Title, content, and sectionId are required' },
        { status: 400 }
      )
    }

    // Generate slug if not provided
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Check if slug already exists
    const existingPage = await prisma.documentationPage.findUnique({
      where: { slug: finalSlug }
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

    // Create the page within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the page
      const page = await tx.documentationPage.create({
        data: {
          title,
          slug: finalSlug,
          content,
          excerpt,
          sectionId,
          tags,
          status: status.toUpperCase() as any,
          visibility: visibility.toUpperCase() as any,
          authorId: normalizedUserId,
          featuredImage,
          sortOrder,
          seoTitle,
          seoDescription,
          keywords,
          estimatedReadTime,
          metadata,
          publishedAt: status.toUpperCase() === 'PUBLISHED' ? new Date() : null
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

      // Create initial version
      await tx.documentationVersion.create({
        data: {
          pageId: page.id,
          version: '1.0.0',
          title: page.title,
          content: page.content,
          changelog: 'Initial version',
          authorId: normalizedUserId,
          isActive: true
        }
      })

      // Create initial revision
      await tx.documentationRevision.create({
        data: {
          pageId: page.id,
          authorId: normalizedUserId,
          action: 'CREATE',
          changes: {
            title: page.title,
            status: page.status,
            visibility: page.visibility
          },
          comment: 'Page created'
        }
      })

      return page
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Failed to create documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to create documentation page' },
      { status: 500 }
    )
  }
}