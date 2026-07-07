// Observability metrics core (ADR-0023 Phase 1).
//
// A SINGLE global-singleton prom-client Registry — guarded via `globalThis`
// exactly like `src/lib/prisma.ts` — so Next.js dev hot-reload and multiple
// route-module evaluations never double-register instruments (prom-client
// throws on duplicate metric names otherwise). Every instrument is created
// once here and imported everywhere; nothing else calls `new Registry()` or
// `register.registerMetric()`.
//
// CARDINALITY DISCIPLINE (do not weaken): the `route` label is ALWAYS a route
// *pattern* (e.g. `/api/posts/[id]`), never a concrete URL. Unbounded label
// values are the classic Prometheus footgun — `normalizeRoutePattern()` is the
// one funnel that guarantees it, and `withLogging` is the one caller.

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client'

import { prisma } from '@/lib/prisma'

// --- Global singleton (survives dev hot-reload) ---------------------------

interface ObservabilityGlobal {
  registry: Registry | null
  initialized: boolean
}

const globalForMetrics = globalThis as unknown as {
  __sociallyhubObservability?: ObservabilityGlobal
}

const store: ObservabilityGlobal =
  globalForMetrics.__sociallyhubObservability ?? {
    registry: null,
    initialized: false,
  }

if (!globalForMetrics.__sociallyhubObservability) {
  globalForMetrics.__sociallyhubObservability = store
}

/** The one process-wide registry. */
export function getRegistry(): Registry {
  if (!store.registry) {
    store.registry = new Registry()
    store.registry.setDefaultLabels({ app: 'sociallyhub' })
  }
  return store.registry
}

// --- Instruments (created once, idempotent under hot-reload) --------------

/**
 * prom-client throws if a metric name is registered twice. Under dev
 * hot-reload the module can re-evaluate, so we look the metric up first and
 * only construct when absent — the same defensive pattern the ADR calls for.
 */
function counter(name: string, help: string, labelNames: string[]): Counter {
  const reg = getRegistry()
  return (
    (reg.getSingleMetric(name) as Counter | undefined) ??
    new Counter({ name, help, labelNames, registers: [reg] })
  )
}

function histogram(
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[]
): Histogram {
  const reg = getRegistry()
  return (
    (reg.getSingleMetric(name) as Histogram | undefined) ??
    new Histogram({ name, help, labelNames, buckets, registers: [reg] })
  )
}

/** http_requests_total{method,route,status} */
export const httpRequestsTotal = counter(
  'http_requests_total',
  'Total number of HTTP requests handled, by method, route pattern, and status code.',
  ['method', 'route', 'status']
)

/** http_request_duration_seconds{method,route} */
export const httpRequestDuration = histogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds, by method and route pattern.',
  ['method', 'route'],
  // Web-request-shaped buckets: 5ms .. 10s.
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
)

// --- Business gauges (DB-backed, async collect over the singleton prisma) --
//
// collect() runs on every scrape. To avoid three COUNT()s per 30s scrape
// hammering Postgres, values are cached in-process for CACHE_TTL_MS. A DB
// error never breaks the scrape — the gauge keeps its last known value.

const CACHE_TTL_MS = 15_000

interface CachedCount {
  value: number
  at: number
}

const countCache = new Map<string, CachedCount>()

async function cachedCount(
  key: string,
  query: () => Promise<number>
): Promise<number> {
  const now = Date.now()
  const cached = countCache.get(key)
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value
  }
  try {
    const value = await query()
    countCache.set(key, { value, at: now })
    return value
  } catch {
    // DB unavailable — keep the last known value (or 0) rather than throwing
    // and failing the whole /metrics exposition.
    return cached?.value ?? 0
  }
}

function registerBusinessGauge(
  name: string,
  help: string,
  key: string,
  query: () => Promise<number>
): Gauge {
  const reg = getRegistry()
  const existing = reg.getSingleMetric(name) as Gauge | undefined
  if (existing) return existing
  return new Gauge({
    name,
    help,
    registers: [reg],
    async collect() {
      this.set(await cachedCount(key, query))
    },
  })
}

export const usersTotalGauge = registerBusinessGauge(
  'sociallyhub_users_total',
  'Total number of registered users.',
  'users',
  () => prisma.user.count()
)

