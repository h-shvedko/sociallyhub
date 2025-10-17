import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspaces: true }
    })

    if (!user?.workspaces?.[0]) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const workspaceId = user.workspaces[0].workspaceId
    const { searchParams } = new URL(request.url)

    // Extract search parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sortBy') || 'sortOrder'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (category) {
      where.categoryId = category
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    // Count total FAQs
    const total = await prisma.helpFAQ.count({ where })

    // Fetch FAQs with pagination
    const faqs = await prisma.helpFAQ.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: {
        [sortBy]: sortOrder === 'desc' ? 'desc' : 'asc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    // Get analytics for each FAQ
    const faqsWithAnalytics = faqs.map(faq => ({
      ...faq,
      helpfulnessRate: faq.helpfulVotes + faq.notHelpfulVotes > 0
        ? ((faq.helpfulVotes / (faq.helpfulVotes + faq.notHelpfulVotes)) * 100).toFixed(1)
        : '0'
    }))

    // Get statistics
    const stats = {
      total,
      active: await prisma.helpFAQ.count({ where: { isActive: true } }),
      inactive: await prisma.helpFAQ.count({ where: { isActive: false } }),
      categories: await prisma.helpCategory.count({ where: { isActive: true } })
    }

    return NextResponse.json({
      faqs: faqsWithAnalytics,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      stats
    })

  } catch (error) {
    console.error('Error fetching FAQs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspaces: true }
    })

    if (!user?.workspaces?.[0]) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const body = await request.json()
    const {
      question,
      answer,
      categoryId,
      sortOrder = 0,
      isActive = true,
      isPinned = false,
      tags = [],
      relatedArticles = []
    } = body

    // Validate required fields
    if (!question || !answer || !categoryId) {
      return NextResponse.json(
        { error: 'Question, answer, and category are required' },
        { status: 400 }
      )
    }

    // Verify category exists
    const category = await prisma.helpCategory.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder
    if (sortOrder === 0) {
      const lastFaq = await prisma.helpFAQ.findFirst({
        where: { categoryId },
        orderBy: { sortOrder: 'desc' }
      })
      finalSortOrder = (lastFaq?.sortOrder || 0) + 1
    }

    // Create FAQ
    const faq = await prisma.helpFAQ.create({
      data: {
        question,
        answer,
        categoryId,
        sortOrder: finalSortOrder,
        isActive,
        isPinned,
        tags,
        relatedArticles
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    })

    return NextResponse.json({
      message: 'FAQ created successfully',
      faq
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating FAQ:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, faqIds, data } = body

    if (action === 'reorder') {
      // Handle drag-and-drop reordering
      const updates = data.updates || []

      await Promise.all(
        updates.map((update: { id: string; sortOrder: number }) =>
          prisma.helpFAQ.update({
            where: { id: update.id },
            data: { sortOrder: update.sortOrder }
          })
        )
      )

      return NextResponse.json({ message: 'FAQ order updated successfully' })
    }

    if (action === 'bulk_update') {
      // Handle bulk operations
      const { categoryId, isActive, isPinned, tags } = data

      const updateData: any = {}
      if (categoryId !== undefined) updateData.categoryId = categoryId
      if (isActive !== undefined) updateData.isActive = isActive
      if (isPinned !== undefined) updateData.isPinned = isPinned
      if (tags !== undefined) updateData.tags = tags

      await prisma.helpFAQ.updateMany({
        where: { id: { in: faqIds } },
        data: updateData
      })

      return NextResponse.json({
        message: `${faqIds.length} FAQ(s) updated successfully`
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error updating FAQs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ids = searchParams.get('ids')?.split(',') || []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No FAQ IDs provided' }, { status: 400 })
    }

    const deletedCount = await prisma.helpFAQ.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({
      message: `${deletedCount.count} FAQ(s) deleted successfully`,
      deletedCount: deletedCount.count
    })

  } catch (error) {
    console.error('Error deleting FAQs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}