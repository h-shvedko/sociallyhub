# ADR-0009: Social Platform Integration Completion Strategy

- Date: 2026-07-02
- Status: Proposed — **Foundations + honesty cleanup implemented 2026-07-04** (live-API verification deferred pending real platform credentials)
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-04).** ADR-0009's full end-to-end scope requires external
> dependencies that do not exist in this environment (a paid X API tier, Meta App Review, real
> platform OAuth credentials, a public webhook subscription). Delivered the code-complete,
> **in-environment-testable** foundations + the ADR's headline honesty cleanup: (1) **no fabricated
> data** — every provider `getAnalytics` returns `success:false` on failure instead of
> `generateMockAnalytics`/`Math.random`; `uploadMedia` reads real bytes from ADR-0007 storage and
> fails honestly (no `mock_media_`/`yt_video_` IDs); real S256 PKCE (RFC 7636) with a Redis verifier
> store. (2) **Fixed the three broken-method bugs** — `/api/inbox/[id]/reply` → new
> `provider.replyToItem()`; `/api/accounts/[id]/refresh` → new `SocialMediaManager.refreshAccount()`;
> `getSocialManager(workspaceId)` credential factory (`PlatformCredentials` → env, decrypt via
> ADR-0006) + `getDecryptedAccount()`, accounts Map off the publish path. (3) **A fully-testable Meta
> webhook receiver** `/api/webhooks/meta` (GET `hub.challenge`, POST `X-Hub-Signature-256` HMAC
> validation, `InboxItem` ingestion) — proven end-to-end against the running app (challenge echo,
> wrong-token 403, valid-signed payload → real InboxItem, invalid-sig 401). (4) **Honest availability
> tiers** (`/api/accounts/platforms`: LinkedIn/TikTok/YouTube = `unavailable`); `createDemoConnection`
> gated behind `isDemoMode()`; docs corrected. An `inbox-sync` repeatable is registered in the
> ADR-0008 worker (idle without creds). **Deferred-external (NOT defects):** live posting/media/
> analytics against Twitter/Meta, Meta App Review + webhook subscription bootstrap, paid X tier — all
> gated on real platform credentials. When credentials exist, the pipeline (ADR-0008) + these
> foundations produce real posts instead of honest failures.

## Context and Problem Statement

SociallyHub ships six social provider integrations (`src/services/social-providers/`: `twitter-provider.ts`, `facebook-provider.ts`, `instagram-provider.ts`, `linkedin-provider.ts`, `tiktok-provider.ts`, `youtube-provider.ts`) with genuine OAuth URL construction, token exchange, and real REST publishing calls (Twitter v2 `/2/tweets`, Facebook Graph, etc.). However, verified code inspection (2026-07-02) shows the integration layer cannot deliver a single production workflow end-to-end:

