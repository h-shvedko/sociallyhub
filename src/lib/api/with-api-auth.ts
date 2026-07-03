// withApiAuth — declared per-route authorization wrapper (ADR-0005, Decision
// item 1). This is the single mechanism by which an API route declares WHO may
// call it. It composes the ADR-0003 session helpers and the ADR-0004
// authorization gates, resolves the declared access level, applies an optional
// Redis rate limit, and stamps `Cache-Control: no-store` by default — all
// BEFORE the wrapped handler body runs. A forgotten declaration is impossible:
// there is no code path that reaches the handler without an `access` value.
//
// Policy (binding): every API route must be built with this wrapper and pass
// one of: 'public' | 'session' | 'platformAdmin' | { workspaceRole } | 'cron'.
// `scripts/check-route-auth.ts` (CI, warn mode) scans for handlers that skip
// it. See docs/api-conventions.md and ADR-0005.

import type { NextRequest, NextResponse } from 'next/server'
import type { WorkspaceRole } from '@prisma/client'

import {
  getAuthenticatedUser,
  requireSession,
  requirePlatformAdmin,
  requireWorkspaceRole,
  ApiError,
  type AuthUser,
  type WorkspaceMembership,
} from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { rateLimit } from '@/lib/utils/rate-limit'

/**
 * Declared access level for a route.
 * - `public`         — no auth (explicit, reviewable allow-list). The wrapper
 *                      still attaches `ctx.user` best-effort if a session
 *                      happens to exist (useful for counter dedup).
 * - `session`        — any authenticated user (ADR-0003 requireSession).
 * - `platformAdmin`  — User.isPlatformAdmin, re-checked in DB (ADR-0004).
 * - `{ workspaceRole }` — member of a workspace holding one of the given roles;
 *                      workspaceId is read from `?workspaceId=` or a route param
 *                      of the same name (ADR-0004 requireWorkspaceRole).
 * - `cron`           — shared-secret header `x-cron-secret === CRON_SECRET`.
 */
export type AccessLevel =
  | 'public'
  | 'session'
  | 'platformAdmin'
  | 'cron'
  | { workspaceRole: WorkspaceRole[] }

/** Rate-limit declaration; the limiter fails open on Redis errors. */
export interface RateLimitConfig {
  /** Bucket by client IP or by authenticated user id. */
  key: 'ip' | 'user'
  /** Max requests per window. */
  points: number
  /** Window length in seconds. */
  windowSec: number
}

export interface WithApiAuthConfig {
  /** WHO may call this route. Required — this is the whole point. */
  access: AccessLevel
  /** Optional throttle applied before the handler runs. */
  limit?: RateLimitConfig
  /**
   * Cache-Control value for the response. Defaults to `'no-store'`.
   * Genuinely cacheable public GETs may opt into e.g.
   * `'public, s-maxage=60, stale-while-revalidate=300'`.
   */
  cache?: 'no-store' | string
}

/** Extra context passed to the wrapped handler alongside the request. */
export interface ApiHandlerContext<
  P = Record<string, string | string[] | undefined>,
> {
  /** Present for authenticated access levels (and best-effort for `public`). */
  user?: AuthUser
  /** Present only for `{ workspaceRole }` access — the caller's membership row. */
  membership?: WorkspaceMembership
  /** Resolved (awaited) route params — Next 15 delivers these as a Promise. */
  params: P
}

/** The inner handler signature the wrapper invokes. */
export type ApiHandler<
  P = Record<string, string | string[] | undefined>,
> = (
  request: NextRequest,
  ctx: ApiHandlerContext<P>
) => Promise<NextResponse> | NextResponse

/** Next 15 route context: `params` arrives as a Promise (or, legacy, plain). */
type NextRouteContext<P> = { params?: Promise<P> | P }

