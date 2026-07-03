import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Email templates are always workspace-scoped (EmailTemplate.workspaceId is
// required in the schema), so the two-tier model (ADR-0004) reduces to
// requireWorkspaceRole(template.workspaceId, ['OWNER', 'ADMIN']) here.

// GET /api/admin/settings/email-templates/[id]/preview - Preview email template
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireSession()
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
      return jsonError(404, 'Template not found')
    }

    await requireWorkspaceRole(template.workspaceId, ['OWNER', 'ADMIN'])

    // Simple template variable replacement
    const replaceVariables = (content: string, variables: any): string => {
      if (!variables) return content

      let processedContent = content

      // Default variables
      const defaultVars = {
        user_name: user.name || 'John Doe',
        user_email: user.email || 'user@example.com',
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
    return handleApiError(error)
  }
}

// POST /api/admin/settings/email-templates/[id]/preview - Preview with custom data
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireSession()
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
      return jsonError(404, 'Template not found')
    }

    await requireWorkspaceRole(template.workspaceId, ['OWNER', 'ADMIN'])

    // Simple template variable replacement with custom data
    const replaceVariables = (content: string, customData: any): string => {
      let processedContent = content

      // Default variables
      const defaultVars = {
        user_name: user.name || 'John Doe',
        user_email: user.email || 'user@example.com',
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
    return handleApiError(error)
  }
}
