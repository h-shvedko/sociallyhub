import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/email-templates - List email templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')

    // Check workspace permissions
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    console.error('Failed to fetch email templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/email-templates - Create email template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
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
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, name, slug, category, subject, htmlContent' },
        { status: 400 }
      )
    }

    // Check permissions
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        workspaceId: workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate category
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

    // Check for existing slug
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: {
        workspaceId,
        slug
      }
    })

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Template with this slug already exists' },
        { status: 409 }
      )
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
        createdBy: normalizedUserId,
        lastUpdatedBy: normalizedUserId
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
    console.error('Failed to create email template:', error)
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    )
  }
}