import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge middleware — ADR-0005 Phase 0 (Stop the bleeding).
 *
 * Cross-cutting, cheap protections applied to every `/api/*` request:
 *   1. `x-request-id` response header (crypto.randomUUID) for log correlation.
 *   2. `X-Robots-Tag: noindex` so API responses never get indexed.
 *   3. `Cache-Control: no-store` on every `/api/*` response — defense in depth
 *      so the caching-leak fix does not depend solely on `next.config.js`
 *      (which is baked into the image and can drift from the running config).
 *      Genuinely-cacheable public routes opt back in via the `withApiAuth`
 *      wrapper's `cache` option, which sets its header after this runs.
 *   4. A COARSE per-IP request ceiling on the highest-risk unauthenticated
 *      surfaces (`/api/auth/*`, `/api/support/*`) → 429 when exceeded.
 *
 * IMPORTANT: this is a *backstop*, not the real rate limiter. It runs on the
 * Next.js edge runtime, which cannot reach Prisma or ioredis, so the count is
 * an in-memory Map that is per-isolate and non-durable — it resets on redeploy
 * and is not shared across app containers. The authoritative, Redis-backed
 * sliding-window limiter lives in `src/lib/utils/rate-limit.ts` and is applied
 * inside the `withApiAuth` wrapper (ADR-0005 Phase 1). Do NOT add Prisma,
 * ioredis, `@/lib` imports, or any Node-only API here — the edge runtime will
 * reject them and every API request would fail.
 */

// --- Coarse in-memory per-IP throttle (backstop only) --------------------

const WINDOW_MS = 10_000 // 10 seconds
const MAX_REQUESTS = 30 // per IP per window on throttled prefixes

type Bucket = { count: number; resetAt: number }

// Per-isolate map. Bounded by periodic eviction of expired buckets below.
const buckets = new Map<string, Bucket>()

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // First hop is the originating client.
    return forwarded.split(',')[0]!.trim()
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

/**
 * Fixed-window counter with lazy, time-bucketed eviction. Returns true when the
 * request should be rejected. Kept intentionally simple and allocation-light.
 */
function isRateLimited(ip: string, now: number): boolean {
  const existing = buckets.get(ip)

  if (!existing || now >= existing.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })

    // Opportunistic eviction so the Map cannot grow unbounded. Cheap: only
    // sweeps when the Map gets large, and only drops fully-expired buckets.
    if (buckets.size > 5_000) {
      for (const [key, bucket] of buckets) {
        if (now >= bucket.resetAt) buckets.delete(key)
      }
    }
    return false
  }

  existing.count += 1
  return existing.count > MAX_REQUESTS
}

function isThrottledPath(pathname: string): boolean {
  return pathname.startsWith('/api/auth/') || pathname.startsWith('/api/support/')
}

export function middleware(request: NextRequest): NextResponse {
  const requestId = crypto.randomUUID()
  const { pathname } = request.nextUrl

  // Coarse throttle on the highest-risk unauthenticated surfaces only.
  if (isThrottledPath(pathname)) {
    const ip = getClientIp(request)
    if (isRateLimited(ip, Date.now())) {
      const res = NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429 }
      )
      res.headers.set('x-request-id', requestId)
      res.headers.set('X-Robots-Tag', 'noindex')
      res.headers.set('Cache-Control', 'no-store')
      res.headers.set('Retry-After', String(Math.ceil(WINDOW_MS / 1000)))
      return res
    }
  }

  const res = NextResponse.next()
  res.headers.set('x-request-id', requestId)
  res.headers.set('X-Robots-Tag', 'noindex')
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// Only run on API routes.
export const config = {
  matcher: '/api/:path*',
}
