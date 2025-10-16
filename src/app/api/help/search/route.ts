import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

// Helper function to highlight search terms in text
function highlightText(text: string, query: string): string {
  if (!text || !query) return text

  const words = query.split(' ').filter(word => word.length > 0)
  let result = text

  words.forEach(word => {
    const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi')
    result = result.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
  })

  return result
}

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper function to extract snippet around search terms
function extractSnippet(content: string, query: string, maxLength: number = 150): string {
  if (!content || !query) return content.substring(0, maxLength) + '...'

  const words = query.split(' ').filter(word => word.length > 0)
  let bestPosition = 0
  let bestScore = 0

  // Find the position with the most query words
  words.forEach(word => {
    const regex = new RegExp(escapeRegExp(word), 'gi')
    let match
    while ((match = regex.exec(content)) !== null) {
      const position = match.index
      const surroundingText = content.substring(
        Math.max(0, position - maxLength / 2),
        Math.min(content.length, position + maxLength / 2)
      )

      // Count matches in this snippet
      const score = words.reduce((acc, w) => {
        const wordRegex = new RegExp(escapeRegExp(w), 'gi')
        return acc + (surroundingText.match(wordRegex) || []).length
      }, 0)

      if (score > bestScore) {
        bestScore = score
        bestPosition = Math.max(0, position - maxLength / 2)
      }
    }
  })

  const snippet = content.substring(bestPosition, bestPosition + maxLength)
  const highlighted = highlightText(snippet, query)

  return (bestPosition > 0 ? '...' : '') + highlighted +
         (bestPosition + maxLength < content.length ? '...' : '')
}

// Helper function to calculate relevance score
function calculateRelevanceScore(item: any, query: string): number {
  const words = query.split(' ').filter(word => word.length > 0)
  let score = 0

  words.forEach(word => {
    const regex = new RegExp(escapeRegExp(word), 'gi')

    // Title matches are worth more
    const titleMatches = (item.title || '').match(regex) || []
    score += titleMatches.length * 10

    // Excerpt matches
    const excerptMatches = (item.excerpt || item.answer || '').match(regex) || []
    score += excerptMatches.length * 5

    // Content matches
    const contentMatches = (item.content || '').match(regex) || []
    score += contentMatches.length * 1

    // Tag matches
    if (item.tags && Array.isArray(item.tags)) {
      const tagMatches = item.tags.filter((tag: string) =>
        tag.toLowerCase().includes(word.toLowerCase())
      ).length
      score += tagMatches * 8
    }
  })

  // Boost based on popularity
  score += (item.views || 0) * 0.01
  score += (item.helpfulVotes || 0) * 0.1

  return score
}

