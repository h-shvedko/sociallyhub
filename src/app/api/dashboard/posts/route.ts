import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/dashboard/posts - Get recent posts for dashboard
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
      return NextResponse.json({ posts: [] })
    }

    // Fetch recent posts with engagement metrics
    const recentPosts = await prisma.post.findMany({
      where: {
        workspaceId: { in: workspaceIds }
      },
      include: {
        variants: {
          select: {
            socialAccountId: true,
            providerPostId: true,
            text: true,
            socialAccount: {
              select: {
                provider: true,
                displayName: true
              }
            }
          }
        },
        metrics: {
          where: {
            metricType: { in: ['likes', 'comments', 'shares', 'reach'] }
          },
          select: {
            metricType: true,
            value: true
          }
        },
        campaign: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    // Format posts for dashboard display
    const formattedPosts = recentPosts.map(post => {
      // Calculate engagement metrics
      const likesMetric = post.metrics.find(m => m.metricType === 'likes')
      const commentsMetric = post.metrics.find(m => m.metricType === 'comments')
      const sharesMetric = post.metrics.find(m => m.metricType === 'shares')
      const reachMetric = post.metrics.find(m => m.metricType === 'reach')

      const likes = likesMetric ? likesMetric.value : 0
      const comments = commentsMetric ? commentsMetric.value : 0
      const shares = sharesMetric ? sharesMetric.value : 0
      const reach = reachMetric ? reachMetric.value : 0

      // Get platforms from socialAccount.provider
      const platforms = post.variants.map(v => {
        // Convert database provider names to display names
        const platformMap: { [key: string]: string } = {
          'TWITTER': 'Twitter',
          'FACEBOOK': 'Facebook', 
          'INSTAGRAM': 'Instagram',
          'LINKEDIN': 'LinkedIn',
          'YOUTUBE': 'YouTube',
          'TIKTOK': 'TikTok'
        }
        return platformMap[v.socialAccount.provider] || v.socialAccount.provider
      })

      // Format engagement text
      const formatEngagement = () => {
        if (post.status === 'PUBLISHED' && (likes > 0 || comments > 0 || shares > 0)) {
          const parts = []
          if (likes > 0) parts.push(`${likes} likes`)
          if (comments > 0) parts.push(`${comments} comments`)
          if (shares > 0) parts.push(`${shares} shares`)
          return parts.join(', ')
        } else if (post.status === 'SCHEDULED') {
          return 'Pending'
        } else {
          return 'Draft'
        }
      }

      // Format time
      const formatTime = () => {
        if (post.status === 'PUBLISHED' && post.publishedAt) {
          const now = new Date()
          const published = new Date(post.publishedAt)
          const diffMs = now.getTime() - published.getTime()
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
          const diffDays = Math.floor(diffHours / 24)

          if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
          } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
          } else {
            const diffMinutes = Math.floor(diffMs / (1000 * 60))
            return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
          }
        } else if (post.status === 'SCHEDULED' && post.scheduledAt) {
          const scheduled = new Date(post.scheduledAt)
          const now = new Date()
          const tomorrow = new Date(now)
          tomorrow.setDate(tomorrow.getDate() + 1)

          if (scheduled.toDateString() === tomorrow.toDateString()) {
            return `Tomorrow ${scheduled.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })}`
          } else {
            return scheduled.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            })
          }
        }
        return null
      }

      return {
        id: post.id,
        content: post.baseContent || 
          (post.variants.length > 0 ? post.variants[0].text : null) || 
          'No content',
        platforms,
        status: post.status.toLowerCase(),
        publishedAt: formatTime(),
        scheduledAt: post.status === 'SCHEDULED' ? formatTime() : null,
        engagement: formatEngagement(),
        campaign: post.campaign?.title || null
      }
    })

    return NextResponse.json({ posts: formattedPosts })

  } catch (error) {
    console.error('Error fetching dashboard posts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'dashboard-posts')