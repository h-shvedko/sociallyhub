# ADR-0008: Background Jobs and the Publishing Pipeline

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-04** (pipeline infrastructure; real provider posting is ADR-0009)
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-04).** Delivered all five phases as infrastructure: queue-manager
> repaired (REDIS_URL parsing, `maxRetriesPerRequest:null`, `(queueName, jobName)` processor registry,
> skip-and-warn for unregistered queues); job-scheduler TS2393 fixed and the `NODE_ENV`/`INIT_JOBS`
> self-init deleted; explicit `src/worker.ts` bootstrap (register → create workers → sync repeatables →
> Redis heartbeat → SIGTERM/SIGINT graceful shutdown) with `npm run worker`/`build:worker` (esbuild
> bundle), Dockerfile.prod bundling, and dev+prod compose `worker` services (+ prod Redis AOF). The
> publish processor is rewritten to load Post/variants/accounts from the DB, decrypt tokens (ADR-0006),
> **check `APIResponse.success`, and persist the true per-variant outcome** (`PUBLISHED`+`providerPostId`
> +`publishedAt` or `FAILED`+`failureReason`), roll up `Post.status`, skip already-published variants on
> retry, and classify errors (401/403 fail-fast vs 429/5xx backoff). `/api/posts` POST/PUT enqueue with
> `jobId=publish:{postId}`; `/api/social/post` routes through the queue; a `reconcile-scheduled-posts`
> repeatable recovers the crash window. Client-report schedules became BullMQ repeatables over real
> `AnalyticsMetric` aggregation; `/api/client-reports/schedules/run` requires `CRON_SECRET` (no default).
> `/api/jobs/*` read real Redis state (no `mockJobs`/`Math.random`); `/api/health` reports worker
> liveness. **Verified live:** worker boots (4 workers, heartbeat, clean SIGTERM); an enqueued
> `publish:{postId}` drove 3 variants `PENDING → FAILED` with truthful `failureReason` ("<platform>
> provider is not configured") and `Post.status → FAILED` — the pipeline runs and reports the truth
> rather than faking success; `/api/jobs/stats` shows real counts; no schema change; `prisma validate`/
> `db:check` green. **Deferred:** real provider posting (ADR-0009 — until then publish jobs fail
> honestly), demo-token gating so seeded accounts skip the real path (ADR-0025), k8s worker Deployment
> (ADR-0022), real throughput metrics (ADR-0023).

## Context and Problem Statement

SociallyHub's core promise — publish and schedule posts to social platforms — is not wired end-to-end.
The pieces exist, but nothing connects them, and several of them are broken in ways that guarantee they
have never run:

1. **No job is ever enqueued.** `src/app/api/posts/route.ts` (POST handler, lines 318–328) contains the
   comment "If status is PUBLISHED or SCHEDULED, trigger background job" but only calls
   `BusinessLogger.logWorkspaceAction('publish_post' | 'schedule_post', ...)`. The post row is written,
   `PostVariant` rows are created with `status: 'PENDING'`, and nothing else happens. `/api/posts/[id]`
   PUT likewise never (re)schedules anything.

2. **Nothing starts the queue stack.** A substantial BullMQ implementation exists
   (`src/lib/jobs/queue-manager.ts` with queues/workers/`QueueEvents` over ioredis;
   `src/lib/jobs/job-scheduler.ts`; processors for `post-scheduling`, `analytics-collection`,
   `notification-dispatch`). But `jobScheduler` is imported by no file other than itself, there is no
   `instrumentation.ts`, no worker entrypoint, and no npm script. The only live consumers of
   `queueManager` are the read-only `/api/jobs/*` routes.

3. **The self-init path could not work even if triggered.** `job-scheduler.ts` lines 460–464
   auto-initialize when `NODE_ENV === 'production' || INIT_JOBS === 'true'`, but:
   - The file fails TypeScript compilation: `scheduleAnalyticsCollection` is defined twice (private,
     line 94; public, line 301) — verified `TS2393: Duplicate function implementation`.
   - `QueueManager.registerProcessor` stores processors in a `Map` keyed by queue name
     (`queue-manager.ts` line 176), so job-scheduler's paired registrations (lines 22–27) silently
     replace `postSchedulingProcessor` with `bulkPostSchedulingProcessor` (and similarly for the other
     two queues). Single-post jobs would be run by the bulk processor.
   - `queue-manager.ts` creates one shared ioredis client (lines 79–87) without
     `maxRetriesPerRequest: null`, which BullMQ v5 (`bullmq@^5.58.2` in package.json) requires for
     `Worker` connections — worker construction throws at startup.
   - `createWorker('media-processing')` is attempted with no registered processor and throws (caught
     and logged).
   - Dev `docker-compose.yml` sets only `REDIS_URL`, while `queue-manager.ts` reads
     `REDIS_HOST`/`REDIS_PORT` (defaulting to `localhost`) — inside the dev container it would connect
     to the wrong host. Only `docker-compose.prod.yml` sets `REDIS_HOST=redis`.

4. **The publish processor is wrong even if it ran.** `src/lib/jobs/processors/post-scheduling.ts`
   lines 91–101 call `socialMediaManager.createPost(...)`, which returns `APIResponse<PublishedPost>`
   (a `{ success, data?, error? }` envelope), then unconditionally push
   `{ success: true, platformPostId: postResult.id, metrics: postResult.metrics }` — `.success` is never
   checked, and `.id`/`.metrics` do not exist on the envelope. Every platform is reported successful.
   The processor also never writes results back to the database: `PostVariant.status`,
   `providerPostId`, `publishedAt`, and `failureReason` (all present in `prisma/schema.prisma`, model
   `PostVariant`, lines 431–450) are never updated.

5. **Account resolution is process-local.** `SocialMediaManager` (`src/services/social-providers/social-media-manager.ts`)
   keeps `private accounts: Map<string, SocialAccount>` (line 74), populated only via `addAccount`
   inside `exchangeCodeForToken` (lines 185–188) during the OAuth callback request. `createPost`
   resolves accounts via `this.getAccount(...)` (line 200). After any restart — or in any process other
   than the one that handled the OAuth callback, such as a worker — every account lookup returns null.
   `SocialAccount` rows in the DB (with `accessToken`, `refreshToken`, `tokenExpiry`, `status`) are
   never consulted at publish time.

6. **Adjacent scheduled work bypasses the queue.** Client-report schedules run via an external-cron
   HTTP endpoint `/api/client-reports/schedules/run`, gated by
   `Bearer ${process.env.CRON_SECRET || 'default-cron-secret'}` (line 15 — an insecure default), which
   generates report data from `Math.random()` mock metrics (lines 397–403). No cron is configured
   anywhere to call it.

7. **Job monitoring is fictional.** `/api/jobs/stats` and `/api/jobs/health` call
   `queueManager.getAllQueueStats()`, which iterates the manager's *in-process* `queues` Map — empty in
   the web process, so they report nothing regardless of Redis state. `/api/jobs/health` fabricates
   `throughput` and `avgDuration` with `Math.random()` (lines 17–18), and `/api/jobs/details` returns a
   hardcoded `mockJobs` array (line 17).

The owner has decided (2026-07-02) that deployment standardizes on self-hosted Docker
(compose now, k8s optional later; the Vercel workflow is removed — ADR-0022). That removes the
serverless constraint that would otherwise argue against long-running workers, and both compose stacks
already run Redis. We must decide how job execution is hosted, how publishing flows from `/api/posts`
to the platforms, and how the surrounding pieces (idempotency, retries, schedules, shutdown,
monitoring) work.

## Decision Drivers

- Publishing is the product's core loop; it must be reliable, observable, and restart-safe.
- Self-hosted Docker (ADR-0022) permits — and favors — dedicated long-running processes.
- Redis 7 is already in `docker-compose.yml` and `docker-compose.prod.yml`; BullMQ 5 + ioredis are
  already dependencies with substantial (if broken) code written against them.
- Scheduled posts may be hours or days in the future; delivery must survive deploys and restarts.
- Publishing to third-party APIs is not idempotent by default — retries must not double-post.
- Implicit module-side-effect initialization (`NODE_ENV`-gated self-init) has already proven
  unauditable: it shipped broken and nobody noticed because nothing exercised it.
- The web tier must stay responsive; platform API calls (slow, rate-limited) do not belong in request
  handlers.
- `/api/jobs/*` monitoring must reflect reality (ADR-0023); tokens must be decryptable by the worker
  (ADR-0006); the Prisma schema must validate before any of this can build (ADR-0002).

## Considered Options

### Option 1 — Dedicated worker container sharing the app image (BullMQ, explicit bootstrap)

A new `src/worker.ts` entrypoint, bundled during the Docker build and run as a separate
`docker-compose` service from the same image (`command` override). The web app only *enqueues*;
the worker owns processors, repeatable jobs, and graceful shutdown.

- Good: real process isolation — platform API latency and worker crashes cannot degrade the web tier;
  independent scaling and restart policy; explicit, testable bootstrap; standard BullMQ topology.
- Good: reuses existing Redis, BullMQ code, and the prod image (one build, two commands).
- Bad: one more container to run and monitor; the worker needs a build step (the standalone
  `Dockerfile.prod` runtime has prod-only deps and no TypeScript loader).

### Option 2 — In-process workers inside the Next.js server (fix and keep the self-init, or move it to `instrumentation.ts`)

Run BullMQ workers inside the web process, started from Next's `register()` instrumentation hook.

- Good: no new container; simplest deployment delta.
- Bad: workers compete with request handling for CPU/memory; `next dev` hot-reload and multi-instance
  web scaling create duplicate/zombie workers; graceful shutdown is entangled with the HTTP server;
  the implicit-init pattern is exactly what already failed silently here. Rejected as the primary
  host, though harmless to allow for local dev convenience.

### Option 3 — No queue: external cron + DB polling endpoints

Generalize the `/api/client-reports/schedules/run` pattern: a host cron curls endpoints that scan the
DB for due work (`Post.scheduledAt <= now`).

- Good: no Redis dependency for correctness; conceptually simple.
- Bad: minute-level granularity; HTTP request timeouts bound batch size; no per-job retry/backoff
  state, no concurrency control, no rate limiting; secret-in-header auth for internal work (already
  shipped with a `'default-cron-secret'` fallback); discards the entire existing BullMQ investment.
  Rejected.

### Option 4 — Replace BullMQ with a Postgres-backed queue (pg-boss)

Drop Redis as a runtime dependency; use Postgres for job state.

- Good: one fewer stateful service; transactional enqueue with the business write.
- Bad: rewrites all existing queue code for a throughput profile we don't have a problem with; Redis
  stays in the stack anyway (cache-manager, rate limiting); loses BullMQ's mature repeatable-job,
  rate-limiter, and delayed-job semantics. Rejected — not worth the churn now; revisit only if Redis
  becomes operationally burdensome.

## Decision Outcome

**Chosen option: Option 1 — a dedicated worker container with explicit bootstrapping**, replacing the
`NODE_ENV`/`INIT_JOBS` module self-init entirely. Specifics:

1. **Worker entrypoint** `src/worker.ts`: explicitly configures the queue manager, registers
   processors, creates workers, syncs repeatable jobs, exposes liveness, and installs SIGTERM/SIGINT
   handlers that call `queueManager.shutdown()` (which already closes workers → queue events → queues
   → Redis in the right order). Delete the self-init block at the bottom of `job-scheduler.ts`.
   `INIT_JOBS` may remain only as a *dev* convenience to start in-process workers under
   `npm run dev`; it must never be the production path.

2. **Queue-manager repair** (prerequisite for anything else):
   - Pass BullMQ *connection options* (parsed from `REDIS_URL`, falling back to
     `REDIS_HOST`/`REDIS_PORT`) instead of one shared ioredis instance, with
     `maxRetriesPerRequest: null`, so Queue/Worker/QueueEvents each get correct connections.
   - Re-key the processor registry by `(queueName, jobName)` and dispatch on `job.name` in the worker
     wrapper, fixing the silent overwrite of `postSchedulingProcessor` by
     `bulkPostSchedulingProcessor`.
   - Fix the `TS2393` duplicate `scheduleAnalyticsCollection` in `job-scheduler.ts`.
   - Do not create a `media-processing` worker until a processor exists (reserved for ADR-0007).

3. **Enqueue from the API.** `/api/posts` POST and `/api/posts/[id]` PUT enqueue to the
   `post-scheduling` queue: `PUBLISHED` → immediate job; `SCHEDULED` → delayed job
   (`delay = scheduledAt - now`). Deterministic idempotency key `jobId = publish:{postId}`; reschedule
   = remove by jobId + re-add; delete/unschedule removes the job. Enqueue happens *after* the DB
   transaction commits; if enqueue fails, the API returns an error and the post stays `APPROVED`/
   `DRAFT` rather than lying with `SCHEDULED`.

4. **DB-backed account resolution.** The publish processor loads the `Post` with its `PostVariant`s
   and each variant's `SocialAccount` from Prisma, and decrypts `accessToken`/`refreshToken` using the
   remediated crypto module from ADR-0006 (the current `src/lib/encryption.ts` is broken —
   `crypto.createCipher` with `aes-256-gcm` — and `SocialAccount` tokens are today stored plaintext
   despite `// Encrypted` schema comments; ADR-0006 owns that migration). Providers are invoked with
   an account object hydrated from the DB row; the `SocialMediaManager` in-memory `accounts` Map is no
   longer on the publish path (it may remain as a per-request cache inside OAuth flows). Token expiry
   (`tokenExpiry`) is checked before publishing; expired tokens trigger provider refresh where
   implemented (ADR-0009) or fail the variant with a clear `failureReason` and set
   `SocialAccount.status = 'TOKEN_EXPIRED'`.

5. **Processor rewrite with real result handling.** The processor iterates variants, calls the
   provider, and *checks `APIResponse.success`*: on success write
   `PostVariant.status = 'PUBLISHED'`, `providerPostId = result.data.id`, `publishedAt`; on failure
   write `status = 'FAILED'` + `failureReason`. Post-level status: all variants published →
   `PUBLISHED` (+ `publishedAt`); all failed → `FAILED`; mixed → `PUBLISHED` with per-variant detail
   surfaced in the UI (the schema's `PostStatus` already includes `FAILED`). Notifications
   (`notification-dispatch` queue) fire from actual outcomes, not fabricated ones.

6. **Idempotency and retry/backoff policy.** Two layers:
   - *Queue layer*: deterministic `jobId`s (above) prevent duplicate enqueues; publishing jobs get
     `attempts: 5`, exponential backoff starting at 30s.
   - *Processor layer*: on retry, variants already `PUBLISHED` (or with a `providerPostId`) are
     skipped — only `PENDING`/`FAILED` variants are attempted, so a partial failure never double-posts
     the succeeded platforms. Errors are classified: 401/403 → fail fast (no retry; mark account),
     429/5xx/network → retry with backoff, honoring `Retry-After` when present.

7. **Repeatable jobs replace the external-cron endpoint.** Client-report schedules
   (`ClientReportSchedule`) become BullMQ repeatable jobs via the v5 Job Schedulers API
   (`upsertJobScheduler`), synced from the DB on worker boot and on schedule CRUD (create/update/
   delete/pause). The report processor replaces the `Math.random()` mock metrics with real
   `AnalyticsMetric` aggregation (shared with ADR-0020). `/api/client-reports/schedules/run` is kept
   temporarily as a manual "Run now" trigger only, with the `'default-cron-secret'` fallback removed
   (require `CRON_SECRET`; ADR-0005). The job-scheduler's built-in hourly/daily/weekly
   `analytics-collection` repeatables stay *disabled* until real provider analytics exist (ADR-0009) —
   scheduling them today would only burn retries against stub providers.

8. **Honest monitoring.** `/api/jobs/stats|health|details` construct lightweight `Queue` handles for
   the known queue names directly against Redis in the web process (Queue handles are clients, not
   workers — safe there), so counts reflect actual Redis state instead of an empty in-process Map.
   Delete `mockJobs` and the `Math.random()` throughput/duration figures; derive them from BullMQ
   metrics/completed-job timestamps or omit them until ADR-0023 lands real collection. The worker
   exposes a minimal liveness endpoint (or Redis heartbeat key) used by the compose healthcheck.

Why Option 1: it is the only option that matches the owner's self-hosted-Docker decision, preserves
the existing (repairable) BullMQ investment, isolates the web tier from third-party API latency, and
replaces the failure mode that got us here — implicit init nobody could observe — with an explicit,
independently deployable, independently monitorable process.

## Consequences

### Positive

- Scheduled and immediate publishing actually happens, survives restarts, and records truthful
  per-platform outcomes in `PostVariant`.
- Publishing state becomes queryable and observable: real queue depths, real failures, real retries.
- The web tier never blocks on social-platform APIs; worker capacity scales independently
  (`concurrency` per queue already modeled in `queue-manager.ts`).
- One image, two commands: no divergence between app and worker builds.
- Client-report scheduling stops depending on an unconfigured external cron and a default secret.
- Clear seams for ADR-0009 (providers), ADR-0010 (notification dispatch), ADR-0020 (report
  generation), and ADR-0007 (future `media-processing` queue).

### Negative

- One more always-on container (memory/CPU, logs, monitoring) and a Docker build step for the worker
  bundle.
- Redis becomes availability-critical for publishing (today it is only cache): enqueue failures must
  be surfaced to users, and Redis persistence (AOF) must be enabled in prod compose.
- Enqueue-after-commit is not transactional: a crash between commit and enqueue can leave a
  `SCHEDULED` post with no job. Mitigated by a low-frequency reconciliation sweep (see Risks).
- Until ADR-0009 completes real providers (media upload stubs, PKCE stub, missing `refreshToken`),
  end-to-end publishing works only for the provider/feature combinations that are genuinely
  implemented; the pipeline must fail those variants honestly rather than pretend success.
- Demo-seeded accounts carry fake tokens (`'encrypted-token-NNN'` from `prisma/seed.ts`); publish jobs
  against them will fail by design — demo behavior needs explicit gating (ADR-0025).

## Implementation Plan

Phase 0 depends on ADR-0002 (schema must pass `prisma validate` / client must regenerate) and the
crypto module from ADR-0006.

**Phase 1 — Repair queue infrastructure (S)**
1. `src/lib/jobs/queue-manager.ts`: accept `REDIS_URL` (parse) or host/port; use BullMQ connection
   *options* with `maxRetriesPerRequest: null`; re-key `processors` by `(queueName, jobName)` and
   dispatch on `job.name`. (S)
2. `src/lib/jobs/job-scheduler.ts`: rename the public `scheduleAnalyticsCollection(data)` (fix
   TS2393); delete the module-level self-init (lines 460–464); drop worker creation for
   `media-processing`. (S)
3. `docker-compose.yml`: align Redis env (`REDIS_URL` consumed by queue-manager). (S)

**Phase 2 — Worker entrypoint and Docker wiring (M)**
4. Add `src/worker.ts`: explicit bootstrap (register processors by job name, create workers, sync
   repeatable jobs from DB, liveness, SIGTERM/SIGINT → `shutdown()`). (M)
5. Add `npm run build:worker` (esbuild bundle → `dist/worker.js`, externalizing `@prisma/client`) and
   `npm run worker` (dev: `tsx src/worker.ts`). Extend `Dockerfile.prod` builder stage to produce and
   copy `dist/worker.js`. (M)
6. `docker-compose.prod.yml` + dev compose: add `worker` service from the app image with
   `command: ["node", "dist/worker.js"]`, same env, `depends_on: [postgres, redis]`, healthcheck;
   enable Redis AOF in prod. Mirror as a k8s Deployment later (ADR-0022). (S)

**Phase 3 — Publishing pipeline (L)**
7. Rewrite `src/lib/jobs/processors/post-scheduling.ts`: load Post/variants/accounts via Prisma;
   decrypt tokens (ADR-0006); check `APIResponse.success`; persist per-variant
   `status`/`providerPostId`/`publishedAt`/`failureReason`; roll up `Post.status`; per-variant
   idempotent retries; error classification (fail-fast auth vs backoff transient). (L)
8. `src/app/api/posts/route.ts` + `src/app/api/posts/[id]/route.ts`: enqueue/reschedule/remove jobs
   with `jobId = publish:{postId}` on PUBLISHED/SCHEDULED transitions; fail the request if enqueue
   fails. (M)
9. Add a `reconcile-scheduled-posts` repeatable job (every 5 min): enqueue any `SCHEDULED` post past
   due with no live job (crash-window recovery). (S)
10. Route `/api/social/post` bulk publishing through the same queue/processor path instead of
    `socialMediaManager.bulkPost` with in-memory accounts. (M)

**Phase 4 — Repeatable schedules migration (M)**
11. Worker boot + `/api/client-reports/schedules` CRUD: `upsertJobScheduler`/remove per
    `ClientReportSchedule`; new `client-reports` queue + processor generating reports from real
    `AnalyticsMetric` data (shared with ADR-0020). (M)
12. `/api/client-reports/schedules/run`: reduce to manual trigger; require `CRON_SECRET` with no
    default (ADR-0005). (S)

**Phase 5 — Honest monitoring (S)**
13. `/api/jobs/stats|health|details`: read real queue state via named Queue handles; delete
    `mockJobs` and `Math.random()` metrics (ADR-0023, ADR-0024). Add worker liveness to
    `/api/health`. (S)

## Risks and Mitigations

- **Redis outage → publishing halts.** Mitigate: Redis AOF persistence + restart policy in compose;
  enqueue failures return errors to users (no silent `SCHEDULED` lies); reconciliation job (step 9)
  re-enqueues after recovery; `/api/health` reports Redis and worker liveness.
- **Double-posting on retry.** Mitigate: deterministic `jobId`s; processor skips variants that are
  `PUBLISHED` or carry a `providerPostId`; fail-fast classification for non-retryable errors.
- **Crash between DB commit and enqueue.** Mitigate: reconciliation sweep; keep the window small by
  enqueueing immediately after the transaction. (A transactional outbox is deliberately deferred —
  overkill at current scale; revisit if reconciliation proves noisy.)
- **Schedule drift between `ClientReportSchedule` rows and Redis repeatables.** Mitigate: full resync
  on worker boot; CRUD handlers upsert/remove synchronously; scheduler IDs derived from row IDs.
- **Worker runs stale code vs. web (single image, two services).** Mitigate: deploy both services from
  the same tag together (ADR-0022 pipeline).
- **Provider stubs produce misleading failures** (mock media IDs, missing `refreshToken`, PKCE stub).
  Mitigate: pipeline records exact `failureReason` per variant; provider completion tracked in
  ADR-0009; demo/fake-token accounts gated per ADR-0025 so they never reach real enqueue paths.
- **Prisma in the bundled worker.** Mitigate: externalize `@prisma/client` in the esbuild config and
  copy `node_modules/.prisma` (already done in `Dockerfile.prod` line 66); CI smoke-starts the worker
  (ADR-0021).

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — schema must validate before the
  worker can generate a client; `PostVariant` state fields are the pipeline's source of truth.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — enqueueing route changes follow
  these conventions.
- ADR-0005: API Security Hardening — removal of the `'default-cron-secret'` fallback; internal
  trigger auth.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — the worker's token decryption
  path; `SocialAccount` token encryption migration.
- ADR-0007: Media Storage, Uploads, and Serving Architecture — future consumer of the reserved
  `media-processing` queue.
- ADR-0009: Social Platform Integration Completion Strategy — provider correctness (media upload,
  PKCE, `refreshToken`) that publishing depends on.
- ADR-0010: Realtime Transport and Notification Delivery — `notification-dispatch` queue is the
  delivery backbone.
- ADR-0020: Client Portal and Shareable Reports — real report generation shares the `client-reports`
  processor.
- ADR-0021: Testing Strategy and Honest Quality Gates — worker smoke tests and processor unit tests.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — the worker service ships through this
  pipeline; k8s worker Deployment later.
- ADR-0023: Observability: Real Metrics, Logging, and Health — real `/api/jobs/*` metrics and worker
  health.
- ADR-0024: Codebase Hygiene — deletion of `mockJobs`, `Math.random()` health figures, and dead
  self-init code.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — seeded fake-token accounts must not reach the
  real publish path.
