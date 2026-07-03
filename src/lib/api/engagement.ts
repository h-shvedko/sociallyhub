// Counter dedup for public engagement endpoints (ADR-0005, Decision item 5).
//
// Public feedback/view counters (help articles, FAQs) were previously blind
// `increment`s with no dedup and no rate limit, so a single client could inflate
// them arbitrarily. This helper records a once-per-day `EngagementEvent` keyed by
// a salted hash of the caller's identity; the model's
// `@@unique([eventType, targetId, dedupKey])` constraint enforces "one engagement
// per identity per target per day". A P2002 on insert means the caller already
// engaged today, so the counter must NOT be incremented again.
//
// Identity: the authenticated user id when a session exists, otherwise the
// request IP (first x-forwarded-for hop, falling back to x-real-ip) plus the
// user-agent. Salted with NEXTAUTH_SECRET so the stored hash is not reversible
// to a raw IP/UA.
//
// NOTE: `prisma.engagementEvent` is generated from the schema model added in the
// same phase; until `prisma generate` runs (Migrate phase) tsc will flag it as
// missing. That is expected and resolves post-generate.

import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Build the per-day dedup key:
 *   sha256( NEXTAUTH_SECRET + (userId || ip+'|'+userAgent) + '|' + YYYY-MM-DD )
 * The date is UTC so the window is stable regardless of server locale.
 */
export function buildDedupKey(
  request: NextRequest,
  user?: { id: string } | null
): string {
  const salt = process.env.NEXTAUTH_SECRET || ''
  const day = new Date().toISOString().slice(0, 10) // UTC YYYY-MM-DD
  const identity = user?.id
    ? user.id
    : `${clientIp(request)}|${request.headers.get('user-agent') || ''}`
  return createHash('sha256').update(`${salt}${identity}|${day}`).digest('hex')
}

/** True when the error is a Prisma P2002 unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  )
}

export interface RecordEngagementInput {
  eventType: string
  targetType: string
  targetId: string
  dedupKey: string
  value?: string | null
}

/**
 * Attempt to record a once-per-day engagement event.
 *
 * @returns `true`  — first engagement today; the caller SHOULD apply its side
 *                    effect (increment the counter).
 *          `false` — the identity already engaged today (unique violation); the
 *                    caller MUST NOT apply the side effect.
 * Any non-P2002 error propagates to the caller's error handling.
 */
export async function recordEngagementOnce(
  input: RecordEngagementInput
): Promise<boolean> {
  try {
    await prisma.engagementEvent.create({
      data: {
        eventType: input.eventType,
        targetType: input.targetType,
        targetId: input.targetId,
        dedupKey: input.dedupKey,
        value: input.value ?? null,
      },
    })
    return true
  } catch (err) {
    if (isUniqueViolation(err)) return false
    throw err
  }
}
