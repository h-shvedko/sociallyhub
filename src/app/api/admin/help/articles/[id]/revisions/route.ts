import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/admin/help/articles/[id]/revisions - Get article revision history
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

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
    return handleApiError(error)
  }
}