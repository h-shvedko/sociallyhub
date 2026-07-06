# ADR-0015: Discord Integration: Defer

- Date: 2026-07-02
- Status: Accepted — **Phases 1–2 implemented 2026-07-06**; real integration (Phases 3–4) deferred
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-06).** Discord is deferred and the fabricated data is **deleted** (not
> just gated): the hardcoded fake server (`guildName 'SociallyHub Community'`, 1247 members,
> `discord.gg/sociallyhub` invite) is gone from `discord/route.ts` (missing `workspaceId` → 400; no
> integration → `{ integration: null }`); the `members`/`admin`/`analytics` mock routes are deleted;
> the mock webhook senders (`sendWebhookMessage`/`sendTestWebhook`/…) are deleted (`SEND_*`/`TEST_*` →
> 501), keeping only the real `DiscordIntegration` CRUD + `CONFIGURE_WEBHOOK` + the reusable
> `DiscordWebhookPayload`/`DiscordEmbed` interfaces. `FEATURE_DISCORD` (a sub-flag of `FEATURE_COMMUNITY`)
> guards the surviving routes, and the whole `/api/community/discord/**` tree is 404'd by the community
> gate when off. **Verified:** zero `discord.gg/sociallyhub` / `demoDiscordInfo` / `1247` / `mock_*`
> literals remain in `src`. The **real integration** (Phase 3 webhook client, Phase 4 bot features)
> remains deferred behind the un-defer criteria.

## Context and Problem Statement

SociallyHub ships ~2,100 lines of Discord "integration" code across five route files
(`src/app/api/community/discord/route.ts`, `.../webhooks/route.ts`, `.../admin/route.ts`,
`.../members/route.ts`, `.../analytics/route.ts`), a `DiscordIntegration` Prisma model
(`prisma/schema.prisma` lines 4133–4168), and one UI consumer
(`src/components/community/community-integration.tsx`, the "Discord Server" card in the Help
Center). Verified state of that code as of 2026-07-02:

- **No real Discord connectivity exists anywhere.** `package.json` has no `discord.js` (or any
  Discord SDK), and the only occurrence of `discord.com/api` in `src/` is a placeholder string in
  `src/app/api/admin/settings/integrations/[id]/test/route.ts`. No `fetch` to Discord is ever made.
- **Webhook "sending" is a console.log.** `sendWebhookMessage()` in
  `src/app/api/community/discord/webhooks/route.ts` (lines 318–336) logs the payload, carries the
  comment `// In production, this would make an actual HTTP request to Discord`, and returns
  `{ messageId: \`mock_webhook_${Date.now()}\` }`. `TEST_WEBHOOK`, `SEND_NOTIFICATION`, and
  `SEND_MODERATION_ALERT` all funnel into it, so the UI-visible "Connection successful" test result
  is fabricated.
- **Member/admin/analytics routes are self-labeled mocks.** `members/route.ts:34` says
  `// Mock Discord API functions`; `admin/route.ts:50` says
  `// Mock Discord API calls (in production, these would be real Discord API calls)` and returns
  `mock_message_*` / `mock_announcement_*` / `mock_channel_*` IDs; `analytics/route.ts` generates
  member growth, channel activity, and peak hours entirely with `Math.random`.
- **An actively misleading demo response.** `GET /api/community/discord` without a `workspaceId`
  (route.ts lines 36–76) returns a hardcoded fake server: `guildName: 'SociallyHub Community'`,
  `memberCount: 1247`, `onlineMembers: 89`, `inviteUrl: 'https://discord.gg/sociallyhub'`, plus
  fabricated recent activity ("NewUser123 joined 5 minutes ago"). The Help Center card fetches
  exactly this URL when no workspace is set (`community-integration.tsx:91`) and renders the fake
  member counts and a live "join" link to a Discord invite we do not control.
- **Even the real parts do not run today.** The audit (verified) found `prisma/schema.prisma` fails
  validation with 33 errors and the checked-in generated client contains none of the
  community models — `prisma.discordIntegration` is `undefined` at runtime until ADR-0002
  remediation lands. Additionally, the webhook route writes `activityType: 'DISCORD_WEBHOOK_SENT'`
  and queries `'DISCORD_NOTIFICATION'` / `'DISCORD_ANNOUNCEMENT'`, none of which exist in the
  `CommunityActivityType` enum (schema lines 4257–4268 define only `DISCORD_MEMBER_JOINED` and
  `DISCORD_MESSAGE_POSTED`), and filters that enum with `startsWith`, which Prisma does not support
  on enum fields — so history/stats would throw even after client regeneration.
