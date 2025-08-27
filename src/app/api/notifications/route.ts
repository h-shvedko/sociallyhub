import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging, SecurityLogger, ErrorLogger, BusinessLogger } from '@/lib/middleware/logging'
import { z } from 'zod'

// Mock data for demonstration - in production, this would come from a database
const mockNotifications = [
  {
    id: 'notif_1',
    type: 'post_published',
    title: 'Post Published Successfully',
    message: 'Your post "Social Media Strategy 2024" has been published to Twitter.',
    userId: 'user1',
    workspaceId: 'workspace1',
    priority: 'medium',
    category: 'social_media',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    readAt: null,
    actionUrl: '/dashboard/posts/123',
    actionLabel: 'View Post',
    metadata: {
      postId: '123',
      platform: 'twitter',
      metrics: {
        likes: 45,
        shares: 12,
        comments: 8
      }
    }
  },
  {
    id: 'notif_2',
    type: 'team_invitation',
    title: 'Team Invitation',
    message: 'John Smith invited you to join the Marketing Team workspace.',
    userId: 'user1',
    workspaceId: 'workspace1',
    priority: 'high',
    category: 'team',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    readAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    actionUrl: '/dashboard/team/invitations',
    actionLabel: 'View Invitation',
    sender: {
      id: 'user2',
      name: 'John Smith',
      avatar: '/avatars/john.jpg'
    },
    metadata: {
      role: 'editor',
      invitationId: 'inv_123'
    }
  },
  {
    id: 'notif_3',
    type: 'approval_requested',
    title: 'Approval Requested',
    message: 'Sarah Davis requested approval for "Product Launch Campaign".',
    userId: 'user1',
    workspaceId: 'workspace1',
    priority: 'high',
    category: 'content',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    readAt: null,
    actionUrl: '/dashboard/approvals/456',
    actionLabel: 'Review & Approve',
    sender: {
      id: 'user3',
      name: 'Sarah Davis',
      avatar: '/avatars/sarah.jpg'
    },
    metadata: {
      postId: '456',
      postTitle: 'Product Launch Campaign',
      requesterId: 'user3',
      requesterName: 'Sarah Davis'
    }
  },
  {
    id: 'notif_4',
    type: 'engagement_milestone',
    title: 'Engagement Milestone Reached!',
    message: 'Your Twitter account just reached 1,000 followers!',
    userId: 'user1',
    workspaceId: 'workspace1',
    priority: 'medium',
    category: 'social_media',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    readAt: null,
    actionUrl: '/dashboard/analytics?platform=twitter',
    actionLabel: 'View Analytics',
    metadata: {
      platform: 'twitter',
      metric: 'followers',
      value: 1000,
      accountId: 'twitter_123'
    }
  },
  {
    id: 'notif_5',
    type: 'post_failed',
    title: 'Post Publishing Failed',
    message: 'Failed to publish "Weekly Newsletter" to LinkedIn: Rate limit exceeded.',
    userId: 'user1',
    workspaceId: 'workspace1',
    priority: 'high',
    category: 'social_media',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    readAt: null,
    actionUrl: '/dashboard/posts/789?retry=true',
    actionLabel: 'Retry Publishing',
    metadata: {
      postId: '789',
      platform: 'linkedin',
      error: 'Rate limit exceeded. Please try again in 15 minutes.'
    }
  }
]

const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  category: z.string().optional(),
  priority: z.string().optional(),
  read: z.enum(['all', 'read', 'unread']).default('all'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

async function handleGetNotifications(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/notifications', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    let queryParams
    try {
      queryParams = getNotificationsQuerySchema.parse({
        limit: searchParams.get('limit'),
        offset: searchParams.get('offset'),
        category: searchParams.get('category'),
        priority: searchParams.get('priority'),
        read: searchParams.get('read'),
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate')
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid query parameters',
            details: error.errors
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Filter notifications based on query parameters
    let filteredNotifications = mockNotifications.filter(notification => {
      // Filter by user
      if (notification.userId !== session.user.id) {
        return false
      }

      // Filter by category
      if (queryParams.category && notification.category !== queryParams.category) {
        return false
      }

      // Filter by priority
      if (queryParams.priority && notification.priority !== queryParams.priority) {
        return false
      }

      // Filter by read status
      if (queryParams.read === 'read' && !notification.readAt) {
        return false
      }
      if (queryParams.read === 'unread' && notification.readAt) {
        return false
      }

      // Filter by date range
      if (queryParams.startDate) {
        const notificationDate = new Date(notification.createdAt)
        const startDate = new Date(queryParams.startDate)
        if (notificationDate < startDate) {
          return false
        }
      }

      if (queryParams.endDate) {
        const notificationDate = new Date(notification.createdAt)
        const endDate = new Date(queryParams.endDate)
        if (notificationDate > endDate) {
          return false
        }
      }

      return true
    })

    // Sort by creation date (newest first)
    filteredNotifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Apply pagination
    const total = filteredNotifications.length
    const notifications = filteredNotifications.slice(
      queryParams.offset, 
      queryParams.offset + queryParams.limit
    )

    // Calculate stats
    const stats = {
      total: mockNotifications.length,
      unread: mockNotifications.filter(n => !n.readAt && n.userId === session.user.id).length,
      byCategory: mockNotifications.reduce((acc, n) => {
        if (n.userId === session.user.id) {
          acc[n.category] = (acc[n.category] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>),
      byPriority: mockNotifications.reduce((acc, n) => {
        if (n.userId === session.user.id) {
          acc[n.priority] = (acc[n.priority] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)
    }

    BusinessLogger.logNotificationEvent(
      'notifications_fetched',
      session.user.id,
      {
        count: notifications.length,
        total,
        filters: queryParams
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          offset: queryParams.offset,
          limit: queryParams.limit,
          hasMore: queryParams.offset + queryParams.limit < total
        },
        stats
      }
    })

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/notifications',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(handleGetNotifications, 'get-notifications')