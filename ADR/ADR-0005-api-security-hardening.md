# ADR-0005: API Security Hardening

- **Date:** 2026-07-02
- **Status:** Accepted — **Implemented 2026-07-04** (core surfaces; full 299-route wrapper migration incremental)
- **Deciders:** Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-04).** Delivered: `withApiAuth` wrapper
> (`src/lib/api/with-api-auth.ts`, access = public|session|platformAdmin|workspaceRole|cron,
> default `no-store`, Redis rate limiting); ioredis sliding-window limiter replacing the broken
> `ratelimiter` dep (`src/lib/utils/rate-limit.ts`); edge middleware (`src/middleware.ts`:
> request-id, noindex, `no-store`, coarse per-IP throttle); the blanket `/api/*` public cache
> header removed from `next.config.js`; `/api/debug/session` deleted; HMAC-signed session-bound
> OAuth state (`src/lib/security/oauth-state.ts`, verified in the connect callback; interim key
> from `OAUTH_STATE_SECRET`||`NEXTAUTH_SECRET`, formal keys per ADR-0006); `EngagementEvent` model
> + migration `0005` for counter dedup; `scripts/check-route-auth.ts` CI coverage check (warn mode).
> Remediation-table endpoints closed: support tickets (anon `where={id}` fallthrough → session-gated
> + workspace-scoped; guest tokens deferred to ADR-0011, attachment relocation to ADR-0007), all 13
> help/documentation/video write handlers (`platformAdmin`), and the four counter endpoints (dedup +
> rate limit). ADR-0004 had already closed global-settings and `feature-flags/evaluate`. Verified by
> unit suites + an authenticated exploit-closure matrix (anon ticket→401, anon writes→401,
> `/api/*`→no-store, dedup+limit fire, debug/session→404, forged state→400). **Not done:** wrapping
> all 299 routes (CI check runs in *warn* mode, publishing the uncovered count) and proxy-level
> limits (ADR-0022).

## Context and Problem Statement

The 2026-07-02 audit found that a significant fraction of SociallyHub's ~299 API route files enforce no authentication, enforce it inconsistently, or leak protected data through infrastructure configuration. These are not theoretical concerns; each item below was re-verified against the code at the time of writing:

