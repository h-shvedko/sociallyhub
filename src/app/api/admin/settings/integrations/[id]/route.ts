import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Integration settings are always workspace-scoped (IntegrationSetting.
// workspaceId is required in the schema), so the two-tier model (ADR-0004)
// reduces to requireWorkspaceRole(integration.workspaceId, ['OWNER', 'ADMIN']).

// GET /api/admin/settings/integrations/[id] - Get specific integration setting
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireSession()
    const integrationId = params.id

    const integration = await prisma.integrationSetting.findUnique({
      where: { id: integrationId },
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

    if (!integration) {
      return jsonError(404, 'Integration not found')
    }

    await requireWorkspaceRole(integration.workspaceId, ['OWNER', 'ADMIN'])

    return NextResponse.json({
      integration: {
        ...integration,
        credentials: integration.credentials ? '***HIDDEN***' : null
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/admin/settings/integrations/[id] - Update integration setting
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireSession()
    const integrationId = params.id
    const body = await request.json()

    const {
      name,
      config,
      credentials,
      isActive,
      syncInterval,
      features,
      webhookUrl,
      webhookSecret,
      resetErrorCount = false
    } = body

    // Get existing integration
    const existing = await prisma.integrationSetting.findUnique({
      where: { id: integrationId }
    })

    if (!existing) {
      return jsonError(404, 'Integration not found')
    }

    await requireWorkspaceRole(existing.workspaceId, ['OWNER', 'ADMIN'])

    // Check for name conflicts if name is being changed
    if (name && name !== existing.name) {
      const conflictingIntegration = await prisma.integrationSetting.findFirst({
        where: {
          workspaceId: existing.workspaceId,
          provider: existing.provider,
          name,
          id: { not: integrationId }
        }
      })

      if (conflictingIntegration) {
        return jsonError(409, 'Integration with this provider and name already exists')
      }
    }

    // Build update data
    const updateData: any = {
      lastUpdatedBy: user.id
    }

    if (name !== undefined) updateData.name = name
    if (config !== undefined) updateData.config = config
    if (credentials !== undefined) {
      updateData.credentials = credentials
      updateData.isConfigured = credentials ? true : false
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (syncInterval !== undefined) updateData.syncInterval = syncInterval
    if (features !== undefined) updateData.features = features
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
    if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret

    if (resetErrorCount) {
      updateData.errorCount = 0
      updateData.lastError = null
    }

    // Update integration
    const integration = await prisma.integrationSetting.update({
      where: { id: integrationId },
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

    return NextResponse.json({
      integration: {
        ...integration,
        credentials: integration.credentials ? '***HIDDEN***' : null
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/admin/settings/integrations/[id] - Delete integration setting
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireSession()
    const integrationId = params.id

    // Get existing integration
    const existing = await prisma.integrationSetting.findUnique({
      where: { id: integrationId }
    })

    if (!existing) {
      return jsonError(404, 'Integration not found')
    }

    await requireWorkspaceRole(existing.workspaceId, ['OWNER', 'ADMIN'])

    await prisma.integrationSetting.delete({
      where: { id: integrationId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    return handleApiError(error)
  }
}
