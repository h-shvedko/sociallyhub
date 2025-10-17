import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/workflow - Get workflows for a page or all pending workflows
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const searchParams = request.nextUrl.searchParams
    const pageId = searchParams.get('pageId')
    const status = searchParams.get('status')
    const assignedToMe = searchParams.get('assignedToMe') === 'true'

    const where: any = {}

    if (pageId) {
      where.pageId = pageId
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    if (assignedToMe) {
      where.assignedToId = normalizedUserId
    }

    const workflows = await prisma.documentationWorkflow.findMany({
      where,
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            section: {
              select: {
                title: true,
                slug: true
              }
            }
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
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Get statistics
    const stats = {
      total: workflows.length,
      pending: workflows.filter(w => w.status === 'PENDING').length,
      inProgress: workflows.filter(w => w.status === 'IN_PROGRESS').length,
      approved: workflows.filter(w => w.status === 'APPROVED').length,
      rejected: workflows.filter(w => w.status === 'REJECTED').length,
      completed: workflows.filter(w => w.status === 'COMPLETED').length
    }

    return NextResponse.json({
      workflows,
      stats
    })
  } catch (error) {
    console.error('Failed to fetch workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/workflow - Create new workflow
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      pageId,
      type,
      assignedToId,
      priority = 'MEDIUM',
      dueDate,
      notes
    } = body

    if (!pageId || !type) {
      return NextResponse.json(
        { error: 'Page ID and workflow type are required' },
        { status: 400 }
      )
    }

    // Verify page exists
    const page = await prisma.documentationPage.findUnique({
      where: { id: pageId }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Documentation page not found' },
        { status: 404 }
      )
    }

    // Check if there's already an active workflow for this page
    const activeWorkflow = await prisma.documentationWorkflow.findFirst({
      where: {
        pageId,
        status: {
          in: ['PENDING', 'IN_PROGRESS']
        }
      }
    })

    if (activeWorkflow) {
      return NextResponse.json(
        { error: 'Page already has an active workflow' },
        { status: 409 }
      )
    }

    // If assignedToId is provided, verify user exists
    if (assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignedToId }
      })

      if (!assignee) {
        return NextResponse.json(
          { error: 'Assignee not found' },
          { status: 404 }
        )
      }
    }

    const workflow = await prisma.documentationWorkflow.create({
      data: {
        pageId,
        type: type.toUpperCase() as any,
        status: 'PENDING',
        requestedById: normalizedUserId,
        assignedToId,
        priority: priority.toUpperCase() as any,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes
      },
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            section: {
              select: {
                title: true,
                slug: true
              }
            }
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

    // Create revision record
    await prisma.documentationRevision.create({
      data: {
        pageId,
        authorId: normalizedUserId,
        action: 'WORKFLOW_CREATE',
        changes: {
          type,
          status: 'PENDING',
          assignedTo: assignedToId
        },
        comment: `Created ${type} workflow`
      }
    })

    // Send notification to assignee
    if (assignedToId) {
      // In a real implementation, send notification via email or in-app notification system
      console.log(`Workflow assigned to user ${assignedToId} for page ${page.title}`)
    }

    return NextResponse.json(workflow, { status: 201 })
  } catch (error) {
    console.error('Failed to create workflow:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/workflow/[id] - Update workflow
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    const body = await request.json()
    const {
      status,
      assignedToId,
      priority,
      dueDate,
      notes,
      reviewNotes
    } = body

    // Check if workflow exists
    const existingWorkflow = await prisma.documentationWorkflow.findUnique({
      where: { id },
      include: {
        page: true
      }
    })

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (status) {
      updateData.status = status.toUpperCase()

      // Set timestamps based on status changes
      if (status === 'IN_PROGRESS' && !existingWorkflow.startedAt) {
        updateData.startedAt = new Date()
      }

      if (['APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
        updateData.reviewedById = normalizedUserId
        updateData.reviewedAt = new Date()
      }

      if (status === 'COMPLETED') {
        updateData.completedAt = new Date()
      }
    }

    if (assignedToId !== undefined) updateData.assignedToId = assignedToId
    if (priority) updateData.priority = priority.toUpperCase()
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (notes !== undefined) updateData.notes = notes
    if (reviewNotes !== undefined) updateData.reviewNotes = reviewNotes

    const updatedWorkflow = await prisma.documentationWorkflow.update({
      where: { id },
      data: updateData,
      include: {
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            section: {
              select: {
                title: true,
                slug: true
              }
            }
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

    // Create revision record
    await prisma.documentationRevision.create({
      data: {
        pageId: existingWorkflow.pageId,
        authorId: normalizedUserId,
        action: 'WORKFLOW_UPDATE',
        changes: {
          workflowId: id,
          oldStatus: existingWorkflow.status,
          newStatus: status || existingWorkflow.status,
          reviewNotes
        },
        comment: `Updated workflow status to ${status || existingWorkflow.status}`
      }
    })

    // If workflow is approved and type is PUBLISH, update page status
    if (status === 'APPROVED' && existingWorkflow.type === 'PUBLISH') {
      await prisma.documentationPage.update({
        where: { id: existingWorkflow.pageId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      })
    }

    return NextResponse.json(updatedWorkflow)
  } catch (error) {
    console.error('Failed to update workflow:', error)
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/workflow/[id] - Cancel workflow
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if workflow exists and can be cancelled
    const existingWorkflow = await prisma.documentationWorkflow.findUnique({
      where: { id }
    })

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    if (['APPROVED', 'REJECTED', 'COMPLETED'].includes(existingWorkflow.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel completed workflow' },
        { status: 400 }
      )
    }

    // Only requester or assignee can cancel
    if (existingWorkflow.requestedById !== normalizedUserId &&
        existingWorkflow.assignedToId !== normalizedUserId) {
      return NextResponse.json(
        { error: 'Only requester or assignee can cancel workflow' },
        { status: 403 }
      )
    }

    await prisma.documentationWorkflow.delete({
      where: { id }
    })

    // Create revision record
    await prisma.documentationRevision.create({
      data: {
        pageId: existingWorkflow.pageId,
        authorId: normalizedUserId,
        action: 'WORKFLOW_CANCEL',
        changes: {
          workflowId: id,
          type: existingWorkflow.type,
          status: existingWorkflow.status
        },
        comment: `Cancelled ${existingWorkflow.type} workflow`
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to cancel workflow:', error)
    return NextResponse.json(
      { error: 'Failed to cancel workflow' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/workflow/[id]/approve - Approve workflow
export async function POST(request: NextRequest) {
  if (request.url.includes('/approve')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const normalizedUserId = normalizeUserId(session.user.id)
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const id = pathParts[pathParts.length - 2] // Get workflow ID from URL

      const body = await request.json()
      const { reviewNotes } = body

      // Get workflow
      const workflow = await prisma.documentationWorkflow.findUnique({
        where: { id },
        include: {
          page: true
        }
      })

      if (!workflow) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        )
      }

      if (workflow.status !== 'PENDING' && workflow.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Workflow cannot be approved in current status' },
          { status: 400 }
        )
      }

      // Update workflow within a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update workflow
        const approvedWorkflow = await tx.documentationWorkflow.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedById: normalizedUserId,
            reviewedAt: new Date(),
            reviewNotes
          }
        })

        // Execute workflow action based on type
        if (workflow.type === 'PUBLISH') {
          await tx.documentationPage.update({
            where: { id: workflow.pageId },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date()
            }
          })
        } else if (workflow.type === 'DELETE') {
          await tx.documentationPage.update({
            where: { id: workflow.pageId },
            data: {
              status: 'ARCHIVED'
            }
          })
        }

        // Create revision record
        await tx.documentationRevision.create({
          data: {
            pageId: workflow.pageId,
            authorId: normalizedUserId,
            action: 'WORKFLOW_APPROVE',
            changes: {
              workflowId: id,
              type: workflow.type,
              reviewNotes
            },
            comment: `Approved ${workflow.type} workflow`
          }
        })

        return approvedWorkflow
      })

      return NextResponse.json(result)
    } catch (error) {
      console.error('Failed to approve workflow:', error)
      return NextResponse.json(
        { error: 'Failed to approve workflow' },
        { status: 500 }
      )
    }
  }
}

// POST /api/documentation/workflow/[id]/reject - Reject workflow
export async function POST(request: NextRequest) {
  if (request.url.includes('/reject')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const normalizedUserId = normalizeUserId(session.user.id)
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const id = pathParts[pathParts.length - 2] // Get workflow ID from URL

      const body = await request.json()
      const { reviewNotes } = body

      if (!reviewNotes) {
        return NextResponse.json(
          { error: 'Review notes are required for rejection' },
          { status: 400 }
        )
      }

      // Get workflow
      const workflow = await prisma.documentationWorkflow.findUnique({
        where: { id }
      })

      if (!workflow) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        )
      }

      if (workflow.status !== 'PENDING' && workflow.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Workflow cannot be rejected in current status' },
          { status: 400 }
        )
      }

      // Update workflow
      const rejectedWorkflow = await prisma.documentationWorkflow.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: normalizedUserId,
          reviewedAt: new Date(),
          reviewNotes
        }
      })

      // Create revision record
      await prisma.documentationRevision.create({
        data: {
          pageId: workflow.pageId,
          authorId: normalizedUserId,
          action: 'WORKFLOW_REJECT',
          changes: {
            workflowId: id,
            type: workflow.type,
            reviewNotes
          },
          comment: `Rejected ${workflow.type} workflow: ${reviewNotes}`
        }
      })

      return NextResponse.json(rejectedWorkflow)
    } catch (error) {
      console.error('Failed to reject workflow:', error)
      return NextResponse.json(
        { error: 'Failed to reject workflow' },
        { status: 500 }
      )
    }
  }
}