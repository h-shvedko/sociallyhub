import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/admin/help/categories/[id] - Get category details for admin
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Fetch category with detailed information
    const category = await prisma.helpCategory.findUnique({
      where: { id },
      include: {
        articles: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            views: true,
            helpfulVotes: true,
            notHelpfulVotes: true,
            publishedAt: true,
            updatedAt: true,
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: [
            { status: 'asc' },
            { updatedAt: 'desc' }
          ]
        },
        faqs: {
          select: {
            id: true,
            question: true,
            views: true,
            helpfulVotes: true,
            notHelpfulVotes: true,
            isActive: true,
            updatedAt: true
          },
          orderBy: {
            sortOrder: 'asc'
          }
        },
        analytics: {
          orderBy: {
            date: 'desc'
          },
          take: 30 // Last 30 days
        },
        _count: {
          select: {
            articles: true,
            faqs: true
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Calculate category statistics
    const stats = {
      totalArticles: category._count.articles,
      publishedArticles: category.articles.filter(a => a.status === 'published').length,
      draftArticles: category.articles.filter(a => a.status === 'draft').length,
      archivedArticles: category.articles.filter(a => a.status === 'archived').length,
      totalFaqs: category._count.faqs,
      activeFaqs: category.faqs.filter(f => f.isActive).length,
      totalViews: category.articles.reduce((sum, a) => sum + a.views, 0) +
                  category.faqs.reduce((sum, f) => sum + f.views, 0),
      totalHelpfulVotes: category.articles.reduce((sum, a) => sum + a.helpfulVotes, 0) +
                         category.faqs.reduce((sum, f) => sum + f.helpfulVotes, 0),
      totalNotHelpfulVotes: category.articles.reduce((sum, a) => sum + a.notHelpfulVotes, 0) +
                            category.faqs.reduce((sum, f) => sum + f.notHelpfulVotes, 0)
    }

    const helpfulnessRate = stats.totalHelpfulVotes + stats.totalNotHelpfulVotes > 0
      ? (stats.totalHelpfulVotes / (stats.totalHelpfulVotes + stats.totalNotHelpfulVotes)) * 100
      : 0

    return NextResponse.json({
      ...category,
      stats: {
        ...stats,
        helpfulnessRate: Math.round(helpfulnessRate * 100) / 100
      }
    })
  } catch (error) {
    console.error('Failed to fetch category details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category details' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/help/categories/[id] - Update category
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    const data = await request.json()

    // Check if category exists
    const existingCategory = await prisma.helpCategory.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const {
      name,
      slug,
      description,
      icon,
      sortOrder,
      isActive
    } = data

    // If slug is changing, check for conflicts
    if (slug && slug !== existingCategory.slug) {
      const slugConflict = await prisma.helpCategory.findUnique({
        where: { slug }
      })

      if (slugConflict) {
        return NextResponse.json(
          { error: 'Category with this slug already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (name) updateData.name = name
    if (slug) updateData.slug = slug
    if (description !== undefined) updateData.description = description
    if (icon !== undefined) updateData.icon = icon
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder
    if (isActive !== undefined) updateData.isActive = isActive

    updateData.updatedAt = new Date()

    // Update the category
    const updatedCategory = await prisma.helpCategory.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            articles: true,
            faqs: true
          }
        }
      }
    })

    return NextResponse.json({
      ...updatedCategory,
      articleCount: updatedCategory._count.articles,
      faqCount: updatedCategory._count.faqs
    })
  } catch (error) {
    console.error('Failed to update category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/help/categories/[id] - Delete category
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params

    // Check if category exists and has content
    const existingCategory = await prisma.helpCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            articles: true,
            faqs: true
          }
        }
      }
    })

    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Check if category has content
    if (existingCategory._count.articles > 0 || existingCategory._count.faqs > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete category with existing articles or FAQs. Please move or delete content first.',
          articleCount: existingCategory._count.articles,
          faqCount: existingCategory._count.faqs
        },
        { status: 400 }
      )
    }

    // Delete the category
    await prisma.helpCategory.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Category deleted successfully',
      deletedCategory: {
        id: existingCategory.id,
        name: existingCategory.name,
        slug: existingCategory.slug
      }
    })
  } catch (error) {
    console.error('Failed to delete category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}