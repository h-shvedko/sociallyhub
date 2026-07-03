import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

    const faq = await prisma.helpFAQ.findUnique({
      where: { id: params.id },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    })

    if (!faq) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    // Get analytics data
    const analytics = {
      views: faq.views,
      helpfulVotes: faq.helpfulVotes,
      notHelpfulVotes: faq.notHelpfulVotes,
      helpfulnessRate: faq.helpfulVotes + faq.notHelpfulVotes > 0
        ? ((faq.helpfulVotes / (faq.helpfulVotes + faq.notHelpfulVotes)) * 100).toFixed(1)
        : '0',
      lastViewed: faq.updatedAt // Mock last viewed time
    }

    return NextResponse.json({
      faq: {
        ...faq,
        analytics
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

    const body = await request.json()
    const {
      question,
      answer,
      categoryId,
      sortOrder,
      isActive,
      isPinned,
      tags,
      relatedArticles
    } = body

    // Check if FAQ exists
    const existingFaq = await prisma.helpFAQ.findUnique({
      where: { id: params.id }
    })

    if (!existingFaq) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    // Validate category if provided
    if (categoryId) {
      const category = await prisma.helpCategory.findUnique({
        where: { id: categoryId }
      })

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      }
    }

    // Update FAQ
    const updateData: any = {}
    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive
    if (isPinned !== undefined) updateData.isPinned = isPinned
    if (tags !== undefined) updateData.tags = tags
    if (relatedArticles !== undefined) updateData.relatedArticles = relatedArticles

    const updatedFaq = await prisma.helpFAQ.update({
      where: { id: params.id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    })

    return NextResponse.json({
      message: 'FAQ updated successfully',
      faq: updatedFaq
    })

  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Help CMS is platform-global content (ADR-0004): platform admins only.
    await requirePlatformAdmin()

    // Check if FAQ exists
    const faq = await prisma.helpFAQ.findUnique({
      where: { id: params.id }
    })

    if (!faq) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 })
    }

    // Delete FAQ
    await prisma.helpFAQ.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: 'FAQ deleted successfully'
    })

  } catch (error) {
    return handleApiError(error)
  }
}