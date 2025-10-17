import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// Discord Member interfaces
interface DiscordMember {
  user: {
    id: string
    username: string
    discriminator: string
    avatar: string | null
    bot?: boolean
  }
  nick?: string | null
  roles: string[]
  joined_at: string
  premium_since?: string | null
  deaf?: boolean
  mute?: boolean
  pending?: boolean
  permissions?: string
}

interface MemberActivity {
  userId: string
  messageCount: number
  lastActivity: Date
  channelActivity: Record<string, number>
  moderationHistory: any[]
}

// Mock Discord API functions
async function fetchDiscordMembers(guildId: string, botToken?: string): Promise<DiscordMember[]> {
  // In production, this would make actual Discord API calls
  return [
    {
      user: {
        id: '123456789012345678',
        username: 'ActiveUser',
        discriminator: '1234',
        avatar: 'avatar_hash_1'
      },
      nick: 'Community Leader',
      roles: ['987654321098765432', '876543210987654321'],
      joined_at: '2023-01-15T10:30:00.000Z'
    },
    {
      user: {
        id: '234567890123456789',
        username: 'NewMember',
        discriminator: '5678',
        avatar: 'avatar_hash_2'
      },
      nick: null,
      roles: ['876543210987654321'], // Basic role
      joined_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
    },
    {
      user: {
        id: '345678901234567890',
        username: 'ModeratorBot',
        discriminator: '0001',
        avatar: 'bot_avatar',
        bot: true
      },
      nick: null,
      roles: ['765432109876543210'], // Moderator role
      joined_at: '2023-01-01T00:00:00.000Z'
    },
    {
      user: {
        id: '456789012345678901',
        username: 'RegularUser',
        discriminator: '9999',
        avatar: null
      },
      nick: 'Just a User',
      roles: ['876543210987654321'],
      joined_at: '2023-06-20T14:22:00.000Z'
    },
    {
      user: {
        id: '567890123456789012',
        username: 'VIPMember',
        discriminator: '0007',
        avatar: 'vip_avatar'
      },
      nick: '⭐ VIP Member',
      roles: ['987654321098765432', '654321098765432109'], // Multiple roles including VIP
      joined_at: '2023-02-10T09:15:00.000Z',
      premium_since: '2023-03-01T00:00:00.000Z'
    }
  ]
}

async function fetchMemberActivity(guildId: string, memberId: string, botToken?: string): Promise<MemberActivity> {
  // Mock activity data
  return {
    userId: memberId,
    messageCount: Math.floor(Math.random() * 500) + 10,
    lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    channelActivity: {
      'general': Math.floor(Math.random() * 100),
      'support': Math.floor(Math.random() * 50),
      'feature-requests': Math.floor(Math.random() * 20)
    },
    moderationHistory: []
  }
}

