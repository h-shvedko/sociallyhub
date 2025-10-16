import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/help/authors - Get authors for help content
export async function GET(request: NextRequest) {
  try {
    // Get unique authors from help articles
    const authors = await prisma.helpArticle.findMany({
      where: {
        status: 'published',
        author: {
          isNot: null
        }
      },
      select: {
        author: {
          select: {
            id: true,
            name: true
          }
        }
      },
      distinct: ['authorId']
    })

    // Extract unique authors
    const uniqueAuthors = authors
      .map(article => article.author)
      .filter((author, index, self) =>
        author && self.findIndex(a => a?.id === author.id) === index
      )

    return NextResponse.json({
      authors: uniqueAuthors
    })
  } catch (error) {
    console.error('Failed to fetch help authors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch authors' },
      { status: 500 }
    )
  }
}