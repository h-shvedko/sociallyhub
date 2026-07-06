// Realtime transport for notifications (ADR-0010, Phase 2.7).
//
// The chosen transport is Server-Sent Events backed by Redis pub/sub: every
// notification producer publishes to a per-user Redis channel and the SSE route
// (`/api/notifications/stream`) relays those messages to the user's open tabs.
//
// CRITICAL INVARIANT — persist-first (ADR-0010): the Notification row is the
// source of truth. Redis pub/sub is only a low-latency *nudge* ("you have new
// data"). A publish that is dropped because Redis is down costs latency, not
// data: the client reconciles from the DB on its poll/reconnect. Therefore
// every function here is FAIL-SOFT — it logs and returns, and NEVER throws into
// a producer's request path.
//
// A publishing (command-mode) connection and a subscribing connection cannot be
// the same ioredis client: once a connection issues SUBSCRIBE it can only run
// (P)SUBSCRIBE/(P)UNSUBSCRIBE. So this module keeps one shared, lazily-created
// publisher and mints a dedicated subscriber per SSE stream.

import Redis from 'ioredis'

import { buildRedisConnectionOptions } from '@/lib/jobs/queue-manager'

/** Redis pub/sub channel a given user's notifications flow through. */
export function userChannel(userId: string): string {
  return `notify:user:${userId}`
}

// Shared publisher — a normal command-mode connection, created on first use.
// lazyConnect defers the socket until the first publish so merely importing this
// module (e.g. in the Next.js server or the worker) opens nothing.
let publisher: Redis | null = null

function getPublisher(): Redis {
  if (publisher) return publisher

  const client = new Redis({
    ...buildRedisConnectionOptions(),
    // Best-effort producer: cap retries so a dead Redis surfaces as a rejected
    // publish (caught below) instead of an unbounded queue that stalls requests.
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    lazyConnect: true,
  })

  client.on('error', (err) => {
    // Do not throw: persist-first means a missing publisher is degraded latency,
    // not lost data. Log once per error event.
    console.warn('[realtime] publisher redis error:', err.message)
  })

  publisher = client
  return publisher
}

/**
 * Publish a payload to a user's notification channel for SSE fan-out.
 *
 * Fail-soft: returns `true` when the message was handed to Redis, `false` when
 * publishing failed (Redis down, etc.). Never throws — callers (notify.ts) rely
 * on this so an unavailable Redis cannot break the persist-first path.
 */
export async function publishToUser(
  userId: string,
  payload: unknown
): Promise<boolean> {
  try {
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload)
    await getPublisher().publish(userChannel(userId), message)
    return true
  } catch (err) {
    console.warn(
      `[realtime] publishToUser(${userId}) failed (persist-first, ignoring):`,
      err instanceof Error ? err.message : err
    )
    return false
  }
}

/**
 * Create a dedicated subscriber bound to a single user's channel.
 *
 * Each SSE connection (one per open tab) gets its own subscriber — multiple tabs
 * for the same user is fine, they each receive every message. The caller owns
 * the returned client and MUST close it (`unsubscribe()` + `quit()`) when the
 * request aborts.
 *
 * `onMessage` receives the raw message string exactly as it was published (a
 * JSON string, in practice), so the SSE route can forward it verbatim without a
 * parse/re-stringify round-trip.
 */
export function createUserSubscriber(
  userId: string,
  onMessage: (message: string) => void
): Redis {
  const channel = userChannel(userId)

  const subscriber = new Redis({
    ...buildRedisConnectionOptions(),
    // A subscriber connection must not cap retries the way a request-scoped
    // command connection does; keep it trying to stay subscribed.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  subscriber.on('error', (err) => {
    console.warn(`[realtime] subscriber redis error (user ${userId}):`, err.message)
  })

  subscriber.on('message', (ch, message) => {
    if (ch === channel) onMessage(message)
  })

  // Fire-and-forget SUBSCRIBE. Messages only flow after the ack, which is fine:
  // anything published in that window is backfilled by the DB/poll path.
  subscriber.subscribe(channel).catch((err) => {
    console.warn(
      `[realtime] subscribe failed for ${channel}:`,
      err instanceof Error ? err.message : err
    )
  })

  return subscriber
}

/**
 * Close the shared publisher (graceful shutdown / test teardown). No-op when the
 * publisher was never created. Safe to call more than once.
 */
export async function closeRealtime(): Promise<void> {
  if (!publisher) return
  const client = publisher
  publisher = null
  try {
    await client.quit()
  } catch {
    try {
      client.disconnect()
    } catch {
      /* ignore */
    }
  }
}
