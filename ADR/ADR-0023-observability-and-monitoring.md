# ADR-0023: Observability: Real Metrics, Logging, and Health

- Date: 2026-07-02
- Status: **Implemented (2026-07-07)** — Option 2. Phase 4 error-tracking (GlitchTip/Sentry) wired but dormant-by-default.
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Implementation note (2026-07-07)

Option 2 (prom-client + repaired self-hosted Prometheus/Grafana/Loki + guarded Sentry)
shipped via a 5-track workflow + wire-check + test tracks, then independent verification.
Much of Phases 0/2 had already landed incrementally — `logs/` gitignored and
`src/lib/monitoring/alerts.ts` deleted (ADR-0024), the jobs endpoints
(`/api/jobs/stats|health|details`) rewritten on real BullMQ handles (ADR-0008), and the
worker's `worker:heartbeat` write (ADR-0008) — so this ADR delivered what remained.

**Metrics core (Phase 1):** one `globalThis`-guarded prom-client `Registry`
(`src/lib/observability/metrics.ts`, the `prisma.ts` singleton pattern so dev hot-reload
never double-registers) with `http_requests_total{method,route,status}`,
`http_request_duration_seconds{method,route}`, DB-backed business gauges
(`sociallyhub_{users,posts,workspaces}_total`, async `collect()` + 15s cache, fail-safe),
and `collectDefaultMetrics()`. `route` is ALWAYS a bounded pattern via
`normalizeRoutePattern()` (the one cardinality funnel). `/api/metrics` rewritten as a
standard exposition endpoint (deleted the per-scrape `MetricsCollector`/`new
PrismaClient()`/Redis; the old bug reset every counter to 1 per scrape) with a
`METRICS_TOKEN` bearer. `withLogging` is the single seam recording both instruments.
`src/instrumentation.ts` (the repo's first) inits the registry once per process.
**Proven live:** `/api/metrics` serves real accumulating counters + gauges
(`sociallyhub_posts_total 1602`), content-type `text/plain; version=0.0.4`.

**Honest health + system metrics (Phase 2):** `/api/health` is a real readiness check —
singleton prisma `SELECT 1`, a module-scope shared ioredis `PING`, worker-heartbeat
freshness gated by `WORKER_EXPECTED` (`disabled` until the worker is expected), the
misleading cwd/tmp write test deleted; degrades (never 500s) unless the DB is down.
`/api/monitoring/metrics` derives errorRate/avgResponseTime from the registry
(`getHttpSummary()`, `null`→"—", never a fake 0) and reports `process.uptime()` — the
`'99.9%'` string and both UI `99.9` fallbacks are gone. The last unowned fabricated
*business* numbers are swept: `/api/analytics/platform` errorRate/responseTime dropped,
`/api/clients/stats` revenue/industry/satisfaction/acquisition dropped (real counts stay),
`/api/campaigns/analytics` age/gender/location demographics dropped — with a CI grep guard
(`scripts/check-no-fabricated-metrics.sh`, blocking Build-gate step) keeping the class out.
**Verification also caught a fabrication the plan didn't name** — the monitoring
dashboard's hardcoded "System Health Overview" bars (98/100/67/34%) and a `|| 127`
active-users fallback — now derived from real data or dropped.

**Stack (Phase 3):** `docker/monitoring/prometheus.yml` repaired (invalid top-level
`recording_rules:` removed → mounted `rules/` dir; scrape targets trimmed to
app/worker/self; alertmanager block dropped in favor of Grafana unified alerting).
`promtool check config` **validates SUCCESS** (2 rule files, 4 alert + 3 recording rules).
Grafana provisioning (Prometheus+Loki datasources, a starter dashboard) + compose mounts
now resolve; `LOG_TO_STDOUT` mode strips winston file transports in containers; the worker
exposes prom-client on internal `:9464`.

**Error tracking (Phase 4):** `@sentry/nextjs` wired via `instrumentation.ts`
`register()`/`onRequestError`, DORMANT without `SENTRY_DSN` (guarded dynamic import, no
`withSentryConfig` — a keyless build is a total no-op); GlitchTip added to compose under
the `monitoring` profile. Grafana alert rules (5xx rate, p95 latency, target/worker down)
shipped in `rules/alerts.yml`.

**Verification:** 24 new Jest tests (registry singleton, route normalization, getHttpSummary,
health/metrics/monitoring endpoints, fabrication-absence assertions) — full suite 19 suites
/ 270 green; `next build` + `build:worker` green; e2e `g8-observability` (health+metrics
endpoints, no-99.9% dashboard, no-demographics) green; `promtool` config validation;
live-container proof of `/api/metrics`, `/api/health`, and the honest dashboard.

**Deferred (by design):** exporters (postgres/redis/node) as real compose services;
OpenTelemetry tracing (Option 3 upgrade path, not foreclosed); turning Sentry/GlitchTip
*on* (needs a DSN + adding `@sentry/nextjs` to standalone tracing per ADR-0022); real
per-platform publish success rates (await ADR-0008/0009 live posting).

## Context and Problem Statement

SociallyHub ships a monitoring *surface* — a `/dashboard/monitoring` page, five metrics/health
endpoints, a winston logger, and a Prometheus/Grafana/Loki stack in `docker-compose.prod.yml` —
but almost none of it measures anything real. Verified against the code on 2026-07-02:

- **Fabricated metrics.** `src/app/api/monitoring/metrics/route.ts` mixes real Prisma counts
  (`prisma.post.count`, `prisma.userSession.count`) with `errorRate = Math.random() * 2` and
  `avgResponseTime = 200 + Math.random() * 300` (lines 52–53) and returns a hardcoded
  `uptime: '99.9%'` (line 65). `src/app/api/analytics/platform/route.ts` fabricates per-platform
  `errorRate`/`responseTime` the same way (lines 116–117). `src/app/api/jobs/health/route.ts`
  computes `throughput` and `avgDuration` from `Math.random()` (lines 17–18).
  `src/app/api/jobs/details/route.ts` returns a hardcoded `mockJobs` array (line 17) and never
  touches BullMQ despite importing `queueManager`. Two *business-facing* endpoints fabricate the
  same way and are owned by no other ADR: `src/app/api/clients/stats/route.ts` invents monthly
  revenue via `0.9 + Math.random() * 0.2` variance over an assumed $999/client (line 86) plus
  hardcoded industry/service-level splits, satisfaction score, and acquisition cost (lines
  94–129), and the demographics section of `src/app/api/campaigns/analytics/route.ts` returns
  hardcoded age/gender/location distributions (lines 175–194, "Mock some demographic data").
  ADR-0008 fixes the client-report schedule mocks and ADR-0013 gates the community ones behind
  the deferral flag, but these two routes are live and agency-facing.
- **A metrics endpoint that cannot accumulate.** `src/app/api/metrics/route.ts` instantiates its
  own `new PrismaClient()` (line 5, bypassing the `src/lib/prisma.ts` singleton and calling
  `$disconnect()` in `finally`), opens a fresh ioredis connection per scrape, and — worse than
  the audit stated — creates its `MetricsCollector` *inside the GET handler*, so every counter
  resets on every scrape: `http_requests_total` is permanently `1`. Its hand-rolled
  `toPrometheus()` also emits percentile values as `_bucket{le="0.5"}` lines, which is not valid
  cumulative-histogram semantics.
- **Queue stats read an empty in-process Map.** `/api/jobs/stats` and `/api/jobs/health` call
  `queueManager.getAllQueueStats()` (`src/lib/jobs/queue-manager.ts:345`), which iterates only
  queues created *in the web process* — and per ADR-0008 no worker or queue is ever started
  there, so real counts are unreachable today.
- **Health checks are shallow and duplicated.** `src/app/api/health/route.ts` pings the DB and
  Redis but via its own `new PrismaClient()` and a new Redis connection per request, performs a
  filesystem write test into `process.cwd()/tmp`, and has no notion of the worker process that
  ADR-0008 introduces. The UI compounds the fiction: `monitoring-dashboard.tsx:110` falls back to
  `'99.9%'` and `analytics-overview-cards.tsx:374` defaults uptime to `99.9`.
- **Logging writes files into the repo.** `src/lib/logger.ts` attaches winston `File` transports
  for `logs/{error,combined,http,exceptions,rejections}.log` unconditionally; five such files are
  *committed to git* (`logs/http.log` ~21 KB from Sep 2025) and `.gitignore` has no `logs` entry.
  In containers this writes into the image's writable layer and is invisible to Loki/Promtail.
- **The prod monitoring stack cannot start.** `docker-compose.prod.yml` mounts
  `./docker/monitoring/grafana/{dashboards,datasources}` (lines 164–165) and `./docker/nginx/*`
  (lines 115–117), none of which exist. `docker/monitoring/prometheus.yml` *does* exist but is
  itself invalid: it has a top-level `recording_rules:` key (rejected by Prometheus's strict
  config parser — the container crash-loops even with mounts fixed) and scrapes six services
  (`postgres-exporter`, `redis-exporter`, `node-exporter`, `cadvisor`, `nginx-exporter`,
  `alertmanager`) that the compose file never defines. Its one real target, `app:3099
  /api/metrics`, is consistent with `Dockerfile.prod` (`ENV PORT=3099`).
- **Dead alerting layer.** `src/lib/monitoring/alerts.ts` (`AlertingSystem`, static in-memory
  `Map`s) has zero importers. Notably, `/api/monitoring/alerts` is *real* — it queries the
  `Alert` Prisma model — and should be kept.

With deployment standardized on self-hosted Docker (ADR-0022) and Stripe billing in scope
(ADR-0019), we will soon be charging customers on infrastructure whose dashboards show random
numbers. This ADR decides how metrics, logs, health, and error tracking become real.

## Decision Drivers

- **Owner decision (2026-07-02):** self-hosted Docker is the deployment target; anything
  requiring a SaaS control plane is disfavored.
- **Honesty:** ADR-0021's principle applies to ops too — a fabricated 99.9% uptime badge is
  worse than no badge. Every displayed number must have a real source or be removed.
- **Reuse what exists:** `docker-compose.prod.yml` already declares Prometheus, Grafana, Loki,
  and Promtail; `withLogging` (`src/lib/middleware/logging.ts`) already wraps 42 API route files
  and is a natural metrics choke point; BullMQ (ADR-0008) has real queue introspection APIs.
- **Next.js constraints:** no root `middleware.ts` exists, edge middleware cannot host
  prom-client, and dev hot-reload re-evaluates modules (registry must be a global singleton,
  same pattern as `src/lib/prisma.ts`). `output: 'standalone'` builds must trace the deps.
- **Small ops footprint:** one part-time operator; every added container must earn its place.
- **Dependencies:** worker heartbeat and real queue stats depend on ADR-0008's worker container;
  scrape topology depends on ADR-0022's final compose file.

## Considered Options

### Option 1 — Fix the hand-rolled collector; JSON metrics only, no external stack

Keep `/api/metrics` bespoke but move the collector to module/global scope, and drop
Prometheus/Grafana from compose.

- Good: zero new dependencies; smallest surface.
- Bad: per-instance counters vanish on every deploy; no history, no dashboards, no alerting; we
  would re-invent exposition, quantiles, and rate math that prom-client already does correctly;
  the existing Grafana/Loki investment in compose is discarded.

### Option 2 — prom-client + self-hosted Prometheus/Grafana/Loki (make the declared stack real)

Adopt `prom-client` with a global-singleton registry; rewrite `/api/metrics` as a standard
exposition endpoint over the `src/lib/prisma.ts` singleton; record per-route HTTP metrics through
the existing `withLogging` wrapper; repair the compose monitoring stack (valid prometheus.yml,
Grafana provisioning, Promtail→Loki over container stdout); worker exposes its own metrics and a
Redis heartbeat; GlitchTip (Sentry-protocol, self-hostable, ~2 containers reusing Postgres/Redis)
for error tracking via `@sentry/nextjs`.

- Good: industry-standard model that matches the self-hosted decision; Prometheus pull model
  handles per-instance registries correctly; Grafana gives dashboards *and* alerting (no separate
  Alertmanager); nearly all compose scaffolding already exists and only needs correcting.
- Bad: three extra containers to operate; per-route labels need cardinality discipline; metrics
  endpoint needs access control.

### Option 3 — OpenTelemetry end-to-end (OTel SDK + Collector, metrics/logs/traces)

Instrument via `instrumentation.ts` with the OTel Node SDK, ship to an OTel Collector, fan out to
Prometheus/Loki/Tempo.

- Good: one instrumentation API for all three signals; vendor-neutral; distributed tracing —
  valuable once the ADR-0008 worker and social-platform calls need cross-process correlation.
- Bad: heaviest option — Collector config, SDK churn in Next.js, and a tracing backend, for a
  single-node compose deployment with one operator; can be layered onto Option 2 later without
  rework (Prometheus and Loki remain the backends either way).

### Option 4 — SaaS APM (Datadog / Grafana Cloud / Sentry SaaS)

- Good: least to operate; best-in-class UX.
- Bad: contradicts the self-hosted standardization decision; recurring cost scales with the very
  metrics volume we are about to create; data residency leaves our control.

## Decision Outcome

**Chosen option: Option 2 — prom-client with the singleton registry, a repaired self-hosted
Prometheus/Grafana/Loki stack, and GlitchTip for error tracking.**

It is the only option that is simultaneously honest (real numbers with history), aligned with the
self-hosted Docker decision, and mostly *already declared* in the repo — the work is correcting
configuration and replacing fabricated values, not adopting a foreign paradigm. Option 3 remains
the upgrade path for tracing and is explicitly not foreclosed: Prometheus and Loki stay as the
storage layer either way.

Concrete rulings:

1. **Metrics core:** add `prom-client`. Create `src/lib/observability/metrics.ts` exporting a
   global-singleton `Registry` (guarded via `globalThis`, the `src/lib/prisma.ts` pattern, so dev
   hot-reload does not double-register), `collectDefaultMetrics()`, and named instruments:
   `http_requests_total{method,route,status}` (counter),
   `http_request_duration_seconds{method,route}` (histogram), plus business gauges
   (`sociallyhub_users_total`, `sociallyhub_posts_total`, `sociallyhub_workspaces_total`) using
   async `collect()` callbacks over the **singleton `prisma`**. The `route` label is always the
   route *pattern* (e.g. `/api/posts/[id]`), never the concrete URL.
2. **Exposition:** rewrite `src/app/api/metrics/route.ts` to return `register.metrics()` with
   `Content-Type` from `register.contentType`. Delete the `MetricsCollector` class, the local
   `new PrismaClient()`, and the per-scrape Redis connection. Protect the endpoint with a
   `METRICS_TOKEN` bearer check (Prometheus `authorization.credentials`), and do not route it
   through nginx to the public internet.
3. **Per-route HTTP metrics:** extend `withLogging` in `src/lib/middleware/logging.ts` to record
   the two HTTP instruments alongside its existing `AppLogger.apiResponse` call — one choke point
   already adopted by 42 route files. Rolling the wrapper out to the remaining routes follows the
   ADR-0003 route conventions; no separate metrics wrapper is introduced.
4. **Queue metrics (with ADR-0008):** `/api/jobs/stats` and `/api/jobs/health` read real counts
   via queue handles constructed by name against Redis (ADR-0008's fix for the empty in-process
   Map); throughput/duration come from BullMQ job timestamps (`processedOn`/`finishedOn`) or
   `queue.getMetrics()`, replacing both `Math.random()` lines. `/api/jobs/details` is rewritten
   over `queue.getJobs([...], offset, offset + limit)`; the `mockJobs` array is deleted. The
   ADR-0008 worker exposes its own prom-client registry on an internal port (`:9464`) and writes
   a `worker:heartbeat` Redis key with a short TTL on each processing loop.
5. **Health:** `src/app/api/health/route.ts` becomes a real readiness check: `SELECT 1` via the
   singleton `prisma`, `PING` via a shared ioredis client (module-scope, not per-request), and a
   worker check that reads the `worker:heartbeat` key freshness — reported as `disabled` unless
   `WORKER_EXPECTED=true`, so health stays green until ADR-0008 Phase 2 lands. The
   `process.cwd()/tmp` filesystem write test is dropped (misleading in a mostly-read-only
   standalone container); an uploads-volume writability check moves to ADR-0007's scope. `HEAD`
   stays as the cheap liveness probe. Docker/k8s healthchecks already point here and keep working.
6. **Honest system metrics:** `/api/monitoring/metrics` derives `errorRate` and
   `avgResponseTime` from the prom-client registry (5xx share and mean duration of this
   instance's `http_*` series), reports `uptime` as `process.uptime()` seconds — the string
   `'99.9%'` is deleted, along with the `'99.9%'`/`99.9` fallbacks in
   `monitoring-dashboard.tsx` and `analytics-overview-cards.tsx`. `/api/analytics/platform`
   drops its fabricated `errorRate`/`responseTime` fields entirely; real per-platform publish
   success rates can be derived from `PostVariant` statuses once ADR-0008/ADR-0009 publishing is
   live. The same ruling sweeps the remaining fabricated *business* metrics no other ADR owns:
   `/api/clients/stats` keeps its real Prisma counts and drops (or derives from the DB) the
   invented revenue, industry/service-level, satisfaction, and acquisition figures;
   `/api/campaigns/analytics` drops the hardcoded age/gender/location demographics blocks — the
   platform split stays, being derived from real engagement data. Per the no-simulated-numbers
   principle, sections are dropped rather than re-fabricated. A CI grep guard for `Math.random(`
   under `src/app/api/**` — with an explicit allowlist for ID-generation uses (e.g.
   `campaigns/route.ts`) and routes owned by other ADRs' remediation/deferral plans, burned down
   as those execute — keeps the class from returning.
7. **Logging:** keep winston, JSON to **stdout only** when running in containers
   (`LOG_TO_STDOUT=true`, default in production): file transports and file-based
   `exceptionHandlers`/`rejectionHandlers` in `src/lib/logger.ts` are removed in that mode (kept
   optionally for local dev). `git rm` the five committed `logs/*.log` files and add `logs/` to
   `.gitignore`. Promtail (`docker/monitoring/promtail.yml`) scrapes Docker container logs into
   Loki; Grafana gets a Loki datasource.
8. **Stack repair (with ADR-0022):** fix `docker/monitoring/prometheus.yml` — delete the invalid
   top-level `recording_rules:` block (recording/alert rules move to a mounted `rules/` dir
   referenced by `rule_files`), trim scrape targets to services that exist (`app:3099`,
   `worker:9464`, Prometheus itself), and add the bearer token. Create
   `docker/monitoring/grafana/datasources/datasources.yml` (Prometheus + Loki) and
   `docker/monitoring/grafana/dashboards/` with provisioning config plus one starter dashboard
   (HTTP rate/latency/errors, queue depth, worker heartbeat, DB/Redis up). Exporters
   (postgres-exporter, redis-exporter, node-exporter) are re-added *only* as real compose
   services in a later phase — config must never reference services that don't exist.
9. **Alerting:** use **Grafana unified alerting** on the Prometheus datasource (no Alertmanager
   container). Delete the dead `src/lib/monitoring/alerts.ts` (`AlertingSystem`) per ADR-0024.
   Keep the DB-backed `/api/monitoring/alerts` route and `Alert` model as the in-app alert
   surface; a Grafana webhook contact point may POST into it later (optional).
10. **Error tracking:** self-hosted **GlitchTip** (Sentry-protocol) as a compose service reusing
    the existing Postgres and Redis, with `@sentry/nextjs` in the app configured via
    `SENTRY_DSN`. This also introduces the repo's first `instrumentation.ts` (`register()` +
    `onRequestError`), which is where prom-client default metrics init lives too. Full Sentry
    self-hosted (~10 containers) is rejected for footprint; Sentry SaaS remains a drop-in swap
    since the SDK is identical.

## Consequences

### Positive

- Every number on `/dashboard/monitoring` and in `/api/metrics` traces to a real source;
  `Math.random()` disappears from all four metric endpoints, the last unowned fabricated
  business numbers (client stats, campaign demographics) go with it, and the CI grep guard
  keeps the class from returning.
- The already-declared Prometheus/Grafana/Loki stack actually starts, with history, dashboards,
  and alerting — no new paradigm, standard PromQL/Grafana skills apply.
- One instrumentation choke point (`withLogging`) means new routes get metrics and logs together.
- Health checks become trustworthy readiness signals for ADR-0022's deploy gates, including the
  ADR-0008 worker.
- Crash visibility (GlitchTip) replaces silent `console.error` swallowing; `instrumentation.ts`
  finally exists as the sanctioned startup hook.
- Repo hygiene: committed log files and the dead `AlertingSystem` are removed (ADR-0024).

### Negative

- Three to five additional containers (Prometheus, Grafana, Loki, Promtail, GlitchTip) to run,
  upgrade, and back up on the single self-hosted target.
- Per-instance registries mean `/api/monitoring/metrics`-derived rates describe *this* instance
  only; accurate fleet-wide numbers require querying Prometheus (acceptable now: compose runs one
  app container; revisit if k8s replicas arrive).
- Until `withLogging` covers all routes, HTTP metrics under-count; coverage rollout rides on
  ADR-0003 conventions.
- Removing fabricated fields (platform errorRate/responseTime, uptime badge, client
  revenue/industry splits, campaign demographics) makes some dashboard cards emptier until real
  sources (ADR-0008/0009 publishing) exist — this is intended.

## Implementation Plan

**Phase 0 — Hygiene (S)**
1. Add `logs/` to `.gitignore`; `git rm --cached logs/*.log`; delete the directory content. (S)
2. Delete `src/lib/monitoring/alerts.ts` (zero importers; verified). Record in ADR-0024's
   cleanup list. (S)

**Phase 1 — Metrics core (M)**
3. `npm i prom-client`. Create `src/lib/observability/metrics.ts`: global-singleton registry,
   `collectDefaultMetrics()`, HTTP counter + duration histogram, DB-backed gauges using the
   singleton `prisma`. (M)
4. Rewrite `src/app/api/metrics/route.ts` to `register.metrics()` + `METRICS_TOKEN` bearer
   check; delete `MetricsCollector`, local `PrismaClient`, per-scrape Redis. (S)
5. Extend `withLogging` (`src/lib/middleware/logging.ts`) to record both HTTP instruments with
   route-pattern labels; verify the 42 wrapped routes emit series. (M)
6. Create `instrumentation.ts` (`register()`) to initialize the registry once per process. (S)

**Phase 2 — Honest health and queue stats (M, depends on ADR-0008 for worker parts)**
7. Rewrite `src/app/api/health/route.ts`: singleton prisma `SELECT 1`, shared ioredis `PING`,
   `worker:heartbeat` freshness gated by `WORKER_EXPECTED`, drop the cwd/tmp write test; keep
   HEAD liveness. (M)
8. Rewrite `/api/jobs/stats`, `/api/jobs/health` (delete both `Math.random()` metrics),
   `/api/jobs/details` (delete `mockJobs`) over real BullMQ queue handles per ADR-0008. (M)
9. Fix `/api/monitoring/metrics`: registry-derived errorRate/avgResponseTime, real
   `process.uptime()`, delete `'99.9%'`; remove UI fallbacks in `monitoring-dashboard.tsx` and
   `analytics-overview-cards.tsx`. (S)
10. Remove fabricated `errorRate`/`responseTime` from `/api/analytics/platform` and their UI
    consumers. (S)
11. Sweep remaining fabricated business metrics: in `src/app/api/clients/stats/route.ts` drop or
    derive-from-DB the `Math.random()` revenue variance and the hardcoded
    industry/service-level/satisfaction/acquisition figures (Prisma counts stay); drop the
    mocked age/gender/location demographics section in
    `src/app/api/campaigns/analytics/route.ts` and its UI consumers. Add the CI grep guard for
    `Math.random(` in `src/app/api/**` with the allowlist (ID generation; routes owned by other
    ADRs). (M)

**Phase 3 — Stack provisioning (M, with ADR-0022)**
12. Fix `docker/monitoring/prometheus.yml`: remove invalid `recording_rules:` block, mount a
    `docker/monitoring/rules/` dir for `rule_files`, trim targets to `app:3099` + `worker:9464`
    + self, add bearer-token authorization. (S)
13. Create `docker/monitoring/grafana/datasources/datasources.yml` (Prometheus, Loki) and
    `docker/monitoring/grafana/dashboards/` provisioning + starter dashboard JSON; verify the
    compose mounts now resolve. (M)
14. Point Promtail at Docker container logs; set `LOG_TO_STDOUT=true` in prod compose; strip
    winston file transports in that mode in `src/lib/logger.ts`. (M)
15. Worker (`src/worker.ts`, from ADR-0008): expose prom-client on `:9464`, write
    `worker:heartbeat` with TTL each loop. (S — rides on ADR-0008)

**Phase 4 — Error tracking and alerts (M)**
16. Add GlitchTip service(s) to `docker-compose.prod.yml`; wire `@sentry/nextjs` with
    `SENTRY_DSN`, `onRequestError` in `instrumentation.ts`. (M)
17. Provision Grafana alert rules: p95 latency, 5xx rate, queue backlog, worker heartbeat
    missing, DB/Redis down, disk usage. Optional webhook contact point into
    `/api/monitoring/alerts` (`Alert` model). (M)

## Risks and Mitigations

- **Label cardinality explosion** (route label from raw URLs): mitigate by labeling with route
  patterns only, enforced inside the `withLogging` helper, and a Prometheus `sample_limit`.
- **Dev hot-reload double registration**: global-singleton registry via `globalThis` (same
  pattern as `src/lib/prisma.ts`); metric creation is idempotent (`getSingleMetric` guard).
- **Scrape endpoint exposure**: bearer token + not proxied by nginx; verified in ADR-0005's
  security review checklist.
- **ADR-0008 slippage** (no worker yet): health reports the worker check as `disabled` unless
  `WORKER_EXPECTED=true`; queue endpoints return real-but-empty counts rather than mocks.
- **Ops burden of 5 new containers**: phase order puts app-side honesty (Phases 0–2) before the
  stack (Phases 3–4); even if Phase 3 stalls, no fabricated numbers remain.
- **Gauge `collect()` DB load on scrape**: 30s scrape interval, three `count()` queries with a
  short in-process cache if needed.
- **Standalone build tracing**: `prom-client` and `@sentry/nextjs` are regular runtime deps;
  verify presence in `.next/standalone` during the ADR-0022 image build check.

## Related ADRs

- ADR-0003: Auth Helper Consolidation and API Route Conventions — `withLogging` rollout vehicle.
- ADR-0005: API Security Hardening — protecting `/api/metrics` and health endpoints.
- ADR-0007: Media Storage, Uploads, and Serving Architecture — uploads-volume writability check.
- ADR-0008: Background Jobs and the Publishing Pipeline — worker container, real queue stats,
  heartbeat; this ADR consumes both.
- ADR-0009: Social Platform Integration Completion Strategy — future source for real
  per-platform error rates replacing the deleted fabricated fields.
- ADR-0016: System Settings & Configuration: Real Operations over Simulations — same
  "no simulated numbers" principle applied to admin settings.
- ADR-0021: Testing Strategy and Honest Quality Gates — honesty principle; health/metrics
  endpoints get integration tests.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — compose topology, deploy gates on
  `/api/health`, removal of the Vercel workflow.
- ADR-0024: Codebase Hygiene — deletion of `src/lib/monitoring/alerts.ts` and committed `logs/`.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — demo data must not leak into
  production metrics dashboards.