// GET /api/community/discord/members - List Discord members with management info
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const search = searchParams.get('search')
    const roleFilter = searchParams.get('role')
    const activityFilter = searchParams.get('activity') // 'active', 'inactive', 'new'
    const sort = searchParams.get('sort') || 'joined' // 'joined', 'activity', 'username'
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

    // Fetch Discord members
    let members = await fetchDiscordMembers(integration.guildId, integration.botToken)

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      members = members.filter(member =>
        member.user.username.toLowerCase().includes(searchLower) ||
        member.nick?.toLowerCase().includes(searchLower)
      )
    }

    // Apply role filter
    if (roleFilter) {
      members = members.filter(member => member.roles.includes(roleFilter))
    }

    // Apply activity filter
    if (activityFilter) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      switch (activityFilter) {
        case 'new':
          members = members.filter(member =>
            new Date(member.joined_at) >= sevenDaysAgo
          )
          break
        case 'active':
          // Members who joined more than 7 days ago and are not bots
          members = members.filter(member =>
            new Date(member.joined_at) <= sevenDaysAgo && !member.user.bot
          )
          break
        case 'inactive':
          // Members who joined more than 30 days ago
          members = members.filter(member =>
            new Date(member.joined_at) <= thirtyDaysAgo && !member.user.bot
          )
          break
      }
    }

    // Sort members
    switch (sort) {
      case 'username':
        members.sort((a, b) => a.user.username.localeCompare(b.user.username))
        break
      case 'activity':
        // Sort by join date as proxy for activity (in production, use real activity data)
        members.sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
        break
      default: // 'joined'
        members.sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
    }

    // Paginate
    const totalMembers = members.length
    const paginatedMembers = members.slice(offset, offset + limit)

    // Get member activity data for paginated members
    const membersWithActivity = await Promise.all(
      paginatedMembers.map(async (member) => {
        const activity = await fetchMemberActivity(integration.guildId, member.user.id, integration.botToken)

        // Get moderation history from our database
        const moderationHistory = await prisma.userModerationHistory.findMany({
          where: {
            workspaceId,
            // In production, you'd link Discord user ID to your user system
            targetId: member.user.id
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            moderator: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        })

        return {
          ...member,
          activity,
          moderationHistory,
          joinedDaysAgo: Math.floor((Date.now() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24))
        }
      })
    )

    // Get role information (mock data)
    const roles = [
      { id: '987654321098765432', name: 'Community Leader', color: 0xff6b6b, position: 3 },
      { id: '876543210987654321', name: 'Member', color: 0x74c0fc, position: 1 },
      { id: '765432109876543210', name: 'Moderator', color: 0x51cf66, position: 4 },
      { id: '654321098765432109', name: 'VIP', color: 0xffd43b, position: 2 }
    ]

    // Get member statistics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const statistics = {
      totalMembers: integration.memberCount || totalMembers,
      onlineMembers: integration.onlineMembers || Math.floor(totalMembers * 0.3),
      newMembers: members.filter(m => new Date(m.joined_at) >= sevenDaysAgo).length,
      activeMembers: members.filter(m => new Date(m.joined_at) <= sevenDaysAgo && !m.user.bot).length,
      bots: members.filter(m => m.user.bot).length,
      premiumMembers: members.filter(m => m.premium_since).length
    }

    return NextResponse.json({
      members: membersWithActivity,
      roles,
      statistics,
      pagination: {
        total: totalMembers,
        limit,
        offset,
        hasMore: offset + paginatedMembers.length < totalMembers
      }
    })

  } catch (error) {
    console.error('Failed to fetch Discord members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Discord members' },
      { status: 500 }
    )
  }
}

