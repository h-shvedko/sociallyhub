// Redis sliding-window rate limiter (ADR-0005, Decision item 3).
//
// Replaces the previous hand-rolled per-instance in-memory Map limiter and
// removes the broken `import { Ratelimit } from 'ratelimiter'` (that named
// export never existed; the dependency is dropped from package.json).
//
// Design:
//   - Redis sorted-set sliding window (ZREMRANGEBYSCORE + ZCARD + ZADD +
//     PEXPIRE) executed atomically in a single Lua EVAL, so it is correct
//     across multiple app containers (ADR-0022 Docker deployment).
//   - Reuses the REDIS_URL connection pattern from src/lib/cache/cache-manager
//     via a lazy singleton — the client is created on first use, never at
//     import time.
//   - FAILS OPEN on any Redis error: availability over throttling (ADR-0005
//     Risks: "Redis unavailability turns the limiter into a DoS on ourselves").
//     A warning is logged and the request is allowed.
//   - When REDIS_URL is UNSET, an in-memory Map fallback provides a real,
//     working sliding-window limiter (used by tests and single-process dev).
//
// Public API:
//   rateLimit(key, { points, windowSec }) -> { ok, remaining, retryAfterSec? }
//   ratelimit.limit(identifier)           -> { success, remaining }  (legacy shim)

import Redis from 'ioredis'

export interface RateLimitOptions {
  /** Max number of requests allowed within the window. */
  points: number
  /** Sliding-window length in seconds. */
  windowSec: number
}

export interface RateLimitResult {
  /** True when the request is allowed (also true on fail-open). */
  ok: boolean
  /** Requests remaining in the current window (0 when throttled). */
  remaining: number
  /** Seconds until the client may retry — present only when `ok` is false. */
  retryAfterSec?: number
}

// ---------------------------------------------------------------------------
// Lazy Redis singleton (mirrors src/lib/cache/cache-manager.ts).
//   undefined = not yet initialized
//   null      = no REDIS_URL configured → use in-memory fallback
//   Redis     = live client
// ---------------------------------------------------------------------------
let redisClient: Redis | null | undefined = undefined

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient

  const url = process.env.REDIS_URL
  if (!url) {
    // No Redis configured: use the in-memory fallback (tests / single dev proc).
    redisClient = null
    return null
  }

  try {
    const client = new Redis(url, {
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    })
    // Never let a Redis connection error crash the process — the limiter
    // catches op failures and fails open; this handler just avoids unhandled
    // 'error' events.
    client.on('error', (err: Error) => {
      console.warn('[rate-limit] Redis connection error:', err.message)
    })
    redisClient = client
    return client
  } catch (err) {
    console.warn(
      '[rate-limit] Redis init failed; using in-memory fallback:',
      err instanceof Error ? err.message : err
    )
    redisClient = null
    return null
  }
}

// Sliding-window log in a single atomic script. Returns
// [ok(1|0), remaining, retryAfterMs]. `member` must be unique per call so
// concurrent same-millisecond requests do not collapse into one ZADD.
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local points = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)

if count < points then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, windowMs)
  return {1, points - count - 1, 0}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryMs = windowMs
  if oldest[2] then
    retryMs = (tonumber(oldest[2]) + windowMs) - now
    if retryMs < 0 then retryMs = 0 end
  end
  redis.call('PEXPIRE', key, windowMs)
  return {0, 0, retryMs}
end
`

// Monotonic-ish uniqueness suffix for ZADD members.
let memberCounter = 0

const REDIS_KEY_PREFIX = 'rl:'

/**
 * Sliding-window rate limit for `key`.
 *
 * @example
 *   const res = await rateLimit(`ip:${ip}:/api/auth/signup`, { points: 5, windowSec: 60 })
 *   if (!res.ok) return jsonError(429, 'Too many requests', { code: 'RATE_LIMITED' })
 *
 * Fails OPEN (returns `{ ok: true }`) on any Redis error. Uses an in-memory
 * fallback when REDIS_URL is unset.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const { points, windowSec } = opts
  const windowMs = windowSec * 1000

  const redis = getRedisClient()
  if (!redis) {
    return memoryRateLimit(key, points, windowMs)
  }

  try {
    const now = Date.now()
    const member = `${now}:${memberCounter++}`
    const raw = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      REDIS_KEY_PREFIX + key,
      String(now),
      String(windowMs),
      String(points),
      member
    )) as [number, number, number]

    const [okNum, remaining, retryMs] = raw
    if (okNum === 1) {
      return { ok: true, remaining: Math.max(0, remaining) }
    }
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)),
    }
  } catch (err) {
    // FAIL OPEN — availability over throttling (ADR-0005).
    console.warn(
      '[rate-limit] Redis op failed; failing open:',
      err instanceof Error ? err.message : err
    )
    return { ok: true, remaining: points }
  }
}

// ---------------------------------------------------------------------------
// In-memory sliding-window fallback (no Redis configured).
// ---------------------------------------------------------------------------
const memoryStore = new Map<string, number[]>()

function memoryRateLimit(
  key: string,
  points: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const cutoff = now - windowMs
  const timestamps = (memoryStore.get(key) ?? []).filter((t) => t > cutoff)

  if (timestamps.length >= points) {
    const oldest = timestamps[0]
    memoryStore.set(key, timestamps)
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }

  timestamps.push(now)
  memoryStore.set(key, timestamps)

  // Opportunistic cleanup so idle keys do not leak memory.
  if (memoryStore.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of memoryStore.entries()) {
      const live = v.filter((t) => t > cutoff)
      if (live.length === 0) memoryStore.delete(k)
      else memoryStore.set(k, live)
    }
  }

  return { ok: true, remaining: points - timestamps.length }
}

// ---------------------------------------------------------------------------
// Backward-compatible shim for the three existing importers
// (ai/images/optimize, ai/images/analyze, audience/sentiment/analyze), which
// call `ratelimit.limit(identifier)` and destructure `{ success }`.
// Preserves the historical 10 requests / 60s policy.
// ---------------------------------------------------------------------------
export const ratelimit = {
  async limit(
    identifier: string
  ): Promise<{ success: boolean; remaining: number }> {
    const res = await rateLimit(`legacy:${identifier}`, {
      points: 10,
      windowSec: 60,
    })
    return { success: res.ok, remaining: res.remaining }
  },
}

// ---------------------------------------------------------------------------
// Test-only hooks (used by scripts/test-rate-limit.ts). Not for app code.
// ---------------------------------------------------------------------------

/** Inject a fake/real Redis client (or null to force the in-memory path). */
export function __setRateLimitRedisForTests(client: Redis | null): void {
  redisClient = client
}

/** Clear the in-memory store and reset the client sentinel. */
export function __resetRateLimitForTests(): void {
  memoryStore.clear()
  redisClient = undefined
}
