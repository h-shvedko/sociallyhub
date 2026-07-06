# ADR-0010: Realtime Transport and Notification Delivery

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-06** (live browser web-push + nginx SSE tuning deferred). *Promoted from Proposed on implementation + merge; the SSE-over-Redis Option 1 decision was executed and shipped.*
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-06).** Delivered all four phases: **SSE transport** over Redis
> pub/sub (`GET /api/notifications/stream` + `src/lib/notifications/realtime.ts` `publishToUser`),
> replacing the dead socket.io client; **persist-first `notifyUser`** (`src/lib/notifications/notify.ts`)
> — create the `Notification` row, then Redis nudge for SSE, then a best-effort dispatch job, so in-app
> works even if the worker is down; **DB-backed API** — `/api/notifications` (+ read/archive/read-all)
> rewritten on the real model (mock array + in-memory preferences route deleted); **fixed dispatch
> worker** (nonexistent `storeNotification()` → `publishToUser` + `deliveredAt`, real recipient email,
> DB `NotificationPreferences` gating, SMS cut); **web-push** — migration `0010` adds
> `NotificationType` values + a `PushSubscription` model, `/api/notifications/push-subscription`
> persists it, `push-service` loads from Prisma with VAPID + 410-pruning, `public/sw.js` service
> worker; **UI** — header bell mounts NotificationCenter with a real unread badge, `use-notifications`
> uses `EventSource` + poll fallback; **producers** wired (post-scheduling, inbox assignment, team
> invite, report completion); **cleanup** — `websocket-manager.ts` + `sms-service.ts` deleted,
> `fastify`/`@fastify/cors`/`socket.io-client` deps removed, `SMTP_PASS` → `SMTP_PASSWORD` in the four
> mailer routes. **Verified live:** an open SSE stream RECEIVED a `notifyUser` event in real time while
> the `Notification` row was persisted first; the API returns real rows with unread stats;
> push-subscription POST/DELETE persists/removes rows; worker builds + boots; migration additive;
> `prisma validate` green. **Deferred:** real browser web-push delivery (needs a live browser
> subscription — DB persistence + VAPID + pruning are done) and nginx SSE keepalive tuning (ADR-0022).

## Context and Problem Statement

SociallyHub has an elaborate notification codebase in which almost nothing is actually wired
end-to-end. Verified state as of 2026-07-02:

- **The realtime transport has no server.** `src/lib/notifications/websocket-manager.ts` is a
  socket.io **client** (`import { io, Socket } from 'socket.io-client'`) that connects to
  `process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3099'`. No socket.io server exists anywhere
  in the repo — `package.json` declares only `socket.io-client@^4.8.1`. Port 3099 is the Next.js
  app itself, which does not speak socket.io. Realtime can never connect.
- **`fastify@^5.5.0` and `@fastify/cors@^11.1.0` are dead dependencies** — zero imports under
  `src/` — apparently reserved for a standalone WS server that was never built.
- **`/api/notifications` ignores the database.** `src/app/api/notifications/route.ts` filters a
  hardcoded `mockNotifications` array (5 entries with fixed `userId: 'user1'`, so real users see
  nothing) even though a real `Notification` Prisma model exists
  (`prisma/schema.prisma`, `model Notification` at line 776: `id`, `userId`, `type
  NotificationType`, `title`, `message`, `data Json?`, `status NotificationStatus @default(UNREAD)`,
  `deliveredAt`, `readAt`, `createdAt`, mapped to `notifications`). The route exports **only GET**;
  mutations live in `/api/notifications/[id]/read`, `/[id]/archive`, `/read-all`, all against the
  same mock data. `/api/notifications/preferences` uses an in-memory
  `const mockPreferences = new Map(...)` (line 36) while the DB-backed `NotificationPreferences`
  model (schema line 2492) is served by a *different* endpoint, `/api/user/notification-preferences`.
