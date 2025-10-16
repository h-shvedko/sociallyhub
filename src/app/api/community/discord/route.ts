import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/community/discord - Get Discord integration info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    // If workspaceId provided, get specific integration
    if (workspaceId) {
      const integration = await prisma.discordIntegration.findUnique({
        where: { workspaceId },
        select: {
          id: true,
          guildId: true,
          guildName: true,
          guildIcon: true,
          inviteUrl: true,
          memberCount: true,
          onlineMembers: true,
          lastActivity: true,
          isActive: true,
          channels: true,
          createdAt: true
        }
      })

      return NextResponse.json({ integration })
    }

    // Otherwise return demo/public Discord server info
    const demoDiscordInfo = {
      id: 'demo-discord',
      guildId: '1234567890123456789',
      guildName: 'SociallyHub Community',
      guildIcon: 'https://cdn.discordapp.com/icons/server/icon.png',
      inviteUrl: 'https://discord.gg/sociallyhub',
      memberCount: 1247,
      onlineMembers: 89,
      lastActivity: new Date().toISOString(),
      isActive: true,
      channels: {
        general: '1234567890123456789',
        support: '1234567890123456790',
        announcements: '1234567890123456791',
        feature_requests: '1234567890123456792',
        showcase: '1234567890123456793'
      },
      recentActivity: [
        {
          type: 'member_joined',
          userName: 'NewUser123',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
        },
        {
          type: 'message_posted',
          userName: 'ActiveUser',
          channel: 'general',
          content: 'Thanks for the help with my integration issue!',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
        },
        {
          type: 'feature_discussed',
          userName: 'PowerUser',
          channel: 'feature_requests',
          content: 'Love the new analytics dashboard feature!',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
        }
      ]
    }

    return NextResponse.json({ integration: demoDiscordInfo })

  } catch (error) {
    console.error('Failed to fetch Discord integration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Discord integration' },
      { status: 500 }
    )
  }
}

// POST /api/community/discord - Setup Discord integration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      workspaceId,
      guildId,
      guildName,
      guildIcon,
      inviteUrl,
      channels = {},
      webhookUrl,
      webhookSecret
    } = body

    // Validation
    if (!workspaceId || !guildId || !guildName || !inviteUrl) {
      return NextResponse.json(
        { error: 'Workspace ID, Guild ID, Guild Name, and Invite URL are required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Upsert Discord integration
    const integration = await prisma.discordIntegration.upsert({
      where: { workspaceId },
      update: {
        guildId,
        guildName,
        guildIcon,
        inviteUrl,
        channels,
        webhookUrl,
        webhookSecret,
        isActive: true,
        lastActivity: new Date()
      },
      create: {
        workspaceId,
        guildId,
        guildName,
        guildIcon,
        inviteUrl,
        channels,
        webhookUrl,
        webhookSecret,
        memberCount: 0,
        onlineMembers: 0,
        isActive: true
      }
    })

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'DISCORD_MEMBER_JOINED',
        title: 'Discord server connected',
        description: `Connected to Discord server: ${guildName}`,
        userId,
        userName: session.user.name || 'User',
        userAvatar: session.user.image,
        workspaceId,
        metadata: {
          guildName,
          inviteUrl
        }
      }
    })

    return NextResponse.json({
      integration,
      message: 'Discord integration setup successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Failed to setup Discord integration:', error)
    return NextResponse.json(
      { error: 'Failed to setup Discord integration' },
      { status: 500 }
    )
  }
}

// PUT /api/community/discord - Update Discord integration
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = normalizeUserId(session.user.id)
    const body = await request.json()

    const {
      workspaceId,
      memberCount,
      onlineMembers,
      isActive,
      autoAnnounce
    } = body

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to workspace
    const userWorkspace = await prisma.userWorkspace.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId
        }
      }
    })

    if (!userWorkspace || !['OWNER', 'ADMIN'].includes(userWorkspace.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Update integration
    const updateData: any = {
      lastActivity: new Date()
    }

    if (memberCount !== undefined) updateData.memberCount = memberCount
    if (onlineMembers !== undefined) updateData.onlineMembers = onlineMembers
    if (isActive !== undefined) updateData.isActive = isActive
    if (autoAnnounce !== undefined) updateData.autoAnnounce = autoAnnounce

    const integration = await prisma.discordIntegration.update({
      where: { workspaceId },
      data: updateData
    })

    return NextResponse.json({
      integration,
      message: 'Discord integration updated successfully'
    })

  } catch (error) {
    console.error('Failed to update Discord integration:', error)
    return NextResponse.json(
      { error: 'Failed to update Discord integration' },
      { status: 500 }
    )
  }
}