import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/faqs - List FAQs with filtering and enhanced sorting
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('categoryId')
    const categorySlug = searchParams.get('categorySlug')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'default'
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

    // Build order by clause based on sort option
    let orderBy: any[] = [{ isPinned: 'desc' }]

    switch (sortBy) {
      case 'popularity':
        orderBy.push({ helpfulVotes: 'desc' }, { views: 'desc' })
        break
      case 'recent':
        orderBy.push({ createdAt: 'desc' })
        break
      case 'alphabetical':
        orderBy.push({ question: 'asc' })
        break
      default:
        orderBy.push({ sortOrder: 'asc' }, { createdAt: 'desc' })
        break
    }

    // Execute query with pagination
    const [faqs, total] = await Promise.all([
      prisma.helpFAQ.findMany({
        where,
        include: {
          category: true
        },
        orderBy,
        take: limit,
        skip: offset
      }),
      prisma.helpFAQ.count({ where })
    ])

    // Add search highlighting if search term provided
    let processedFaqs = faqs
    if (search) {
      processedFaqs = faqs.map(faq => ({
        ...faq,
        highlightedQuestion: highlightText(faq.question, search),
        highlightedAnswer: highlightText(faq.answer, search)
      }))
    }

    return NextResponse.json({
      faqs: processedFaqs,
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

// Helper function to highlight search terms in text
function highlightText(text: string, searchTerm: string): string {
  if (!searchTerm || !text) return text

  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
}

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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