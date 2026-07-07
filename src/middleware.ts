import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isFeatureEnabled } from '@/lib/config/features'

/**
 * Edge middleware — ADR-0005 Phase 0 (Stop the bleeding) + the deferral gate
 * for ADR-0013/0014/0015.
 *
 * Cross-cutting, cheap protections applied to every `/api/*` request:
 *   0. Feature-flag gate (ADR-0013/0014/0015): deferred, known-broken
 *      subsystems return a JSON 404 when their flag is off (the default).
 *      `/api/community/**` is gated by FEATURE_COMMUNITY and
 *      `/api/documentation/**` by FEATURE_DOCS_MANAGEMENT. One gate here covers
 *      all 36 community + 19 documentation route files without touching them,
 *      so the deferred code stays byte-identical for a clean eventual repair.
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
 * ioredis, or any Node-only API here — the edge runtime will reject them and
 * every API request would fail. The only `@/lib` import allowed is
 * `@/lib/config/features`, which is pure `process.env` reads and therefore
 * edge-safe; keep it that way.
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

// --- Portal-only default-deny (ADR-0020) ----------------------------------
//
// A user whose every membership is CLIENT_VIEWER carries `portalOnly: true`
// in their JWT (set at sign-in, src/lib/auth/config.ts). ~175 legacy routes
// still check "is a member" without checking the role (the ADR-0004
// requireWorkspaceRole rollout is incremental), so without this gate a
// portal contact could read e.g. /api/posts for the whole workspace. The
// ADR-0020 allowlist is enforced here as prefixes; the allowed families
// re-check the role against the DB internally (requireClientViewer /
// requireWorkspaceRole), so a stale claim can never WIDEN access.
// `getToken` verifies the JWT with jose — edge-safe, no Prisma/Redis.

const PORTAL_ALLOWED_PREFIXES = [
  '/api/auth/', // session/signout/csrf — needed to be signed in at all
  '/api/portal/', // the portal's own summary endpoint
  '/api/client-reports', // list/[id]/download are CLIENT_VIEWER-scoped inside
  '/api/share/', // public share surface (anonymous by design)
  '/api/health', // liveness, no tenant data
]

function isPortalAllowedPath(pathname: string): boolean {
  return PORTAL_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
}

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token')
  )
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const { pathname } = request.nextUrl

  // --- Feature-flag deferral gate (ADR-0013/0014/0015) ---------------------
  // Deferred, known-broken subsystems 404 when their flag is off (the default).
  // Discord lives under `/api/community/**`, so the community gate covers it;
  // ADR-0015's own per-route guards enforce the FEATURE_DISCORD sub-flag.
  if (
    (pathname.startsWith('/api/community') && !isFeatureEnabled('FEATURE_COMMUNITY')) ||
    (pathname.startsWith('/api/documentation') && !isFeatureEnabled('FEATURE_DOCS_MANAGEMENT'))
  ) {
    const res = NextResponse.json({ error: 'Not found' }, { status: 404 })
    res.headers.set('x-request-id', requestId)
    res.headers.set('X-Robots-Tag', 'noindex')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }

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

  // Portal-only default-deny (ADR-0020). Cookie pre-check keeps the JWT
  // verification off the hot path for anonymous/public traffic.
  if (!isPortalAllowedPath(pathname) && hasSessionCookie(request)) {
    try {
      const token = await getToken({ req: request })
      if (token?.portalOnly === true) {
        const res = NextResponse.json(
          { error: 'Forbidden', code: 'PORTAL_ONLY' },
          { status: 403 }
        )
        res.headers.set('x-request-id', requestId)
        res.headers.set('X-Robots-Tag', 'noindex')
        res.headers.set('Cache-Control', 'no-store')
        return res
      }
    } catch {
      // Token verification failed (malformed cookie, missing secret at the
      // edge): fall through — every route still authenticates for itself.
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
