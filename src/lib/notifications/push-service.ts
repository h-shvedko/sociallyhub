import webpush from 'web-push'
import { PushNotificationData } from './types'
import { ErrorLogger, PerformanceLogger, BusinessLogger } from '@/lib/middleware/logging'

export interface PushServiceConfig {
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidEmail: string
  maxRetries: number
  retryDelay: number
  ttl: number
}

export interface PushSubscription {
  userId: string
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  userAgent?: string
  createdAt: string
  lastUsed?: string
}

export class PushService {
  private config: PushServiceConfig
  private subscriptions: Map<string, PushSubscription[]> = new Map()

  constructor() {
    this.config = {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
      vapidEmail: process.env.VAPID_EMAIL || 'noreply@sociallyhub.com',
      maxRetries: 3,
      retryDelay: 2000,
      ttl: 24 * 60 * 60 // 24 hours in seconds
    }

    this.initializeWebPush()
  }

  private initializeWebPush(): void {
    if (!this.config.vapidPublicKey || !this.config.vapidPrivateKey) {
      console.warn('Push service not configured - VAPID keys missing')
      return
    }

    try {
      webpush.setVapidDetails(
        `mailto:${this.config.vapidEmail}`,
        this.config.vapidPublicKey,
        this.config.vapidPrivateKey
      )

      BusinessLogger.logSystemEvent(
        'push_service_initialized',
        { vapidEmail: this.config.vapidEmail }
      )

    } catch (error) {
      ErrorLogger.logExternalServiceError(
        'web_push',
        error as Error,
        { operation: 'initialize_vapid' }
      )
    }
  }

  async send(userId: string, notificationData: PushNotificationData): Promise<void> {
    const userSubscriptions = this.subscriptions.get(userId) || []
    
    if (userSubscriptions.length === 0) {
      BusinessLogger.logNotificationEvent(
        'push_notification_skipped',
        userId,
        { reason: 'no_subscriptions' }
      )
      return
    }

    const timer = PerformanceLogger.startTimer('send_push_notification')

    try {
      const payload = JSON.stringify({
        title: notificationData.title,
        body: notificationData.body,
        icon: notificationData.icon || '/icon-192.png',
        badge: notificationData.badge,
        tag: notificationData.tag,
        data: notificationData.data,
        actions: notificationData.actions,
        requireInteraction: notificationData.requireInteraction,
        silent: notificationData.silent,
        timestamp: Date.now()
      })

      const options = {
        TTL: this.config.ttl,
        urgency: this.mapPriorityToUrgency(notificationData.data?.priority || 'medium')
      }

      const promises = userSubscriptions.map(subscription => 
        this.sendToSubscription(subscription, payload, options)
      )

      const results = await Promise.allSettled(promises)

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      // Remove failed subscriptions (likely expired)
      const validSubscriptions = userSubscriptions.filter((_, index) => 
        results[index].status === 'fulfilled'
      )

      if (validSubscriptions.length !== userSubscriptions.length) {
        this.subscriptions.set(userId, validSubscriptions)
      }

      BusinessLogger.logNotificationEvent(
        'push_notification_sent',
        userId,
        {
          totalSubscriptions: userSubscriptions.length,
          successful,
          failed,
          title: notificationData.title
        }
      )

      timer.end({
        userId,
        subscriptions: userSubscriptions.length,
        successful,
        failed
      })

    } catch (error) {
      timer.end({ error: true })
      
      ErrorLogger.logExternalServiceError(
        'web_push',
        error as Error,
        {
          operation: 'send_push_notification',
          userId,
          subscriptions: userSubscriptions.length
        }
      )

      throw error
    }
  }

  private async sendToSubscription(
    subscription: PushSubscription,
    payload: string,
    options: any
  ): Promise<void> {
    let retryCount = 0

    while (retryCount <= this.config.maxRetries) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          payload,
          options
        )

