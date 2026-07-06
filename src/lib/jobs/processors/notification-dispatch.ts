// Notification channel fan-out (ADR-0010, Phase 3.10).
//
// PERSIST-FIRST (binding, ADR-0010): the `Notification` row is ALWAYS created by
// `notifyUser` (src/lib/notifications/notify.ts) BEFORE this job is enqueued. This
// processor therefore never persists — it only DELIVERS the already-persisted row
// across channels:
//   - in_app: nudge the user's open tabs over SSE (`publishToUser`) and stamp
//             `deliveredAt`. In-app is the source of truth and always "delivered".
//   - email:  resolve the REAL recipient (`prisma.user.email`) and send via the
//             existing nodemailer `email-service` (SMTP_PASSWORD).
//   - push:   hand off to `push-service` by userId (loads subscriptions from the
//             DB; honest no-op/failure when unconfigured or no subscriptions).
//
// Channel gating comes from the DB `NotificationPreferences` row (global toggles,
// the per-type `preferences` JSON, and DND / quiet-hours), NOT from any in-memory
// preferences object. SMS was cut per ADR-0010 — there is no sms branch.
//
// Honesty: we NEVER fabricate delivery. A channel that is disabled, in quiet
// hours, has no recipient, or is unconfigured is recorded as skipped (with a
// reason); a channel that throws is recorded as failed. The overall job succeeds
// as long as the guaranteed in-app channel was delivered, so a transient
// email/push failure does NOT trigger a whole-job retry that would double-send.

import { Job } from 'bullmq'
import type { Notification, NotificationPreferences } from '@prisma/client'

import { JobProcessor, JobResult } from '../queue-manager'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/notifications/email-service'
import { pushService } from '@/lib/notifications/push-service'
import { publishToUser } from '@/lib/notifications/realtime'
import type {
  EmailNotificationData,
  PushNotificationData,
} from '@/lib/notifications/types'
import { BusinessLogger, ErrorLogger, PerformanceLogger } from '@/lib/middleware/logging'

type Channel = 'in_app' | 'email' | 'push'

/**
 * Job payload as enqueued by `notifyUser` (src/lib/notifications/notify.ts): just
 * the id of the already-persisted notification plus the target user. Everything
 * else (title/message/type, recipient email, channel preferences) is resolved
 * from the DB here so the queue never carries stale copies.
 */
export interface NotificationDispatchJobData {
  id: string
  type: 'notification_dispatch'
  payload: {
    notificationId: string
    userId: string
    notificationType?: string
  }
  userId: string
  workspaceId?: string
  createdAt?: string
}

interface ChannelResult {
  channel: Channel
  success: boolean
  skipped?: boolean
  reason?: string
  deliveredAt?: string
  error?: string
}

export interface NotificationDispatchResult {
  notificationId: string
  results: ChannelResult[]
  summary: {
    totalChannels: number
    delivered: number
    skipped: number
    failed: number
    duration: number
  }
}

/**
 * Default channel set per notification type (the ADR-0010 domain-events table).
 * in_app is implicit on every type; email/push here are only ATTEMPTED — each is
 * still gated by the user's `NotificationPreferences` and DND before it fires.
 * Keyed by the DB `NotificationType` string so unknown/new values fall back
 * gracefully instead of throwing.
 */
const DEFAULT_CHANNELS_BY_TYPE: Record<string, Channel[]> = {
  PUBLISH_SUCCESS: ['in_app'],
  PUBLISH_FAILED: ['in_app', 'email', 'push'],
  TOKEN_EXPIRING: ['in_app', 'email'],
  TOKEN_EXPIRED: ['in_app', 'email'],
  INBOX_ASSIGNMENT: ['in_app', 'push'],
  SLA_BREACH: ['in_app', 'email', 'push'],
  REPORT_READY: ['in_app', 'email'],
  APPROVAL_REQUESTED: ['in_app', 'email'],
  APPROVAL_GRANTED: ['in_app', 'email'],
  APPROVAL_DENIED: ['in_app', 'email'],
  SUPPORT_TICKET_UPDATED: ['in_app', 'email', 'push'],
  TEAM_INVITATION: ['in_app'], // route already sends the invite email
  BILLING_ALERT: ['in_app', 'email'],
}
const FALLBACK_CHANNELS: Channel[] = ['in_app', 'email']

/**
 * Is a cross-channel (email/push) delivery allowed by the user's preferences?
 * in_app is always allowed (persist-first source of truth). When the user has no
 * preferences row, channels default ON. A per-type entry in the `preferences`
 * JSON (`{ "<TYPE>": { "email": bool, "push": bool } }`) can turn a channel off.
 */
