import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/search/suggestions - Get search suggestions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    let suggestions: any[] = []

    if (query.trim().length > 0) {
      // Get suggestions that start with or contain the query
      suggestions = await prisma.helpSearchSuggestion.findMany({
        where: {
          query: {
            contains: query.trim(),
            mode: 'insensitive'
          }
        },
        orderBy: [
          { frequency: 'desc' },
          { lastUsed: 'desc' }
        ],
        take: limit,
        select: {
          query: true,
          frequency: true,
          lastUsed: true
        }
      })
    } else {
      // Get most popular suggestions
      suggestions = await prisma.helpSearchSuggestion.findMany({
        orderBy: [
          { frequency: 'desc' },
          { lastUsed: 'desc' }
        ],
        take: limit,
        select: {
          query: true,
          frequency: true,
          lastUsed: true
        }
      })
    }

    return NextResponse.json({
      suggestions: suggestions.map(s => s.query),
      detailed: suggestions
    })
  } catch (error) {
    console.error('Failed to fetch search suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch search suggestions' },
      { status: 500 }
    )
  }
}