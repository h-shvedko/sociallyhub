import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/manage/[id] - Get single documentation page for editing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const page = await prisma.documentationPage.findUnique({
      where: { id: params.id },
      include: {
        section: {
          select: {
            id: true,
            title: true,
            slug: true,
            icon: true
          }
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        versions: {
          select: {
            id: true,
            version: true,
            title: true,
            changelog: true,
            createdAt: true,
            isActive: true,
            author: {
              select: {
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        codeExamples: {
          select: {
            id: true,
            title: true,
            language: true,
            code: true,
            description: true,
            isTestable: true,
            testResults: true,
            sortOrder: true
          },
          orderBy: { sortOrder: 'asc' }
        },
        crossReferences: {
          select: {
            id: true,
            referencedPage: {
              select: {
                id: true,
                title: true,
                slug: true
              }
            },
            context: true,
            anchor: true
          }
        },
        referencedBy: {
          select: {
            id: true,
            page: {
              select: {
                id: true,
                title: true,
                slug: true
              }
            },
            context: true
          }
        },
        collaborators: {
          select: {
            id: true,
            role: true,
            permissions: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        analytics: {
          select: {
            views: true,
            uniqueViews: true,
            timeSpent: true,
            searchQueries: true,
            feedbackRating: true,
            exitPage: true,
            date: true
          },
          orderBy: { date: 'desc' },
          take: 30
        },
        comments: {
          select: {
            id: true,
            content: true,
            type: true,
            status: true,
            createdAt: true,
            author: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        _count: {
          select: {
            versions: true,
            comments: true,
            collaborators: true,
            analytics: true
          }
        }
      }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Failed to fetch documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation page' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/manage/[id] - Update documentation page
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      title,
      slug,
      content,
      excerpt,
      sectionId,
      tags,
      status,
      visibility,
      featuredImage,
      sortOrder,
      seoTitle,
      seoDescription,
      keywords,
      estimatedReadTime,
      metadata,
      versionComment,
      majorVersion = false
    } = body

    // Check if page exists
    const existingPage = await prisma.documentationPage.findUnique({
      where: { id: params.id },
      include: {
        versions: {
          where: { isActive: true },
          take: 1
        }
      }
    })

    if (!existingPage) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Check if slug is changing and if new slug already exists
    if (slug && slug !== existingPage.slug) {
      const slugExists = await prisma.documentationPage.findUnique({
        where: { slug }
      })

      if (slugExists) {
        return NextResponse.json(
          { error: 'Page with this slug already exists' },
          { status: 409 }
        )
      }
    }

    // Update within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Detect what changed for revision tracking
      const changes: any = {}
      if (title && title !== existingPage.title) changes.title = { from: existingPage.title, to: title }
      if (status && status !== existingPage.status) changes.status = { from: existingPage.status, to: status }
      if (visibility && visibility !== existingPage.visibility) changes.visibility = { from: existingPage.visibility, to: visibility }
      if (content && content !== existingPage.content) changes.content = true

      // Update the page
      const updatedPage = await tx.documentationPage.update({
        where: { id: params.id },
        data: {
          ...(title && { title }),
          ...(slug && { slug }),
          ...(content && { content }),
          ...(excerpt && { excerpt }),
          ...(sectionId && { sectionId }),
          ...(tags && { tags }),
          ...(status && { status: status.toUpperCase() as any }),
          ...(visibility && { visibility: visibility.toUpperCase() as any }),
          ...(featuredImage !== undefined && { featuredImage }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(seoTitle && { seoTitle }),
          ...(seoDescription && { seoDescription }),
          ...(keywords && { keywords }),
          ...(estimatedReadTime !== undefined && { estimatedReadTime }),
          ...(metadata && { metadata }),
          ...(status === 'PUBLISHED' && !existingPage.publishedAt && { publishedAt: new Date() })
        },
        include: {
          section: true,
          author: true
        }
      })

      // Create new version if content changed
      if (content && content !== existingPage.content) {
        const currentVersion = existingPage.versions[0]
        const versionParts = currentVersion?.version.split('.') || ['1', '0', '0']

        let newVersion: string
        if (majorVersion) {
          newVersion = `${parseInt(versionParts[0]) + 1}.0.0`
        } else {
          newVersion = `${versionParts[0]}.${parseInt(versionParts[1]) + 1}.0`
        }

        // Deactivate current version
        if (currentVersion) {
          await tx.documentationVersion.update({
            where: { id: currentVersion.id },
            data: { isActive: false }
          })
        }

        // Create new version
        await tx.documentationVersion.create({
          data: {
            pageId: params.id,
            version: newVersion,
            title: updatedPage.title,
            content: updatedPage.content,
            changelog: versionComment || 'Content updated',
            authorId: normalizedUserId,
            isActive: true
          }
        })
      }

      // Create revision record
      if (Object.keys(changes).length > 0) {
        await tx.documentationRevision.create({
          data: {
            pageId: params.id,
            authorId: normalizedUserId,
            action: 'UPDATE',
            changes,
            comment: versionComment || 'Page updated'
          }
        })
      }

      return updatedPage
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to update documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to update documentation page' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/manage/[id] - Delete documentation page
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)

    // Check if page exists
    const existingPage = await prisma.documentationPage.findUnique({
      where: { id: params.id }
    })

    if (!existingPage) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Delete within a transaction (cascade deletes handled by schema)
    await prisma.$transaction(async (tx) => {
      // Create final revision record
      await tx.documentationRevision.create({
        data: {
          pageId: params.id,
          authorId: normalizedUserId,
          action: 'DELETE',
          changes: {
            title: existingPage.title,
            status: existingPage.status
          },
          comment: 'Page deleted'
        }
      })

      // Delete the page (cascades to related records)
      await tx.documentationPage.delete({
        where: { id: params.id }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete documentation page:', error)
    return NextResponse.json(
      { error: 'Failed to delete documentation page' },
      { status: 500 }
    )
  }
}