1. **Any support ticket is readable and writable by ID, unauthenticated.** In `src/app/api/support/tickets/[ticketId]/route.ts` (GET and PUT), `.../updates/route.ts`, and `.../attachments/route.ts`, the access filter is built as `const where: any = { id: ticketId }` and workspace/user scoping is only added *inside* `if (session?.user?.id) { ... }`. A request with no session falls through and matches any ticket. A guest who knows (or brute-forces) a ticket ID can read the ticket, change its status/priority/resolution, post updates, and upload or delete attachments. Attachments are additionally written to `public/uploads/tickets`, making them world-readable by URL. A second bug compounds this: the authenticated path calls `normalizeUserId(session.user.id)` without `await` (it is `async` in `src/lib/auth/demo-user.ts`), passing a Promise into the Prisma `where` clause — so the *authenticated* path errors while the *unauthenticated* path succeeds.
2. **Global system configuration is exposed to every authenticated user.** All `/api/admin/settings/**` handlers (e.g. `src/app/api/admin/settings/system/route.ts`) check only `if (!session) return 401`, then perform a workspace OWNER/ADMIN check *only when a `workspaceId` is supplied*. Global-scope rows (`workspaceId = null`) — system configuration, security configuration, backup configuration, feature flags — can be read and created by any logged-in user. No platform-admin concept is enforced anywhere (see ADR-0004).
3. **Feature-flag evaluation requires no session.** `src/app/api/admin/settings/feature-flags/evaluate/route.ts` calls `getServerSession()` but never returns 401 when it is absent; it also accepts arbitrary `userId` and `workspaceId` in the request body. Anyone on the internet can enumerate flag keys, spoof evaluation identities, and flood the `FeatureFlagEvaluation` audit table.
4. **Unauthenticated content writes.** Nine handlers under `/api/help/**` carry the literal comment `// TODO: Add authentication and admin check here` on POST/PUT/DELETE: `articles/route.ts:87`, `articles/[slug]/route.ts:86,143`, `categories/route.ts:67`, `categories/[slug]/route.ts:84,125`, `faqs/route.ts:122`, `faqs/[id]/route.ts:72,116`. In addition, `POST /api/documentation/pages`, `PUT/DELETE /api/documentation/sections/[slug]`, and `POST /api/video-tutorials` never call `getServerSession` at all. Anonymous users can create, deface, or delete the entire help center, documentation tree, and video library.
5. **Blanket public caching of authenticated API responses.** The active config `next.config.js` (lines 84–92) applies `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to `source: '/api/(.*)'` — every API route, including session-scoped ones. Behind any CDN or shared cache, one user's dashboard, inbox, or billing payload can be served to another user for up to a minute (longer with stale-while-revalidate).
6. **Inflatable counters.** `POST /api/help/articles/[slug]/feedback` and `POST /api/help/faqs/[id]/view` (and the FAQ feedback route) blindly `increment` vote/view counters with no session, no dedup key, and no rate limit. The same pattern applies to feature-request votes for guests (IP string only).
7. **Unsigned, unverified OAuth state.** `src/services/social-providers/base-provider.ts:313-316` generates the OAuth `state` parameter with `Math.random().toString(36)` — not cryptographically random, not bound to a session, not signed. The callback handler (`src/app/api/social/connect/route.ts` POST) destructures `state` from the body and never checks it. This is a textbook OAuth CSRF/login-forgery setup (cryptographic remediation details in ADR-0006).
8. **Rate limiting is essentially absent.** `package.json` declares `"ratelimiter": "^3.4.1"`, and `src/lib/utils/rate-limit.ts` imports `{ Ratelimit }` from it — a named export that package does not have. The file's real export is a hand-rolled per-instance in-memory Map limiter (10 req/min), imported by exactly three routes (`/api/ai/images/optimize`, `/api/ai/images/analyze`, `/api/audience/sentiment/analyze`). Login, signup, ticket creation, guest chat, search, and every counter endpoint are unthrottled. There is also **no root `middleware.ts`** in the repository at all.

Corrections found while verifying the audit (code beats audit): the `/api/admin/settings/**` routes import `normalizeUserId` from `'@/lib/utils'`, but `src/lib/utils.ts` exports only `cn()` — those handlers currently throw a `TypeError` before reaching Prisma. The authorization gap in item 2 describes the code's *intended* logic and must still be closed as part of repairing the routes (ADR-0016). Likewise, `feature-flags/evaluate` does call `getServerSession` (it just never enforces it) — and, because of the same broken import, an *unauthenticated* call succeeds while an *authenticated* one crashes.

The problem is systemic, not a list of one-off bugs: there is no convention that forces a route author to state who may call a route, and no layer that fails closed when they forget.

## Decision Drivers

- **D1 — Fail closed.** A forgotten check must default to "deny", not "allow". Today the default is allow (missing session ⇒ unscoped query).
- **D2 — Owner decisions.** Support tickets and Admin RBAC are being repaired *now* (ADR-0011, ADR-0012); Community/Documentation are deferred behind flags (ADR-0013, ADR-0014); deployment is self-hosted Docker (ADR-0022). Security fixes must land on the repaired-now surfaces first, and deferred surfaces must be *gated*, not fixed feature-by-feature.
- **D3 — Stripe billing is in scope (ADR-0019).** Payment-adjacent APIs raise the stakes: cached responses, forgeable OAuth state, and unthrottled auth endpoints become PCI/liability problems, not just bugs.
- **D4 — Single-team velocity.** The fix must be expressible as a small set of helpers and one convention, enforceable mechanically (lint/CI), not a 299-file hand audit repeated forever.
- **D5 — Infrastructure realism.** Self-hosted Docker with Redis already in the stack (ioredis/BullMQ are dependencies) means a Redis-backed limiter is cheap; Next.js edge middleware cannot use ioredis, which constrains where limiting logic can live.

## Considered Options

### Option 1 — Patch each endpoint individually, no shared layer

Fix the ~30 known holes route by route: add `getServerSession` checks, copy the OWNER/ADMIN snippet, delete the cache header.

- **Pros:** No new abstractions; each fix is small and independently shippable.
- **Cons:** Violates D1 and D4 — the *next* route added will repeat the mistake, because nothing enforces the pattern. The audit already shows three coexisting auth idioms and two nonexistent import paths; more copy-paste is how we got here. No answer for rate limiting or caching policy.

### Option 2 — Centralize all enforcement in a root `middleware.ts`

Introduce `src/middleware.ts` with a route-pattern table: `/api/admin/**` requires platform admin, `/api/support/**` requires session-or-guest-token, etc. Handlers stay as they are.

- **Pros:** One choke point; fails closed for unlisted routes; fixes caching via `NextResponse` headers.
- **Cons:** Next.js middleware runs on the edge runtime — no Prisma, no ioredis — so it can check *session cookie presence* but not workspace roles, ticket ownership, or platform-admin status; those need the database. A pattern table detached from handlers drifts (the `/api/admin/settings` vs `/api/admin/client-branding` split already shows path prefixes don't map cleanly to permission levels). Object-level authorization (ticket X belongs to workspace Y) is impossible here. Middleware alone gives a false sense of coverage.

### Option 3 — Declared authorization per route via shared wrappers, plus a thin middleware and config fix (layered)

Every route handler is built with a shared wrapper — new in this ADR — that composes the auth helpers standardized in ADR-0003 (`requireSession`, `requireAdmin`) and their authorization successors (`requireWorkspaceRole` and `requirePlatformAdmin` per ADR-0004, the guest ticket token per ADR-0011), with an explicit `access: 'public'` marker for the small set of intentionally public endpoints. A root `src/middleware.ts` adds cheap cross-cutting protections (kill caching on `/api/*`, request IDs, coarse IP throttle). `next.config.js` loses the blanket public cache header. A CI script fails the build if any `route.ts` exports a handler without a recognized auth declaration. Rate limiting is a Node-runtime helper backed by Redis, applied inside the wrapper.

- **Pros:** Fails closed (D1) *and* is enforced mechanically (D4); authorization lives next to the data access that needs it, so object-level checks are possible; works within the edge-runtime constraint (D5); the public list becomes a reviewable artifact.
- **Cons:** Requires touching every route file over time; two enforcement layers to keep coherent; the CI check is convention-based (static scan), not type-proven. Reopens ADR-0003's Option 3, which that ADR rejected as "too much, too early" — adopting this option means explicitly amending that judgment (see Decision Outcome).

### Option 4 — Push rate limiting and caching to a reverse proxy (nginx/traefik) in Docker compose

Handle throttling, header rewriting, and TLS at the proxy; keep app changes minimal.

- **Pros:** Battle-tested limiters; zero app-code latency cost; natural fit for ADR-0022's compose stack.
- **Cons:** Does nothing for authorization, which is the dominant failure class here; per-user (vs per-IP) limits and object-level rules need app context; local dev and tests bypass the proxy, so the security posture differs by environment. Useful *complement*, insufficient *substitute*.

## Decision Outcome

**Chosen option: Option 3 — layered enforcement with declared per-route authorization**, with Option 4's proxy-level limits adopted later as a complementary hardening step under ADR-0022.

Concretely:

1. **Policy (binding):** *Every API route must declare its access level.* Allowed declarations: `public` (explicit, reviewed allow-list), `session`, `workspaceRole(...roles)`, `platformAdmin`, `guestTicketToken`, `cron` (shared-secret, for `/api/client-reports/schedules/run` and future jobs). The declaration is made by building the handler with `withApiAuth`, a higher-order wrapper introduced by *this* ADR. **This amends ADR-0003**, which considered and rejected a wrapper layer (its Option 3, "too much, too early") in favor of plain helpers; the security findings above are the "later" that judgment anticipated, and the wrapper *composes* those helpers rather than replacing them: it resolves the session once via ADR-0003's `getAuthenticatedUser()` (which awaits `normalizeUserId` internally), performs the declared check (`requireSession`/`requireAdmin`, later ADR-0004's `requireWorkspaceRole`/`requirePlatformAdmin`), and returns 401/403 before the handler body runs. A CI check (`scripts/check-route-auth.ts`, wired into the ADR-0022 pipeline) statically scans `src/app/api/**/route.ts` and fails on any handler not using the wrapper.
2. **Caching:** remove the `/api/(.*)` `Cache-Control: public, s-maxage=60` block from `next.config.js`. The wrapper sets `Cache-Control: no-store` on all responses by default; routes that are genuinely cacheable (`public` GETs like help-article reads) opt in explicitly with `private`/`s-maxage` values they justify in code review.
3. **Rate limiting:** drop the `ratelimiter` dependency (its named import is broken anyway) and rewrite `src/lib/utils/rate-limit.ts` as a Redis sliding-window limiter on the existing ioredis connection, with an in-memory fallback for tests. Limits are declared in the same wrapper config (`limit: { key: 'ip' | 'user', points, window }`). Priority targets: auth endpoints (`/api/auth/signup`, credential login), guest-facing support (ticket create, chat, contact form), search, feedback/view counters, and AI endpoints. The thin `src/middleware.ts` adds only a coarse per-IP ceiling as backstop, because edge middleware cannot reach Redis.
4. **OAuth state:** `generateState()` is replaced by an HMAC-signed state token — `nonce.expiry.HMAC(nonce|expiry|userId, key)` using the key-management scheme of ADR-0006 — generated server-side, bound to the initiating session, and *verified* in the callback before any token exchange (ADR-0009 owns the broader connect flow).
5. **Counter integrity:** feedback/view/vote endpoints require a dedup identity — `userId` when a session exists, otherwise a salted hash of IP + user-agent with a per-day window — recorded in a small `EngagementEvent` table (or unique constraint on existing vote tables where they exist, e.g. `FeatureRequestVote`), plus the standard rate limit.
6. **Endpoint remediation table** (the normative work list):

| Endpoint (methods) | Verified problem | Required access | Fix |
|---|---|---|---|
| `/api/support/tickets/[ticketId]` (GET/PUT), `.../updates` (GET/POST), `.../attachments` (GET/POST/DELETE) | Unauthenticated fallthrough `where = { id }`; unawaited `normalizeUserId` breaks the authed path | `session` (owner/workspace) or `guestTicketToken` (ADR-0011) | Wrapper + scoped query; fail closed when neither identity present; move files out of `public/uploads` (ADR-0007) |
| `/api/admin/settings/**` (19 handlers incl. system, security, backup, integrations, feature-flags) | Global scope (`workspaceId=null`) readable/creatable by any authenticated user; broken `normalizeUserId` import from `@/lib/utils` | `platformAdmin` for global scope; `workspaceRole(OWNER, ADMIN)` for workspace scope | Wrapper with scope-dependent check (ADR-0004 role); fix imports as part of ADR-0016 repair |
| `/api/admin/settings/feature-flags/evaluate` (POST) | Session fetched but never enforced; body-supplied `userId`/`workspaceId` trusted | `session` | Enforce 401; derive `userId` from session, `workspaceId` validated via `UserWorkspace`; rate limit |
| `/api/help/articles` (POST), `/api/help/articles/[slug]` (PUT/DELETE), `/api/help/categories(+[slug])` (POST/PUT/DELETE), `/api/help/faqs(+[id])` (POST/PUT/DELETE) | Literal `TODO: Add authentication` — anonymous writes | `platformAdmin` (content admin) | Wrapper; the admin variants under `/api/admin/help/**` remain the real editing surface (ADR-0012) |
| `/api/documentation/pages` (POST), `/api/documentation/sections/[slug]` (PUT/DELETE) | No auth at all | `platformAdmin`; entire docs-management surface flag-gated | Gate behind ADR-0014 feature flag; wrapper regardless, so the gate failing open still denies |
| `/api/video-tutorials` (POST) | No auth despite admin-only comment | `platformAdmin` | Wrapper |
| `/api/help/articles/[slug]/feedback`, `/api/help/faqs/[id]/feedback`, `/api/help/faqs/[id]/view`, `/api/community/feature-requests/[requestId]/vote` | Blind counter increments, no dedup | `public` + dedup identity + rate limit | Item 5 above |
| `/api/social/connect` (GET/POST) | `Math.random()` state, never verified on callback | `session` (already) + signed state | Item 4 above |
| ALL `/api/*` | `Cache-Control: public, s-maxage=60` from `next.config.js` | n/a | Item 2 above (delete header block; default `no-store`) |
| `/api/debug/session` | Session/workspace debug dump routable in prod | remove | Delete (tracked in ADR-0024) |
| `/api/support/agents/status`, `/api/help/**` GETs, `/api/documentation/**` GETs | Intentionally public | `public` (explicit) | Declare in allow-list so CI check passes them consciously |

Community and Discord routes (`/api/community/**` beyond the vote endpoint above) are not individually remediated: they are disabled at the flag gate per ADR-0013/ADR-0015, and the CI convention check applies to them when they return.

## Consequences

### Positive

- Ticket data, global system configuration, and all content-management writes stop being anonymous-writable; the two subsystems being repaired now (ADR-0011, ADR-0012) start from a sound authorization base.
- The caching data-leak class is eliminated structurally (default `no-store`), not per-route.
- Authorization intent becomes visible and reviewable: `access: 'public'` in a diff is a red flag a reviewer can see; CI blocks silent omissions — the "TODO: add auth" failure mode cannot recur unnoticed.
- Redis-backed limits work correctly across multiple app containers, aligning with ADR-0022's Docker deployment; the broken `ratelimiter` dependency is removed.
- OAuth account linking gains CSRF protection before real platform integrations ship (ADR-0009).

### Negative

- Touching every route file is a large mechanical migration; until the CI check flips from *warn* to *fail*, coverage is partial and the gap list must be tracked.
- The wrapper adds a Redis round-trip on limited routes and a convention burden on contributors; genuinely public endpoints need explicit declaration, which is friction.
- A static CI scan can be fooled (e.g. re-exported handlers); it is a guardrail, not a proof. Complementary integration tests (ADR-0021) must assert 401/403 behavior on representative routes.
- Guest ticket flows get slightly harder to use (token in email link instead of raw ID) — an accepted trade-off, detailed in ADR-0011.

## Implementation Plan

**Phase 0 — Stop the bleeding (config-only, no route edits):**
1. Delete the `/api/(.*)` Cache-Control block in `next.config.js`; add a `no-store` header rule for `/api/(.*)` in the same file as an interim default. *(S)*
2. Delete `src/app/api/debug/session/route.ts`. *(S)*
3. Add `src/middleware.ts`: request-ID header, coarse in-memory per-IP throttle on `/api/auth/*` and `/api/support/*`, explicit `x-robots-tag: noindex` on `/api/*`. *(S)*

**Phase 1 — Wrapper and helpers (with ADR-0003/0004):**
4. Implement `withApiAuth` (new here — see Decision item 1) in `src/lib/api/with-api-auth.ts`, composing the ADR-0003 helpers and supporting `public | session | workspaceRole | platformAdmin | guestTicketToken | cron`, session resolution via `getAuthenticatedUser()` (awaited `normalizeUserId`), default `no-store`, structured 401/403 responses. *(M)*
5. Rewrite `src/lib/utils/rate-limit.ts` as Redis sliding-window on ioredis (env-configurable), remove `ratelimiter` from `package.json`; wire `limit` option into the wrapper. *(M)*
6. Add `scripts/check-route-auth.ts` + CI job (warn mode). *(S)*

**Phase 2 — Repair-now surfaces:**
7. Migrate `/api/support/tickets/**` (list, detail, updates, attachments) to the wrapper with owner/workspace scoping and ADR-0011 guest tokens; relocate attachment storage per ADR-0007. *(M)*
8. Migrate `/api/admin/settings/**` to the wrapper with `platformAdmin`-for-global-scope semantics; fix the `@/lib/utils` `normalizeUserId` imports (coordinate with ADR-0016). *(M)*
9. Enforce session on `feature-flags/evaluate`; derive identity server-side; add rate limit. *(S)*

**Phase 3 — Content writes and counters:**
10. Gate all `/api/help/**`, `/api/documentation/**`, `/api/video-tutorials` write handlers with `platformAdmin`; flag-gate documentation management per ADR-0014. *(M)*
11. Implement counter dedup (unique constraints / `EngagementEvent`) and apply limits to feedback/view/vote endpoints. *(M)*

**Phase 4 — OAuth state and lockdown:**
12. Replace `generateState()` with HMAC-signed, session-bound state; verify in the connect callback (keys per ADR-0006, flow per ADR-0009). *(M)*
13. Migrate the remaining route files to the wrapper; flip the CI check from warn to fail; add 401/403 integration tests for the remediation-table endpoints (ADR-0021). *(L)*

## Risks and Mitigations

- **Risk: the migration stalls half-done, leaving a false sense of safety.** Mitigation: Phase 0 and Phase 2 fix the *verified exploitable* holes first; the CI check in warn mode publishes the uncovered-route count in every build until it reaches zero, then flips to fail.
- **Risk: `no-store` default regresses performance of genuinely cacheable public GETs (help search, article reads).** Mitigation: explicit opt-in caching in the wrapper config; measure via ADR-0023 observability before tuning.
- **Risk: Redis unavailability turns the limiter into a denial-of-service on ourselves.** Mitigation: limiter fails open with a logged warning (availability over throttling), backstopped by the middleware in-memory ceiling and, later, proxy-level limits (ADR-0022).
- **Risk: guest ticket tokens break existing emailed links.** Mitigation: ADR-0011 defines a migration window in which old links redirect to a re-verification step (email challenge) rather than 404.
- **Risk: `platformAdmin` does not exist yet (ADR-0004 is Accepted, but its `isPlatformAdmin` column rides the ADR-0002 remediation migration).** Mitigation: until that migration lands, the wrapper maps `platformAdmin` to a temporary env-based allow-list of user IDs (`PLATFORM_ADMIN_USER_IDS`), which is strictly safer than today's any-authenticated-user behavior and is replaced transparently later.

## Related ADRs

- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — supplies the session helpers (`getAuthenticatedUser`, `requireSession`, `requireAdmin`) that `withApiAuth` composes; **amended by this ADR**, which introduces the wrapper layer ADR-0003's Option 3 had rejected as premature and adds the *enforcement* (CI check, default-deny policy).
- **ADR-0004: Platform Authorization Model and RBAC Enforcement** — defines the `platformAdmin` role required for global-scope settings and content administration.
- **ADR-0006: Cryptography, Token Encryption, and Secrets Management** — key management for the HMAC-signed OAuth state and replacement of the broken `encryption.ts`.
- **ADR-0007: Media Storage, Uploads, and Serving Architecture** — relocating ticket attachments out of `public/uploads`.
- **ADR-0009: Social Platform Integration Completion Strategy** — owns the OAuth connect flow the signed state slots into.
- **ADR-0011: Support Subsystem Remediation** — guest ticket token design consumed by the ticket-route fixes.
- **ADR-0012: Admin Dashboard and RBAC Subsystem Remediation** — admin surfaces that adopt the wrapper first.
- **ADR-0013 / ADR-0014 / ADR-0015** — deferred subsystems whose routes are flag-gated rather than individually remediated.
- **ADR-0016: System Settings & Configuration** — functional repair of the settings routes whose authorization this ADR fixes.
- **ADR-0019: Billing and Subscriptions with Stripe** — raises the stakes on caching, throttling, and CSRF (D3).
- **ADR-0021: Testing Strategy and Honest Quality Gates** — 401/403 integration tests backing the convention.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — hosts the CI route-auth check and the later proxy-level rate limits.
- **ADR-0024: Codebase Hygiene** — removal of `/api/debug/session` and the dead `ratelimiter` import.