function isChannelAllowed(
  prefs: NotificationPreferences | null,
  type: string,
  channel: Channel
): boolean {
  if (channel === 'in_app') return true
  if (!prefs) return true // sensible default: enabled when unconfigured

  const globalOn = channel === 'email' ? prefs.emailEnabled : prefs.pushEnabled
  if (!globalOn) return false

  const perType = (prefs.preferences as Record<string, unknown> | null)?.[type]
  if (perType && typeof perType === 'object') {
    const key = channel === 'email' ? 'email' : 'push'
    if ((perType as Record<string, unknown>)[key] === false) return false
  }
  return true
}

/**
 * Is "now" inside the user's Do-Not-Disturb window? DND suppresses email/push
 * only (never in-app). Empty `dndDays` means every day. Evaluated in the user's
 * `digestTimezone` (falls back to UTC). Returns false whenever DND is disabled or
 * incompletely configured.
 */
function isWithinDnd(prefs: NotificationPreferences | null): boolean {
  if (!prefs?.dndEnabled) return false
  if (!prefs.dndStartTime || !prefs.dndEndTime) return false

  const tz = prefs.digestTimezone || 'UTC'
  const now = new Date()

  const days = Array.isArray(prefs.dndDays) ? prefs.dndDays : []
  if (days.length > 0) {
    const today = now
      .toLocaleDateString('en-US', { weekday: 'long', timeZone: tz })
      .toLowerCase()
    if (!days.map((d) => d.toLowerCase()).includes(today)) return false
  }

  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const current = now.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  })
  const cur = toMinutes(current)
  const start = toMinutes(prefs.dndStartTime)
  const end = toMinutes(prefs.dndEndTime)

  // Window may wrap past midnight (e.g. 22:00 → 07:00).
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end
}

function nowIso(): string {
  return new Date().toISOString()
}

function baseMetrics(duration: number): JobResult['metrics'] {
  return {
    duration,
    memoryUsage: process.memoryUsage().heapUsed,
    timestamp: nowIso(),
  }
}

