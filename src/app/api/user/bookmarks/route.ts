import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

// GET /api/user/bookmarks - Get user's bookmarked articles
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get bookmarked articles
    const [bookmarks, totalCount] = await Promise.all([
      prisma.helpArticleBookmark.findMany({
        where: {
          userId: session.user.id
        },
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              readingTime: true,
              views: true,
              helpfulVotes: true,
              notHelpfulVotes: true,
              publishedAt: true,
              createdAt: true,
              updatedAt: true,
              category: {
                select: {
                  name: true,
                  slug: true,
                  icon: true
                }
              },
              author: {
                select: {
                  name: true,
                  image: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.helpArticleBookmark.count({
        where: {
          userId: session.user.id
        }
      })
    ])

    const articles = bookmarks.map(bookmark => ({
      ...bookmark.article,
      bookmarkedAt: bookmark.createdAt
    }))

    return NextResponse.json({
      articles,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + bookmarks.length < totalCount
      }
    })

  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    )
  }
}