// POST /api/community/discord/members - Execute member management actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      action, // KICK, BAN, UNBAN, ADD_ROLE, REMOVE_ROLE, TIMEOUT, NICKNAME
      memberId,
      reason,
      parameters // Action-specific parameters
    } = body

    if (!workspaceId || !action || !memberId) {
      return NextResponse.json(
        { error: 'Workspace ID, action, and member ID are required' },
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

    // Execute member management action
    switch (action) {
      case 'KICK':
        result = await kickMember(integration.guildId, memberId, reason, integration.botToken)
        actionDescription = `Kicked member ${memberId}`
        break

      case 'BAN':
        result = await banMember(
          integration.guildId,
          memberId,
          reason,
          parameters?.deleteMessageDays || 0,
          integration.botToken
        )
        actionDescription = `Banned member ${memberId}`
        break

      case 'UNBAN':
        result = await unbanMember(integration.guildId, memberId, reason, integration.botToken)
        actionDescription = `Unbanned member ${memberId}`
        break

      case 'ADD_ROLE':
        result = await addMemberRole(
          integration.guildId,
          memberId,
          parameters.roleId,
          integration.botToken
        )
        actionDescription = `Added role to member ${memberId}`
        break

      case 'REMOVE_ROLE':
        result = await removeMemberRole(
          integration.guildId,
          memberId,
          parameters.roleId,
          integration.botToken
        )
        actionDescription = `Removed role from member ${memberId}`
        break

      case 'TIMEOUT':
        result = await timeoutMember(
          integration.guildId,
          memberId,
          parameters.duration,
          reason,
          integration.botToken
        )
        actionDescription = `Timed out member ${memberId} for ${parameters.duration} minutes`
        break

      case 'NICKNAME':
        result = await updateMemberNickname(
          integration.guildId,
          memberId,
          parameters.nickname,
          integration.botToken
        )
        actionDescription = `Updated nickname for member ${memberId}`
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Log the moderation action
    await prisma.moderationAction.create({
      data: {
        workspaceId,
        moderatorId: normalizeUserId(session.user.id),
        actionType: action,
        targetType: 'DISCORD_MEMBER',
        targetId: memberId,
        reason: reason || actionDescription,
        description: `Discord member action: ${actionDescription}`,
        status: result.success ? 'COMPLETED' : 'FAILED',
        reviewedBy: normalizeUserId(session.user.id),
        reviewedAt: new Date(),
        metadata: {
          discordAction: action,
          memberId,
          parameters,
          result
        }
      }
    })

    // Create community activity
    await prisma.communityActivity.create({
      data: {
        activityType: 'DISCORD_MEMBER_ACTION',
        title: `Discord member ${action.toLowerCase()}`,
        description: actionDescription + (reason ? `: ${reason}` : ''),
        userId: normalizeUserId(session.user.id),
        userName: session.user.name || 'Admin',
        userAvatar: session.user.image,
        targetId: memberId,
        targetType: 'discord_member',
        targetTitle: `Discord Member`,
        workspaceId,
        metadata: {
          action,
          memberId,
          parameters,
          success: result.success,
          guildId: integration.guildId
        }
      }
    })

    return NextResponse.json({
      success: result.success,
      message: result.message || actionDescription,
      data: result.data
    })

  } catch (error) {
    console.error('Failed to execute member action:', error)
    return NextResponse.json(
      { error: 'Failed to execute member action' },
      { status: 500 }
    )
  }
}

// Discord API member management functions (mock implementations)
async function kickMember(guildId: string, memberId: string, reason: string, botToken?: string) {
  console.log(`Kicking member ${memberId} from guild ${guildId}: ${reason}`)
  return {
    success: true,
    message: 'Member kicked successfully'
  }
}

async function banMember(guildId: string, memberId: string, reason: string, deleteMessageDays: number, botToken?: string) {
  console.log(`Banning member ${memberId} from guild ${guildId}: ${reason}`)
  return {
    success: true,
    message: 'Member banned successfully'
  }
}

async function unbanMember(guildId: string, memberId: string, reason: string, botToken?: string) {
  console.log(`Unbanning member ${memberId} from guild ${guildId}: ${reason}`)
  return {
    success: true,
    message: 'Member unbanned successfully'
  }
}

async function addMemberRole(guildId: string, memberId: string, roleId: string, botToken?: string) {
  console.log(`Adding role ${roleId} to member ${memberId} in guild ${guildId}`)
  return {
    success: true,
    message: 'Role added successfully'
  }
}

async function removeMemberRole(guildId: string, memberId: string, roleId: string, botToken?: string) {
  console.log(`Removing role ${roleId} from member ${memberId} in guild ${guildId}`)
  return {
    success: true,
    message: 'Role removed successfully'
  }
}

async function timeoutMember(guildId: string, memberId: string, duration: number, reason: string, botToken?: string) {
  console.log(`Timing out member ${memberId} in guild ${guildId} for ${duration} minutes: ${reason}`)
  return {
    success: true,
    message: 'Member timed out successfully'
  }
}

async function updateMemberNickname(guildId: string, memberId: string, nickname: string, botToken?: string) {
  console.log(`Updating nickname for member ${memberId} in guild ${guildId} to: ${nickname}`)
  return {
    success: true,
    message: 'Nickname updated successfully'
  }
}