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

// GET /api/admin/help/workflows/[id] - Get workflow details
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

    const { id } = params

    // Fetch workflow details
    const workflow = await prisma.helpArticleWorkflow.findUnique({
      where: { id },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            content: true,
            excerpt: true,
            categoryId: true,
            tags: true,
            status: true,
            seoTitle: true,
            seoDescription: true
          }
        },
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
      }
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  } catch (error) {
    console.error('Failed to fetch workflow:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/help/workflows/[id] - Update workflow (approve, reject, assign)
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = params
    const data = await request.json()
    const { action, reviewComments, assignedToId } = data

    // Check if workflow exists
    const existingWorkflow = await prisma.helpArticleWorkflow.findUnique({
      where: { id },
      include: {
        article: true
      }
    })

    if (!existingWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    let updateData: any = {}
    let articleUpdateData: any = null

    switch (action) {
      case 'assign':
        if (!assignedToId) {
          return NextResponse.json(
            { error: 'assignedToId is required for assign action' },
            { status: 400 }
          )
        }

        // Verify assigned user exists
        const assignedUser = await prisma.user.findUnique({
          where: { id: assignedToId }
        })

        if (!assignedUser) {
          return NextResponse.json(
            { error: 'Assigned user not found' },
            { status: 400 }
          )
        }

        updateData = {
          assignedToId,
          status: 'pending',
          updatedAt: new Date()
        }
        break

      case 'approve':
        if (existingWorkflow.status !== 'pending') {
          return NextResponse.json(
            { error: 'Only pending workflows can be approved' },
            { status: 400 }
          )
        }

        updateData = {
          status: 'approved',
          reviewedById: userId,
          reviewedAt: new Date(),
          approvedAt: new Date(),
          reviewComments: reviewComments || 'Approved',
          updatedAt: new Date()
        }

        // Apply the proposed changes to the article
        if (existingWorkflow.workflowType === 'update') {
          articleUpdateData = {}
          if (existingWorkflow.proposedTitle) articleUpdateData.title = existingWorkflow.proposedTitle
          if (existingWorkflow.proposedContent) articleUpdateData.content = existingWorkflow.proposedContent
          if (existingWorkflow.proposedExcerpt) articleUpdateData.excerpt = existingWorkflow.proposedExcerpt
          if (existingWorkflow.proposedCategoryId) articleUpdateData.categoryId = existingWorkflow.proposedCategoryId
          if (existingWorkflow.proposedTags) articleUpdateData.tags = existingWorkflow.proposedTags
          if (existingWorkflow.proposedSeoTitle) articleUpdateData.seoTitle = existingWorkflow.proposedSeoTitle
          if (existingWorkflow.proposedSeoDescription) articleUpdateData.seoDescription = existingWorkflow.proposedSeoDescription
          articleUpdateData.updatedAt = new Date()
        } else if (existingWorkflow.workflowType === 'publish') {
          articleUpdateData = {
            status: 'published',
            publishedAt: new Date(),
            updatedAt: new Date()
          }
        } else if (existingWorkflow.workflowType === 'archive') {
          articleUpdateData = {
            status: 'archived',
            updatedAt: new Date()
          }
        }
        break

      case 'reject':
        if (existingWorkflow.status !== 'pending') {
          return NextResponse.json(
            { error: 'Only pending workflows can be rejected' },
            { status: 400 }
          )
        }

        updateData = {
          status: 'rejected',
          reviewedById: userId,
          reviewedAt: new Date(),
          rejectedAt: new Date(),
          reviewComments: reviewComments || 'Rejected',
          updatedAt: new Date()
        }
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be assign, approve, or reject' },
          { status: 400 }
        )
    }

    // Update workflow and article in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the workflow
      const updatedWorkflow = await tx.helpArticleWorkflow.update({
        where: { id },
        data: updateData,
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true
            }
          },
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
        }
      })

      // Update article if needed
      let updatedArticle = null
      if (articleUpdateData) {
        updatedArticle = await tx.helpArticle.update({
          where: { id: existingWorkflow.articleId },
          data: articleUpdateData
        })

        // Create a revision if content was updated
        if (action === 'approve' && existingWorkflow.workflowType === 'update') {
          const lastRevision = await tx.helpArticleRevision.findFirst({
            where: { articleId: existingWorkflow.articleId },
            orderBy: { version: 'desc' }
          })

          const nextVersion = lastRevision ? lastRevision.version + 1 : 1

          await tx.helpArticleRevision.create({
            data: {
              articleId: existingWorkflow.articleId,
              version: nextVersion,
              title: updatedArticle.title,
              content: updatedArticle.content,
              excerpt: updatedArticle.excerpt,
              categoryId: updatedArticle.categoryId,
              tags: updatedArticle.tags,
              status: updatedArticle.status,
              seoTitle: updatedArticle.seoTitle,
              seoDescription: updatedArticle.seoDescription,
              changeSummary: `Approved workflow: ${existingWorkflow.workflowType}`,
              authorId: userId
            }
          })
        }
      }

      return { updatedWorkflow, updatedArticle }
    })

    return NextResponse.json({
      message: `Workflow ${action}${action === 'assign' ? 'ed' : action === 'approve' ? 'd' : 'ed'} successfully`,
      workflow: result.updatedWorkflow,
      ...(result.updatedArticle && { article: result.updatedArticle })
    })
  } catch (error) {
    console.error('Failed to update workflow:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    )
  }
}