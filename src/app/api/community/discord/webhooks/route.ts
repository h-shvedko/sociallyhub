import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions, normalizeUserId, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/config/features'

// Discord Webhook Types — kept as the one reusable artifact: they match Discord's
// real webhook payload/embed schema and are the starting point for the real
// implementation in ADR-0015 Phase 3 (webhook client). No mock sender uses them today.
interface DiscordWebhookPayload {
  content?: string
  username?: string
  avatar_url?: string
  embeds?: DiscordEmbed[]
}

interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  timestamp?: string
  footer?: {
    text: string
    icon_url?: string
  }
  author?: {
    name: string
    url?: string
    icon_url?: string
  }
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
}

// Silence "declared but never read" for the intentionally-kept interfaces above
// (they document the real Discord schema for the un-deferred Phase 3 implementation).
export type { DiscordWebhookPayload, DiscordEmbed }

// GET /api/community/discord/webhooks - Get webhook configuration and real activity history
export async function GET(request: NextRequest) {
  if (!isFeatureEnabled('FEATURE_DISCORD')) {
    return NextResponse.json({ error: 'Feature not available' }, { status: 404 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await normalizeUserId(session.user.id)

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has admin permissions
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Get Discord integration
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceId }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Discord integration not found' }, { status: 404 })
    }

    // Real Discord activity history only. There is no webhook-delivery tracking yet
    // (that arrives with the DiscordWebhookDelivery table in ADR-0015 Phase 3), so we
    // query only the CommunityActivityType enum values that actually exist and never
    // fabricate success/failure statistics.
    const history = await prisma.communityActivity.findMany({
      where: {
        workspaceId,
        activityType: { in: ['DISCORD_MEMBER_JOINED', 'DISCORD_MESSAGE_POSTED'] }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return NextResponse.json({
      integration: {
        webhookUrl: integration.webhookUrl,
        webhookSecret: integration.webhookSecret ? '***HIDDEN***' : null,
        isConfigured: !!integration.webhookUrl
      },
      history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/community/discord/webhooks - Configure webhook settings
//
// Only CONFIGURE_WEBHOOK is implemented (real config CRUD). All SEND_*/TEST_*
// actions return 501 until the real webhook client ships in ADR-0015 Phase 3 —
// they must never fabricate a "webhook sent successfully" result.
export async function POST(request: NextRequest) {
  if (!isFeatureEnabled('FEATURE_DISCORD')) {
    return NextResponse.json({ error: 'Feature not available' }, { status: 404 })
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    await normalizeUserId(session.user.id)

    const body = await request.json()
    const {
      workspaceId,
      action, // CONFIGURE_WEBHOOK (implemented) | SEND_*/TEST_* (501, not implemented)
      webhookUrl, // For configuration
      webhookSecret // For configuration
    } = body

    if (!workspaceId || !action) {
      return NextResponse.json(
        { error: 'Workspace ID and action are required' },
        { status: 400 }
      )
    }

    // Verify user has admin permissions
    await requireWorkspaceRole(workspaceId, ['OWNER', 'ADMIN'])

    // Get Discord integration
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceId }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Discord integration not found' }, { status: 404 })
    }

    switch (action) {
      case 'CONFIGURE_WEBHOOK': {
        const result = await configureWebhook(integration.id, webhookUrl, webhookSecret)
        return NextResponse.json({
          success: result.success,
          message: result.message
        })
      }

      case 'SEND_WEBHOOK':
      case 'TEST_WEBHOOK':
      case 'SEND_NOTIFICATION':
      case 'SEND_MODERATION_ALERT':
        // Real webhook delivery is not implemented (ADR-0015 Phase 3). Do not fake success.
        return NextResponse.json({ error: 'Not implemented' }, { status: 501 })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    return handleApiError(error)
  }
}

// Real webhook configuration CRUD — no external HTTP call, just persists the config.
async function configureWebhook(integrationId: string, webhookUrl: string, webhookSecret?: string) {
  await prisma.discordIntegration.update({
    where: { id: integrationId },
    data: {
      webhookUrl,
      webhookSecret,
      lastActivity: new Date()
    }
  })

  return {
    success: true,
    message: 'Webhook configured successfully'
  }
}