1. **Mock media upload.** `TwitterProvider.uploadMedia()` returns `mock_media_${Date.now()}...` (`twitter-provider.ts:486`), `FacebookProvider.uploadMedia()` returns `fb_media_...` (`facebook-provider.ts:453`), and `InstagramProvider.uploadMedia()` returns `ig_media_...` (`instagram-provider.ts:415`). Any post with media publishes with fabricated media IDs (or fails at the platform).
2. **Broken PKCE.** `TwitterProvider.generateCodeChallenge()` returns the literal string `'mock_code_challenge'` and `getStoredCodeVerifier()` returns `'mock_code_verifier'` (`twitter-provider.ts:627-635`). Twitter OAuth 2.0 requires real S256 PKCE; the token exchange cannot succeed against the live API.
3. **Mock analytics.** `TwitterProvider.getAnalytics()` returns inline `Math.random()` data unconditionally (`twitter-provider.ts:509-533`); LinkedIn (`linkedin-provider.ts:550-553`) and TikTok (`tiktok-provider.ts:505-512`) unconditionally return `generateMockAnalytics()`. Facebook, Instagram, and YouTube *do* call the real insights APIs first (`facebook-provider.ts:471-523`, `instagram-provider.ts:455-480`, `youtube-provider.ts:625-650`) but on any failure silently substitute `generateMockAnalytics()` **with `success: true`**, so callers — including the dashboard — cannot distinguish real metrics from fiction.
4. **Inbox replies are unimplementable.** `POST /api/inbox/[id]/reply` calls `provider.reply({...})` (`src/app/api/inbox/[id]/reply/route.ts:46`); no provider defines `reply()`. The base class only defines `replyToComment()` (`base-provider.ts:132`), whose default implementation returns a "not implemented" error. There is also no inbound ingestion: no webhook endpoints and no polling job exist, so `InboxItem` rows come only from seed data or manual POSTs.
5. **Token refresh always fails.** `POST /api/accounts/[id]/refresh` calls `socialMediaManager.refreshToken(...)` (`src/app/api/accounts/[id]/refresh/route.ts:55`), a method that does not exist on `SocialMediaManager` (`social-media-manager.ts` defines `addAccount`, `getProvider`, `bulkPost`, etc., but no `refreshToken`). Providers implement `refreshAccessToken(account)` individually, but nothing routes to them or persists rotated tokens.
6. **In-memory account registry.** `SocialMediaManager` resolves accounts from a private `Map` (`social-media-manager.ts:74`) populated only by `exchangeCodeForToken` (line 187) within the same process. DB-stored `SocialAccount` rows are never hydrated, so `/api/social/post`, the analytics-collection processor (`src/lib/jobs/processors/analytics-collection.ts:132`), and any worker in a separate process can never find an account.
7. **Silent demo fabrication.** With no platform env credentials configured (the default install), `POST /api/accounts/connect` calls `createDemoConnection()` (`src/app/api/accounts/connect/route.ts:59-62, 113+`), fabricating fake `SocialAccount` rows (`demo-twitter-123`, random follower metadata) with no explicit opt-in flag.
8. **Credential architecture mismatch.** `SocialMediaManager.initializeProviders()` reads only `process.env` at module load (`social-media-manager.ts:85-131`). The newer `PlatformCredentials` model (`prisma/schema.prisma:2632`, workspace-level BYO app keys, nominally AES-256-GCM encrypted via `src/lib/encryption.ts` — a scheme ADR-0006 verified never round-trips, so every stored secret is unrecoverable write-only ciphertext) is written and validated by `/api/platform-credentials` but **never consumed by any provider** — `decryptCredentials` is referenced only inside the platform-credentials routes themselves. Meanwhile `SocialAccount.accessToken`/`refreshToken` carry `// Encrypted` comments (`schema.prisma:365-366`) but are stored in plaintext by `/api/accounts/callback`.

The problem: **decide how to take the integration layer from "convincing skeleton" to "at least one fully working, honest, production platform path"**, given limited capacity and the owner decisions of 2026-07-02 (self-hosted Docker deployment, Stripe billing in scope, Community/Docs/Discord deferred).

## Decision Drivers

- **Honesty over coverage.** `PRODUCT_OVERVIEW.md` claims "zero mock data"; `AI_MOCK_DATA.md` and this audit disprove it. A social-media-management SaaS that never posts to a social network has no viable core; a smaller set of *real* integrations beats six fake ones.
- **Existing investment.** The BullMQ pipeline (ADR-0008) already includes `processors/post-scheduling.ts` and `processors/analytics-collection.ts`; the integration layer must plug into those workers, not into request handlers.
- **Security posture.** ADR-0005 (unsigned OAuth `state`), ADR-0006 (plaintext `SocialAccount` tokens) both intersect this work; completing integrations without fixing token handling would double the remediation cost later.
- **Platform economics.** Twitter/X API (Basic tier) and Meta Graph API (free, webhook-capable) are the two cheapest paths to a demonstrable end-to-end product. LinkedIn/TikTok/YouTube have heavier app-review processes and (for TikTok/YouTube) content-publishing restrictions.
- **Self-hosted deployment (ADR-0022).** Long-lived Node processes are available, so persistent workers and webhook receivers are feasible (no serverless constraints).
- **Demo mode must survive** for sales/testing, but explicitly and visibly (ADR-0025), never as a silent default.