export const notificationDispatchProcessor: JobProcessor<NotificationDispatchJobData> = async (
  job: Job<NotificationDispatchJobData>
): Promise<JobResult> => {
  const timer = PerformanceLogger.startTimer('notification_dispatch_job')
  const notificationId = job.data?.payload?.notificationId

  try {
    if (!notificationId) {
      throw new Error('notification_dispatch job missing payload.notificationId')
    }

    // The row is the source of truth (created by notifyUser). Load it fresh —
    // never trust a copy carried on the job.
    const notification: Notification | null = await prisma.notification.findUnique({
      where: { id: notificationId },
    })

    if (!notification) {
      // Honest failure: nothing to deliver. Retrying will not conjure the row.
      const message = `Notification ${notificationId} not found (nothing to dispatch)`
      timer.end({ success: false, notificationId })
      return { success: false, error: message, metrics: baseMetrics(timer.getDuration()) }
    }

    const userId = notification.userId
    const type = notification.type as string

    const [user, prefs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      }),
      prisma.notificationPreferences.findUnique({ where: { userId } }),
    ])

    const channels = DEFAULT_CHANNELS_BY_TYPE[type] ?? FALLBACK_CHANNELS
    const dnd = isWithinDnd(prefs)

    BusinessLogger.logNotificationEvent('notification_dispatch_started', userId, {
      notificationId: notification.id,
      type,
      channels,
      dnd,
    })

    const results: ChannelResult[] = []

    for (const channel of channels) {
      const channelTimer = PerformanceLogger.startTimer(`notification_${channel}_dispatch`)

      // Preference + DND gating for cross-channel delivery (in_app is exempt).
      if (channel !== 'in_app') {
        if (!isChannelAllowed(prefs, type, channel)) {
          results.push({ channel, success: false, skipped: true, reason: 'disabled_by_preferences' })
          channelTimer.end({ skipped: true, channel })
          continue
        }
        if (dnd) {
          results.push({ channel, success: false, skipped: true, reason: 'quiet_hours' })
          channelTimer.end({ skipped: true, channel })
          continue
        }
      }

      try {
        switch (channel) {
          case 'in_app': {
            // Persist already happened; nudge SSE + mark delivered. publishToUser
            // is fail-soft (never throws) — a down Redis costs latency, not data.
            await publishToUser(userId, notification)
            await prisma.notification.update({
              where: { id: notification.id },
              data: { deliveredAt: new Date() },
            })
            results.push({ channel, success: true, deliveredAt: nowIso() })
            break
          }

          case 'email': {
            if (!user?.email) {
              results.push({ channel, success: false, skipped: true, reason: 'no_recipient_email' })
              break
            }
            const emailData: EmailNotificationData = {
              to: [user.email],
              subject: notification.title,
              html: buildEmailHtml(notification, user.name),
              text: notification.message,
              headers: {
                'X-Notification-ID': notification.id,
                'X-Notification-Type': type,
              },
            }
            await emailService.send(emailData)
            results.push({ channel, success: true, deliveredAt: nowIso() })
            break
          }

          case 'push': {
            // Honest failure when web-push is unconfigured — never claim delivery.
            if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
              results.push({ channel, success: false, skipped: true, reason: 'push_not_configured' })
              break
            }
            const data = (notification.data as Record<string, unknown> | null) ?? {}
            const actionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : undefined
            const pushData: PushNotificationData = {
              title: notification.title,
              body: notification.message,
              icon: '/icon-192.png',
              tag: notification.id,
              data: { ...data, notificationId: notification.id, actionUrl },
            }
            // push-service resolves subscriptions from the DB (rework owned by the
            // push phase); it throws on real send failures and logs an honest skip
            // when the user has no subscriptions.
            await pushService.send(userId, pushData)
            results.push({ channel, success: true, deliveredAt: nowIso() })
            break
          }
        }

        channelTimer.end({ success: true, channel })
        BusinessLogger.logNotificationEvent(`notification_${channel}_sent`, userId, {
          notificationId: notification.id,
        })
      } catch (error) {
        results.push({ channel, success: false, error: (error as Error).message })
        ErrorLogger.logExternalServiceError(channel, error as Error, {
          operation: 'notification_dispatch',
          notificationId: notification.id,
          userId,
        })
        channelTimer.end({ success: false, error: true, channel })
      }
    }

    const delivered = results.filter((r) => r.success).length
    const skipped = results.filter((r) => r.skipped).length
    const failed = results.filter((r) => !r.success && !r.skipped).length

    const finalResult: NotificationDispatchResult = {
      notificationId: notification.id,
      results,
      summary: {
        totalChannels: channels.length,
        delivered,
        skipped,
        failed,
        duration: timer.getDuration(),
      },
    }

    // Overall success is anchored to the guaranteed in-app channel: as long as
    // in-app delivered, the job is done. Email/push are best-effort — failing
    // them must NOT trigger a whole-job retry that re-sends the email/push.
    const inApp = results.find((r) => r.channel === 'in_app')
    const jobSucceeded = inApp ? inApp.success : failed === 0

    timer.end({
      success: jobSucceeded,
      notificationId: notification.id,
      delivered,
      skipped,
      failed,
    })

    BusinessLogger.logNotificationEvent('notification_dispatch_completed', userId, {
      notificationId: notification.id,
      summary: finalResult.summary,
    })

    return {
      success: jobSucceeded,
      result: finalResult,
      error: jobSucceeded
        ? undefined
        : `In-app delivery failed for notification ${notification.id}`,
      metrics: baseMetrics(timer.getDuration()),
    }
  } catch (error) {
    timer.end({ success: false, error: true, notificationId })

    ErrorLogger.logUnexpectedError(error as Error, {
      context: 'notification_dispatch_job',
      notificationId,
      userId: job.data?.userId,
    })

    return {
      success: false,
      error: (error as Error).message,
      metrics: baseMetrics(timer.getDuration()),
    }
  }
}

/**
 * Render the transactional email body for a persisted notification. Pulls an
 * optional call-to-action from the notification's `data` JSON (`actionUrl` +
 * `actionLabel`). Kept intentionally small — richer per-type templates can come
 * later without changing the dispatch contract.
 */
function buildEmailHtml(notification: Notification, userName?: string | null): string {
  const data = (notification.data as Record<string, unknown> | null) ?? {}
  const actionUrl = typeof data.actionUrl === 'string' ? data.actionUrl : undefined
  const actionLabel =
    typeof data.actionLabel === 'string' ? data.actionLabel : 'View in SociallyHub'
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : 'Hi,'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(notification.title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
      <div style="max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#2563eb;color:#ffffff;padding:24px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;">${escapeHtml(notification.title)}</h1>
        </div>
        <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
          <p style="margin:0 0 12px;">${greeting}</p>
          <p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(notification.message)}</p>
          ${
            actionUrl
              ? `<div style="text-align:center;margin:24px 0;">
                   <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${escapeHtml(
                     actionLabel
                   )}</a>
                 </div>`
              : ''
          }
        </div>
        <div style="background:#f8f9fa;padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;color:#6b7280;font-size:12px;">
          <p style="margin:0;">This notification was sent from SociallyHub.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
