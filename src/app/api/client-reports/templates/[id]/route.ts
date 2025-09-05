import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaClient } from '@prisma/client'
import { normalizeUserId } from '@/lib/auth/demo-user'

const prisma = new PrismaClient()

// GET /api/client-reports/templates/[id] - Get specific template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: templateId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    const template = await prisma.clientReportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })

  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

// PUT /api/client-reports/templates/[id] - Update template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: templateId } = await params
    const body = await request.json()

    const {
      name,
      description,
      type,
      format,
      metrics,
      isActive,
      isDefault
    } = body

    // Basic validation
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    if (!Array.isArray(format) || format.length === 0) {
      return NextResponse.json({ error: 'At least one format must be selected' }, { status: 400 })
    }

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json({ error: 'At least one metric must be selected' }, { status: 400 })
    }

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Check if template exists and belongs to the workspace
    const existingTemplate = await prisma.clientReportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // If setting this as default, unset other defaults
    if (isDefault) {
      await prisma.clientReportTemplate.updateMany({
        where: {
          workspaceId: userWorkspace.workspaceId,
          isDefault: true,
          id: { not: templateId }
        },
        data: {
          isDefault: false
        }
      })
    }

    // Update the template
    const updatedTemplate = await prisma.clientReportTemplate.update({
      where: {
        id: templateId,
      },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'PERFORMANCE',
        format,
        metrics,
        isActive: isActive !== undefined ? isActive : true,
        isDefault: isDefault || false,
      }
    })

    console.log(`📝 Template ${templateId} updated by user ${userId}`)

    return NextResponse.json({ template: updatedTemplate })

  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

// DELETE /api/client-reports/templates/[id] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await normalizeUserId(session.user.id)
    const { id: templateId } = await params

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: userId,
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
    }

    // Check if template exists and belongs to the workspace
    const existingTemplate = await prisma.clientReportTemplate.findFirst({
      where: {
        id: templateId,
        workspaceId: userWorkspace.workspaceId,
      }
    })

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check if template is being used by any reports
    const reportsUsingTemplate = await prisma.clientReport.findFirst({
      where: {
        templateId: templateId,
      }
    })

    if (reportsUsingTemplate) {
      return NextResponse.json({ 
        error: 'Cannot delete template that is being used by existing reports' 
      }, { status: 400 })
    }

    // Delete the template
    await prisma.clientReportTemplate.delete({
      where: {
        id: templateId,
      }
    })

    console.log(`🗑️ Template ${templateId} deleted by user ${userId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}