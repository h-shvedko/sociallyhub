// Web Push delivery, reworked onto the PushSubscription Prisma model (ADR-0010,
// Phase 4). Subscriptions are persisted in the DB (via
// POST/DELETE /api/notifications/push-subscription) so they survive restarts;
// this service loads them from `prisma.pushSubscription` at send time.
//
// HONESTY RULES (binding, ADR-0010):
//   - If VAPID keys are missing the service NO-OPS: it logs once and returns a
//     truthful result (nothing sent) — it NEVER throws and NEVER pretends a push
//     was delivered.
//   - On a 404/410 Gone from the push service the subscription is dead: the row
//     is PRUNED from the DB so we stop trying to reach it.
//   - `lastUsedAt` is only bumped on a genuinely successful send.

import webpush from 'web-push'

import { prisma } from '@/lib/prisma'
import { PushNotificationData } from './types'
import {
  ErrorLogger,
  BusinessLogger,
} from '@/lib/middleware/logging'

/** Shape web-push needs for a single endpoint. */
interface WebPushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** Truthful per-user send outcome — never fabricated. */
export interface PushSendResult {
  /** VAPID configured and at least attempted a send. */
  configured: boolean
  /** Subscriptions found for the user. */
  total: number
  /** Sends that succeeded. */
  sent: number
  /** Sends that failed for a transient/unknown reason (not pruned). */
  failed: number
  /** Dead subscriptions removed from the DB after a 404/410. */
  pruned: number
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
// The spec requires a mailto: subject. Accept a bare address for convenience.
const rawVapidEmail = process.env.VAPID_EMAIL || 'mailto:noreply@sociallyhub.com'
const VAPID_EMAIL = rawVapidEmail.startsWith('mailto:')
  ? rawVapidEmail
  : `mailto:${rawVapidEmail}`

const TTL_SECONDS = 24 * 60 * 60 // 24h

let vapidReady = false
let vapidWarned = false

/**
 * Configure web-push with the VAPID keypair. Idempotent; returns whether push
 * is actually usable. When keys are absent we warn ONCE and stay disabled — a
 * missing VAPID config is a deploy choice, not a runtime error.
 */
function ensureVapid(): boolean {
  if (vapidReady) return true
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    if (!vapidWarned) {
      vapidWarned = true
      console.warn(
        '[push] VAPID keys not configured (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) — web push disabled; subscriptions stored but no push sent.'
      )
    }
    return false
  }
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    vapidReady = true
    BusinessLogger.logSystemEvent('push_service_initialized', {
      vapidEmail: VAPID_EMAIL,
    })
    return true
  } catch (error) {
    ErrorLogger.logExternalServiceError('web_push', error as Error, {
      operation: 'initialize_vapid',
    })
    return false
  }
}

/** Load a user's persisted subscriptions from the DB. */
async function loadUserSubscriptions(userId: string) {
  return prisma.pushSubscription.findMany({ where: { userId } })
}

/**
 * Send a push payload to every subscription a user has. Loads subscriptions
 * from Prisma, prunes dead ones on 404/410, and returns a truthful result.
 *
 * When VAPID is unconfigured this is a no-op (configured:false) — the caller
 * must treat that as "not delivered", never as success.
 */
export async function sendToUser(
  userId: string,
  payload: PushNotificationData | Record<string, unknown>
): Promise<PushSendResult> {
  const configured = ensureVapid()

  const subscriptions = await loadUserSubscriptions(userId)
  const result: PushSendResult = {
    configured,
    total: subscriptions.length,
    sent: 0,
    failed: 0,
    pruned: 0,
  }

  if (!configured || subscriptions.length === 0) {
    BusinessLogger.logNotificationEvent('push_notification_skipped', userId, {
      reason: !configured ? 'vapid_not_configured' : 'no_subscriptions',
    })
    return result
  }

  const body = JSON.stringify({
    ...payload,
    timestamp: Date.now(),
  })

  const options = {
    TTL: TTL_SECONDS,
    urgency: mapPriorityToUrgency(
      (payload as PushNotificationData)?.data?.priority as string | undefined
    ),
  }

  const deadSubscriptionIds: string[] = []
  const usedSubscriptionIds: string[] = []

  await Promise.all(
    subscriptions.map(async (sub) => {
      const target: WebPushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }
      try {
        await webpush.sendNotification(target, body, options)
        result.sent++
        usedSubscriptionIds.push(sub.id)
      } catch (error: any) {
        const statusCode = error?.statusCode
        // 404 Not Found / 410 Gone: the subscription is permanently dead.
        if (statusCode === 404 || statusCode === 410) {
          deadSubscriptionIds.push(sub.id)
        } else {
          result.failed++
          ErrorLogger.logExternalServiceError('web_push', error as Error, {
            operation: 'send_push_notification',
            userId,
            statusCode,
          })
        }
      }
    })
  )

  // Prune dead subscriptions so we stop paying for them.
  if (deadSubscriptionIds.length > 0) {
    try {
      const pruned = await prisma.pushSubscription.deleteMany({
        where: { id: { in: deadSubscriptionIds } },
      })
      result.pruned = pruned.count
    } catch (error) {
      ErrorLogger.logExternalServiceError('web_push', error as Error, {
        operation: 'prune_dead_subscriptions',
        userId,
      })
    }
  }

  // Bump lastUsedAt only for subscriptions that genuinely received a push.
  if (usedSubscriptionIds.length > 0) {
    try {
      await prisma.pushSubscription.updateMany({
        where: { id: { in: usedSubscriptionIds } },
        data: { lastUsedAt: new Date() },
      })
    } catch {
      // Non-fatal: last-used bookkeeping must never fail a delivery.
    }
  }

  BusinessLogger.logNotificationEvent('push_notification_sent', userId, {
    total: result.total,
    sent: result.sent,
    failed: result.failed,
    pruned: result.pruned,
  })

  return result
}

function mapPriorityToUrgency(
  priority?: string
): 'very-low' | 'low' | 'normal' | 'high' {
  switch (priority) {
    case 'critical':
    case 'high':
      return 'high'
    case 'low':
      return 'low'
    default:
      return 'normal'
  }
}

/** The VAPID public key clients need to subscribe (safe to expose). */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY
}

/**
 * Thin class wrapper kept for the existing call sites
 * (`pushService.send(userId, data)` in the dispatch worker and
 * notification-manager). All real work lives in `sendToUser`.
 */
export class PushService {
  async send(
    userId: string,
    notificationData: PushNotificationData
  ): Promise<PushSendResult> {
    return sendToUser(userId, notificationData)
  }

  getVapidPublicKey(): string {
    return getVapidPublicKey()
  }
}

// Singleton instance for global use (backwards-compatible export).
export const pushService = new PushService()
