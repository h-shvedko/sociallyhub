import { Job } from 'bullmq'
import { JobProcessor, JobResult } from '../queue-manager'
import { notificationManager } from '@/lib/notifications/notification-manager'
import { emailService } from '@/lib/notifications/email-service'
import { pushService } from '@/lib/notifications/push-service'
import { smsService } from '@/lib/notifications/sms-service'
import { webhookService } from '@/lib/notifications/webhook-service'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'
import {
  NotificationData,
  NotificationPreferences,
  EmailNotificationData,
  PushNotificationData,
  SMSNotificationData,
  WebhookNotificationData,
  NotificationPriority
} from '@/lib/notifications/types'

export interface NotificationDispatchJobData {
  id: string
  type: 'notification_dispatch' | 'bulk_notification_dispatch' | 'scheduled_notification'
  payload: {
    notification: NotificationData
    preferences: NotificationPreferences
    channels: Array<'in_app' | 'email' | 'push' | 'sms' | 'webhook'>
    deliveryOptions?: {
      email?: {
        template?: string
        customData?: Record<string, any>
      }
      push?: {
        badge?: number
        sound?: string
        vibration?: number[]
      }
      sms?: {
        provider?: 'twilio' | 'aws_sns'
      }
      webhook?: {
        urls: string[]
        timeout?: number
        retries?: number
      }
    }
    scheduledFor?: string
  }
  userId: string
  workspaceId?: string
}

export interface NotificationDispatchResult {
  notificationId: string
  results: Array<{
    channel: 'in_app' | 'email' | 'push' | 'sms' | 'webhook'
    success: boolean
    deliveredAt?: string
    error?: string
    deliveryId?: string
    metrics?: {
      responseTime: number
      deliveryConfirmed: boolean
    }
  }>
  summary: {
    totalChannels: number
    successfulDeliveries: number
    failedDeliveries: number
    duration: number
  }
}