export const postsTotalGauge = registerBusinessGauge(
  'sociallyhub_posts_total',
  'Total number of posts.',
  'posts',
  () => prisma.post.count()
)

export const workspacesTotalGauge = registerBusinessGauge(
  'sociallyhub_workspaces_total',
  'Total number of workspaces.',
  'workspaces',
  () => prisma.workspace.count()
)

// --- Default process/runtime metrics --------------------------------------

/**
 * Initialize collectDefaultMetrics() exactly once per process. Called from
 * `instrumentation.ts` register(); safe to call again (guarded).
 */
export function initObservability(): void {
  if (store.initialized) return
  store.initialized = true
  collectDefaultMetrics({ register: getRegistry() })
}

// --- Route-pattern normalization (the ONE cardinality funnel) --------------

const CUID_RE = /^c[a-z0-9]{20,}$/i
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LONG_TOKEN_RE = /^[A-Za-z0-9_-]{20,}$/
const NUMERIC_RE = /^\d+$/

/**
 * Collapse concrete path segments that are identifiers into `:id`, so the
 * `route` label stays bounded. Query strings are dropped. A caller-supplied
 * `pattern` (e.g. a route's known `[id]` template) always wins.
 *
 * Examples:
 *   /api/posts/clx123.../variants -> /api/posts/:id/variants
 *   /api/share/reports/AbCd...43  -> /api/share/reports/:id
 *   /api/users/42                 -> /api/users/:id
 */
export function normalizeRoutePattern(
  pathnameOrUrl: string,
  pattern?: string
): string {
  if (pattern && pattern.startsWith('/')) return pattern

  let pathname = pathnameOrUrl
  const q = pathname.indexOf('?')
  if (q !== -1) pathname = pathname.slice(0, q)

  return (
    '/' +
    pathname
      .split('/')
      .filter(Boolean)
      .map((seg) => {
        if (
          NUMERIC_RE.test(seg) ||
          CUID_RE.test(seg) ||
          UUID_RE.test(seg) ||
          LONG_TOKEN_RE.test(seg)
        ) {
          return ':id'
        }
        return seg
      })
      .join('/')
  )
}

/**
 * Record one finished HTTP request on both instruments. The single seam used
 * by `withLogging`; `route` is normalized here so no caller can leak a raw URL.
 */
export function recordHttpMetric(args: {
  method: string
  pathname: string
  routePattern?: string
  status: number
  durationMs: number
}): void {
  const route = normalizeRoutePattern(args.pathname, args.routePattern)
  const method = args.method.toUpperCase()
  httpRequestsTotal.inc({ method, route, status: String(args.status) })
  httpRequestDuration.observe({ method, route }, args.durationMs / 1000)
}

// --- Instance-derived summary (for /api/monitoring/metrics) -----------------
//
// The honest replacement for the deleted Math.random() errorRate/response-time.
// Derived from THIS instance's http_* series (per-instance by design — fleet
// numbers come from querying Prometheus). Returns null when no requests have
// been recorded yet, so callers can render "—" instead of a fake 0.

export interface HttpSummary {
  totalRequests: number
  errorRate: number // percent, 5xx share
  avgResponseTimeMs: number
}

export async function getHttpSummary(): Promise<HttpSummary | null> {
  const reg = getRegistry()

  const requestsMetric = await (
    reg.getSingleMetric('http_requests_total') as Counter | undefined
  )?.get()
  const durationMetric = await (
    reg.getSingleMetric('http_request_duration_seconds') as
      | Histogram
      | undefined
  )?.get()

  if (!requestsMetric || requestsMetric.values.length === 0) return null

  let total = 0
  let errors = 0
  for (const v of requestsMetric.values) {
    const count = v.value
    total += count
    const status = Number(v.labels.status)
    if (status >= 500) errors += count
  }

  // Mean = sum / count from the histogram's _sum and _count series.
  let durationSum = 0
  let durationCount = 0
  if (durationMetric) {
    for (const v of durationMetric.values) {
      if (v.metricName?.endsWith('_sum')) durationSum += v.value
      else if (v.metricName?.endsWith('_count')) durationCount += v.value
    }
  }

  return {
    totalRequests: total,
    errorRate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
    avgResponseTimeMs:
      durationCount > 0
        ? Math.round((durationSum / durationCount) * 1000)
        : 0,
  }
}
