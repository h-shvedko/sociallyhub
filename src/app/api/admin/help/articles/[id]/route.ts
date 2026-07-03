import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// GET /api/admin/help/articles/[id] - Get article details for admin
export async function GET(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

    const { id } = params

    // Fetch article with all admin-relevant data
    const article = await prisma.helpArticle.findUnique({
      where: { id },
      include: {
        category: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        comments: {
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
            createdAt: 'desc'
          }
        },
        revisions: {
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
          }
        },
        workflows: {
          include: {
            requestedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            },
            reviewedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        media: {
          orderBy: {
            sortOrder: 'asc'
          }
        },
        analytics: {
          orderBy: {
            date: 'desc'
          },
          take: 30 // Last 30 days
        }
      }
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    return NextResponse.json(article)
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/admin/help/articles/[id] - Update article
export async function PUT(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    const user = await requireAdmin()

    const { id } = params
    const data = await request.json()

    // Check if article exists
    const existingArticle = await prisma.helpArticle.findUnique({
      where: { id },
      include: {
        revisions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    })

    if (!existingArticle) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const {
      title,
      slug,
      content,
      excerpt,
      categoryId,
      tags = [],
      status,
      featuredImage,
      readingTime,
      relatedArticles = [],
      seoTitle,
      seoDescription,
      changeSummary
    } = data

    // If slug is changing, check for conflicts
    if (slug && slug !== existingArticle.slug) {
      const slugConflict = await prisma.helpArticle.findUnique({
        where: { slug }
      })

      if (slugConflict) {
        return NextResponse.json(
          { error: 'Article with this slug already exists' },
          { status: 400 }
        )
      }
    }

    // Update article with transaction to handle revision creation
    const result = await prisma.$transaction(async (tx) => {
      // Prepare update data
      const updateData: any = {}

      if (title) updateData.title = title
      if (slug) updateData.slug = slug
      if (content) updateData.content = content
      if (excerpt !== undefined) updateData.excerpt = excerpt
      if (categoryId) updateData.categoryId = categoryId
      if (tags) updateData.tags = tags
      if (status) {
        updateData.status = status
        // Update publishedAt when publishing
        if (status === 'published' && existingArticle.status !== 'published') {
          updateData.publishedAt = new Date()
        } else if (status !== 'published') {
          updateData.publishedAt = null
        }
      }
      if (featuredImage !== undefined) updateData.featuredImage = featuredImage
      if (readingTime !== undefined) updateData.readingTime = readingTime
      if (relatedArticles) updateData.relatedArticles = relatedArticles
      if (seoTitle !== undefined) updateData.seoTitle = seoTitle
      if (seoDescription !== undefined) updateData.seoDescription = seoDescription

      updateData.updatedAt = new Date()

      // Update the article
      const updatedArticle = await tx.helpArticle.update({
        where: { id },
        data: updateData,
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

      // Create revision if content or significant fields changed
      const significantChange = title || content || excerpt || categoryId || status
      if (significantChange) {
        const lastRevision = existingArticle.revisions[0]
        const nextVersion = lastRevision ? lastRevision.version + 1 : 1

        await tx.helpArticleRevision.create({
          data: {
            articleId: id,
            version: nextVersion,
            title: updatedArticle.title,
            content: updatedArticle.content,
            excerpt: updatedArticle.excerpt,
            categoryId: updatedArticle.categoryId,
            tags: updatedArticle.tags,
            status: updatedArticle.status,
            seoTitle: updatedArticle.seoTitle,
            seoDescription: updatedArticle.seoDescription,
            changeSummary: changeSummary || 'Article updated',
            authorId: user.id
          }
        })
      }

      return updatedArticle
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/admin/help/articles/[id] - Delete article
export async function DELETE(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

    const { id } = params

    // Check if article exists
    const existingArticle = await prisma.helpArticle.findUnique({
      where: { id }
    })

    if (!existingArticle) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Soft delete by setting status to archived
    const deletedArticle = await prisma.helpArticle.update({
      where: { id },
      data: {
        status: 'archived',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      message: 'Article archived successfully',
      article: deletedArticle
    })
  } catch (error) {
    return handleApiError(error)
  }
}