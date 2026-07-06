// Server-Sent Events transport for in-app notifications (ADR-0010, Phase 2.6).
//
// `GET /api/notifications/stream` holds an HTTP response open and relays every
// message published to the caller's Redis channel (`notify:user:{id}`) as an SSE
// `data:` event. The browser's native EventSource handles reconnection; the 30s
// poll in use-notifications.ts remains the correctness fallback (persist-first —
// this stream is a latency upgrade, never the source of truth).
//
// Node runtime is required: the Edge runtime has no long-lived TCP socket for an
// ioredis subscriber. Auth is the normal NextAuth session (same origin, ADR-0003
// helpers). ADR-0005 already removed the blanket `Cache-Control: public` on
// `/api/*`; this route additionally sets `no-store` so no proxy caches the stream.

import { NextRequest } from 'next/server'

import { requireSession } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { createUserSubscriber, userChannel } from '@/lib/notifications/realtime'

// Long-lived streaming connection: pin to Node and opt out of static handling.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Heartbeat comment cadence. Comments (`:`-prefixed) keep idle proxies (nginx
// `proxy_read_timeout`, ADR-0022) from dropping the connection and are ignored
// by EventSource.
const HEARTBEAT_MS = 25_000

export async function GET(request: NextRequest) {
  let user
  try {
    user = await requireSession()
  } catch (err) {
    // Envelope 401 (or 500) BEFORE opening the stream.
    return handleApiError(err)
  }

  const encoder = new TextEncoder()
  const channel = userChannel(user.id)

  let subscriber: ReturnType<typeof createUserSubscriber> | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Controller already closed (client vanished mid-write) — ignore.
        }
      }

      // Open the stream with a comment so the client's `onopen` fires promptly.
      send(`: connected ${new Date().toISOString()}\n\n`)

      // One dedicated subscriber per stream. Each published message is a JSON
      // string (see notify.ts / realtime.publishToUser) forwarded verbatim.
      subscriber = createUserSubscriber(user.id, (message) => {
        send(`data: ${message}\n\n`)
      })

      heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS)

      const cleanup = async () => {
        if (closed) return
        closed = true

        if (heartbeat) {
          clearInterval(heartbeat)
          heartbeat = null
        }

        if (subscriber) {
          const sub = subscriber
          subscriber = null
          try {
            await sub.unsubscribe(channel)
          } catch {
            /* ignore */
          }
          try {
            await sub.quit()
          } catch {
            try {
              sub.disconnect()
            } catch {
              /* ignore */
            }
          }
        }

        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      // Client closed the tab / navigated away / EventSource.close().
      // Wrap so the listener stays void-returning (no-misused-promises).
      request.signal.addEventListener('abort', () => {
        void cleanup()
      })
    },

    // Called if the stream is cancelled from the consumer side.
    cancel() {
      closed = true
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }
      if (subscriber) {
        try {
          subscriber.disconnect()
        } catch {
          /* ignore */
        }
        subscriber = null
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      // Defeat nginx response buffering so events flush immediately (ADR-0022
      // will also set `proxy_buffering off` for this location).
      'X-Accel-Buffering': 'no',
    },
  })
}
