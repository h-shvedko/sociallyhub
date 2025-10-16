import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/faqs/[id] - Get specific FAQ
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const faq = await prisma.helpFAQ.findUnique({
      where: { id },
      include: {
        category: true
      }
    })

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    // Increment view count (non-blocking)
    prisma.helpFAQ.update({
      where: { id },
      data: { views: { increment: 1 } }
    }).catch(console.error)

    // Get related articles if any
    let relatedArticles = []
    if (faq.relatedArticles.length > 0) {
      relatedArticles = await prisma.helpArticle.findMany({
        where: {
          id: { in: faq.relatedArticles },
          status: 'published'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          readingTime: true
        }
      })
    }

    return NextResponse.json({
      ...faq,
      relatedArticles
    })
  } catch (error) {
    console.error('Failed to fetch help FAQ:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help FAQ' },
      { status: 500 }
    )
  }
}

// PUT /api/help/faqs/[id] - Update FAQ (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const data = await request.json()

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const faq = await prisma.helpFAQ.findUnique({
      where: { id }
    })

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    // Update FAQ
    const updatedFAQ = await prisma.helpFAQ.update({
      where: { id },
      data,
      include: {
        category: true
      }
    })

    return NextResponse.json(updatedFAQ)
  } catch (error) {
    console.error('Failed to update help FAQ:', error)
    return NextResponse.json(
      { error: 'Failed to update help FAQ' },
      { status: 500 }
    )
  }
}

// DELETE /api/help/faqs/[id] - Delete FAQ (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const faq = await prisma.helpFAQ.findUnique({
      where: { id }
    })

    if (!faq) {
      return NextResponse.json(
        { error: 'FAQ not found' },
        { status: 404 }
      )
    }

    await prisma.helpFAQ.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete help FAQ:', error)
    return NextResponse.json(
      { error: 'Failed to delete help FAQ' },
      { status: 500 }
    )
  }
}