export const notificationDispatchProcessor: JobProcessor<NotificationDispatchJobData> = async (
  job: Job<NotificationDispatchJobData>
): Promise<JobResult> => {
  const { payload } = job.data
  const { notification, preferences, channels, deliveryOptions, scheduledFor } = payload

  const timer = PerformanceLogger.startTimer('notification_dispatch_job')
  
  try {
    // Check if notification should be delayed
    if (scheduledFor) {
      const scheduleTime = new Date(scheduledFor)
      const now = new Date()
      
      if (scheduleTime > now) {
        // Job was scheduled too early, reschedule it
        const delay = scheduleTime.getTime() - now.getTime()
        throw new Error(`Notification scheduled for future delivery in ${delay}ms`)
      }
    }

    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date()
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        timeZone: preferences.quietHours.timezone 
      })
      const [currentHour, currentMinute] = currentTime.split(':').map(Number)
      const currentMinutes = currentHour * 60 + currentMinute

      const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute

      const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number)
      const endMinutes = endHour * 60 + endMinute

      const isQuietTime = startMinutes <= endMinutes
        ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
        : currentMinutes >= startMinutes || currentMinutes <= endMinutes

      if (isQuietTime && notification.priority !== NotificationPriority.CRITICAL) {
        BusinessLogger.logNotificationEvent('notification_delayed_quiet_hours', notification.userId, {
          notificationId: notification.id,
          currentTime,
          quietHoursStart: preferences.quietHours.start,
          quietHoursEnd: preferences.quietHours.end
        })

        // Reschedule for after quiet hours
        const nextDeliveryTime = new Date()
        nextDeliveryTime.setHours(endHour, endMinute, 0, 0)
        if (nextDeliveryTime <= now) {
          nextDeliveryTime.setDate(nextDeliveryTime.getDate() + 1)
        }

        return {
          success: false,
          error: `Notification delayed due to quiet hours. Rescheduled for ${nextDeliveryTime.toISOString()}`,
          metrics: {
            duration: timer.getDuration(),
            memoryUsage: process.memoryUsage().heapUsed,
            timestamp: new Date().toISOString()
          }
        }
      }
    }

    BusinessLogger.logNotificationEvent('notification_dispatch_started', notification.userId, {
      notificationId: notification.id,
      channels,
      type: notification.type,
      priority: notification.priority
    })

    const results: NotificationDispatchResult['results'] = []
    let successfulDeliveries = 0
    let failedDeliveries = 0

    // Process each delivery channel
    for (const channel of channels) {
      const channelTimer = PerformanceLogger.startTimer(`notification_${channel}_dispatch`)
      
      try {
        const channelResult: NotificationDispatchResult['results'][0] = {
          channel,
          success: false,
          deliveredAt: new Date().toISOString()
        }

        switch (channel) {
          case 'in_app':
            // In-app notifications are handled by the notification manager
            await notificationManager.storeNotification(notification)
            channelResult.success = true
            channelResult.deliveryId = notification.id
            break

          case 'email':
            if (preferences.channels.email) {
              const emailData: EmailNotificationData = {
                to: [notification.userId], // This should be resolved to actual email
                subject: notification.title,
                html: await generateEmailTemplate(notification, deliveryOptions?.email),
                text: notification.message,
                headers: {
                  'X-Notification-ID': notification.id,
                  'X-Notification-Type': notification.type,
                  'X-Priority': notification.priority
                }
              }
              
              await emailService.send(emailData)
              channelResult.success = true
              channelResult.deliveryId = `email_${notification.id}`
            } else {
              throw new Error('Email notifications disabled in user preferences')
            }
            break

          case 'push':
            if (preferences.channels.push) {
              const pushData: PushNotificationData = {
                title: notification.title,
                body: notification.message,
                icon: notification.imageUrl || '/icon-192.png',
                badge: deliveryOptions?.push?.badge,
                tag: notification.id,
                data: {
                  notificationId: notification.id,
                  actionUrl: notification.actionUrl,
                  ...notification.data
                },
                actions: notification.actionLabel ? [{
                  action: 'view',
                  title: notification.actionLabel,
                  icon: '/icon-view.png'
                }] : undefined,
                requireInteraction: notification.priority === NotificationPriority.CRITICAL
              }

              await pushService.send(notification.userId, pushData)
              channelResult.success = true
              channelResult.deliveryId = `push_${notification.id}`
            } else {
              throw new Error('Push notifications disabled in user preferences')
            }
            break

          case 'sms':
            if (preferences.channels.sms && notification.priority === NotificationPriority.CRITICAL) {
              // SMS only for critical notifications
              const smsData: SMSNotificationData = {
                to: notification.userId, // This should be resolved to actual phone number
                message: `${notification.title}: ${notification.message}`,
                from: process.env.SMS_FROM_NUMBER
              }

              await smsService.send(smsData)
              channelResult.success = true
              channelResult.deliveryId = `sms_${notification.id}`
            } else {
              throw new Error('SMS notifications not available for this priority level or disabled')
            }
            break

          case 'webhook':
            if (deliveryOptions?.webhook?.urls) {
              const webhookPromises = deliveryOptions.webhook.urls.map(async (url) => {
                const webhookData: WebhookNotificationData = {
                  url,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Notification-ID': notification.id,
                    'X-Notification-Type': notification.type,
                    'User-Agent': 'SociallyHub-Notification-Webhook/1.0'
                  },
                  payload: {
                    event: 'notification.sent',
                    notification,
                    timestamp: new Date().toISOString(),
                    workspace: notification.workspaceId
                  },
                  timeout: deliveryOptions.webhook.timeout || 5000,
                  retries: deliveryOptions.webhook.retries || 2
                }

                return await webhookService.send(webhookData)
              })

              await Promise.all(webhookPromises)
              channelResult.success = true
              channelResult.deliveryId = `webhook_${notification.id}`
            } else {
              throw new Error('No webhook URLs configured')
            }
            break

          default:
            throw new Error(`Unsupported notification channel: ${channel}`)
        }

        channelResult.metrics = {
          responseTime: channelTimer.getDuration(),
          deliveryConfirmed: true
        }

        successfulDeliveries++
        results.push(channelResult)

        BusinessLogger.logNotificationEvent(`notification_${channel}_sent`, notification.userId, {
          notificationId: notification.id,
          deliveryId: channelResult.deliveryId,
          responseTime: channelTimer.getDuration()
        })

        channelTimer.end({ success: true, channel })

      } catch (error) {
        results.push({
          channel,
          success: false,
          error: (error as Error).message,
          deliveredAt: new Date().toISOString(),
          metrics: {
            responseTime: channelTimer.getDuration(),
            deliveryConfirmed: false
          }
        })

        failedDeliveries++

        ErrorLogger.logExternalServiceError(channel, error as Error, {
          operation: 'notification_dispatch',
          notificationId: notification.id,
          userId: notification.userId,
          workspaceId: notification.workspaceId
        })

        channelTimer.end({ success: false, error: true, channel })
      }
    }

    const finalResult: NotificationDispatchResult = {
      notificationId: notification.id,
      results,
      summary: {
        totalChannels: channels.length,
        successfulDeliveries,
        failedDeliveries,
        duration: timer.getDuration()
      }
    }

    timer.end({
      success: successfulDeliveries > 0,
      notificationId: notification.id,
      successfulDeliveries,
      failedDeliveries,
      totalChannels: channels.length
    })

    BusinessLogger.logNotificationEvent('notification_dispatch_completed', notification.userId, {
      notificationId: notification.id,
      summary: finalResult.summary,
      duration: timer.getDuration()
    })

    return {
      success: successfulDeliveries > 0,
      result: finalResult,
      error: failedDeliveries === channels.length ? 'All delivery channels failed' : undefined,
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error) {
    timer.end({ success: false, error: true, notificationId: notification.id })

    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'notification_dispatch_job',
      notificationId: notification.id,
      userId: notification.userId,
      workspaceId: notification.workspaceId,
      channels
    })

    return {
      success: false,
      error: (error as Error).message,
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Bulk notification dispatch processor
export interface BulkNotificationDispatchJobData {
  id: string
  type: 'bulk_notification_dispatch'
  payload: {
    notifications: Array<{
      notification: NotificationData
      preferences: NotificationPreferences
      channels: Array<'in_app' | 'email' | 'push' | 'sms' | 'webhook'>
    }>
    batchId: string
    deliveryOptions?: NotificationDispatchJobData['payload']['deliveryOptions']
  }
  userId: string
  workspaceId?: string
}

export const bulkNotificationDispatchProcessor: JobProcessor<BulkNotificationDispatchJobData> = async (
  job: Job<BulkNotificationDispatchJobData>
): Promise<JobResult> => {
  const { payload } = job.data
  const { notifications, batchId, deliveryOptions } = payload

  const timer = PerformanceLogger.startTimer('bulk_notification_dispatch_job')

  try {
    BusinessLogger.logNotificationEvent('bulk_notification_dispatch_started', 'system', {
      batchId,
      notificationCount: notifications.length
    })

    const results = []
    let totalSuccessful = 0
    let totalFailed = 0

    for (const [index, notificationItem] of notifications.entries()) {
      try {
        // Update job progress
        await job.updateProgress(Math.round(((index + 1) / notifications.length) * 100))

        // Create individual notification dispatch job
        const dispatchJobData: NotificationDispatchJobData = {
          id: `dispatch_${notificationItem.notification.id}`,
          type: 'notification_dispatch',
          payload: {
            notification: notificationItem.notification,
            preferences: notificationItem.preferences,
            channels: notificationItem.channels,
            deliveryOptions
          },
          userId: notificationItem.notification.userId,
          workspaceId: notificationItem.notification.workspaceId
        }

        // Process the notification dispatch
        const dispatchResult = await notificationDispatchProcessor({
          ...job,
          data: dispatchJobData
        } as Job<NotificationDispatchJobData>)

        results.push({
          notificationId: notificationItem.notification.id,
          success: dispatchResult.success,
          result: dispatchResult.result,
          error: dispatchResult.error
        })

        if (dispatchResult.success) {
          totalSuccessful++
        } else {
          totalFailed++
        }

      } catch (error) {
        results.push({
          notificationId: notificationItem.notification.id,
          success: false,
          error: (error as Error).message
        })
        totalFailed++
      }
    }

    timer.end({
      success: totalSuccessful > 0,
      batchId,
      totalNotifications: notifications.length,
      totalSuccessful,
      totalFailed
    })

    BusinessLogger.logNotificationEvent('bulk_notification_dispatch_completed', 'system', {
      batchId,
      totalNotifications: notifications.length,
      totalSuccessful,
      totalFailed,
      duration: timer.getDuration()
    })

    return {
      success: totalSuccessful > 0,
      result: {
        batchId,
        totalNotifications: notifications.length,
        totalSuccessful,
        totalFailed,
        results
      },
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error) {
    timer.end({ success: false, error: true, batchId })

    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'bulk_notification_dispatch_job',
      batchId,
      notificationCount: notifications.length
    })

    return {
      success: false,
      error: (error as Error).message,
      metrics: {
        duration: timer.getDuration(),
        memoryUsage: process.memoryUsage().heapUsed,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// Helper function to generate email templates
async function generateEmailTemplate(
  notification: NotificationData,
  options?: { template?: string; customData?: Record<string, any> }
): Promise<string> {
  const defaultTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e1e5e9; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .priority-high { border-left: 4px solid #dc3545; }
        .priority-critical { border-left: 4px solid #dc3545; background: #fff5f5; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 ${notification.title}</h1>
        </div>
        <div class="content ${notification.priority === NotificationPriority.HIGH || notification.priority === NotificationPriority.CRITICAL ? 'priority-' + notification.priority : ''}">
          <p>${notification.message}</p>
          
          ${notification.actionUrl && notification.actionLabel ? `
            <div style="text-align: center;">
              <a href="${notification.actionUrl}" class="button">${notification.actionLabel}</a>
            </div>
          ` : ''}
          
          ${notification.metadata ? `
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
              <strong>Additional Details:</strong>
              <ul style="margin: 10px 0;">
                ${Object.entries(notification.metadata).map(([key, value]) => 
                  `<li><strong>${key}:</strong> ${value}</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>This notification was sent from SociallyHub</p>
          <p><small>Priority: ${notification.priority} | Category: ${notification.category}</small></p>
        </div>
      </div>
    </body>
    </html>
  `

  // In a real implementation, you might want to use a template engine
  // or load templates from a database/file system
  return defaultTemplate
}