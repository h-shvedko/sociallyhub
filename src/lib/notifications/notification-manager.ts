import { 
  NotificationData, 
  NotificationPreferences, 
  NotificationTemplate,
  NotificationRule,
  NotificationHistory,
  NotificationStats,
  NotificationType,
  NotificationPriority,
  NotificationCategory,
  EmailNotificationData,
  PushNotificationData,
  SMSNotificationData,
  WebhookNotificationData
} from './types'
import { websocketManager } from './websocket-manager'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'
import { emailService } from './email-service'
import { pushService } from './push-service'
import { smsService } from './sms-service'
import { webhookService } from './webhook-service'

export interface NotificationManagerConfig {
  enableInApp: boolean
  enableEmail: boolean
  enablePush: boolean
  enableSMS: boolean
  enableWebhook: boolean
  throttleInterval: number
  maxRetries: number
  batchSize: number
}

export class NotificationManager {
  private config: NotificationManagerConfig
  private templates: Map<NotificationType, NotificationTemplate> = new Map()
  private rules: Map<string, NotificationRule> = new Map()
  private throttleCache: Map<string, { count: number; resetTime: number }> = new Map()
  private subscribers: Map<string, Set<(notification: NotificationData) => void>> = new Map()

  constructor(config: Partial<NotificationManagerConfig> = {}) {
    this.config = {
      enableInApp: true,
      enableEmail: true,
      enablePush: true,
      enableSMS: false,
      enableWebhook: true,
      throttleInterval: 60000, // 1 minute
      maxRetries: 3,
      batchSize: 100,
      ...config
    }

    this.initializeDefaultTemplates()
    this.initializeDefaultRules()
  }

  // Core notification methods
  async send(
    notification: Omit<NotificationData, 'id' | 'createdAt'>,
    preferences?: NotificationPreferences
  ): Promise<string> {
    const timer = PerformanceLogger.startTimer('send_notification')
    
    const fullNotification: NotificationData = {
      ...notification,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    }

    try {
      // Apply rules and preferences
      const channels = await this.determineChannels(fullNotification, preferences)
      
      if (channels.length === 0) {
        BusinessLogger.logNotificationEvent(
          'notification_skipped',
          fullNotification.userId,
          { notificationId: fullNotification.id, reason: 'no_channels' }
        )
        return fullNotification.id
      }

      // Check throttling
      if (await this.isThrottled(fullNotification)) {
        BusinessLogger.logNotificationEvent(
          'notification_throttled',
          fullNotification.userId,
          { notificationId: fullNotification.id }
        )
        return fullNotification.id
      }

      // Send to determined channels
      const deliveryPromises = channels.map(channel => 
        this.sendToChannel(fullNotification, channel)
      )

      const deliveryResults = await Promise.allSettled(deliveryPromises)

      // Log results
      const successful = deliveryResults.filter(r => r.status === 'fulfilled').length
      const failed = deliveryResults.filter(r => r.status === 'rejected').length

      BusinessLogger.logNotificationEvent(
        'notification_sent',
        fullNotification.userId,
        {
          notificationId: fullNotification.id,
          type: fullNotification.type,
          channels: channels.length,
          successful,
          failed,
          priority: fullNotification.priority
        }
      )

      timer.end({
        notificationId: fullNotification.id,
        channels: channels.length,
        successful,
        failed
      })

      return fullNotification.id

    } catch (error) {
      timer.end({ error: true })
      
      ErrorLogger.logUnexpectedError(error as Error, {
        context: 'send_notification',
        notificationId: fullNotification.id,
        userId: fullNotification.userId
      })

      throw error
    }
  }

