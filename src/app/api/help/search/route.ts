import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/search - Search articles and FAQs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query')
    const type = searchParams.get('type') // 'articles', 'faqs', or 'all' (default)
    const limit = parseInt(searchParams.get('limit') || '10')
    const categoryId = searchParams.get('categoryId')

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const results: any = {}

    // Search articles if type is 'articles' or 'all'
    if (type === 'articles' || type === 'all' || !type) {
      const articleWhere: any = {
        status: 'published',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { excerpt: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } }
        ]
      }

      if (categoryId) {
        articleWhere.categoryId = categoryId
      }

      const articles = await prisma.helpArticle.findMany({
        where: articleWhere,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          readingTime: true,
          views: true,
          publishedAt: true,
          category: {
            select: {
              name: true,
              slug: true
            }
          },
          author: {
            select: {
              name: true
            }
          }
        },
        orderBy: [
          { views: 'desc' },
          { helpfulVotes: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: limit
      })

      results.articles = articles
    }

    // Search FAQs if type is 'faqs' or 'all'
    if (type === 'faqs' || type === 'all' || !type) {
      const faqWhere: any = {
        isActive: true,
        OR: [
          { question: { contains: query, mode: 'insensitive' } },
          { answer: { contains: query, mode: 'insensitive' } }
        ]
      }

      if (categoryId) {
        faqWhere.categoryId = categoryId
      }

      const faqs = await prisma.helpFAQ.findMany({
        where: faqWhere,
        select: {
          id: true,
          question: true,
          answer: true,
          views: true,
          helpfulVotes: true,
          isPinned: true,
          category: {
            select: {
              name: true,
              slug: true
            }
          }
        },
        orderBy: [
          { isPinned: 'desc' },
          { views: 'desc' },
          { helpfulVotes: 'desc' }
        ],
        take: limit
      })

      // Truncate answer for search results
      results.faqs = faqs.map(faq => ({
        ...faq,
        answer: faq.answer.length > 200
          ? faq.answer.substring(0, 200) + '...'
          : faq.answer
      }))
    }

    // Get total counts
    const counts: any = {}
    if (results.articles) {
      counts.articles = results.articles.length
    }
    if (results.faqs) {
      counts.faqs = results.faqs.length
    }
    counts.total = (counts.articles || 0) + (counts.faqs || 0)

    return NextResponse.json({
      query,
      results,
      counts
    })
  } catch (error) {
    console.error('Failed to search help content:', error)
    return NextResponse.json(
      { error: 'Failed to search help content' },
      { status: 500 }
    )
  }
}