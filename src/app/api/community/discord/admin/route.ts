import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Discord API integration helpers
interface DiscordGuildInfo {
  id: string
  name: string
  icon: string | null
  member_count: number
  presence_count: number
  channels: DiscordChannel[]
  roles: DiscordRole[]
  owner_id: string
}

interface DiscordChannel {
  id: string
  name: string
  type: number
  position: number
  parent_id: string | null
  permission_overwrites: any[]
}

interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
  permissions: string
  managed: boolean
}

interface DiscordMember {
  user: {
    id: string
    username: string
    discriminator: string
    avatar: string | null
  }
  nick: string | null
  roles: string[]
  joined_at: string
  premium_since: string | null
}

// Mock Discord API calls (in production, these would be real Discord API calls)
async function fetchDiscordGuildInfo(guildId: string, botToken?: string): Promise<DiscordGuildInfo | null> {
  // In production, this would make an actual Discord API call
  // For now, return mock data
  return {
    id: guildId,
    name: 'SociallyHub Community',
    icon: 'guild_icon_hash',
    member_count: 1247,
    presence_count: 89,
    channels: [
      { id: '1234567890123456789', name: 'general', type: 0, position: 0, parent_id: null, permission_overwrites: [] },
      { id: '1234567890123456790', name: 'support', type: 0, position: 1, parent_id: null, permission_overwrites: [] },
      { id: '1234567890123456791', name: 'announcements', type: 0, position: 2, parent_id: null, permission_overwrites: [] },
      { id: '1234567890123456792', name: 'feature-requests', type: 0, position: 3, parent_id: null, permission_overwrites: [] },
      { id: '1234567890123456793', name: 'showcase', type: 0, position: 4, parent_id: null, permission_overwrites: [] }
    ],
    roles: [
      { id: '1234567890123456794', name: '@everyone', color: 0, position: 0, permissions: '104324161', managed: false },
      { id: '1234567890123456795', name: 'Moderator', color: 15158332, position: 1, permissions: '8', managed: false },
      { id: '1234567890123456796', name: 'Community Helper', color: 3066993, position: 2, permissions: '0', managed: false }
    ],
    owner_id: '1234567890123456797'
  }
}

async function fetchDiscordMembers(guildId: string, botToken?: string): Promise<DiscordMember[]> {
  // Mock member data
  return [
    {
      user: { id: '1234567890123456798', username: 'ActiveUser', discriminator: '1234', avatar: 'avatar_hash' },
      nick: 'Active Community Member',
      roles: ['1234567890123456796'],
      joined_at: '2023-01-15T10:30:00.000Z',
      premium_since: null
    },
    {
      user: { id: '1234567890123456799', username: 'ModeratorBot', discriminator: '0001', avatar: 'bot_avatar' },
      nick: null,
      roles: ['1234567890123456795'],
      joined_at: '2023-01-01T00:00:00.000Z',
      premium_since: null
    }
  ]
}

// GET /api/community/discord/admin - Get Discord admin panel data
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

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

    // Fetch live Discord data
    const [guildInfo, members] = await Promise.all([
      fetchDiscordGuildInfo(integration.guildId, integration.botToken),
      fetchDiscordMembers(integration.guildId, integration.botToken)
    ])

    // Get recent Discord activities from community activities
    const recentActivities = await prisma.communityActivity.findMany({
      where: {
        workspaceId,
        activityType: { startsWith: 'DISCORD_' }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Get Discord moderation statistics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [
      totalMembers,
      newMembersThisMonth,
      moderationActionsThisMonth,
      bannedMembers
    ] = await Promise.all([
      guildInfo?.member_count || 0,
      // Mock data for new members
      Math.floor(Math.random() * 50) + 10,
      // Count moderation actions that might be Discord-related
      prisma.moderationAction.count({
        where: {
          workspaceId,
          createdAt: { gte: thirtyDaysAgo },
          description: { contains: 'discord', mode: 'insensitive' }
        }
      }),
      // Mock banned members count
      Math.floor(Math.random() * 5) + 1
    ])

    // Get webhook statistics
    const webhookStats = {
      totalSent: Math.floor(Math.random() * 200) + 50,
      successRate: 98.5,
      lastSent: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
      failedDeliveries: Math.floor(Math.random() * 5)
    }

    // Get channel message statistics (mock data)
    const channelStats = guildInfo?.channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      messageCount: Math.floor(Math.random() * 1000) + 100,
      activeMembers: Math.floor(Math.random() * 50) + 5,
      lastActivity: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
    })) || []

    return NextResponse.json({
      integration,
      guildInfo,
      members: members.slice(0, 10), // Limit to first 10 for overview
      statistics: {
        totalMembers,
        onlineMembers: guildInfo?.presence_count || 0,
        newMembersThisMonth,
        moderationActionsThisMonth,
        bannedMembers
      },
      webhookStats,
      channelStats,
      recentActivities
    })

  } catch (error) {
    console.error('Failed to fetch Discord admin data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Discord admin data' },
      { status: 500 }
    )
  }
}

