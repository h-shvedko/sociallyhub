import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/dashboard/inbox - Get recent inbox items for dashboard
async function getHandler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Normalize user ID for consistency with legacy sessions
    const userId = await normalizeUserId(session.user.id)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5') // Default to 5 for dashboard

    // Get user's workspaces
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: { userId },
      select: { workspaceId: true }
    })
    const workspaceIds = userWorkspaces.map(uw => uw.workspaceId)

    if (workspaceIds.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // Fetch recent inbox items
    const inboxItems = await prisma.inboxItem.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        status: { not: 'CLOSED' } // Exclude closed items from dashboard
      },
      include: {
        socialAccount: {
          select: {
            provider: true,
            displayName: true,
            handle: true
          }
        },
        assignee: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    // Format inbox items for dashboard display
    const formattedItems = inboxItems.map(item => {
      // Format time
      const formatTime = () => {
        const now = new Date()
        const created = new Date(item.createdAt)
        const diffMs = now.getTime() - created.getTime()
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffDays = Math.floor(diffHours / 24)
        const diffMinutes = Math.floor(diffMs / (1000 * 60))

        if (diffDays > 0) {
          return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
        } else if (diffHours > 0) {
          return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
        } else if (diffMinutes > 0) {
          return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
        } else {
          return 'Just now'
        }
      }

      // Format platform name (provider is the field name in socialAccount)
      const formatPlatform = (provider: string) => {
        const platformMap: { [key: string]: string } = {
          'TWITTER': 'Twitter',
          'FACEBOOK': 'Facebook',
          'INSTAGRAM': 'Instagram', 
          'LINKEDIN': 'LinkedIn',
          'YOUTUBE': 'YouTube',
          'TIKTOK': 'TikTok'
        }
        return platformMap[provider] || provider
      }

      // Format type
      const formatType = (type: string) => {
        const typeMap: { [key: string]: string } = {
          'MENTION': 'mention',
          'DIRECT_MESSAGE': 'dm',
          'COMMENT': 'comment',
          'REVIEW': 'review',
          'REPLY': 'reply'
        }
        return typeMap[type] || type.toLowerCase()
      }

      // Truncate content if too long
      const truncateContent = (content: string, maxLength: number = 100) => {
        if (content.length <= maxLength) return content
        return content.substring(0, maxLength) + '...'
      }

      return {
        id: item.id,
        author: item.authorName || item.authorHandle || 'Unknown User',
        platform: formatPlatform(item.socialAccount?.provider || 'UNKNOWN'),
        content: truncateContent(item.content || 'No content'),
        time: formatTime(),
        type: formatType(item.type || 'COMMENT'),
        status: item.status?.toLowerCase() || 'new',
        sentiment: item.sentiment?.toLowerCase() || null,
        isUrgent: item.sentiment === 'negative' || (item.slaBreachedAt && new Date(item.slaBreachedAt) <= new Date()),
        platformHandle: item.authorHandle,
        assignee: item.assignee?.name || null
      }
    })

    // Calculate summary stats
    const totalItems = await prisma.inboxItem.count({
      where: {
        workspaceId: { in: workspaceIds },
        status: { not: 'CLOSED' }
      }
    })

    const urgentItems = await prisma.inboxItem.count({
      where: {
        workspaceId: { in: workspaceIds },
        status: { not: 'CLOSED' },
        OR: [
          { sentiment: 'negative' },
          { slaBreachedAt: { lte: new Date() } }
        ]
      }
    })

    return NextResponse.json({
      items: formattedItems,
      summary: {
        total: totalItems,
        urgent: urgentItems,
        pending: await prisma.inboxItem.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: 'OPEN'
          }
        }),
        replied: await prisma.inboxItem.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: 'CLOSED'
          }
        })
      }
    })

  } catch (error) {
    console.error('Error fetching dashboard inbox:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'dashboard-inbox')