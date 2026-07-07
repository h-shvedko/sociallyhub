/**
 * @jest-environment node
 *
 * ADR-0023 Track F1 — unit tests for src/lib/observability/metrics.ts (the
 * pinned metrics contract). Pure, no DB: exercises the route-pattern funnel,
 * the singleton registry, recordHttpMetric's counter/histogram writes, the
 * honest getHttpSummary() replacement for the deleted Math.random() figures,
 * and the presence of the DB-backed business gauges.
 *
 * The prom-client registry is a PROCESS singleton (globalThis-guarded), so
 * every test that asserts an exact count first `.reset()`s the instrument it
 * reads — making the assertions order-independent within this file.
 */
import { describe, it, expect } from '@jest/globals'

import {
  getRegistry,
  normalizeRoutePattern,
  recordHttpMetric,
  getHttpSummary,
} from '@/lib/observability/metrics'

/** Read a registered metric's current samples. `.get()` may be async (gauges). */
async function metricValues(name: string): Promise<Array<{ value: number; labels: Record<string, string | number>; metricName?: string }>> {
  const metric = getRegistry().getSingleMetric(name) as unknown as {
    get: () => Promise<{ values: Array<{ value: number; labels: Record<string, string | number>; metricName?: string }> }>
  }
  const snapshot = await metric.get()
  return snapshot.values
}

function resetMetric(name: string): void {
  const metric = getRegistry().getSingleMetric(name) as unknown as { reset?: () => void }
  metric?.reset?.()
}

// ---------------------------------------------------------------------------
// normalizeRoutePattern — the ONE cardinality funnel
// ---------------------------------------------------------------------------

describe('normalizeRoutePattern', () => {
  it('collapses a cuid segment to :id and preserves the static tail', () => {
    expect(
      normalizeRoutePattern('/api/posts/clh1234567890abcdefghij/variants')
    ).toBe('/api/posts/:id/variants')
  })

  it('collapses a numeric id segment to :id', () => {
    expect(normalizeRoutePattern('/api/users/42')).toBe('/api/users/:id')
  })

  it('collapses a uuid segment to :id', () => {
    expect(
      normalizeRoutePattern('/api/x/550e8400-e29b-41d4-a716-446655440000')
    ).toBe('/api/x/:id')
  })

  it('collapses a long opaque token segment to :id', () => {
    expect(
      normalizeRoutePattern('/api/share/reports/AbCdEfGhIjKlMnOpQrStUvWx')
    ).toBe('/api/share/reports/:id')
  })

  it('leaves a fully-static pathname unchanged', () => {
    expect(normalizeRoutePattern('/api/health')).toBe('/api/health')
  })

  it('strips the query string', () => {
    expect(normalizeRoutePattern('/api/posts?limit=5&cursor=abc')).toBe('/api/posts')
  })

  it("lets a '/'-prefixed caller pattern win verbatim (over the raw pathname)", () => {
    expect(normalizeRoutePattern('/api/posts/42', '/api/posts/[id]')).toBe(
      '/api/posts/[id]'
    )
  })

  it('ignores a non-/-prefixed pattern (a slug) and derives from the pathname', () => {
    expect(normalizeRoutePattern('/api/posts/42', 'posts-slug')).toBe(
      '/api/posts/:id'
    )
  })
})

// ---------------------------------------------------------------------------
// getRegistry — process singleton
// ---------------------------------------------------------------------------

describe('getRegistry', () => {
  it('returns the SAME registry instance on repeated calls', () => {
    expect(getRegistry()).toBe(getRegistry())
  })
})

// ---------------------------------------------------------------------------
// getHttpSummary — honest, null-when-empty
// ---------------------------------------------------------------------------

describe('getHttpSummary', () => {
  it('returns null when no HTTP requests have been recorded', async () => {
    resetMetric('http_requests_total')
    resetMetric('http_request_duration_seconds')
    expect(await getHttpSummary()).toBeNull()
  })

  it('reports errorRate as the 5xx share and a finite non-negative avgResponseTimeMs', async () => {
    resetMetric('http_requests_total')
    resetMetric('http_request_duration_seconds')

    // 3x 200 + 1x 500 => errorRate = 25.00, total = 4
    recordHttpMetric({ method: 'GET', pathname: '/api/summary', status: 200, durationMs: 10 })
    recordHttpMetric({ method: 'GET', pathname: '/api/summary', status: 200, durationMs: 10 })
    recordHttpMetric({ method: 'GET', pathname: '/api/summary', status: 200, durationMs: 10 })
    recordHttpMetric({ method: 'GET', pathname: '/api/summary', status: 500, durationMs: 30 })

    const summary = await getHttpSummary()
    expect(summary).not.toBeNull()
    expect(summary!.totalRequests).toBe(4)
    expect(summary!.errorRate).toBe(25)
    expect(Number.isFinite(summary!.avgResponseTimeMs)).toBe(true)
    expect(summary!.avgResponseTimeMs).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// recordHttpMetric — counter + histogram writes, route normalized to a pattern
// ---------------------------------------------------------------------------

describe('recordHttpMetric', () => {
  it('increments http_requests_total under the NORMALIZED route label, never a raw id', async () => {
    resetMetric('http_requests_total')
    resetMetric('http_request_duration_seconds')

    // Two requests to distinct concrete ids that both normalize to /api/posts/:id
    recordHttpMetric({ method: 'get', pathname: '/api/posts/42', status: 200, durationMs: 15 })
    recordHttpMetric({ method: 'GET', pathname: '/api/posts/99', status: 200, durationMs: 25 })

    const values = await metricValues('http_requests_total')
    const series = values.find(
      (v) =>
        v.labels.route === '/api/posts/:id' &&
        v.labels.method === 'GET' &&
        String(v.labels.status) === '200'
    )
    expect(series).toBeDefined()
    expect(series!.value).toBe(2) // both records collapsed onto one bounded series

    // No raw id ever leaks into the route label (cardinality discipline).
    const leaked = values.some(
      (v) => String(v.labels.route).includes('42') || String(v.labels.route).includes('99')
    )
    expect(leaked).toBe(false)
  })

  it('observes http_request_duration_seconds (count matches the recorded requests)', async () => {
    resetMetric('http_requests_total')
    resetMetric('http_request_duration_seconds')

    recordHttpMetric({ method: 'GET', pathname: '/api/posts/1', status: 200, durationMs: 12 })
    recordHttpMetric({ method: 'GET', pathname: '/api/posts/2', status: 200, durationMs: 34 })

    const values = await metricValues('http_request_duration_seconds')
    const countSeries = values.find(
      (v) =>
        v.metricName === 'http_request_duration_seconds_count' &&
        v.labels.route === '/api/posts/:id' &&
        v.labels.method === 'GET'
    )
    expect(countSeries).toBeDefined()
    expect(countSeries!.value).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Business gauges — registered by name on the singleton registry
// ---------------------------------------------------------------------------

describe('DB-backed business gauges', () => {
  it.each([
    'sociallyhub_users_total',
    'sociallyhub_posts_total',
    'sociallyhub_workspaces_total',
  ])('registers %s on the registry', (name) => {
    expect(getRegistry().getSingleMetric(name)).toBeTruthy()
  })
})
