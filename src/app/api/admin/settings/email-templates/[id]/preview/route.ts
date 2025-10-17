import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// GET /api/admin/settings/email-templates/[id]/preview - Preview email template
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

    // Simple template variable replacement
    const replaceVariables = (content: string, variables: any): string => {
      if (!variables) return content

      let processedContent = content

      // Default variables
      const defaultVars = {
        user_name: session.user.name || 'John Doe',
        user_email: session.user.email || 'user@example.com',
        workspace_name: template.workspace?.name || 'My Workspace',
        current_date: new Date().toLocaleDateString(),
        current_year: new Date().getFullYear().toString(),
        company_name: 'SociallyHub',
        support_email: 'support@sociallyhub.com'
      }

      // Merge with preview data
      const allVars = { ...defaultVars, ...(template.previewData || {}) }

      // Replace variables
      Object.entries(allVars).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        processedContent = processedContent.replace(regex, String(value))
      })

      return processedContent
    }

    const processedHtml = replaceVariables(template.htmlContent, template.variables)
    const processedText = template.textContent
      ? replaceVariables(template.textContent, template.variables)
      : null
    const processedSubject = replaceVariables(template.subject, template.variables)

    return NextResponse.json({
      preview: {
        subject: processedSubject,
        htmlContent: processedHtml,
        textContent: processedText,
        variables: template.variables,
        previewData: template.previewData
      }
    })

  } catch (error) {
    console.error('Failed to preview email template:', error)
    return NextResponse.json(
      { error: 'Failed to preview email template' },
      { status: 500 }
    )
  }
}

// POST /api/admin/settings/email-templates/[id]/preview - Preview with custom data
export async function POST(
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
    const { previewData } = await request.json()

    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
      include: {
        workspace: {
          select: { id: true, name: true }
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

    // Simple template variable replacement with custom data
    const replaceVariables = (content: string, customData: any): string => {
      let processedContent = content

      // Default variables
      const defaultVars = {
        user_name: session.user.name || 'John Doe',
        user_email: session.user.email || 'user@example.com',
        workspace_name: template.workspace?.name || 'My Workspace',
        current_date: new Date().toLocaleDateString(),
        current_year: new Date().getFullYear().toString(),
        company_name: 'SociallyHub',
        support_email: 'support@sociallyhub.com'
      }

      // Merge with custom preview data
      const allVars = { ...defaultVars, ...(customData || {}) }

      // Replace variables
      Object.entries(allVars).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
        processedContent = processedContent.replace(regex, String(value))
      })

      return processedContent
    }

    const processedHtml = replaceVariables(template.htmlContent, previewData)
    const processedText = template.textContent
      ? replaceVariables(template.textContent, previewData)
      : null
    const processedSubject = replaceVariables(template.subject, previewData)

    return NextResponse.json({
      preview: {
        subject: processedSubject,
        htmlContent: processedHtml,
        textContent: processedText,
        variables: template.variables,
        previewData
      }
    })

  } catch (error) {
    console.error('Failed to preview email template:', error)
    return NextResponse.json(
      { error: 'Failed to preview email template' },
      { status: 500 }
    )
  }
}