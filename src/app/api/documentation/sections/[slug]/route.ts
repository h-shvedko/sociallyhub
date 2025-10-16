import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/documentation/sections/[slug] - Get specific section with pages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    const section = await prisma.documentationSection.findUnique({
      where: { slug },
      include: {
        pages: {
          where: {
            status: 'published'
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            views: true,
            helpfulVotes: true,
            estimatedReadTime: true,
            publishedAt: true,
            sortOrder: true,
            author: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Documentation section not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(section)
  } catch (error) {
    console.error('Failed to fetch documentation section:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation section' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/sections/[slug] - Update section
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { title, description, icon, sortOrder, isActive } = body

    const section = await prisma.documentationSection.update({
      where: { slug },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json(section)
  } catch (error) {
    console.error('Failed to update documentation section:', error)
    return NextResponse.json(
      { error: 'Failed to update documentation section' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/sections/[slug] - Delete section
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    // Check if section has pages
    const pagesCount = await prisma.documentationPage.count({
      where: { section: { slug } }
    })

    if (pagesCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete section that contains pages. Please delete all pages first.' },
        { status: 400 }
      )
    }

    await prisma.documentationSection.delete({
      where: { slug }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete documentation section:', error)
    return NextResponse.json(
      { error: 'Failed to delete documentation section' },
      { status: 500 }
    )
  }
}