## Considered Options

### Option 1 — Breadth-first: bring all six providers to production simultaneously

Fix PKCE, media upload, analytics, reply, and refresh across all six providers in one program of work.

- Good: single consistent sweep; no "tiered" platform story to explain.
- Bad: 6× app registration, review queues (TikTok audit, YouTube API audit, LinkedIn Marketing Developer Platform approval) serialize the schedule; months before *anything* is fully real.
- Bad: LinkedIn/TikTok analytics and YouTube publishing have API limitations the current stubs paper over; "production" for those platforms is not achievable by code alone.
- Bad: highest risk of shipping six half-fixed providers instead of two finished ones — the current failure mode, repeated.

### Option 2 — Depth-first: finish Twitter/X and Meta Graph (Facebook + Instagram) end-to-end; gate the rest (RECOMMENDED)

Complete two platform families through the full lifecycle — OAuth (real PKCE, signed state), DB-backed accounts with encrypted tokens, real media upload, publish via the ADR-0008 worker, token refresh, inbox ingestion (Meta webhooks; Twitter polling), outbound replies, and scheduled analytics collection into `AnalyticsMetric`. LinkedIn/TikTok/YouTube remain visible but flagged "beta / not yet available" in `/api/accounts/platforms`, with their silent mock paths removed.

- Good: one honest, demonstrable end-to-end product path in weeks, not months; Instagram rides on the same Meta Graph app as Facebook (shared webhooks, shared credentials), so "two families" yields three user-visible platforms.
- Good: forces the cross-cutting foundations (credential resolution, account hydration, token encryption, worker wiring) to be built once and correctly; remaining platforms become incremental.
- Good: Meta webhooks give a real inbox ingestion pipeline; Twitter polling exercises the fallback path — both ingestion modes get built.
- Bad: temporary platform-coverage asymmetry; marketing copy and `/api/accounts/platforms` must be corrected to match.
- Bad: LinkedIn users get "coming soon" where they previously saw a (fake) working connection.

### Option 3 — Outsource to a third-party aggregation API (Ayrshare, unified posting APIs)

Replace `src/services/social-providers/` with a paid aggregator handling OAuth, publishing, and webhooks for all platforms.

- Good: fastest route to broad real coverage; someone else maintains API churn.
- Bad: per-workspace/per-user pricing destroys SaaS margins and conflicts with the BYO `PlatformCredentials` design already built (with encryption made real by ADR-0006); white-label/agency positioning (ADR-0020) suffers.
- Bad: core product differentiation (publishing pipeline, inbox, analytics) becomes a thin wrapper over a vendor; vendor lock-in for the company's central feature.
- Bad: discards substantial working code (OAuth flows, REST publishing calls are already correct in shape).

### Option 4 — Status quo plus honesty labels: keep demo mode, defer real integration

Label everything demo, fix nothing else, prioritize billing/support work.

- Good: cheapest short-term.
- Bad: the product cannot do the one thing it sells; billing real customers (ADR-0019) for a simulated product is untenable. Rejected on principle.

## Decision Outcome

**Option 2 — depth-first completion of Twitter/X and Meta Graph (Facebook + Instagram), with shared foundations built first and the remaining three platforms feature-flagged as unavailable.**

Concretely, we decide:

