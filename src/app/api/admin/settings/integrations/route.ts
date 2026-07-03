import { NextRequest, NextResponse } from 'next/server'
import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { encryptCredentials, encryptString, isEncrypted } from '@/lib/encryption'

// Integration settings are always workspace-scoped (IntegrationSetting.
// workspaceId is required in the schema), so the two-tier model (ADR-0004)
// reduces to requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN']) here.

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

// GET /api/admin/settings/integrations - List integration settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const provider = searchParams.get('provider')
    const isActive = searchParams.get('isActive')
    const isConfigured = searchParams.get('isConfigured')

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

    if (provider) {
      where.provider = provider
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (isConfigured !== null) {
      where.isConfigured = isConfigured === 'true'
    }

    const integrations = await prisma.integrationSetting.findMany({
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
        { provider: 'asc' },
        { name: 'asc' }
      ]
    })

    // Mask sensitive material (never return credentials or webhook secrets —
    // encrypted at rest per ADR-0006, masked for display).
    const maskedIntegrations = integrations.map(integration => ({
      ...integration,
      credentials: integration.credentials ? CREDENTIALS_MASK : null,
      webhookSecret: integration.webhookSecret ? CREDENTIALS_MASK : null
    }))

    // Group by provider
    const integrationsByProvider = maskedIntegrations.reduce((acc, integration) => {
      if (!acc[integration.provider]) {
        acc[integration.provider] = []
      }
      acc[integration.provider].push(integration)
      return acc
    }, {} as Record<string, any[]>)

    // Get statistics
    const stats = {
      totalIntegrations: integrations.length,
      providers: Object.keys(integrationsByProvider).length,
      activeIntegrations: integrations.filter(i => i.isActive).length,
      configuredIntegrations: integrations.filter(i => i.isConfigured).length,
      errorIntegrations: integrations.filter(i => i.errorCount > 0).length,
      recentlyUpdated: integrations.filter(i => {
        const daysSinceUpdate = (Date.now() - new Date(i.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
        return daysSinceUpdate <= 7
      }).length
    }

    return NextResponse.json({
      integrations: integrationsByProvider,
      stats,
      total: integrations.length
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/settings/integrations - Create integration setting
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()
    const body = await request.json()

    const {
      workspaceId,
      provider,
      name,
      config,
      credentials,
      isActive = true,
      syncInterval,
      features,
      webhookUrl,
      webhookSecret
    } = body

    // Validate required fields
    if (!workspaceId || !provider || !name || !config) {
      return jsonError(400, 'Missing required fields: workspaceId, provider, name, config')
    }

    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Validate provider
    const validProviders = [
      'DISCORD', 'SLACK', 'ZAPIER', 'GOOGLE_ANALYTICS', 'FACEBOOK_PIXEL',
      'STRIPE', 'PAYPAL', 'MAILCHIMP', 'SENDGRID', 'TWILIO', 'AWS', 'AZURE',
      'GCP', 'GITHUB', 'GITLAB', 'JIRA', 'ASANA', 'TRELLO', 'NOTION',
      'AIRTABLE', 'HUBSPOT', 'SALESFORCE', 'ZOOM', 'TEAMS', 'CALENDLY',
      'TYPEFORM', 'INTERCOM', 'ZENDESK', 'FRESHDESK', 'CUSTOM'
    ]

    if (!validProviders.includes(provider)) {
      return jsonError(400, `Invalid provider. Must be one of: ${validProviders.join(', ')}`)
    }

    // Check for existing integration with same provider and name
    const existingIntegration = await prisma.integrationSetting.findFirst({
      where: {
        workspaceId,
        provider,
        name
      }
    })

    if (existingIntegration) {
      return jsonError(409, 'Integration with this provider and name already exists')
    }

    // Encrypt secret material before persisting (ADR-0006 Phase 4). The mask
    // sentinel is ignored so it can never be stored as a real credential.
    const hasCredentials = !!credentials && credentials !== CREDENTIALS_MASK
    const hasWebhookSecret = !!webhookSecret && webhookSecret !== CREDENTIALS_MASK

    // Create integration
    const integration = await prisma.integrationSetting.create({
      data: {
        workspaceId,
        provider,
        name,
        config,
        // `credentials` is a `Json?` column; Prisma's typed create input rejects
        // a bare JS `null` (it wants `Prisma.JsonNull`/omission). Coalesce the
        // "no credentials" case to `undefined` (field omitted -> stored NULL);
        // encrypted values are always non-null strings. Previously this line only
        // compiled because the helper's `any` return contaminated the ternary.
        credentials: (hasCredentials ? encryptCredentialsForStorage(credentials) : null) ?? undefined,
        isActive,
        isConfigured: hasCredentials ? true : false,
        syncInterval,
        features,
        webhookUrl,
        webhookSecret: hasWebhookSecret ? encryptSecretForStorage(webhookSecret) : null,
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

    return NextResponse.json({
      integration: {
        ...integration,
        credentials: integration.credentials ? CREDENTIALS_MASK : null,
        webhookSecret: integration.webhookSecret ? CREDENTIALS_MASK : null
      }
    }, { status: 201 })

  } catch (error) {
    return handleApiError(error)
  }
}
