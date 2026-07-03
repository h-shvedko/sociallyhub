import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Email templates are always workspace-scoped (EmailTemplate.workspaceId is
// required in the schema), so the two-tier model (ADR-0004) reduces to
// requireWorkspaceRole(template.workspaceId, ['OWNER', 'ADMIN']) here.

// GET /api/admin/settings/email-templates/[id] - Get specific email template
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireSession()
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
      return jsonError(404, 'Template not found')
    }

    await requireWorkspaceRole(template.workspaceId, ['OWNER', 'ADMIN'])

    return NextResponse.json({ template })

  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/admin/settings/email-templates/[id] - Update email template
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireSession()
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
      return jsonError(404, 'Template not found')
    }

    await requireWorkspaceRole(existing.workspaceId, ['OWNER', 'ADMIN'])

    // Prevent modification of system templates
    if (existing.isSystem) {
      return jsonError(400, 'Cannot modify system templates')
    }

    // Validate category if provided
    if (category) {
      const validCategories = [
        'AUTHENTICATION', 'NOTIFICATIONS', 'MARKETING', 'TRANSACTIONAL', 'SYSTEM',
        'ALERTS', 'REPORTS', 'INVITATIONS', 'WELCOME', 'ONBOARDING', 'BILLING', 'SUPPORT'
      ]

      if (!validCategories.includes(category)) {
        return jsonError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`)
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
        return jsonError(409, 'Template with this slug already exists')
      }
    }

    // Build update data
    const updateData: any = {
      lastUpdatedBy: user.id
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
    return handleApiError(error)
  }
}

// DELETE /api/admin/settings/email-templates/[id] - Delete email template
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireSession()
    const templateId = params.id

    // Get existing template
    const existing = await prisma.emailTemplate.findUnique({
      where: { id: templateId }
    })

    if (!existing) {
      return jsonError(404, 'Template not found')
    }

    await requireWorkspaceRole(existing.workspaceId, ['OWNER', 'ADMIN'])

    // Prevent deletion of system templates
    if (existing.isSystem) {
      return jsonError(400, 'Cannot delete system templates')
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    return handleApiError(error)
  }
}