- **The UI is decorative.** `src/components/notifications/notification-center.tsx` and
  `src/hooks/use-notifications.ts` are imported only by the dead `src/lib/lazy-components.ts`
  and are mounted nowhere. The header bell in `src/components/layout/header.tsx` (line 96) is a
  `<Button>` with no `onClick` and a hardcoded badge of `3`.
- **The dispatch worker exists but is broken and never runs.** ADR-0008 covers starting the BullMQ
  workers; independently of that, `src/lib/jobs/processors/notification-dispatch.ts` has channel
  fan-out (in_app/email/push/sms/webhook, quiet-hours handling, per-channel results) with real
  defects: the `in_app` branch calls `notificationManager.storeNotification(notification)` — a
  method that **does not exist** on `NotificationManager` (its methods are `send`, `sendBulk`,
  `sendToChannel`, `sendInApp`, ...), so in-app dispatch would throw even with workers running;
  the email branch sends `to: [notification.userId]` (a user ID, not an email address); and
  `NotificationManager.sendInApp` only emits to a websocket that can never connect, with
  `// TODO: Store in database for offline users`. Additionally, `src/lib/jobs/job-scheduler.ts`
  lines 26–27 register `notificationDispatchProcessor` and `bulkNotificationDispatchProcessor`
  under the **same** queue key `'notification-dispatch'`; `registerProcessor` is a `Map.set`, so
  the bulk processor silently replaces the single-dispatch one.
