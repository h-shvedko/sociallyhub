import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { encryptCredentials, encryptString, isEncrypted } from '@/lib/encryption'

// Integration settings are always workspace-scoped (IntegrationSetting.
// workspaceId is required in the schema), so the two-tier model (ADR-0004)
// reduces to requireWorkspaceRole(integration.workspaceId, ['OWNER', 'ADMIN']).

// Display sentinel substituted for real secret material in every response
// (`credentials` and `webhookSecret`). A client that re-submits a record it
// previously fetched sends this value back for unchanged secrets, so writes
// treat it as "no change" and never encrypt the mask over real data.
const CREDENTIALS_MASK = '***HIDDEN***'

// Encrypt the credentials JSON blob for storage at rest (ADR-0006 Phase 4).
// Tolerates values round-tripped from a masked response so re-saving a record
// never double-encrypts or clobbers secrets:
//   null/undefined -> null (clears the column)
//   already enc:v1: -> stored as-is (idempotent; no double-encryption)
//   anything else   -> JSON-serialized then AES-256-GCM encrypted.
function encryptCredentialsForStorage(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (isEncrypted(value)) return value
  return encryptCredentials(value)
}

// Encrypt a scalar secret (webhookSecret) for storage at rest, with the same
// round-trip tolerance as above.
function encryptSecretForStorage(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (isEncrypted(value)) return value
  return encryptString(String(value))
}

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
        credentials: integration.credentials ? CREDENTIALS_MASK : null,
        webhookSecret: integration.webhookSecret ? CREDENTIALS_MASK : null
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
    // Encrypt credentials on write (ADR-0006 Phase 4). Skip the mask sentinel so
    // a client re-submitting a fetched record leaves existing secrets untouched.
    if (credentials !== undefined && credentials !== CREDENTIALS_MASK) {
      updateData.credentials = credentials ? encryptCredentialsForStorage(credentials) : null
      updateData.isConfigured = credentials ? true : false
    }
    if (isActive !== undefined) updateData.isActive = isActive
    if (syncInterval !== undefined) updateData.syncInterval = syncInterval
    if (features !== undefined) updateData.features = features
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl
    if (webhookSecret !== undefined && webhookSecret !== CREDENTIALS_MASK) {
      updateData.webhookSecret = webhookSecret ? encryptSecretForStorage(webhookSecret) : null
    }

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
        credentials: integration.credentials ? CREDENTIALS_MASK : null,
        webhookSecret: integration.webhookSecret ? CREDENTIALS_MASK : null
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