// GET /api/help/search - Enhanced search with analytics
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query')
    const type = searchParams.get('type') // 'articles', 'faqs', or 'all' (default)
    const limit = parseInt(searchParams.get('limit') || '20')
    const categoryId = searchParams.get('categoryId')
    const sortBy = searchParams.get('sortBy') || 'relevance' // relevance, date, popularity
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const authorId = searchParams.get('authorId')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const trimmedQuery = query.trim().toLowerCase()

    // Get request metadata for analytics
    const headersList = headers()
    const userAgent = headersList.get('user-agent') || ''
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown'

    const results: any = {}
    let totalResults = 0

    // Build advanced search conditions
    const buildSearchConditions = (searchQuery: string) => {
      return [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { excerpt: { contains: searchQuery, mode: 'insensitive' } },
        { content: { contains: searchQuery, mode: 'insensitive' } },
        { tags: { hasSome: searchQuery.split(' ') } }
      ]
    }

    // Search articles if type is 'articles' or 'all'
    if (type === 'articles' || type === 'all' || !type) {
      const articleWhere: any = {
        status: 'published',
        OR: buildSearchConditions(trimmedQuery)
      }

      // Add category filter
      if (categoryId) {
        articleWhere.categoryId = categoryId
      }

      // Add date filters
      if (dateFrom || dateTo) {
        articleWhere.publishedAt = {}
        if (dateFrom) articleWhere.publishedAt.gte = new Date(dateFrom)
        if (dateTo) articleWhere.publishedAt.lte = new Date(dateTo)
      }

      // Add author filter
      if (authorId) {
        articleWhere.authorId = authorId
      }

      // Build order by based on sortBy parameter
      let orderBy: any = []
      switch (sortBy) {
        case 'date':
          orderBy = [{ publishedAt: 'desc' }]
          break
        case 'popularity':
          orderBy = [{ views: 'desc' }, { helpfulVotes: 'desc' }]
          break
        case 'relevance':
        default:
          // For relevance, we'll use a combination of factors
          orderBy = [
            { helpfulVotes: 'desc' },
            { views: 'desc' },
            { publishedAt: 'desc' }
          ]
          break
      }

      const articles = await prisma.helpArticle.findMany({
        where: articleWhere,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          content: true, // Include for highlighting
          readingTime: true,
          views: true,
          helpfulVotes: true,
          publishedAt: true,
          tags: true,
          category: {
            select: {
              name: true,
              slug: true
            }
          },
          author: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy,
        take: limit
      })

      // Add highlighting and relevance scoring
      const articlesWithHighlights = articles.map(article => {
        const highlightedTitle = highlightText(article.title, trimmedQuery)
        const highlightedExcerpt = highlightText(article.excerpt || '', trimmedQuery)
        const snippet = extractSnippet(article.content, trimmedQuery, 150)

        return {
          ...article,
          content: undefined, // Remove full content from response
          highlightedTitle,
          highlightedExcerpt,
          snippet,
          relevanceScore: calculateRelevanceScore(article, trimmedQuery)
        }
      })

      results.articles = articlesWithHighlights
      totalResults += articles.length
    }

    // Search FAQs if type is 'faqs' or 'all'
    if (type === 'faqs' || type === 'all' || !type) {
      const faqWhere: any = {
        isActive: true,
        OR: [
          { question: { contains: trimmedQuery, mode: 'insensitive' } },
          { answer: { contains: trimmedQuery, mode: 'insensitive' } }
        ]
      }

      if (categoryId) {
        faqWhere.categoryId = categoryId
      }

      // Build FAQ order by
      let faqOrderBy: any = []
      switch (sortBy) {
        case 'popularity':
          faqOrderBy = [
            { isPinned: 'desc' },
            { views: 'desc' },
            { helpfulVotes: 'desc' }
          ]
          break
        case 'date':
          faqOrderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }]
          break
        case 'relevance':
        default:
          faqOrderBy = [
            { isPinned: 'desc' },
            { helpfulVotes: 'desc' },
            { views: 'desc' }
          ]
          break
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
        orderBy: faqOrderBy,
        take: limit
      })

      // Add highlighting and relevance scoring for FAQs
      const faqsWithHighlights = faqs.map(faq => {
        const highlightedQuestion = highlightText(faq.question, trimmedQuery)
        const highlightedAnswer = highlightText(
          faq.answer.length > 200
            ? faq.answer.substring(0, 200) + '...'
            : faq.answer,
          trimmedQuery
        )

        return {
          ...faq,
          highlightedQuestion,
          highlightedAnswer,
          relevanceScore: calculateRelevanceScore(faq, trimmedQuery)
        }
      })

      results.faqs = faqsWithHighlights
      totalResults += faqs.length
    }

    // Track search analytics (async, don't wait for completion)
    trackSearchAnalytics(
      trimmedQuery,
      categoryId,
      totalResults,
      userAgent,
      ipAddress
    ).catch(console.error)

    // Update search suggestions (async)
    updateSearchSuggestions(trimmedQuery).catch(console.error)

    // Get total counts
    const counts: any = {}
    if (results.articles) {
      counts.articles = results.articles.length
    }
    if (results.faqs) {
      counts.faqs = results.faqs.length
    }
    counts.total = totalResults

    return NextResponse.json({
      query: query.trim(),
      results,
      counts,
      filters: {
        type,
        categoryId,
        sortBy,
        dateFrom,
        dateTo,
        authorId
      }
    })
  } catch (error) {
    console.error('Failed to search help content:', error)
    return NextResponse.json(
      { error: 'Failed to search help content' },
      { status: 500 }
    )
  }
}

// Helper function to track search analytics
async function trackSearchAnalytics(
  query: string,
  categoryId: string | null,
  resultsCount: number,
  userAgent: string,
  ipAddress: string
) {
  try {
    await prisma.helpSearchQuery.create({
      data: {
        query,
        categoryId: categoryId || undefined,
        resultsCount,
        userAgent,
        ipAddress,
        sessionId: generateSessionId(userAgent, ipAddress)
      }
    })
  } catch (error) {
    console.error('Failed to track search analytics:', error)
  }
}

// Helper function to update search suggestions
async function updateSearchSuggestions(query: string) {
  try {
    // Only track meaningful queries (3+ characters)
    if (query.length < 3) return

    await prisma.helpSearchSuggestion.upsert({
      where: { query },
      update: {
        frequency: { increment: 1 },
        lastUsed: new Date()
      },
      create: {
        query,
        frequency: 1,
        lastUsed: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to update search suggestions:', error)
  }
}

// Helper function to generate a simple session ID
function generateSessionId(userAgent: string, ipAddress: string): string {
  const data = `${userAgent}-${ipAddress}-${new Date().toDateString()}`
  // Simple hash function for session ID
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}