- **Channel services are stubs or misconfigured.** `src/lib/notifications/sms-service.ts` defaults
  to `provider: 'mock'` and the Twilio SDK is not in `package.json` (a real `twilio` init would
  throw). `src/lib/notifications/push-service.ts` uses the installed `web-push@^3.6.7` but warns
  and no-ops without `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, and keeps subscriptions in an
  **in-memory Map** — there is no `PushSubscription` Prisma model, so subscriptions cannot survive
  a restart. `src/lib/notifications/email-service.ts` correctly reads `SMTP_PASSWORD` (matching
  `docker-compose.yml` and `.env.example`), but four ad-hoc mailer routes
  (`/api/invoices/send-email`, `/api/clients/[id]/messages`, `/api/client-reports/[id]/send`,
  `/api/client-reports/schedules/run`) read `SMTP_PASS`, which is never set.

The question this ADR answers: **what realtime transport do we standardize on, how do
notifications get persisted and delivered per channel, and which domain events produce them?**

## Decision Drivers

- **Deployment model (binding decision #1):** self-hosted Docker behind nginx
  (docker-compose now, k8s optional later; ADR-0022). No Vercel constraints, but also no appetite
  for extra always-on services beyond app + worker + postgres + redis + nginx.
- Redis is already in the stack (`ioredis` used by `src/lib/cache/cache-manager.ts` and
  `src/lib/jobs/queue-manager.ts`), and ADR-0008 establishes a worker process where dispatch runs
  in a different process than the Next.js server — cross-process fan-out is mandatory.
- ADR-0011 (support tickets/chat) and ADR-0019 (Stripe billing) need a working in-app
  notification path *now*; they should publish events, not invent their own transports.
- The `Notification` model, `NotificationType` enum (`APPROVAL_*`, `PUBLISH_SUCCESS`,
  `PUBLISH_FAILED`, `TOKEN_EXPIRING`, `TOKEN_EXPIRED`, `INBOX_ASSIGNMENT`, `SLA_BREACH`,
  `REPORT_READY` — schema line 931) and `NotificationPreferences` model already exist; we should
  build on them, not around them (ADR-0002 migration-first for any changes).
- Honesty over surface area: a small set of channels that verifiably deliver beats five channels
  of which three are mocks (CLAUDE.md's "zero mock data" claim must become true here).
- `use-notifications.ts` already implements 30-second polling as a fallback; realtime is a latency
  upgrade, not a correctness requirement.

## Considered Options

### Option 1 — Server-Sent Events (SSE) from a Next.js route, backed by Redis pub/sub

A `GET /api/notifications/stream` route handler (Node runtime) holds the HTTP response open and
relays messages from a Redis subscription on `notify:user:{userId}`. Any process (Next.js route
or BullMQ worker) publishes to that channel after persisting a `Notification` row.

- Good: no new server process, no new dependency (`ioredis` already present); works through nginx
  with `proxy_buffering off`; browser-native `EventSource` with automatic reconnection replaces
  ~400 lines of hand-rolled socket reconnect logic; auth reuses the normal NextAuth session cookie
  on the same origin (ADR-0003/0005 conventions apply unchanged).
- Good: one-directional server→client push is *all this feature needs* — every client→server
  action (mark read, archive) is already a REST call.
- Bad: one held connection per open tab consumes a Node connection each; needs heartbeat comments
  to defeat idle proxy timeouts; HTTP/1.1 browsers cap ~6 connections per origin (mitigated by
  HTTP/2 at nginx, and by the polling fallback).
- Bad: no bidirectional channel — if a future feature needs client→server streaming (e.g. live
  cursors), this transport doesn't cover it.

### Option 2 — Standalone socket.io server (repurposing the fastify dependencies)

Build the server that `websocket-manager.ts` always assumed: a fastify (or bare Node) process
running `socket.io`, deployed as another compose service, with Redis adapter for fan-out.

- Good: matches existing client code; bidirectional; rooms/namespaces for workspace channels.
- Bad: a whole new always-on service to build, secure (its own auth handshake — session cookies
  don't flow to a second origin without care), deploy, monitor, and keep in lockstep with the app;
  requires adding `socket.io` + `@socket.io/redis-adapter`; nginx WebSocket upgrade config.
  All of that for a feature whose only current requirement is "push a JSON blob to a user's open
  tabs". The existing client code is not an asset worth preserving — it's untested code that has
  never once connected.

### Option 3 — Polling only (no push transport)

Keep `use-notifications.ts`'s 30s poll against a rewritten DB-backed `/api/notifications`.

- Good: smallest possible change; zero infrastructure.
- Bad: 30s worst-case latency undermines support chat (ADR-0011) and publish-failure alerts;
  polling every session every 30s is *more* aggregate load than idle SSE connections; we would
  still need a push story later and would pay the migration twice.

### Option 4 — Hosted realtime (Pusher/Ably)

- Good: zero transport code, excellent reliability.
- Bad: contradicts the self-hosted standardization (binding decision #1), adds a paid external
  dependency and data egress for a need Redis pub/sub covers; per-message pricing scales badly
  with notification volume.

## Decision Outcome

**Chosen: Option 1 — SSE from a Next.js route backed by Redis pub/sub — plus a strict
"persist-first" delivery pipeline.** Socket.io (Option 2) is explicitly recorded as the upgrade
path *if and when* a bidirectional requirement materializes; nothing in the chosen design blocks
it, because all producers publish through one function (`publishToUser`) whose transport can be
swapped.

Concretely:

1. **Transport:** `GET /api/notifications/stream` (SSE, Node runtime) subscribing to Redis channel
   `notify:user:{userId}`. Heartbeat comment every 25s. The existing 30s poll in
   `use-notifications.ts` remains as fallback; `EventSource` replaces `websocket-manager.ts`.
2. **Persist-first rule:** every notification is a `Notification` row *before* any channel
   delivery. Redis pub/sub is a cache-invalidation-style nudge ("you have new data"), never the
   source of truth — a missed SSE message costs latency, not data.
3. **API truth:** `/api/notifications` (+ `[id]/read`, `[id]/archive`, `read-all`) is rewritten on
   the `Notification` model. `/api/notifications/preferences` is deleted; the DB-backed
   `/api/user/notification-preferences` (ADR-0017) is the single preferences endpoint.
4. **UI:** `NotificationCenter` is mounted from the header bell; badge count comes from the API.
5. **Channels for v1:** in-app (DB + SSE), email via the existing nodemailer `email-service.ts`
   (canonical env var: `SMTP_PASSWORD`; the four `SMTP_PASS` readers are fixed), and web-push with
   generated VAPID keys plus a new `PushSubscription` model. **SMS is cut** — `sms-service.ts` is
   deleted along with its mock provider; Twilio was never installed and no product requirement
   exists. The webhook channel is deferred (workspace webhook URL config does not exist yet;
   revisit with ADR-0016). `fastify`, `@fastify/cors`, and `socket.io-client` are removed from
   `package.json` (ADR-0024).
6. **Dispatch:** channel fan-out runs in the `notification-dispatch` BullMQ queue inside the
   ADR-0008 worker. Producers call a thin `notifyUser()` helper that (a) creates the
   `Notification` row, (b) publishes to Redis for SSE, (c) enqueues a dispatch job for
   email/web-push filtered by `NotificationPreferences`. In-app delivery therefore works even if
   the worker is down.

### Domain events that produce notifications

| Event (producer) | `NotificationType` | Channels (default) |
|---|---|---|
| Post published / publish failed (`post-scheduling` processor, ADR-0008) | `PUBLISH_SUCCESS` / `PUBLISH_FAILED` | in-app; + email/push for `PUBLISH_FAILED` |
| Social token expiring / expired (token-health job, ADR-0009) | `TOKEN_EXPIRING` / `TOKEN_EXPIRED` | in-app + email |
| Inbox item assigned (`PUT /api/inbox/[id]`) | `INBOX_ASSIGNMENT` | in-app + push |
| Inbox SLA breached (scheduled check, ADR-0008) | `SLA_BREACH` | in-app + email + push |
| Client report generated (`/api/client-reports/schedules/run`, report completion) | `REPORT_READY` | in-app + email |
| Approval requested/granted/denied (approval workflow, when mounted) | `APPROVAL_REQUESTED` / `APPROVAL_GRANTED` / `APPROVAL_DENIED` | in-app + email |
| Support ticket reply / status change (ADR-0011) | `SUPPORT_TICKET_UPDATED` *(new enum value)* | in-app + email + push |
| Team invitation created (`POST /api/team/invite`) | `TEAM_INVITATION` *(new enum value)* | in-app (email already sent by the route) |
| Stripe payment failed / subscription state change (ADR-0019 webhooks) | `BILLING_ALERT` *(new enum value)* | in-app + email |

The three new enum values are added via a real migration per ADR-0002 (which also unblocks
`prisma migrate` overall). Anything not in this table does not create notifications in v1.

## Consequences

### Positive

- Realtime actually works, on the existing stack, behind the existing nginx, with zero new
  services or dependencies — and degrades gracefully to the already-written polling path.
- The `Notification` model becomes the single source of truth; the header bell, the notification
  center, unread counts, and email/push all derive from the same rows. Mock arrays and the
  duplicate preferences endpoint are deleted.
- ADR-0011 (support), ADR-0019 (billing), ADR-0008/0009 (publishing, token health) get one
  documented producer API (`notifyUser`) instead of each inventing delivery.
- ~1,000+ lines of dead/unreachable code removed (`websocket-manager.ts`, `sms-service.ts`,
  fastify deps, mock routes), shrinking the audit surface (ADR-0024).
- Web-push subscriptions survive restarts once persisted; VAPID keys make push real.

### Negative

- SSE holds one server connection per open dashboard tab; at meaningful scale the stream route's
  process needs monitoring (connection-count gauge — ADR-0023) and nginx keepalive tuning.
- One-directional transport: a future bidirectional feature (collaborative editing, typing
  indicators for support chat) forces the socket.io upgrade path we deferred. Accepted: the
  producer API isolates that change to transport internals.
- Deleting SMS closes a channel some enterprise buyers ask for; re-adding it later requires a real
  Twilio integration and a phone-number field strategy, not just reinstating the mock.
- Until the ADR-0008 worker is deployed, email/web-push fan-out does not run (in-app still works
  via the persist-first path). This coupling is deliberate.

## Implementation Plan

### Phase 1 — Make the API and UI honest (in-app only, no new transport)

1. **(M)** Rewrite `src/app/api/notifications/route.ts` on Prisma: `GET` lists the caller's
   `Notification` rows with `status`/`type`/date filters + pagination + unread stats (auth via
   ADR-0003 helpers). Delete `mockNotifications`. Rewrite `[id]/read`, `[id]/archive`
   (`status: DISMISSED`), `read-all` as `updateMany` on the model.
2. **(S)** Delete `src/app/api/notifications/preferences/route.ts` (in-memory `mockPreferences`
   Map); point all clients at `/api/user/notification-preferences` (ADR-0017 owns its UI).
3. **(S)** Add `src/lib/notifications/notify.ts` exporting `notifyUser(userId, { type, title,
   message, data })`: `prisma.notification.create` now; Redis publish + job enqueue added in
   Phases 2–3. This is the only API producers may use.
4. **(M)** Mount the UI: make the header bell (`src/components/layout/header.tsx`) a popover
   hosting `NotificationCenter`; drive the badge from `use-notifications.ts` (real unread count,
   remove the hardcoded `3`). Strip `websocketManager` usage from the hook, keep polling.
5. **(S)** First producer as proof: `POST /api/team/invite` calls `notifyUser` with
   `TEAM_INVITATION` (after the Phase 3 enum migration lands, use `data.kind` until then or
   sequence this after step 8).

### Phase 2 — SSE transport

6. **(M)** Add `src/app/api/notifications/stream/route.ts`: Node runtime, session-authenticated,
   `ReadableStream` SSE response; dedicated `ioredis` subscriber (a subscribing connection cannot
   be shared with commands) on `notify:user:{userId}`; 25s `: ping` heartbeat; cleanup on
   `request.signal` abort. Set `Cache-Control: no-store` — and per ADR-0005, ensure the blanket
   `Cache-Control: public, s-maxage=60` header on `/api/*` in `next.config.js` is removed before
   this ships.
7. **(S)** Add `publishToUser` in `src/lib/notifications/realtime.ts` (shared publisher on the
   existing Redis connection factory); call it from `notifyUser`. Replace polling-only mode in
   `use-notifications.ts` with `EventSource` + poll fallback; delete
   `src/lib/notifications/websocket-manager.ts`.
8. **(S)** nginx (ADR-0022 compose): `proxy_buffering off`, `proxy_read_timeout 1h` for
   `/api/notifications/stream`; confirm HTTP/2 termination so per-origin connection caps don't
   bite.

### Phase 3 — Dispatch worker fan-out (depends on ADR-0008 worker entrypoint)

9. **(S)** Migration (ADR-0002): extend `NotificationType` with `SUPPORT_TICKET_UPDATED`,
   `TEAM_INVITATION`, `BILLING_ALERT`; add `PushSubscription` model (`id`, `userId`, `endpoint
   @unique`, `p256dh`, `auth`, `userAgent`, `createdAt`, `lastUsedAt`).
10. **(M)** Fix `src/lib/jobs/processors/notification-dispatch.ts`: replace the nonexistent
    `notificationManager.storeNotification()` call (persistence already happened in `notifyUser`;
    the in_app branch becomes `publishToUser` + `deliveredAt` update); resolve real recipient
    email via `prisma.user.findUnique` instead of `to: [notification.userId]`; read channel
    gating from the DB `NotificationPreferences` (`emailEnabled`, `pushEnabled`, `preferences`
    JSON, DND fields) instead of the in-memory types. Delete the `sms` case.
11. **(S)** Fix `src/lib/jobs/job-scheduler.ts` lines 26–27: the bulk processor currently
    overwrites the single one under the same `'notification-dispatch'` key — route by
    `job.data.type` inside one processor (or use named BullMQ job processors).
12. **(S)** Fix SMTP env var: change `SMTP_PASS` → `SMTP_PASSWORD` in
    `src/app/api/invoices/send-email/route.ts`, `src/app/api/clients/[id]/messages/route.ts`,
    `src/app/api/client-reports/[id]/send/route.ts`,
    `src/app/api/client-reports/schedules/run/route.ts` (compose and `.env.example` already
    define `SMTP_PASSWORD`); longer-term these routes should call `email-service.ts`.
13. **(M)** Wire producers: `post-scheduling` processor → `PUBLISH_SUCCESS`/`PUBLISH_FAILED`;
    inbox assignment route → `INBOX_ASSIGNMENT`; SLA check job → `SLA_BREACH`; report completion →
    `REPORT_READY`; ADR-0009 token-health job → `TOKEN_EXPIRING`/`TOKEN_EXPIRED`; ADR-0011 and
    ADR-0019 hook in at their own pace via `notifyUser`.

### Phase 4 — Web push

14. **(S)** Generate VAPID keys (`npx web-push generate-vapid-keys`); add `VAPID_PUBLIC_KEY`,
    `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` to `.env.example` and compose secrets (ADR-0006 handling).
15. **(M)** Persist subscriptions: `POST/DELETE /api/notifications/push-subscription` writing the
    `PushSubscription` model; rework `push-service.ts` to load subscriptions from Prisma instead
    of its in-memory `Map`, pruning rows on `410 Gone`.
16. **(M)** Add `public/sw.js` service worker (`push` + `notificationclick` → `actionUrl`) and a
    subscribe toggle in the notification-preferences UI (ADR-0017).

### Cleanup (with Phase 2)

17. **(S)** Remove `fastify`, `@fastify/cors`, `socket.io-client` from `package.json`; delete
    `src/lib/notifications/sms-service.ts` and SMS types; drop `NEXT_PUBLIC_WS_URL` from env
    files (ADR-0024 tracks the sweep).

## Risks and Mitigations

- **SSE connections exhausted or silently dropped by proxies.** Mitigate: heartbeats, nginx
  timeouts per step 8, `EventSource` auto-reconnect with `Last-Event-ID` unnecessary because the
  poll + DB is the source of truth; expose an active-connection gauge (ADR-0023).
- **Worker not deployed → users think email/push are configured but silent.** Mitigate:
  persist-first keeps in-app correct regardless; `/api/health` (ADR-0023) reports queue liveness;
  admin settings (ADR-0016) should surface channel status honestly instead of simulating it.
- **Redis restart drops in-flight pub/sub messages.** Accepted by design: clients reconcile from
  the DB on reconnect/poll; no notification is lost, only its push latency.
- **Notification storms (e.g. bulk publish failures) spam email/push.** Mitigate: per-type
  throttling in the dispatch processor (the manager already sketches this at
  `notification-manager.ts` line 415) and digest preferences from `NotificationPreferences`.
- **Enum migration ordering.** New `NotificationType` values require the ADR-0002 schema
  remediation to land first (schema currently fails `prisma validate`); Phase 1 can ship with
  existing enum values only.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — prerequisite for the
  `PushSubscription` model and `NotificationType` enum extension.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — the rewritten notification
  routes and the SSE stream use these helpers.
- ADR-0005: API Security Hardening — removal of the blanket public `Cache-Control` on `/api/*`
  is a hard prerequisite for shipping the SSE stream.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — VAPID/SMTP secret handling.
- ADR-0008: Background Jobs and the Publishing Pipeline — hosts the `notification-dispatch`
  worker; its `post-scheduling` processor is the first high-value producer.
- ADR-0009: Social Platform Integration Completion Strategy — produces `TOKEN_EXPIRING` /
  `TOKEN_EXPIRED` events.
- ADR-0011: Support Subsystem Remediation — consumes `notifyUser` for ticket/chat updates; its
  chat realtime rides the same SSE channel in v1.
- ADR-0016: System Settings & Configuration — honest channel-status reporting; future workspace
  webhook configuration would un-defer the webhook channel.
- ADR-0017: User Settings, Personalization, and i18n Scope — owns the
  `/api/user/notification-preferences` endpoint and preferences UI this ADR standardizes on.
- ADR-0019: Billing and Subscriptions with Stripe — produces `BILLING_ALERT` events from webhooks.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — nginx SSE configuration.
- ADR-0023: Observability — delivery metrics, SSE connection gauge, queue liveness in health.
- ADR-0024: Codebase Hygiene — removal of fastify/socket.io-client/sms-service/websocket-manager.
