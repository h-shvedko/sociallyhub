import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/faqs - List FAQs with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('categoryId')
    const categorySlug = searchParams.get('categorySlug')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const isPinned = searchParams.get('isPinned')

    // Build where clause
    const where: any = {
      isActive: true
    }

    // Filter by category
    if (categoryId) {
      where.categoryId = categoryId
    } else if (categorySlug) {
      const category = await prisma.helpCategory.findUnique({
        where: { slug: categorySlug }
      })
      if (category) {
        where.categoryId = category.id
      }
    }

    // Filter by pinned status
    if (isPinned !== null) {
      where.isPinned = isPinned === 'true'
    }

    // Search filter
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Execute query with pagination
    const [faqs, total] = await Promise.all([
      prisma.helpFAQ.findMany({
        where,
        include: {
          category: true
        },
        orderBy: [
          { isPinned: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.helpFAQ.count({ where })
    ])

    return NextResponse.json({
      faqs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('Failed to fetch help FAQs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch help FAQs' },
      { status: 500 }
    )
  }
}

// POST /api/help/faqs - Create new FAQ (Admin only)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // TODO: Add authentication and admin check here
    // const session = await getServerSession()
    // if (!session?.user || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const {
      question,
      answer,
      categoryId,
      sortOrder = 0,
      isPinned = false,
      relatedArticles = [],
      isActive = true
    } = data

    // Validate required fields
    if (!question || !answer || !categoryId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create the FAQ
    const faq = await prisma.helpFAQ.create({
      data: {
        question,
        answer,
        categoryId,
        sortOrder,
        isPinned,
        relatedArticles,
        isActive
      },
      include: {
        category: true
      }
    })

    return NextResponse.json(faq, { status: 201 })
  } catch (error) {
    console.error('Failed to create help FAQ:', error)
    return NextResponse.json(
      { error: 'Failed to create help FAQ' },
      { status: 500 }
    )
  }
}