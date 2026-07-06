// The single notification producer API (ADR-0010, Phase 1.3).
//
// Every domain event that should notify a user goes through `notifyUser` (or the
// bulk `notifyUsers`). Producers MUST NOT create Notification rows, publish to
// Redis, or enqueue dispatch jobs by hand — doing all three in the right order
// is exactly what this module exists to guarantee.
//
// PERSIST-FIRST ORDER (binding, ADR-0010):
//   1. prisma.notification.create  — the Notification row is the source of truth.
//   2. publishToUser               — best-effort SSE nudge (in-app realtime).
//   3. queueManager.addJob         — best-effort email/web-push fan-out, gated by
//                                    NotificationPreferences inside the worker.
//
// Steps 2 and 3 are best-effort: if Redis or the queue is down, in-app delivery
// STILL succeeds because the row exists and the client's poll/SSE-reconnect reads
// it from the DB. We NEVER fabricate delivery — a failed publish/enqueue is
// logged, not swallowed as success.

import { Prisma } from '@prisma/client'
import type { NotificationType, Notification } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { queueManager } from '@/lib/jobs/queue-manager'

import { publishToUser } from './realtime'

/** BullMQ queue + job name the dispatch worker (ADR-0008) consumes. */
const NOTIFICATION_DISPATCH_QUEUE = 'notification-dispatch'
const NOTIFICATION_DISPATCH_JOB = 'notification_dispatch'

export interface NotifyInput {
  type: NotificationType
  title: string
  message: string
  /** Optional structured payload (e.g. `actionUrl`, entity ids) stored on the row. */
  data?: Record<string, unknown> | null
}

/**
 * Persist a notification, nudge the user's open tabs over SSE, and enqueue
 * channel fan-out. Returns the created `Notification` row.
 *
 * Only step 1 (persist) can fail the call — a DB error is a real failure and is
 * re-thrown to the producer. Steps 2 and 3 are best-effort and never throw.
 */
export async function notifyUser(
  userId: string,
  input: NotifyInput
): Promise<Notification> {
  // 1. Persist FIRST — the row is the source of truth. Status starts UNREAD.
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      // Prisma Json?: pass the object, or omit (undefined) to leave it NULL.
      data: input.data === undefined ? undefined : (input.data as Prisma.InputJsonValue),
      status: 'UNREAD',
    },
  })

  // 2. Publish for SSE (in-app realtime). publishToUser is already fail-soft;
  //    the guard is belt-and-suspenders so nothing here can break the producer.
  try {
    await publishToUser(userId, notification)
  } catch (err) {
    console.warn(
      `[notify] publish failed for notification ${notification.id} (in-app row persisted):`,
      err instanceof Error ? err.message : err
    )
  }

  // 3. Enqueue email/web-push fan-out. Best-effort: if the queue/Redis is down,
  //    the in-app notification already succeeded — only cross-channel delivery is
  //    deferred. The worker resolves recipient + preferences from the DB.
  try {
    await queueManager.addJob(NOTIFICATION_DISPATCH_QUEUE, {
      id: `notify-${notification.id}`,
      type: NOTIFICATION_DISPATCH_JOB,
      payload: {
        notificationId: notification.id,
        userId,
        notificationType: notification.type,
      },
      userId,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn(
      `[notify] dispatch enqueue failed for notification ${notification.id} (in-app delivered, email/push skipped):`,
      err instanceof Error ? err.message : err
    )
  }

  return notification
}

/**
 * Bulk variant: fan a single notification out to many users. Each user gets its
 * own row/publish/enqueue via `notifyUser`. Isolated per user — one user's DB
 * failure does not abort the rest — and returns only the notifications that were
 * successfully persisted.
 */
export async function notifyUsers(
  userIds: string[],
  input: NotifyInput
): Promise<Notification[]> {
  const results = await Promise.allSettled(
    userIds.map((userId) => notifyUser(userId, input))
  )

  const created: Notification[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      created.push(result.value)
    } else {
      console.error(
        `[notify] notifyUser failed for user ${userIds[i]}:`,
        result.reason instanceof Error ? result.reason.message : result.reason
      )
    }
  }
  return created
}
