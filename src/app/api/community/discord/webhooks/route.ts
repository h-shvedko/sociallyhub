import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Discord Webhook Types
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

// GET /api/community/discord/webhooks - Get webhook history and stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Verify user has admin permissions
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: normalizeUserId(session.user.id),
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get Discord integration
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceId }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Discord integration not found' }, { status: 404 })
    }

    // Get webhook history from community activities
    const webhookHistory = await prisma.communityActivity.findMany({
      where: {
        workspaceId,
        activityType: { in: ['DISCORD_WEBHOOK_SENT', 'DISCORD_NOTIFICATION', 'DISCORD_ANNOUNCEMENT'] }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Get webhook statistics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      totalWebhooks,
      recentWebhooks,
      failedWebhooks,
      successfulWebhooks
    ] = await Promise.all([
      prisma.communityActivity.count({
        where: {
          workspaceId,
          activityType: { startsWith: 'DISCORD_WEBHOOK' }
        }
      }),
      prisma.communityActivity.count({
        where: {
          workspaceId,
          activityType: { startsWith: 'DISCORD_WEBHOOK' },
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      // Mock failed webhooks (in production, track this in metadata)
      Math.floor(Math.random() * 5),
      prisma.communityActivity.count({
        where: {
          workspaceId,
          activityType: { startsWith: 'DISCORD_WEBHOOK' },
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ])

    // Get webhook delivery trend (last 7 days)
    const deliveryTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = await prisma.communityActivity.count({
        where: {
          workspaceId,
          activityType: { startsWith: 'DISCORD_WEBHOOK' },
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      })

      deliveryTrend.push({
        date: date.toISOString().split('T')[0],
        count
      })
    }

    // Calculate success rate
    const successRate = totalWebhooks > 0 ?
      ((totalWebhooks - failedWebhooks) / totalWebhooks * 100).toFixed(1) : '100'

    return NextResponse.json({
      integration: {
        webhookUrl: integration.webhookUrl,
        webhookSecret: integration.webhookSecret ? '***HIDDEN***' : null,
        isConfigured: !!integration.webhookUrl
      },
      history: webhookHistory,
      statistics: {
        totalWebhooks,
        recentWebhooks,
        failedWebhooks,
        successfulWebhooks,
        successRate: parseFloat(successRate)
      },
      deliveryTrend,
      pagination: {
        limit,
        offset,
        hasMore: webhookHistory.length === limit
      }
    })

  } catch (error) {
    console.error('Failed to fetch webhook data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhook data' },
      { status: 500 }
    )
  }
}

// POST /api/community/discord/webhooks - Send webhook or configure webhook settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      action, // SEND_WEBHOOK, CONFIGURE_WEBHOOK, TEST_WEBHOOK
      payload, // Webhook payload for sending
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
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId: normalizeUserId(session.user.id),
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get Discord integration
    const integration = await prisma.discordIntegration.findUnique({
      where: { workspaceId }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Discord integration not found' }, { status: 404 })
    }

    let result = null

    switch (action) {
      case 'CONFIGURE_WEBHOOK':
        // Update webhook configuration
        result = await configureWebhook(integration.id, webhookUrl, webhookSecret)
        break

      case 'SEND_WEBHOOK':
        // Send webhook message
        result = await sendWebhookMessage(integration.webhookUrl!, payload)
        break

      case 'TEST_WEBHOOK':
        // Send test webhook
        result = await sendTestWebhook(integration.webhookUrl!, session.user.name || 'Admin')
        break

      case 'SEND_NOTIFICATION':
        // Send formatted notification
        result = await sendDiscordNotification(integration.webhookUrl!, payload)
        break

      case 'SEND_MODERATION_ALERT':
        // Send moderation alert
        result = await sendModerationAlert(integration.webhookUrl!, payload)
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Log webhook activity
    if (result.success && ['SEND_WEBHOOK', 'TEST_WEBHOOK', 'SEND_NOTIFICATION', 'SEND_MODERATION_ALERT'].includes(action)) {
      await prisma.communityActivity.create({
        data: {
          activityType: 'DISCORD_WEBHOOK_SENT',
          title: `Discord webhook: ${action}`,
          description: payload?.content || payload?.embeds?.[0]?.title || 'Webhook sent',
          userId: normalizeUserId(session.user.id),
          userName: session.user.name || 'Admin',
          userAvatar: session.user.image,
          targetId: integration.id,
          targetType: 'discord_webhook',
          targetTitle: integration.guildName,
          workspaceId,
          metadata: {
            action,
            payload,
            success: result.success,
            webhookUrl: integration.webhookUrl?.substring(0, 50) + '...' // Truncated for security
          }
        }
      })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.data
    })

  } catch (error) {
    console.error('Failed to execute webhook action:', error)
    return NextResponse.json(
      { error: 'Failed to execute webhook action' },
      { status: 500 }
    )
  }
}

// Webhook helper functions
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

async function sendWebhookMessage(webhookUrl: string, payload: DiscordWebhookPayload) {
  try {
    // In production, this would make an actual HTTP request to Discord
    console.log('Sending Discord webhook:', payload)

    // Mock successful response
    return {
      success: true,
      message: 'Webhook sent successfully',
      data: { messageId: `mock_webhook_${Date.now()}` }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to send webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function sendTestWebhook(webhookUrl: string, adminName: string) {
  const payload: DiscordWebhookPayload = {
    embeds: [{
      title: '🔧 Webhook Test',
      description: 'This is a test message from SociallyHub Discord integration.',
      color: 0x00ff00, // Green
      timestamp: new Date().toISOString(),
      footer: {
        text: `Test initiated by ${adminName}`,
        icon_url: 'https://sociallyhub.com/icon.png'
      },
      fields: [
        {
          name: 'Status',
          value: '✅ Connection successful',
          inline: true
        },
        {
          name: 'Integration',
          value: 'SociallyHub Community',
          inline: true
        }
      ]
    }]
  }

  return await sendWebhookMessage(webhookUrl, payload)
}

async function sendDiscordNotification(webhookUrl: string, notificationData: any) {
  const payload: DiscordWebhookPayload = {
    embeds: [{
      title: notificationData.title || 'Community Notification',
      description: notificationData.description,
      color: notificationData.color || 0x3498db, // Blue
      timestamp: new Date().toISOString(),
      footer: {
        text: 'SociallyHub Community',
        icon_url: 'https://sociallyhub.com/icon.png'
      },
      ...(notificationData.fields && { fields: notificationData.fields })
    }]
  }

  return await sendWebhookMessage(webhookUrl, payload)
}

async function sendModerationAlert(webhookUrl: string, alertData: any) {
  const payload: DiscordWebhookPayload = {
    embeds: [{
      title: '🚨 Moderation Alert',
      description: alertData.description,
      color: 0xff4444, // Red
      timestamp: new Date().toISOString(),
      footer: {
        text: 'SociallyHub Moderation System',
        icon_url: 'https://sociallyhub.com/icon.png'
      },
      fields: [
        {
          name: 'Action Required',
          value: alertData.action || 'Review required',
          inline: true
        },
        {
          name: 'Priority',
          value: alertData.priority || 'Medium',
          inline: true
        },
        ...(alertData.user && [{
          name: 'User',
          value: alertData.user,
          inline: true
        }])
      ]
    }]
  }

  return await sendWebhookMessage(webhookUrl, payload)
}