        // Update last used timestamp
        subscription.lastUsed = new Date().toISOString()
        return

      } catch (error: any) {
        retryCount++

        // Check if subscription is expired/invalid
        if (error.statusCode === 410 || error.statusCode === 404) {
          throw new Error(`Subscription expired: ${error.statusCode}`)
        }

        // Check if we should retry
        if (retryCount > this.config.maxRetries || error.statusCode === 400) {
          throw error
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * retryCount)
      }
    }
  }

  async sendBulk(notifications: Array<{
    userId: string
    data: PushNotificationData
  }>): Promise<void> {
    const timer = PerformanceLogger.startTimer('send_bulk_push_notifications')

    try {
      const promises = notifications.map(({ userId, data }) => 
        this.send(userId, data)
      )

      const results = await Promise.allSettled(promises)

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      BusinessLogger.logNotificationEvent(
        'bulk_push_notifications_sent',
        'system',
        {
          total: notifications.length,
          successful,
          failed
        }
      )

      timer.end({
        total: notifications.length,
        successful,
        failed
      })

    } catch (error) {
      timer.end({ error: true })
      throw error
    }
  }

  // Subscription management
  async subscribe(userId: string, subscription: Omit<PushSubscription, 'userId' | 'createdAt'>): Promise<void> {
    const fullSubscription: PushSubscription = {
      ...subscription,
      userId,
      createdAt: new Date().toISOString()
    }

    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, [])
    }

    const userSubscriptions = this.subscriptions.get(userId)!
    
    // Remove existing subscription with same endpoint
    const existingIndex = userSubscriptions.findIndex(s => s.endpoint === subscription.endpoint)
    if (existingIndex !== -1) {
      userSubscriptions.splice(existingIndex, 1)
    }

    userSubscriptions.push(fullSubscription)

    BusinessLogger.logNotificationEvent(
      'push_subscription_added',
      userId,
      { endpoint: subscription.endpoint.slice(0, 50) + '...' }
    )

    // TODO: Store in database
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const userSubscriptions = this.subscriptions.get(userId)
    if (!userSubscriptions) return

    const index = userSubscriptions.findIndex(s => s.endpoint === endpoint)
    if (index !== -1) {
      userSubscriptions.splice(index, 1)
      
      if (userSubscriptions.length === 0) {
        this.subscriptions.delete(userId)
      }

      BusinessLogger.logNotificationEvent(
        'push_subscription_removed',
        userId,
        { endpoint: endpoint.slice(0, 50) + '...' }
      )

      // TODO: Remove from database
    }
  }

  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.subscriptions.get(userId) || []
  }

  async testSubscription(subscription: PushSubscription): Promise<boolean> {
    try {
      const testPayload = JSON.stringify({
        title: 'Test Notification',
        body: 'This is a test notification from SociallyHub',
        icon: '/icon-192.png',
        tag: 'test'
      })

      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        testPayload,
        { TTL: 60 }
      )

      return true

    } catch (error) {
      ErrorLogger.logExternalServiceError(
        'web_push',
        error as Error,
        {
          operation: 'test_subscription',
          userId: subscription.userId,
          endpoint: subscription.endpoint.slice(0, 50) + '...'
        }
      )

      return false
    }
  }

  // Utility methods
  getVapidPublicKey(): string {
    return this.config.vapidPublicKey
  }

  private mapPriorityToUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
    switch (priority) {
      case 'critical':
        return 'high'
      case 'high':
        return 'high'
      case 'medium':
        return 'normal'
      case 'low':
        return 'low'
      default:
        return 'normal'
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Admin methods
  async getStats(): Promise<{
    totalSubscriptions: number
    subscriptionsByUser: Record<string, number>
    oldestSubscription?: string
    newestSubscription?: string
  }> {
    let totalSubscriptions = 0
    const subscriptionsByUser: Record<string, number> = {}
    let oldestDate: string | undefined
    let newestDate: string | undefined

    this.subscriptions.forEach((userSubs, userId) => {
      totalSubscriptions += userSubs.length
      subscriptionsByUser[userId] = userSubs.length

      userSubs.forEach(sub => {
        if (!oldestDate || sub.createdAt < oldestDate) {
          oldestDate = sub.createdAt
        }
        if (!newestDate || sub.createdAt > newestDate) {
          newestDate = sub.createdAt
        }
      })
    })

    return {
      totalSubscriptions,
      subscriptionsByUser,
      oldestSubscription: oldestDate,
      newestSubscription: newestDate
    }
  }

  async cleanupExpiredSubscriptions(): Promise<number> {
    let cleanedCount = 0

    for (const [userId, subscriptions] of this.subscriptions.entries()) {
      const validSubscriptions: PushSubscription[] = []

      for (const subscription of subscriptions) {
        const isValid = await this.testSubscription(subscription)
        if (isValid) {
          validSubscriptions.push(subscription)
        } else {
          cleanedCount++
        }
      }

      if (validSubscriptions.length === 0) {
        this.subscriptions.delete(userId)
      } else if (validSubscriptions.length !== subscriptions.length) {
        this.subscriptions.set(userId, validSubscriptions)
      }
    }

    if (cleanedCount > 0) {
      BusinessLogger.logSystemEvent(
        'push_subscriptions_cleaned',
        { cleanedCount, remainingCount: this.getTotalSubscriptionCount() }
      )
    }

    return cleanedCount
  }

  private getTotalSubscriptionCount(): number {
    let count = 0
    this.subscriptions.forEach(subs => {
      count += subs.length
    })
    return count
  }
}

// Singleton instance for global use
export const pushService = new PushService()