- **What IS genuinely implemented:** the `DiscordIntegration` record CRUD — GET-by-workspace,
  POST upsert, PUT update in `route.ts`, and `CONFIGURE_WEBHOOK` in `webhooks/route.ts` — with
  correct OWNER/ADMIN workspace checks. The model itself is a reasonable config surface: guild
  metadata, `channels` Json map, `webhookUrl`/`webhookSecret`, member counters, `isActive`,
  `autoAnnounce`.

The owner has decided (2026-07-02) that Support tickets/chat and Admin RBAC are repaired now, while
Community, Documentation management, and Discord are deferred behind feature flags. This ADR
records how Discord specifically is deferred, what is deleted versus kept, and what the real
implementation looks like when it is un-deferred.

## Decision Drivers

- **Honesty of the product surface.** Fake member counts and a fabricated "webhook sent
  successfully" result are worse than absence: they mislead users and admins and erode trust in
  every other metric the platform shows (same principle as ADR-0016 and ADR-0023).
- **Owner-set priorities.** Engineering capacity is committed to Support remediation (ADR-0011),
  Admin RBAC (ADR-0012), and Stripe billing (ADR-0019). Discord serves the deferred Community
  subsystem (ADR-0013), so it has no standalone user today.
- **Preserve sunk design value cheaply.** The `DiscordIntegration` model and its CRUD are sound
  and cost nothing to keep; the mock leaves are the liability.
- **A real integration is well-understood but not trivial.** Webhook posting is easy; bot-based
  member/analytics features require OAuth2 install, token custody (ADR-0006), rate-limit handling,
  and signed request verification — a real project, not a patch.
- **Consistency.** ADR-0013 and ADR-0014 establish the defer-behind-feature-flag pattern; Discord
  should follow the same mechanism rather than invent another.

## Considered Options

1. **Delete all Discord code and the model outright.**
   Cleanest repo (ADR-0024 spirit); zero maintenance. But it discards a usable schema and CRUD
   surface, forces a Prisma migration to drop the table (churn during the ADR-0002 remediation
   window), and makes later revival a from-scratch effort.

2. **Defer behind a feature flag: gate all Discord routes off, delete the hardcoded demo-server
   response and the mock leaf functions, keep the `DiscordIntegration` model + CRUD as the config
   surface.**
   Small, honest, reversible. The flag rides on the mechanism ADR-0013 introduces; the misleading
   data disappears immediately; the schema keeps its shape so un-deferral is additive.

3. **Implement the minimal real slice now (webhook POST to Discord).**
   Replacing `sendWebhookMessage` with a real `fetch` is genuinely small (~M). But it drags in
   secret handling, delivery logging, retry/rate-limit behavior, and QA against a real guild — all
   for a feature whose only consumer (Community/Help Center) is itself deferred by ADR-0013.
   Building it now violates the owner's prioritization.

4. **Keep as-is but label it "demo mode".**
   Lowest effort, but keeps 2,100 lines of `Math.random` code compiling in the hot path, keeps the
   fake invite link live, and normalizes simulated data — exactly what ADR-0025 says demo data must
   never do (leak into real routes).

## Decision Outcome

**Option 2: defer Discord behind a feature flag, remove the fabricated data, keep the model and
CRUD.**

Concretely:

- A `FEATURE_DISCORD` flag (default **off**) is added to the feature-flag module introduced by
  ADR-0013 (`src/lib/config/features.ts`). All five `src/app/api/community/discord/**` route files
  check it first and return `404 { error: 'Feature not available' }` when off. Discord is a
  sub-flag of Community: it can only be enabled when `FEATURE_COMMUNITY` is also on.
- The hardcoded demo-server fallback in `GET /api/community/discord` (the 1,247-member
  `discord.gg/sociallyhub` object) is **deleted unconditionally** — even with the flag on, a
  missing `workspaceId` becomes a `400`, and a workspace without an integration returns
  `{ integration: null }`. Demo content, if ever wanted, belongs to the explicit demo mode of
  ADR-0025, not to a route fallback.
