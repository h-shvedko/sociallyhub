// Web Push subscription persistence (ADR-0010, Phase 4).
//
// POST   — upsert the caller's browser PushSubscription into the DB (keyed by
//          the unique endpoint, so re-subscribing or re-assigning an endpoint to
//          the current user is idempotent).
// DELETE — remove one of the caller's subscriptions by endpoint.
//
// Persistence is decoupled from delivery: storing a subscription here always
// succeeds even when VAPID is unconfigured (push-service no-ops honestly).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireSession } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// Browser `PushSubscription.toJSON()` shape (extra fields like `expirationTime`
// are ignored). We accept it directly so the client can POST the raw object.
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()

    const parsed = subscribeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return jsonError(400, 'Invalid push subscription', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    const { endpoint, keys } = parsed.data
    const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null

    // Upsert on the unique endpoint. If the same endpoint was previously owned
    // by another user (shared device), it is re-assigned to the current caller.
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        lastUsedAt: new Date(),
      },
    })

    return NextResponse.json({
      subscription: { id: subscription.id, endpoint: subscription.endpoint },
    })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireSession()

    const parsed = unsubscribeSchema.safeParse(await request.json())
    if (!parsed.success) {
      return jsonError(400, 'Invalid unsubscribe request', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }

    // Scope the delete to the caller's own subscriptions: a user can only remove
    // an endpoint they own. Honest count — 0 when nothing matched.
    const { count } = await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: user.id },
    })

    return NextResponse.json({ removed: count })
  } catch (err) {
    return handleApiError(err)
  }
}
