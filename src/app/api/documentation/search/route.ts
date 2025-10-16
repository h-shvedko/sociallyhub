import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
function extractSnippet(content: string, query: string, maxLength: number = 200): string {
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
function calculateRelevanceScore(page: any, query: string): number {
  const words = query.split(' ').filter(word => word.length > 0)
  let score = 0

  words.forEach(word => {
    const regex = new RegExp(escapeRegExp(word), 'gi')

    // Title matches are worth more
    const titleMatches = (page.title || '').match(regex) || []
    score += titleMatches.length * 10

    // Excerpt matches
    const excerptMatches = (page.excerpt || '').match(regex) || []
    score += excerptMatches.length * 5

    // Content matches
    const contentMatches = (page.content || '').match(regex) || []
    score += contentMatches.length * 1

    // Tag matches
    if (page.tags && Array.isArray(page.tags)) {
      const tagMatches = page.tags.filter((tag: string) =>
        tag.toLowerCase().includes(word.toLowerCase())
      ).length
      score += tagMatches * 8
    }
  })

  // Boost based on popularity
  score += (page.views || 0) * 0.01
  score += (page.helpfulVotes || 0) * 0.1

  return score
}

// GET /api/documentation/search - Search documentation pages
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query')
    const sectionSlug = searchParams.get('sectionSlug')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'relevance' // relevance, date, popularity

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    const trimmedQuery = query.trim().toLowerCase()

    // Build search conditions
    const where: any = {
      status: 'published',
      isPublic: true,
      OR: [
        { title: { contains: trimmedQuery, mode: 'insensitive' } },
        { excerpt: { contains: trimmedQuery, mode: 'insensitive' } },
        { content: { contains: trimmedQuery, mode: 'insensitive' } },
        { tags: { hasSome: trimmedQuery.split(' ') } }
      ]
    }

    // Add section filter if provided
    if (sectionSlug) {
      where.section = { slug: sectionSlug }
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

    const pages = await prisma.documentationPage.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true, // Include for highlighting and snippets
        tags: true,
        views: true,
        helpfulVotes: true,
        estimatedReadTime: true,
        publishedAt: true,
        section: {
          select: {
            title: true,
            slug: true,
            icon: true
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
    const pagesWithHighlights = pages.map(page => {
      const highlightedTitle = highlightText(page.title, trimmedQuery)
      const highlightedExcerpt = highlightText(page.excerpt || '', trimmedQuery)
      const snippet = extractSnippet(page.content, trimmedQuery, 200)

      return {
        ...page,
        content: undefined, // Remove full content from response
        highlightedTitle,
        highlightedExcerpt,
        snippet,
        relevanceScore: calculateRelevanceScore(page, trimmedQuery)
      }
    })

    // Sort by relevance score if using relevance sorting
    if (sortBy === 'relevance') {
      pagesWithHighlights.sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore)
    }

    return NextResponse.json({
      query: query.trim(),
      results: pagesWithHighlights,
      totalCount: pages.length,
      filters: {
        sectionSlug,
        sortBy
      }
    })
  } catch (error) {
    console.error('Failed to search documentation pages:', error)
    return NextResponse.json(
      { error: 'Failed to search documentation pages' },
      { status: 500 }
    )
  }
}