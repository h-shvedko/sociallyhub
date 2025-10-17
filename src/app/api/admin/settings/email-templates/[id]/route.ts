import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/email-templates/[id] - Get specific email template
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const templateId = params.id

    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: template.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ template })

  } catch (error) {
    console.error('Failed to fetch email template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email template' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/settings/email-templates/[id] - Update email template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const templateId = params.id
    const body = await request.json()

    const {
      name,
      slug,
      category,
      subject,
      htmlContent,
      textContent,
      variables,
      isActive,
      previewData
    } = body

    // Get existing template
    const existing = await prisma.emailTemplate.findUnique({
      where: { id: templateId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: existing.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent modification of system templates
    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'Cannot modify system templates' },
        { status: 400 }
      )
    }

    // Validate category if provided
    if (category) {
      const validCategories = [
        'AUTHENTICATION', 'NOTIFICATIONS', 'MARKETING', 'TRANSACTIONAL', 'SYSTEM',
        'ALERTS', 'REPORTS', 'INVITATIONS', 'WELCOME', 'ONBOARDING', 'BILLING', 'SUPPORT'
      ]

      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Check for slug conflicts if slug is being changed
    if (slug && slug !== existing.slug) {
      const conflictingTemplate = await prisma.emailTemplate.findFirst({
        where: {
          workspaceId: existing.workspaceId,
          slug,
          id: { not: templateId }
        }
      })

      if (conflictingTemplate) {
        return NextResponse.json(
          { error: 'Template with this slug already exists' },
          { status: 409 }
        )
      }
    }

    // Build update data
    const updateData: any = {
      lastUpdatedBy: normalizedUserId
    }

    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (category !== undefined) updateData.category = category
    if (subject !== undefined) updateData.subject = subject
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent
    if (textContent !== undefined) updateData.textContent = textContent
    if (variables !== undefined) updateData.variables = variables
    if (isActive !== undefined) updateData.isActive = isActive
    if (previewData !== undefined) updateData.previewData = previewData

    // Update template
    const template = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: updateData,
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        createdByUser: {
          select: { id: true, name: true, email: true }
        },
        updatedByUser: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ template })

  } catch (error) {
    console.error('Failed to update email template:', error)
    return NextResponse.json(
      { error: 'Failed to update email template' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/settings/email-templates/[id] - Delete email template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const templateId = params.id

    // Get existing template
    const existing = await prisma.emailTemplate.findUnique({
      where: { id: templateId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: existing.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent deletion of system templates
    if (existing.isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system templates' },
        { status: 400 }
      )
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to delete email template:', error)
    return NextResponse.json(
      { error: 'Failed to delete email template' },
      { status: 500 }
    )
  }
}