import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'

// GET /api/help/categories/[slug] - Get specific category with content
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params

    const category = await prisma.helpCategory.findUnique({
      where: { slug }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Get articles and FAQs for this category
    const [articles, faqs] = await Promise.all([
      prisma.helpArticle.findMany({
        where: {
          categoryId: category.id,
          status: 'published'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          readingTime: true,
          views: true,
          helpfulVotes: true,
          publishedAt: true,
          author: {
            select: {
              name: true,
              image: true
            }
          }
        },
        orderBy: { publishedAt: 'desc' }
      }),
      prisma.helpFAQ.findMany({
        where: {
          categoryId: category.id,
          isActive: true
        },
        orderBy: [
          { isPinned: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'desc' }
        ]
      })
    ])

    return NextResponse.json({
      ...category,
      articles,
      faqs
    })
  } catch (error) {
    console.error('Failed to fetch help category:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help category' },
      { status: 500 }
    )
  }
}

// PUT /api/help/categories/[slug] - Update category (Admin only)
export async function PUT(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    // ADR-0005: content writes require platform admin (fail closed).
    await requirePlatformAdmin()

    const { slug } = params
    const data = await request.json()

    const category = await prisma.helpCategory.findUnique({
      where: { slug }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Update category
    const updatedCategory = await prisma.helpCategory.update({
      where: { id: category.id },
      data
    })

    return NextResponse.json(updatedCategory)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/help/categories/[slug] - Delete category (Admin only)
export async function DELETE(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    // ADR-0005: content writes require platform admin (fail closed).
    await requirePlatformAdmin()

    const { slug } = params

    const category = await prisma.helpCategory.findUnique({
      where: { slug }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if category has content
    const [articleCount, faqCount] = await Promise.all([
      prisma.helpArticle.count({
        where: { categoryId: category.id }
      }),
      prisma.helpFAQ.count({
        where: { categoryId: category.id }
      })
    ])

    if (articleCount > 0 || faqCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing content' },
        { status: 400 }
      )
    }

    await prisma.helpCategory.delete({
      where: { id: category.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}