function applyCacheHeader(
  res: NextResponse,
  config: WithApiAuthConfig
): NextResponse {
  res.headers.set('Cache-Control', config.cache ?? 'no-store')
  return res
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

function resolveWorkspaceId(
  request: NextRequest,
  params: Record<string, unknown>
): string | null {
  const fromQuery = request.nextUrl.searchParams.get('workspaceId')
  if (fromQuery) return fromQuery
  const fromParams = params?.workspaceId
  return typeof fromParams === 'string' ? fromParams : null
}

function buildRateLimitKey(
  limit: RateLimitConfig,
  request: NextRequest,
  user?: AuthUser
): string {
  const scope = request.nextUrl.pathname
  if (limit.key === 'user' && user?.id) {
    return `user:${user.id}:${scope}`
  }
  return `ip:${getClientIp(request)}:${scope}`
}

/**
 * Wrap a Next.js route handler with a declared access level, optional rate
 * limit, and default `no-store` caching. The returned function is a valid
 * Next.js App Router route handler and can be exported directly as
 * `GET`/`POST`/`PUT`/`PATCH`/`DELETE`.
 *
 * Auth failures (401/403/404) are returned as the standard
 * `{ error, code?, details? }` envelope via `handleApiError` BEFORE the handler
 * runs. Rate-limit rejections return 429 with a `Retry-After` header. The
 * limiter fails open on Redis errors (availability over throttling).
 *
 * @example
 *   // src/app/api/help/faqs/route.ts
 *   import { withApiAuth } from '@/lib/api/with-api-auth'
 *   import { NextResponse } from 'next/server'
 *
 *   export const POST = withApiAuth(
 *     async (request, { user }) => {
 *       const body = await request.json()
 *       // ... user is guaranteed present (platformAdmin) ...
 *       return NextResponse.json({ ok: true })
 *     },
 *     { access: 'platformAdmin', limit: { key: 'user', points: 30, windowSec: 60 } }
 *   )
 *
 * @example
 *   // Workspace-scoped read: workspaceId from ?workspaceId= or a route param.
 *   export const GET = withApiAuth(
 *     async (_request, { membership }) => {
 *       const posts = await prisma.post.findMany({
 *         where: { workspaceId: membership!.workspaceId },
 *       })
 *       return NextResponse.json(posts)
 *     },
 *     { access: { workspaceRole: ['OWNER', 'ADMIN', 'PUBLISHER'] } }
 *   )
 */
export function withApiAuth<
  P = Record<string, string | string[] | undefined>,
>(
  handler: ApiHandler<P>,
  config: WithApiAuthConfig
): (request: NextRequest, routeContext?: NextRouteContext<P>) => Promise<NextResponse> {
  return async (request, routeContext) => {
    try {
      const params = ((await routeContext?.params) ?? {}) as P
      const ctx: ApiHandlerContext<P> = { params }

      // 1. Resolve + enforce the declared access level (fails closed).
      const access = config.access
      if (access === 'public') {
        // No auth required; attach the user opportunistically for dedup use.
        ctx.user = (await getAuthenticatedUser()) ?? undefined
      } else if (access === 'session') {
        ctx.user = await requireSession()
      } else if (access === 'platformAdmin') {
        ctx.user = await requirePlatformAdmin()
      } else if (access === 'cron') {
        const provided = request.headers.get('x-cron-secret')
        const expected = process.env.CRON_SECRET
        if (!expected || !provided || provided !== expected) {
          throw new ApiError(401, 'Unauthorized', 'UNAUTHENTICATED')
        }
      } else if (typeof access === 'object' && 'workspaceRole' in access) {
        const workspaceId = resolveWorkspaceId(
          request,
          params as Record<string, unknown>
        )
        if (!workspaceId) {
          throw new ApiError(400, 'workspaceId is required', 'WORKSPACE_ID_REQUIRED')
        }
        ctx.membership = await requireWorkspaceRole(
          workspaceId,
          access.workspaceRole
        )
        // Membership passed ⇒ a session exists; populate user for handlers.
        ctx.user = (await getAuthenticatedUser()) ?? undefined
      } else {
        // Unreachable given the type, but fail closed for safety.
        throw new ApiError(403, 'Forbidden', 'FORBIDDEN')
      }

      // 2. Rate limit (fails open on limiter/Redis error).
      if (config.limit) {
        const key = buildRateLimitKey(config.limit, request, ctx.user)
        const result = await rateLimit(key, {
          points: config.limit.points,
          windowSec: config.limit.windowSec,
        })
        if (!result.ok) {
          const res = jsonError(429, 'Too many requests', { code: 'RATE_LIMITED' })
          if (result.retryAfterSec !== undefined) {
            res.headers.set('Retry-After', String(result.retryAfterSec))
          }
          return applyCacheHeader(res, config)
        }
      }

      // 3. Run the handler and stamp the cache header on its response.
      const response = await handler(request, ctx)
      return applyCacheHeader(response, config)
    } catch (err) {
      // 401/403/404/400 from the gates, or 500 for anything unexpected.
      return applyCacheHeader(handleApiError(err), config)
    }
  }
}
