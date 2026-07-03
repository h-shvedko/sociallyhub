import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Email templates are always workspace-scoped (EmailTemplate.workspaceId is
// required in the schema), so the two-tier model (ADR-0004) reduces to
// requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN']) here.

// GET /api/admin/settings/email-templates - List email templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')

    if (!workspaceId) {
      // Authenticate before validation so missing sessions still 401.
      await requireSession()
      return jsonError(400, 'Workspace ID required')
    }

    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Build where clause
    const where: any = {
      workspaceId: workspaceId
    }

    if (category) {
      where.category = category
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
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
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group by category
    const templatesByCategory = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    }, {} as Record<string, any[]>)

    // Get statistics
    const stats = {
      totalTemplates: templates.length,
      categories: Object.keys(templatesByCategory).length,
      activeTemplates: templates.filter(t => t.isActive).length,
      systemTemplates: templates.filter(t => t.isSystem).length,
      recentlyUsed: templates.filter(t => {
        if (!t.lastUsed) return false
        const daysSinceUsed = (Date.now() - new Date(t.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
        return daysSinceUsed <= 30
      }).length
    }

    return NextResponse.json({
      templates: templatesByCategory,
      stats,
      total: templates.length
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/settings/email-templates - Create email template
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()
    const body = await request.json()

    const {
      workspaceId,
      name,
      slug,
      category,
      subject,
      htmlContent,
      textContent,
      variables,
      isActive = true,
      previewData
    } = body

    // Validate required fields
    if (!workspaceId || !name || !slug || !category || !subject || !htmlContent) {
      return jsonError(400, 'Missing required fields: workspaceId, name, slug, category, subject, htmlContent')
    }

    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Validate category
    const validCategories = [
      'AUTHENTICATION', 'NOTIFICATIONS', 'MARKETING', 'TRANSACTIONAL', 'SYSTEM',
      'ALERTS', 'REPORTS', 'INVITATIONS', 'WELCOME', 'ONBOARDING', 'BILLING', 'SUPPORT'
    ]

    if (!validCategories.includes(category)) {
      return jsonError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`)
    }

    // Check for existing slug
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: {
        workspaceId,
        slug
      }
    })

    if (existingTemplate) {
      return jsonError(409, 'Template with this slug already exists')
    }

    // Create template
    const template = await prisma.emailTemplate.create({
      data: {
        workspaceId,
        name,
        slug,
        category,
        subject,
        htmlContent,
        textContent,
        variables,
        isActive,
        previewData,
        createdBy: user.id,
        lastUpdatedBy: user.id
      },
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

    return NextResponse.json({ template }, { status: 201 })

  } catch (error) {
    return handleApiError(error)
  }
}