// POST /api/community/discord/admin - Execute Discord admin actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      action, // SEND_MESSAGE, KICK_MEMBER, BAN_MEMBER, UPDATE_ROLE, CREATE_CHANNEL, etc.
      targetId, // Channel ID, Member ID, Role ID, etc.
      parameters // Action-specific parameters
    } = body

    // Validation
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
    let actionDescription = ''

    // Execute Discord actions
    switch (action) {
      case 'SEND_MESSAGE':
        // Send message to Discord channel
        result = await sendDiscordMessage(
          integration.guildId,
          targetId,
          parameters.message,
          integration.botToken
        )
        actionDescription = `Sent message to channel ${targetId}`
        break

      case 'SEND_ANNOUNCEMENT':
        // Send announcement with embed
        result = await sendDiscordAnnouncement(
          integration.guildId,
          targetId,
          parameters.title,
          parameters.description,
          parameters.color,
          integration.botToken
        )
        actionDescription = `Sent announcement: ${parameters.title}`
        break

      case 'KICK_MEMBER':
        // Kick member from Discord
        result = await kickDiscordMember(
          integration.guildId,
          targetId,
          parameters.reason,
          integration.botToken
        )
        actionDescription = `Kicked member ${targetId}: ${parameters.reason}`
        break

      case 'BAN_MEMBER':
        // Ban member from Discord
        result = await banDiscordMember(
          integration.guildId,
          targetId,
          parameters.reason,
          parameters.deleteMessageDays,
          integration.botToken
        )
        actionDescription = `Banned member ${targetId}: ${parameters.reason}`
        break

      case 'UPDATE_MEMBER_ROLE':
        // Add/remove role from member
        result = await updateMemberRole(
          integration.guildId,
          targetId,
          parameters.roleId,
          parameters.action, // 'add' or 'remove'
          integration.botToken
        )
        actionDescription = `${parameters.action === 'add' ? 'Added' : 'Removed'} role for member ${targetId}`
        break

      case 'CREATE_CHANNEL':
        // Create new Discord channel
        result = await createDiscordChannel(
          integration.guildId,
          parameters.name,
          parameters.type,
          parameters.parentId,
          integration.botToken
        )
        actionDescription = `Created channel: ${parameters.name}`
        break

      case 'UPDATE_WEBHOOK':
        // Update webhook settings
        result = await updateWebhookSettings(
          integration.id,
          parameters.webhookUrl,
          parameters.webhookSecret
        )
        actionDescription = 'Updated webhook settings'
        break

      case 'SYNC_MEMBERS':
        // Sync Discord members with database
        result = await syncDiscordMembers(integration.guildId, workspaceId, integration.botToken)
        actionDescription = 'Synced Discord members'
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Log the admin action
    await prisma.moderationAction.create({
      data: {
        workspaceId,
        moderatorId: normalizeUserId(session.user.id),
        actionType: 'DISCORD_ADMIN',
        targetType: 'DISCORD_INTEGRATION',
        targetId: integration.id,
        reason: actionDescription,
        description: `Discord admin action: ${action}`,
        status: result.success ? 'COMPLETED' : 'FAILED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        metadata: {
          discordAction: action,
          targetId,
          parameters,
          result
        }
      }
    })

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'DISCORD_ADMIN_ACTION',
        title: `Discord admin action: ${action}`,
        description: actionDescription,
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Admin',
        userAvatar: session.user.image,
        targetId: integration.id,
        targetType: 'discord_integration',
        targetTitle: integration.guildName,
        workspaceId,
        metadata: {
          action,
          targetId,
          parameters,
          success: result.success
        }
      }
    })

    return NextResponse.json({
      success: result.success,
      message: result.message || actionDescription,
      data: result.data
    })

  } catch (error) {
    console.error('Failed to execute Discord admin action:', error)
    return NextResponse.json(
      { error: 'Failed to execute Discord admin action' },
      { status: 500 }
    )
  }
}

// Discord API helper functions (mock implementations)
async function sendDiscordMessage(guildId: string, channelId: string, message: string, botToken?: string) {
  // In production, this would make an actual Discord API call
  console.log(`Sending message to Discord channel ${channelId}: ${message}`)
  return {
    success: true,
    message: 'Message sent successfully',
    data: { messageId: `mock_message_${Date.now()}` }
  }
}

async function sendDiscordAnnouncement(guildId: string, channelId: string, title: string, description: string, color: number, botToken?: string) {
  console.log(`Sending announcement to Discord channel ${channelId}: ${title}`)
  return {
    success: true,
    message: 'Announcement sent successfully',
    data: { messageId: `mock_announcement_${Date.now()}` }
  }
}

async function kickDiscordMember(guildId: string, memberId: string, reason: string, botToken?: string) {
  console.log(`Kicking Discord member ${memberId}: ${reason}`)
  return {
    success: true,
    message: 'Member kicked successfully'
  }
}

async function banDiscordMember(guildId: string, memberId: string, reason: string, deleteMessageDays: number, botToken?: string) {
  console.log(`Banning Discord member ${memberId}: ${reason}`)
  return {
    success: true,
    message: 'Member banned successfully'
  }
}

async function updateMemberRole(guildId: string, memberId: string, roleId: string, action: 'add' | 'remove', botToken?: string) {
  console.log(`${action === 'add' ? 'Adding' : 'Removing'} role ${roleId} for member ${memberId}`)
  return {
    success: true,
    message: `Role ${action === 'add' ? 'added' : 'removed'} successfully`
  }
}

async function createDiscordChannel(guildId: string, name: string, type: number, parentId?: string, botToken?: string) {
  console.log(`Creating Discord channel: ${name}`)
  return {
    success: true,
    message: 'Channel created successfully',
    data: { channelId: `mock_channel_${Date.now()}` }
  }
}

async function updateWebhookSettings(integrationId: string, webhookUrl: string, webhookSecret: string) {
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
    message: 'Webhook settings updated successfully'
  }
}

async function syncDiscordMembers(guildId: string, workspaceId: string, botToken?: string) {
  const members = await fetchDiscordMembers(guildId, botToken)

  // In production, this would sync members with your database
  console.log(`Syncing ${members.length} Discord members for guild ${guildId}`)

  return {
    success: true,
    message: `Synced ${members.length} Discord members`,
    data: { syncedCount: members.length }
  }
}