1. **Credential source of truth**: workspace-level `PlatformCredentials` is the primary credential source, encrypted via the ADR-0006-remediated `src/lib/encryption.ts` (AES-256-GCM in the versioned `enc:v1` format — the legacy module's output never round-tripped); `process.env` platform vars become the *fallback* for single-tenant installs. Per ADR-0006 Phase 4, pre-existing `PlatformCredentials` secrets are nulled (`isConfigured=false`) as unrecoverable, so workspace owners must re-enter credentials before this source becomes operative — until then the env fallback carries single-tenant installs. `SocialMediaManager` stops being an env-initialized module singleton and becomes a per-workspace factory (`getSocialManager(workspaceId)`) that decrypts `PlatformCredentials` on demand.
2. **Accounts come from the database.** The in-memory `accounts: Map` is removed. Every operation loads `SocialAccount` via Prisma, decrypting tokens with the ADR-0006 helpers. `SocialAccount.accessToken`/`refreshToken` become genuinely encrypted at rest (migration per ADR-0002, with a one-time re-encryption script).
3. **Real PKCE and signed state.** S256 code challenge from `crypto.randomBytes`, verifier persisted server-side keyed by the OAuth `state`, and `state` becomes HMAC-signed (closing the tamperable-state gap flagged under ADR-0005).
4. **Real media upload** for Twitter (chunked v1.1 `media/upload` INIT/APPEND/FINALIZE) and Meta (photo/video endpoints; Instagram container flow), reading bytes from the media storage layer defined in ADR-0007.
5. **Publishing only via the worker.** Provider `createPost` is invoked exclusively from `processors/post-scheduling.ts` (ADR-0008); `/api/social/post`'s direct-publish path is retired or reduced to enqueueing.
6. **`refreshToken` implemented properly**: a new `SocialMediaManager.refreshAccount(accountId)` delegates to the provider's existing `refreshAccessToken(account)`, persists rotated tokens encrypted, updates `tokenExpiry` and `status`; workers refresh proactively before expiry. `/api/accounts/[id]/refresh` calls the new method.
7. **Inbox becomes a real pipeline**: a Meta webhook receiver (`/api/webhooks/meta`) with `hub.challenge` verification and `X-Hub-Signature-256` validation ingests comments/mentions/messages into `InboxItem`/`Conversation`; a BullMQ repeatable `inbox-sync` job polls Twitter mentions/replies (Account Activity API is cost-prohibitive at Basic tier). Outbound replies get a defined `replyToItem()` provider contract implemented for both families, and `/api/inbox/[id]/reply` is fixed to call it.
8. **Analytics collection is honest.** The silent `success: true` mock fallbacks are deleted; `getAnalytics` failures return `success: false` and are recorded (ADR-0023). `processors/analytics-collection.ts` runs on schedule and persists real metrics into `AnalyticsMetric`, which the dashboard already reads.
9. **Demo fabrication moves behind the explicit demo-mode flag** (ADR-0025): `createDemoConnection()` runs only when demo mode is enabled; otherwise `/api/accounts/connect` returns an actionable configuration error. `/api/accounts/platforms` reports true availability: `available` (credentials configured), `configurable` (BYO keys accepted), `unavailable` (LinkedIn/TikTok/YouTube until their completion phases), `demo` (flag on).

Why this option: it is the only path that produces a *true* end-to-end product (compose → schedule → publish → ingest engagement → reply → measure) within a realistic horizon, builds every cross-cutting foundation exactly once, and aligns with already-accepted ADRs (0006 encryption, 0008 workers, 0022 self-hosting) instead of fighting them.

## Consequences

### Positive

- At least three user-visible platforms (X, Facebook Pages, Instagram Business) work for real: publishing with media, token refresh, inbox, replies, analytics.
- The "zero mock data" claim becomes recoverable: mock analytics can no longer masquerade as real (`success: true` fallback removed), and demo accounts are explicit.
- `PlatformCredentials` — currently write-only dead weight — becomes the operative multi-tenant credential system, enabling agency BYO-app-keys.
- `SocialAccount` tokens are encrypted at rest, closing a stated ADR-0006 gap.
- Both inbox ingestion modes (webhook and polling) exist as reusable patterns for later platforms.
- LinkedIn/TikTok/YouTube completion becomes a bounded, per-platform increment on stable foundations.

### Negative

- Three platforms are honestly labeled unavailable for a period; marketing materials (`PRODUCT_OVERVIEW.md`, `/api/accounts/platforms` copy) must be corrected, which is a visible walk-back.
- Requires platform app registrations, Meta App Review (pages_manage_posts, instagram_content_publish, webhooks) and a paid X API tier — external dependencies with lead time and recurring cost.
- Token re-encryption migration must be executed carefully on existing installs (plaintext → encrypted), coordinated with ADR-0002's migration-first workflow.
- Webhook receiver adds public attack surface; must follow ADR-0005 hardening (signature verification, rate limiting).
- Per-workspace provider instantiation adds minor overhead versus the current singleton (mitigated by short-lived caching).

## Implementation Plan

Sizing: **S** ≤ ½ day, **M** ½–2 days, **L** 2–5 days.

### Phase 0 — Foundations (blockers for everything else)

1. **(M)** `src/services/social-providers/social-media-manager.ts`: remove `accounts: Map` and env-only `initializeProviders()`; add `getSocialManager(workspaceId)` factory resolving credentials `PlatformCredentials → env fallback`, decrypting via the ADR-0006-rewritten `src/lib/encryption.ts` (`enc:v1` format only). Prerequisite: ADR-0006 Phase 1 (crypto rewrite) and Phase 4 (null legacy `PlatformCredentials` secrets — they were never decryptable) must have landed, and owners must re-enter credentials for a workspace before its `PlatformCredentials` resolve; the env fallback covers the interim. Export a credential-resolution helper for reuse by workers.
2. **(M)** Encrypt `SocialAccount.accessToken`/`refreshToken`: write path in `src/app/api/accounts/callback/route.ts`, read path via a `getDecryptedAccount(id)` helper; one-time migration script `scripts/encrypt-social-tokens.ts` (coordinate with ADR-0002/ADR-0006).
3. **(S)** `src/app/api/accounts/connect/route.ts`: gate `createDemoConnection()` behind the ADR-0025 demo-mode flag; return a 503 configuration error otherwise. Mark fabricated rows `metadata.demoAccount: true` (already present) for later cleanup.
4. **(S)** `src/app/api/accounts/platforms/route.ts`: report per-platform availability tiers (`available` / `configurable` / `unavailable` / `demo`).
5. **(M)** Implement `SocialMediaManager.refreshAccount(accountId)` (delegate to provider `refreshAccessToken`, persist rotated tokens encrypted, update `tokenExpiry`/`status`); fix `src/app/api/accounts/[id]/refresh/route.ts:55` to call it.
6. **(M)** Sign OAuth `state` (HMAC via `NEXTAUTH_SECRET`-derived key) and persist PKCE verifiers keyed by state (DB table or Redis, TTL 10 min). Applies to `accounts/connect`, `accounts/callback`, `social/connect`.

### Phase 1 — Twitter/X end-to-end

1. **(S)** `twitter-provider.ts:627-635`: real S256 PKCE (`crypto.createHash('sha256')` over a stored `crypto.randomBytes(32)` verifier from Phase 0.6).
2. **(L)** `twitter-provider.ts:479-502`: real chunked media upload (v1.1 INIT/APPEND/FINALIZE, media category handling, processing-status polling), sourcing bytes from ADR-0007 storage.
3. **(M)** Wire publish through `processors/post-scheduling.ts` (ADR-0008): load `SocialAccount` from DB, refresh-if-near-expiry, call `createPost`, check `APIResponse.success` before reading `postResult.id` (fixes the known result-handling bug), persist `providerPostId` on `PostVariant`.
4. **(M)** Replace `twitter-provider.ts` `getAnalytics` mock with real v2 tweet metrics (`public_metrics`, plus `non_public_metrics` where the tier allows); on unavailability return `success: false` — never fabricated data.
5. **(M)** Implement `replyToItem()` (POST `/2/tweets` with `reply.in_reply_to_tweet_id`); fix `src/app/api/inbox/[id]/reply/route.ts:46` to call the defined contract instead of nonexistent `provider.reply()`.
6. **(M)** `inbox-sync` repeatable BullMQ job: poll mentions/replies via recent search, upsert `InboxItem`/`Conversation` with `providerItemId` dedupe.

### Phase 2 — Meta Graph (Facebook Pages + Instagram Business)

1. **(M)** `facebook-provider.ts:453` and `instagram-provider.ts:415`: real media upload (page photos/videos endpoints; IG media container create → status poll → publish).
2. **(M)** Remove silent mock fallbacks in `facebook-provider.ts:508-514`, `instagram-provider.ts:470-476` (and `youtube-provider.ts:640-646` while touching the pattern): failures return `success: false` with the platform error.
3. **(L)** `src/app/api/webhooks/meta/route.ts`: GET `hub.challenge` verification, POST with `X-Hub-Signature-256` validation, ingestion of feed comments, mentions, and messages into `InboxItem`; subscription bootstrap when a page/IG account connects.
4. **(M)** `replyToItem()` for Facebook (POST `/{comment_id}/comments`, private replies) and Instagram (comment replies).
5. **(M)** Analytics via `processors/analytics-collection.ts` on a repeatable schedule (ADR-0008), persisting page/IG insights into `AnalyticsMetric` with correct `socialAccountId` linkage.

### Phase 3 — Honesty cleanup and gating

1. **(S)** LinkedIn/TikTok/YouTube: mark `unavailable` in platforms endpoint; delete or demo-gate `generateMockAnalytics()` in `linkedin-provider.ts:648`, `tiktok-provider.ts:579`, `instagram-provider.ts:738`, `facebook-provider.ts:776`, `youtube-provider.ts:762`.
2. **(S)** Correct `SOCIAL_INTEGRATION_GUIDE.md` and `PRODUCT_OVERVIEW.md` platform claims; check off the guide's production security checklist items delivered here.
3. **(M)** Integration tests against recorded fixtures for both provider families; E2E "publish → webhook → reply" smoke path (ADR-0021).

## Risks and Mitigations

- **Meta App Review delays (weeks).** Mitigate: submit review at Phase 0 completion using a staging app; develop against test users/pages meanwhile.
- **X API pricing/tier changes.** Mitigate: isolate tier-dependent features (non-public metrics, search windows) behind capability flags per credential set; BYO `PlatformCredentials` lets agencies bring their own tier.
- **Token re-encryption migration corrupts existing accounts.** Mitigate: dual-read (try decrypt, fall back to plaintext once), backfill script, then enforce; verify on staging snapshot first (ADR-0002 workflow).
- **Webhook receiver abuse.** Mitigate: signature verification before parsing, payload size limits, rate limiting per ADR-0005; dead-letter queue for malformed events.
- **Polling rate limits (Twitter).** Mitigate: per-account adaptive intervals, `since_id` cursors, jittered scheduling in the `inbox-sync` job.
- **Scope creep toward the deferred three platforms.** Mitigate: this ADR explicitly sequences them after Phase 3; each gets its own mini-plan reusing the Phase 0 foundations.
- **Regression risk in dashboards that currently render mock analytics.** Mitigate: dashboards read `AnalyticsMetric` (already real aggregation per audit); only provider-direct analytics endpoints change behavior — audit `/api/social/analytics` consumers before removing fallbacks.

## Related ADRs

- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — token-encryption migration and any webhook/verifier tables follow its process.
- **ADR-0005: API Security Hardening** — signed OAuth state, webhook signature verification, rate limiting.
- **ADR-0006: Cryptography, Token Encryption, and Secrets Management** — hard dependency (its Phases 1–4 precede Phase 0 here): `SocialAccount` token encryption at rest; reuses `src/lib/encryption.ts` (AES-256-GCM, `enc:v1`) as rewritten by ADR-0006 and applied to `PlatformCredentials` by its Phase 4 cleanup — legacy secrets are nulled for re-entry because the prior module's output was never decryptable.
- **ADR-0007: Media Storage, Uploads, and Serving Architecture** — real media upload reads bytes from this storage layer.
- **ADR-0008: Background Jobs and the Publishing Pipeline** — publishing, `analytics-collection`, and `inbox-sync` all run as BullMQ workers defined there; fixes the `post-scheduling.ts` result-handling bug in that pipeline's context.
- **ADR-0021: Testing Strategy and Honest Quality Gates** — fixture-based provider tests and the publish/ingest E2E path.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — long-lived worker and webhook processes assume the self-hosted topology.
- **ADR-0023: Observability: Real Metrics, Logging, and Health** — analytics failures and webhook errors are recorded instead of masked by mock data.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — demo account fabrication and any demo analytics live exclusively behind its flag.
