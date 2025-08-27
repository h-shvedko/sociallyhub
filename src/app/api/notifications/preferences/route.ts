import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging, SecurityLogger, ErrorLogger, BusinessLogger } from '@/lib/middleware/logging'
import { z } from 'zod'
import { NotificationPreferences, NotificationCategory, NotificationPriority } from '@/lib/notifications/types'

const notificationPreferencesSchema = z.object({
  userId: z.string(),
  workspaceId: z.string().optional(),
  channels: z.object({
    inApp: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
    sms: z.boolean()
  }),
  categories: z.record(z.object({
    enabled: z.boolean(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    channels: z.array(z.enum(['inApp', 'email', 'push', 'sms']))
  })),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string(),
    end: z.string(),
    timezone: z.string()
  }).optional(),
  frequency: z.object({
    immediate: z.array(z.string()),
    digest: z.array(z.string()),
    digestInterval: z.enum(['hourly', 'daily', 'weekly'])
  }).optional()
})

// Mock storage for preferences - in production, this would be in a database
const mockPreferences = new Map<string, NotificationPreferences>()

async function handleGetPreferences(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/notifications/preferences', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const workspaceId = searchParams.get('workspaceId')

    if (!userId || userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const key = workspaceId ? `${userId}:${workspaceId}` : userId
    const preferences = mockPreferences.get(key)

    if (!preferences) {
      // Return default preferences
      const defaultPreferences: NotificationPreferences = {
        userId,
        workspaceId,
        channels: {
          inApp: true,
          email: true,
          push: false,
          sms: false
        },
        categories: {
          [NotificationCategory.SOCIAL_MEDIA]: {
            enabled: true,
            priority: NotificationPriority.MEDIUM,
            channels: ['inApp', 'email']
          },
          [NotificationCategory.TEAM]: {
            enabled: true,
            priority: NotificationPriority.HIGH,
            channels: ['inApp', 'email', 'push']
          },
          [NotificationCategory.CONTENT]: {
            enabled: true,
            priority: NotificationPriority.MEDIUM,
            channels: ['inApp', 'email']
          },
          [NotificationCategory.ANALYTICS]: {
            enabled: true,
            priority: NotificationPriority.LOW,
            channels: ['inApp']
          },
          [NotificationCategory.SYSTEM]: {
            enabled: true,
            priority: NotificationPriority.HIGH,
            channels: ['inApp', 'email']
          },
          [NotificationCategory.SECURITY]: {
            enabled: true,
            priority: NotificationPriority.CRITICAL,
            channels: ['inApp', 'email', 'push', 'sms']
          }
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        },
        frequency: {
          immediate: [
            'team_invitation',
            'approval_requested',
            'security_alert',
            'post_failed'
          ],
          digest: [
            'post_published',
            'engagement_milestone',
            'analytics_report'
          ],
          digestInterval: 'daily'
        }
      }

      return NextResponse.json({
        success: true,
        data: defaultPreferences
      })
    }

    BusinessLogger.logNotificationEvent(
      'preferences_fetched',
      session.user.id,
      { workspaceId }
    )

    return NextResponse.json({
      success: true,
      data: preferences
    })

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/notifications/preferences',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleSavePreferences(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      SecurityLogger.logUnauthorizedAccess(
        undefined, 
        '/api/notifications/preferences', 
        request.headers.get('x-forwarded-for') || undefined
      )
      
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate preferences data
    let validatedPreferences
    try {
      validatedPreferences = notificationPreferencesSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: 'Invalid preferences data',
            details: error.errors
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Ensure user can only update their own preferences
    if (validatedPreferences.userId !== session.user.id) {
      SecurityLogger.logUnauthorizedAccess(
        session.user.id, 
        '/api/notifications/preferences', 
        request.headers.get('x-forwarded-for') || undefined,
        { attemptedUserId: validatedPreferences.userId }
      )
      
      return NextResponse.json(
        { error: 'Unauthorized: Cannot update preferences for another user' },
        { status: 403 }
      )
    }

    // Save preferences (in production, this would be saved to database)
    const key = validatedPreferences.workspaceId 
      ? `${validatedPreferences.userId}:${validatedPreferences.workspaceId}` 
      : validatedPreferences.userId
    
    mockPreferences.set(key, validatedPreferences)

    BusinessLogger.logNotificationEvent(
      'preferences_saved',
      session.user.id,
      { 
        workspaceId: validatedPreferences.workspaceId,
        enabledChannels: Object.entries(validatedPreferences.channels)
          .filter(([_, enabled]) => enabled)
          .map(([channel, _]) => channel),
        enabledCategories: Object.entries(validatedPreferences.categories)
          .filter(([_, config]) => config.enabled)
          .map(([category, _]) => category)
      }
    )

    return NextResponse.json({
      success: true,
      data: validatedPreferences,
      message: 'Notification preferences saved successfully'
    })

  } catch (error) {
    ErrorLogger.logUnexpectedError(error as Error, {
      endpoint: '/api/notifications/preferences',
      method: 'POST'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(handleGetPreferences, 'get-notification-preferences')
export const POST = withLogging(handleSavePreferences, 'save-notification-preferences')