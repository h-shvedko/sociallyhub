import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/help/workflows - List all article workflows
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const workflowType = searchParams.get('workflowType')
    const assignedToId = searchParams.get('assignedToId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (workflowType) {
      where.workflowType = workflowType
    }

    if (assignedToId) {
      where.assignedToId = assignedToId
    }

    // Fetch workflows with pagination
    const [workflows, total] = await Promise.all([
      prisma.helpArticleWorkflow.findMany({
        where,
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
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.helpArticleWorkflow.count({ where })
    ])

    // Get workflow statistics
    const stats = await prisma.helpArticleWorkflow.groupBy({
      by: ['status'],
      _count: true
    })

    return NextResponse.json({
      workflows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      stats: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count
        return acc
      }, {} as Record<string, number>)
    })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

// POST /api/admin/help/workflows - Create new workflow
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
    const {
      articleId,
      workflowType,
      assignedToId,
      proposedTitle,
      proposedContent,
      proposedExcerpt,
      proposedCategoryId,
      proposedTags,
      proposedSeoTitle,
      proposedSeoDescription
    } = data

    // Validate required fields
    if (!articleId || !workflowType) {
      return NextResponse.json(
        { error: 'Missing required fields: articleId, workflowType' },
        { status: 400 }
      )
    }

    // Verify article exists
    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId }
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 400 }
      )
    }

    // Verify assigned user exists (if provided)
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId }
      })

      if (!assignedUser) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 400 }
        )
      }
    }

    // Create the workflow
    const workflow = await prisma.helpArticleWorkflow.create({
      data: {
        articleId,
        workflowType,
        requestedById: userId,
        assignedToId,
        proposedTitle,
        proposedContent,
        proposedExcerpt,
        proposedCategoryId,
        proposedTags: proposedTags || [],
        proposedSeoTitle,
        proposedSeoDescription
      },
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
        }
      }
    })

    return NextResponse.json(workflow, { status: 201 })
  } catch (error) {
    console.error('Failed to create workflow:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}