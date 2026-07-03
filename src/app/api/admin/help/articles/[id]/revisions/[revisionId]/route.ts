import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
interface RouteParams {
  params: Promise<{
    id: string
    revisionId: string
  }>
}

// GET /api/admin/help/articles/[id]/revisions/[revisionId] - Get specific revision
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

    const { id: articleId, revisionId } = params

    // Fetch specific revision
    const revision = await prisma.helpArticleRevision.findFirst({
      where: {
        id: revisionId,
        articleId
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    if (!revision) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
    }

    return NextResponse.json(revision)
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/help/articles/[id]/revisions/[revisionId] - Restore revision
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const user = await requireAdmin()

    const { id: articleId, revisionId } = params

    // Fetch the revision to restore
    const revisionToRestore = await prisma.helpArticleRevision.findFirst({
      where: {
        id: revisionId,
        articleId
      }
    })

    if (!revisionToRestore) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
    }

    // Fetch current article to get current version
    const currentArticle = await prisma.helpArticle.findUnique({
      where: { id: articleId },
      include: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    })

    if (!currentArticle) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Restore article content and create new revision
    const result = await prisma.$transaction(async (tx) => {
      // Update the article with the revision content
      const updatedArticle = await tx.helpArticle.update({
        where: { id: articleId },
        data: {
          title: revisionToRestore.title,
          content: revisionToRestore.content,
          excerpt: revisionToRestore.excerpt,
          categoryId: revisionToRestore.categoryId,
          tags: revisionToRestore.tags,
          status: revisionToRestore.status,
          seoTitle: revisionToRestore.seoTitle,
          seoDescription: revisionToRestore.seoDescription,
          updatedAt: new Date()
        },
        include: {
          category: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        }
      })

      // Create a new revision for this restore operation
      const lastRevision = currentArticle.revisions[0]
      const nextVersion = lastRevision ? lastRevision.version + 1 : 1

      const newRevision = await tx.helpArticleRevision.create({
        data: {
          articleId,
          version: nextVersion,
          title: revisionToRestore.title,
          content: revisionToRestore.content,
          excerpt: revisionToRestore.excerpt,
          categoryId: revisionToRestore.categoryId,
          tags: revisionToRestore.tags,
          status: revisionToRestore.status,
          seoTitle: revisionToRestore.seoTitle,
          seoDescription: revisionToRestore.seoDescription,
          changeSummary: `Restored from version ${revisionToRestore.version}`,
          authorId: user.id
        }
      })

      return { updatedArticle, newRevision }
    })

    return NextResponse.json({
      message: `Article restored to version ${revisionToRestore.version}`,
      article: result.updatedArticle,
      newRevision: result.newRevision
    })
  } catch (error) {
    return handleApiError(error)
  }
}