  async sendBulk(
    notifications: Omit<NotificationData, 'id' | 'createdAt'>[],
    preferences?: NotificationPreferences
  ): Promise<string[]> {
    const timer = PerformanceLogger.startTimer('send_bulk_notifications')
    const notificationIds: string[] = []

    try {
      // Process in batches
      for (let i = 0; i < notifications.length; i += this.config.batchSize) {
        const batch = notifications.slice(i, i + this.config.batchSize)
        
        const batchPromises = batch.map(notification => 
          this.send(notification, preferences)
        )

        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            notificationIds.push(result.value)
          } else {
            ErrorLogger.logUnexpectedError(result.reason, {
              context: 'bulk_notification_failed',
              notificationIndex: i + index
            })
          }
        })
      }

      timer.end({
        totalNotifications: notifications.length,
        successful: notificationIds.length,
        batches: Math.ceil(notifications.length / this.config.batchSize)
      })

      return notificationIds

    } catch (error) {
      timer.end({ error: true })
      throw error
    }
  }

  // Channel-specific sending
  private async sendToChannel(
    notification: NotificationData, 
    channel: 'in_app' | 'email' | 'push' | 'sms' | 'webhook'
  ): Promise<void> {
    switch (channel) {
      case 'in_app':
        return this.sendInApp(notification)
      case 'email':
        return this.sendEmail(notification)
      case 'push':
        return this.sendPush(notification)
      case 'sms':
        return this.sendSMS(notification)
      case 'webhook':
        return this.sendWebhook(notification)
      default:
        throw new Error(`Unsupported channel: ${channel}`)
    }
  }

  private async sendInApp(notification: NotificationData): Promise<void> {
    if (!this.config.enableInApp) return

    // Send via WebSocket
    if (websocketManager.isConnected()) {
      await websocketManager.sendMessage('notification', notification)
    }

    // Notify local subscribers
    const userSubscribers = this.subscribers.get(notification.userId) || new Set()
    userSubscribers.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        ErrorLogger.logUnexpectedError(error as Error, {
          context: 'in_app_notification_callback',
          notificationId: notification.id
        })
      }
    })

    // TODO: Store in database for offline users
  }

  private async sendEmail(notification: NotificationData): Promise<void> {
    if (!this.config.enableEmail) return

    const template = this.templates.get(notification.type)
    if (!template?.emailHtml || !template?.emailSubject) return

    const emailData: EmailNotificationData = {
      to: [notification.userId], // TODO: Get actual email from user data
      subject: this.processTemplate(template.emailSubject, notification),
      html: this.processTemplate(template.emailHtml, notification),
      text: this.processTemplate(template.message, notification)
    }

    await emailService.send(emailData)
  }

  private async sendPush(notification: NotificationData): Promise<void> {
    if (!this.config.enablePush) return

    const template = this.templates.get(notification.type)
    
    const pushData: PushNotificationData = {
      title: template?.pushTitle || notification.title,
      body: template?.pushBody || notification.message,
      icon: notification.imageUrl,
      data: {
        notificationId: notification.id,
        actionUrl: notification.actionUrl,
        ...notification.data
      },
      tag: notification.type,
      requireInteraction: notification.priority === NotificationPriority.CRITICAL
    }

    if (notification.actionLabel && notification.actionUrl) {
      pushData.actions = [{
        action: 'open',
        title: notification.actionLabel
      }]
    }

    await pushService.send(notification.userId, pushData)
  }

  private async sendSMS(notification: NotificationData): Promise<void> {
    if (!this.config.enableSMS) return

    // Only send SMS for high/critical priority notifications
    if (![NotificationPriority.HIGH, NotificationPriority.CRITICAL].includes(notification.priority)) {
      return
    }

    const smsData: SMSNotificationData = {
      to: notification.userId, // TODO: Get actual phone number
      message: `${notification.title}: ${notification.message}`
    }

    await smsService.send(smsData)
  }

  private async sendWebhook(notification: NotificationData): Promise<void> {
    if (!this.config.enableWebhook) return

    // TODO: Get webhook URL from user preferences or workspace settings
    const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL
    if (!webhookUrl) return

    const webhookData: WebhookNotificationData = {
      url: webhookUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Notification-ID': notification.id
      },
      payload: {
        notification,
        timestamp: new Date().toISOString()
      }
    }

    await webhookService.send(webhookData)
  }

  // Template processing
  private processTemplate(template: string, notification: NotificationData): string {
    let processed = template

    // Replace basic variables
    const variables = {
      title: notification.title,
      message: notification.message,
      userId: notification.userId,
      workspaceId: notification.workspaceId || '',
      actionUrl: notification.actionUrl || '',
      actionLabel: notification.actionLabel || '',
      senderName: notification.sender?.name || '',
      ...notification.data,
      ...notification.metadata
    }

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      processed = processed.replace(regex, String(value || ''))
    })

    return processed
  }

  // Subscription management
  subscribe(userId: string, callback: (notification: NotificationData) => void): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set())
    }
    
    this.subscribers.get(userId)!.add(callback)
    
    return () => {
      const userSubscribers = this.subscribers.get(userId)
      if (userSubscribers) {
        userSubscribers.delete(callback)
        if (userSubscribers.size === 0) {
          this.subscribers.delete(userId)
        }
      }
    }
  }

  // Utility methods
  private async determineChannels(
    notification: NotificationData,
    preferences?: NotificationPreferences
  ): Promise<('in_app' | 'email' | 'push' | 'sms' | 'webhook')[]> {
    const channels: ('in_app' | 'email' | 'push' | 'sms' | 'webhook')[] = []

    if (!preferences) {
      // Default channels based on priority
      channels.push('in_app')
      
      if (notification.priority !== NotificationPriority.LOW) {
        if (this.config.enableEmail) channels.push('email')
      }
      
      if ([NotificationPriority.HIGH, NotificationPriority.CRITICAL].includes(notification.priority)) {
        if (this.config.enablePush) channels.push('push')
      }
      
      return channels
    }

    // Use preferences
    const categoryPrefs = preferences.categories[notification.category]
    
    if (!categoryPrefs?.enabled) return []
    
    if (preferences.channels.inApp && categoryPrefs.channels.includes('inApp')) {
      channels.push('in_app')
    }
    
    if (preferences.channels.email && categoryPrefs.channels.includes('email')) {
      channels.push('email')
    }
    
    if (preferences.channels.push && categoryPrefs.channels.includes('push')) {
      channels.push('push')
    }
    
    if (preferences.channels.sms && categoryPrefs.channels.includes('sms')) {
      channels.push('sms')
    }

    return channels
  }

  private async isThrottled(notification: NotificationData): Promise<boolean> {
    const key = `${notification.userId}:${notification.type}`
    const now = Date.now()
    const cached = this.throttleCache.get(key)

    if (!cached || now > cached.resetTime) {
      this.throttleCache.set(key, {
        count: 1,
        resetTime: now + this.config.throttleInterval
      })
      return false
    }

    // TODO: Make throttle limits configurable per notification type
    const limit = notification.priority === NotificationPriority.CRITICAL ? 10 : 5
    
    if (cached.count >= limit) {
      return true
    }

    cached.count++
    return false
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Template and rule management
  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'post_published',
        type: NotificationType.POST_PUBLISHED,
        title: 'Post Published Successfully',
        message: 'Your post "{{title}}" has been published to {{platform}}',
        emailSubject: '✅ Post Published - {{title}}',
        emailHtml: '<h2>Post Published Successfully</h2><p>Your post "{{title}}" has been published to {{platform}}.</p><a href="{{actionUrl}}">View Post</a>',
        pushTitle: 'Post Published',
        pushBody: 'Your post has been published to {{platform}}',
        variables: ['title', 'platform', 'actionUrl'],
        category: NotificationCategory.SOCIAL_MEDIA,
        priority: NotificationPriority.MEDIUM
      },
      {
        id: 'post_failed',
        type: NotificationType.POST_FAILED,
        title: 'Post Publishing Failed',
        message: 'Failed to publish "{{title}}" to {{platform}}: {{error}}',
        emailSubject: '❌ Post Publishing Failed - {{title}}',
        emailHtml: '<h2>Post Publishing Failed</h2><p>We couldn\'t publish your post "{{title}}" to {{platform}}.</p><p><strong>Error:</strong> {{error}}</p>',
        pushTitle: 'Post Failed',
        pushBody: 'Failed to publish to {{platform}}',
        variables: ['title', 'platform', 'error'],
        category: NotificationCategory.SOCIAL_MEDIA,
        priority: NotificationPriority.HIGH
      },
      {
        id: 'team_invitation',
        type: NotificationType.TEAM_INVITATION,
        title: 'Team Invitation',
        message: '{{senderName}} invited you to join {{workspaceId}}',
        emailSubject: '📧 You\'re invited to join {{workspaceId}}',
        emailHtml: '<h2>Team Invitation</h2><p>{{senderName}} has invited you to join the {{workspaceId}} workspace.</p><a href="{{actionUrl}}">Accept Invitation</a>',
        pushTitle: 'Team Invitation',
        pushBody: 'You\'ve been invited to join {{workspaceId}}',
        variables: ['senderName', 'workspaceId', 'actionUrl'],
        category: NotificationCategory.TEAM,
        priority: NotificationPriority.MEDIUM
      },
      {
        id: 'approval_requested',
        type: NotificationType.APPROVAL_REQUESTED,
        title: 'Approval Requested',
        message: '{{requesterName}} requested approval for "{{postTitle}}"',
        emailSubject: '📝 Approval Request - {{postTitle}}',
        emailHtml: '<h2>Approval Requested</h2><p>{{requesterName}} has requested approval for the post "{{postTitle}}".</p><a href="{{actionUrl}}">Review & Approve</a>',
        pushTitle: 'Approval Needed',
        pushBody: 'Review post: {{postTitle}}',
        variables: ['requesterName', 'postTitle', 'actionUrl'],
        category: NotificationCategory.CONTENT,
        priority: NotificationPriority.HIGH
      }
    ]

    defaultTemplates.forEach(template => {
      this.templates.set(template.type, template)
    })
  }

  private initializeDefaultRules(): void {
    // Default notification rules can be added here
    // For now, we'll use basic logic in determineChannels
  }
}

// Singleton instance for global use
export const notificationManager = new NotificationManager()