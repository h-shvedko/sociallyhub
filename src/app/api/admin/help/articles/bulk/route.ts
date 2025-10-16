import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/admin/help/articles/bulk - Bulk operations on articles
export async function POST(request: NextRequest) {
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

    const data = await request.json()
    const { operation, articleIds, updateData } = data

    // Validate input
    if (!operation || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing operation or articleIds' },
        { status: 400 }
      )
    }

    // Validate that all articles exist
    const existingArticles = await prisma.helpArticle.findMany({
      where: {
        id: { in: articleIds }
      },
      select: { id: true, title: true, status: true }
    })

    if (existingArticles.length !== articleIds.length) {
      return NextResponse.json(
        { error: 'Some articles not found' },
        { status: 400 }
      )
    }

    let result

    switch (operation) {
      case 'publish':
        result = await prisma.helpArticle.updateMany({
          where: {
            id: { in: articleIds }
          },
          data: {
            status: 'published',
            publishedAt: new Date(),
            updatedAt: new Date()
          }
        })
        break

      case 'unpublish':
        result = await prisma.helpArticle.updateMany({
          where: {
            id: { in: articleIds }
          },
          data: {
            status: 'draft',
            publishedAt: null,
            updatedAt: new Date()
          }
        })
        break

      case 'archive':
        result = await prisma.helpArticle.updateMany({
          where: {
            id: { in: articleIds }
          },
          data: {
            status: 'archived',
            updatedAt: new Date()
          }
        })
        break

      case 'delete':
        // Permanently delete articles (use with caution)
        result = await prisma.helpArticle.deleteMany({
          where: {
            id: { in: articleIds }
          }
        })
        break

      case 'update_category':
        if (!updateData?.categoryId) {
          return NextResponse.json(
            { error: 'Missing categoryId for update_category operation' },
            { status: 400 }
          )
        }

        // Verify category exists
        const category = await prisma.helpCategory.findUnique({
          where: { id: updateData.categoryId }
        })

        if (!category) {
          return NextResponse.json(
            { error: 'Category not found' },
            { status: 400 }
          )
        }

        result = await prisma.helpArticle.updateMany({
          where: {
            id: { in: articleIds }
          },
          data: {
            categoryId: updateData.categoryId,
            updatedAt: new Date()
          }
        })
        break

      case 'add_tags':
        if (!updateData?.tags || !Array.isArray(updateData.tags)) {
          return NextResponse.json(
            { error: 'Missing tags array for add_tags operation' },
            { status: 400 }
          )
        }

        // This is more complex as we need to merge tags
        const addTagsResult = await prisma.$transaction(async (tx) => {
          const updates = await Promise.all(
            articleIds.map(async (articleId) => {
              const article = await tx.helpArticle.findUnique({
                where: { id: articleId },
                select: { tags: true }
              })

              if (!article) return null

              const existingTags = article.tags || []
              const newTags = [...new Set([...existingTags, ...updateData.tags])]

              return tx.helpArticle.update({
                where: { id: articleId },
                data: {
                  tags: newTags,
                  updatedAt: new Date()
                }
              })
            })
          )

          return { count: updates.filter(Boolean).length }
        })

        result = addTagsResult
        break

      case 'remove_tags':
        if (!updateData?.tags || !Array.isArray(updateData.tags)) {
          return NextResponse.json(
            { error: 'Missing tags array for remove_tags operation' },
            { status: 400 }
          )
        }

        const removeTagsResult = await prisma.$transaction(async (tx) => {
          const updates = await Promise.all(
            articleIds.map(async (articleId) => {
              const article = await tx.helpArticle.findUnique({
                where: { id: articleId },
                select: { tags: true }
              })

              if (!article) return null

              const existingTags = article.tags || []
              const newTags = existingTags.filter(tag => !updateData.tags.includes(tag))

              return tx.helpArticle.update({
                where: { id: articleId },
                data: {
                  tags: newTags,
                  updatedAt: new Date()
                }
              })
            })
          )

          return { count: updates.filter(Boolean).length }
        })

        result = removeTagsResult
        break

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        )
    }

    // Create activity log for bulk operation
    try {
      await prisma.$transaction(async (tx) => {
        // Create revisions for significant operations
        if (['publish', 'unpublish', 'archive'].includes(operation)) {
          for (const articleId of articleIds) {
            const article = await tx.helpArticle.findUnique({
              where: { id: articleId },
              include: {
                revisions: {
                  orderBy: { version: 'desc' },
                  take: 1
                }
              }
            })

            if (article) {
              const lastRevision = article.revisions[0]
              const nextVersion = lastRevision ? lastRevision.version + 1 : 1

              await tx.helpArticleRevision.create({
                data: {
                  articleId,
                  version: nextVersion,
                  title: article.title,
                  content: article.content,
                  excerpt: article.excerpt,
                  categoryId: article.categoryId,
                  tags: article.tags,
                  status: article.status,
                  seoTitle: article.seoTitle,
                  seoDescription: article.seoDescription,
                  changeSummary: `Bulk operation: ${operation}`,
                  authorId: userId
                }
              })
            }
          }
        }
      })
    } catch (error) {
      console.error('Failed to create revision logs for bulk operation:', error)
      // Don't fail the entire operation for revision creation issues
    }

    return NextResponse.json({
      message: `Bulk operation '${operation}' completed successfully`,
      affectedCount: result.count,
      operation,
      articleIds
    })
  } catch (error) {
    console.error('Failed to perform bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}