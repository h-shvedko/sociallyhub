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

// GET /api/admin/help/articles/[id]/revisions - Get article revision history
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

    const { id: articleId } = params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify article exists
    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId },
      select: { id: true, title: true }
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Fetch article revisions
    const [revisions, totalCount] = await Promise.all([
      prisma.helpArticleRevision.findMany({
        where: { articleId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        },
        orderBy: {
          version: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.helpArticleRevision.count({
        where: { articleId }
      })
    ])

    return NextResponse.json({
      revisions,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
      article: {
        id: article.id,
        title: article.title
      }
    })
  } catch (error) {
    console.error('Failed to fetch article revisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch article revisions' },
      { status: 500 }
    )
  }
}