import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// GET /api/documentation/pages/[slug] - Get specific page
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    const page = await prisma.documentationPage.findUnique({
      where: { slug },
      include: {
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
            image: true
          }
        }
      }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Increment view count
    await prisma.documentationPage.update({
      where: { id: page.id },
      data: { views: { increment: 1 } }
    })

    return NextResponse.json({
      ...page,
      views: page.views + 1 // Return updated view count
    })
  } catch (error) {
    console.error('Failed to fetch documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation page' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/pages/[slug] - Update page
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    const body = await request.json()
    const {
      title,
      content,
      excerpt,
      tags,
      featuredImage,
      sortOrder,
      isPublic,
      seoTitle,
      seoDescription,
      keywords,
      estimatedReadTime,
      status
    } = body

    const page = await prisma.documentationPage.update({
      where: { slug },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(excerpt !== undefined && { excerpt }),
        ...(tags && { tags }),
        ...(featuredImage !== undefined && { featuredImage }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isPublic !== undefined && { isPublic }),
        ...(seoTitle !== undefined && { seoTitle }),
        ...(seoDescription !== undefined && { seoDescription }),
        ...(keywords && { keywords }),
        ...(estimatedReadTime !== undefined && { estimatedReadTime }),
        ...(status && { status }),
        lastReviewed: new Date()
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

    return NextResponse.json(page)
  } catch (error) {
    console.error('Failed to update documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to update documentation page' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/pages/[slug] - Delete page
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    await prisma.documentationPage.delete({
      where: { slug }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to delete documentation page' },
      { status: 500 }
    )
  }
}