- The mock leaf implementations (`members`, `admin`, `analytics` routes; `sendWebhookMessage` and
  its callers' send actions) are **deleted**, not just gated: code that fabricates success must not
  survive behind a flag where a future flag-flip silently re-exposes it.
- The `DiscordIntegration` model and its CRUD (`route.ts` GET/POST/PUT, `CONFIGURE_WEBHOOK`)
  are **kept** as the configuration surface, gated by the flag. Schema fixes (client generation,
  enum usage) ride on ADR-0002.
- The Help Center Discord card in `community-integration.tsx` renders nothing when the API returns
  404/`null` (it is already inside the Community surface deferred by ADR-0013).

Why: this is the only option that removes the misleading behavior immediately, costs roughly a
day, respects the owner's priority ordering, and leaves a clean, additive path to a real
integration.

## Consequences

### Positive

- No user or admin ever again sees fabricated Discord members, invites, analytics, or "webhook
  sent" confirmations.
- ~1,400+ lines of mock code removed from the build (ADR-0024 hygiene win); remaining Discord
  surface is small, real, and gated.
- `DiscordIntegration` config data already written by any workspace is preserved; un-deferral
  requires no destructive migration.
- One consistent deferral mechanism across Community (ADR-0013), Documentation (ADR-0014), and
  Discord.

### Negative

- No Discord functionality at all until un-deferred — including the plausible-sounding
  "notify our Discord on new ticket" use case some customers may expect from the marketing surface.
- Kept-but-dormant model and CRUD are code that must still be carried through schema remediation
  (ADR-0002) and route-convention updates (ADR-0003) without a live consumer exercising them.
- Deleting the mock routes removes reference material for the eventual real implementation
  (mitigated: the payload/embed TypeScript interfaces in `webhooks/route.ts` are kept — they match
  Discord's real webhook schema and are the one genuinely reusable artifact).

## Implementation Plan

### Phase 1 — Flag off and remove fabricated data (now, S)

1. Add `FEATURE_DISCORD: false` to `src/lib/config/features.ts` (mechanism per ADR-0013), enabled
   only if `FEATURE_COMMUNITY` is also enabled. (S)
2. `src/app/api/community/discord/route.ts`: add the flag guard; delete the `demoDiscordInfo`
   object and the no-`workspaceId` fallback branch (lines 35–76); require `workspaceId` (400
   otherwise); return `{ integration: null }` when none exists. (S)
3. Add the same guard to `webhooks/`, `admin/`, `members/`, `analytics/` route files. (S)
4. `src/components/community/community-integration.tsx`: render no Discord card when the fetch
   returns 404 or `integration: null`; remove the hardcoded expectation of `recentActivity`. (S)

### Phase 2 — Delete mock leaves, keep the config surface (now, S)

5. Delete `src/app/api/community/discord/members/route.ts`, `admin/route.ts`, and
   `analytics/route.ts` entirely (all leaf logic is mock). (S)
6. In `webhooks/route.ts`: keep GET history and `CONFIGURE_WEBHOOK`; delete `sendWebhookMessage`,
   `sendTestWebhook`, `sendDiscordNotification`, `sendModerationAlert` and their `SEND_*`/`TEST_*`
   actions (return 501 if requested); keep the `DiscordWebhookPayload`/`DiscordEmbed` interfaces.
   Remove the `Math.random` failed-webhook count and the `startsWith`-on-enum filters; query only
   the enum values that exist (`DISCORD_MEMBER_JOINED`, `DISCORD_MESSAGE_POSTED`) or none. (S)
7. Fix the out-of-enum `communityActivity` writes in the remaining Discord code paths as part of
   the ADR-0002 schema pass (either use existing enum values or extend the enum deliberately). (S,
   coordinated with ADR-0002)

### Phase 3 — Un-deferred slice 1: notifications-to-Discord webhook (later, M)

The highest-value/lowest-effort real feature. Discord *incoming webhooks* need no SDK, no bot, and
no OAuth — a plain `POST https://discord.com/api/webhooks/{id}/{token}` with the JSON embed payload
already typed in `webhooks/route.ts`.

8. Implement `src/lib/discord/webhook-client.ts`: `fetch` POST, 10s timeout, handle `429` via
   `retry_after`, surface real success/failure. (M)
9. Store `webhookUrl`/`webhookSecret` encrypted per ADR-0006; never return them in API responses
   (the current `'***HIDDEN***'` masking stays). (S)
10. Deliver asynchronously through the job queue of ADR-0008 with retry/backoff; record real
    delivery outcomes in a `DiscordWebhookDelivery` table (replace the `CommunityActivity` misuse). (M)
11. Wire notification events from ADR-0010 (e.g. new support ticket, publish failure) as webhook
    triggers; `TEST_WEBHOOK` becomes a real send. (M)

### Phase 4 — Un-deferred slice 2: bot-based features (later, L)

12. OAuth2 bot install flow (`identify guilds bot` scopes, `applications.commands` if slash
    commands are wanted), storing the bot token per ADR-0006. (L)
13. Real REST reads (guild info, member counts) via `discord.js` **or** plain REST with the bot
    token — decide then; plain REST is preferred if the surface stays read-mostly, `discord.js`
    if gateway events (member join, messages) are needed. Honor per-route rate-limit buckets
    (`X-RateLimit-*` headers). (L)
14. If interactive features (slash commands, interaction callbacks) are built: verify incoming
    requests with Discord's Ed25519 signature headers (`X-Signature-Ed25519`,
    `X-Signature-Timestamp`) — this, not the current unused `webhookSecret`, is Discord's actual
    verification model. (M)
15. Rebuild members/analytics endpoints on real data only. (L)

**Un-defer criteria (all required):** (a) Community subsystem un-deferred per ADR-0013's own
criteria; (b) ADR-0011/0012/0019 repair work shipped; (c) concrete demand signal (customer requests
or an operations need such as ops-alerts-to-Discord); (d) owner sign-off. Phase 3 may be pulled
forward independently of Community if the *internal ops notification* use case alone justifies it,
since it does not depend on any community UI.

**Effort estimate:** Phases 1–2 together ≈ 1 developer-day. Phase 3 ≈ 2–4 days. Phase 4 ≈ 2–3
weeks including a test guild, rate-limit hardening, and QA.

## Risks and Mitigations

- **Risk:** Users who saw the fake Discord card ask where "the community server" went.
  **Mitigation:** the card disappears together with the rest of the deferred Community surface
  (ADR-0013); release notes state Discord integration is not yet available.
- **Risk:** Dormant `DiscordIntegration` CRUD rots (schema drift, Next.js 15 params conventions).
  **Mitigation:** it is included in the ADR-0002 validation pass and ADR-0003 route-convention
  sweep like any live route; a smoke test asserts flag-off routes return 404.
- **Risk:** Flag flip re-exposes half-finished behavior.
  **Mitigation:** mock code is deleted, not gated; with the flag on, the only reachable actions are
  config CRUD, which is real. `SEND_*` returns 501 until Phase 3 ships.
- **Risk:** `webhookSecret` stored in plaintext today becomes a liability when real URLs are
  configured. **Mitigation:** Phase 3 step 9 encrypts at rest per ADR-0006 before any real webhook
  URL handling ships; until then the flag keeps the write path off.
- **Risk:** The `discord.gg/sociallyhub` invite (not owned by us) could be registered by a third
  party and previously shipped UI linked to it. **Mitigation:** the hardcoded object is deleted in
  Phase 1; grep CI guard (ADR-0024) for `discord.gg/` literals in `src/`.

## Related ADRs

- ADR-0001: Record Architecture Decisions — format followed here.
- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — prerequisite: the
  `DiscordIntegration` client/tables do not exist until it lands; enum fixes coordinated there.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — the surviving routes adopt its
  conventions.
- ADR-0005: API Security Hardening / ADR-0006: Cryptography, Token Encryption, and Secrets
  Management — govern webhook URL/secret and future bot-token custody.
- ADR-0008: Background Jobs and the Publishing Pipeline — delivery queue for Phase 3.
- ADR-0009: Social Platform Integration Completion Strategy — the sibling pattern for real
  external-API integrations (tokens, rate limits) that Phase 4 follows.
- ADR-0010: Realtime Transport and Notification Delivery — source of the notification events a
  future Discord webhook fans out.
- ADR-0013: Community Subsystem: Defer Behind Feature Flag — parent decision; supplies the flag
  mechanism and the `FEATURE_COMMUNITY` gate Discord nests under.
- ADR-0014: Documentation Management: Defer Behind Feature Flag — same deferral pattern.
- ADR-0016: System Settings & Configuration: Real Operations over Simulations — the "no fabricated
  success" principle applied here.
- ADR-0024: Codebase Hygiene — mock-code deletion and the `discord.gg/` grep guard.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — where demo Discord data would belong, if
  ever, instead of a route fallback.
