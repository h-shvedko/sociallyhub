// Prometheus exposition endpoint (ADR-0023 Phase 1, ruling #2).
//
// This route returns the ONE global-singleton prom-client registry's exposition
// text. The old hand-rolled `MetricsCollector` (per-scrape counters that reset to
// 1 every scrape), the local `new PrismaClient()`, and the per-scrape ioredis
// connection are all DELETED — everything now flows through
// `src/lib/observability/metrics.ts`.
//
// Access control: when `METRICS_TOKEN` is set, a matching `Authorization: Bearer`
// header is required (constant-time compare). When it is unset the endpoint is
// open — the documented dev/compose default; production sets the token and never
// proxies this route to the public internet (ADR-0023 ruling #2, ADR-0005).
//
// NOT wrapped in withLogging: a scrape must not record itself as an HTTP metric
// and must not require a session.

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getRegistry, initObservability } from '@/lib/observability/metrics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Ensure default process metrics + business gauges exist before the first
// scrape even if instrumentation.ts hasn't run in this runtime (idempotent).
initObservability()

/** Constant-time bearer-token check. Returns true when access is allowed. */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.METRICS_TOKEN
  // Documented dev/compose default: no token configured -> open.
  if (!expected) return true

  const header = request.headers.get('authorization') || ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return false
  const provided = header.slice(prefix.length)

  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  // timingSafeEqual throws on length mismatch; the length check is unavoidable
  // and does not leak the secret's content.
  if (expectedBuf.length !== providedBuf.length) return false
  return timingSafeEqual(expectedBuf, providedBuf)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const reg = getRegistry()
  const body = await reg.metrics()
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': reg.contentType,
      'Cache-Control': 'no-store',
    },
  })
}
