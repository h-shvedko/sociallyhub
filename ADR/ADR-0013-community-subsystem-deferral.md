# ADR-0013: Community Subsystem: Defer Behind Feature Flag

- Date: 2026-07-02
- Status: Accepted
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub carries a large, almost entirely AI-generated "community" surface: 36 route
files under `src/app/api/community/**` (forum, feature requests, Discord, moderation
rules/logs/audit, spam detection, content filtering, reports, user moderation, activity
feed, analytics/health/insights) backed by ~15 Prisma models (`CommunityForumPost`,
`CommunityForumReply`, `CommunityForumVote`, `FeatureRequest`, `FeatureRequestVote`,
`FeatureRequestComment`, `DiscordIntegration`, `CommunityActivity`, `ModerationAction`,
`UserModerationHistory`, `ContentReport`, `AutoModerationRule`, `SpamDetection`,
`ModerationQueue`, `CommunityAnalytics`).

The subsystem is not runnable today, and much of it would still be broken even after the
Prisma client can be regenerated (ADR-0002). Verified against the code on 2026-07-02:

- **No generated client / no migrations.** The checked-in Prisma client contains none of
  the community models and the sole migration has none of their tables; every
  `prisma.communityForumPost.*` call throws at runtime. `prisma validate` fails with 33
  errors, including — inside this subsystem — a duplicate `actions` field on
  `AutoModerationRule` (`actions Json` and `actions ModerationAction[]`,
  `prisma/schema.prisma` ~lines 4615–4650).
- **Schema-mismatched writes.** `src/app/api/community/spam-detection/route.ts` (lines
  250–268) and `src/app/api/community/content-filtering/route.ts` create `SpamDetection`
  rows with fields that do not exist on the model (`targetType`, `targetId`,
  `detectionType`, `confidence`, `reasons`, `metadata`, `status`, `autoDetected`); the
  actual model (schema lines 4655–4695) has `contentType`, `contentId`, `isSpam`,
  `confidenceScore`, `spamType`, `detectionFactors`, `matchedPatterns`,
  `suspiciousWords`. They also pass `workspaceId: workspaceId || null` although the
  column is required.
- **Invalid enum usage.** Community routes write `CommunityActivity.activityType` values
  that are not in the `CommunityActivityType` enum (schema lines 4257–4268), e.g.
  `'MODERATION_ACTION'`, `'REPORT_SUBMITTED'`, `'DISCORD_WEBHOOK_SENT'`,
  `'DISCORD_ADMIN_ACTION'`, `'DISCORD_MEMBER_ACTION'`, `'FEATURE_REQUEST_MERGED'`,
  `'FEATURE_REQUEST_MODERATED'`, `'FEATURE_REQUEST_MODERATION'`,
  `'FEATURE_REQUEST_BULK_MODERATION'` — roughly 20 `communityActivity.create()` call
  sites in total. Discord routes additionally filter with
  `activityType: { startsWith: 'DISCORD_' }` (`discord/admin/route.ts:144`,
  `discord/webhooks/route.ts:101,107,116,134`), which Prisma does not support on enums.
- **Nonexistent model references.** `analytics/route.ts` (lines 162, 276, 388, 533,
  594), `insights/route.ts` (425, 448) and `health/route.ts` (199) call
  `prisma.communityForumComment`; the model is `CommunityForumReply`
  (schema line 3975).
- **Missing API surface.** There are no endpoints at all for forum replies, forum votes,
  a single-post view, or feature-request comments, despite the models existing.
  `ModerationQueue` and `CommunityAnalytics` have no management API.
- **No working UI.** `src/components/admin/admin-sidebar.tsx` (lines 79–85) links to
  `/dashboard/admin/community` and four child pages (moderation, forum, discord,
  analytics); no `community` directory exists under `src/app/dashboard/admin` — all five
  links 404. `src/components/dashboard/help/help-center.tsx` (lines 309, 313, 448, 452)
  opens `/community/forum`, `/community/forum/new`, `/community/feature-requests`,
  `/community/feature-requests/new`; `src/app/community` does not exist. The only
  community component actually mounted, `src/components/community/community-integration.tsx`,
  builds a malformed URL when `workspaceId` is absent (line 90:
  `/api/community/activity` + `&limit=10` with no `?`).
- **Mock internals.** Analytics/health/insights and moderation stats mix real
  aggregation with `Math.random()` scores and hardcoded values;
  `content-filtering/rules/route.ts:302` exports `GET_TEMPLATES`, which Next.js never
  routes (dead code).

The owner has decided (2026-07-02) to focus repair effort on Support tickets/chat
(ADR-0011), Admin RBAC (ADR-0012), and Stripe billing (ADR-0019), and to **defer**
Community, Documentation management (ADR-0014), and Discord (ADR-0015). The question
this ADR answers is *how* to defer: what mechanism gates the code, what user-visible
surfaces must be hidden, and what conditions and work items govern un-deferral.

## Decision Drivers

- Engineering capacity must go to revenue- and reliability-critical subsystems first
  (support, RBAC, billing, publishing pipeline).
- The community surface must not be reachable in production: today it can only throw
  500s, 404 dead links, and confusing empty states — all of which erode trust.
- The gate must not itself depend on broken infrastructure. A `FeatureFlag` model exists
  in `prisma/schema.prisma` (line 5542), but it belongs to the admin settings subsystem
  whose remediation is only Proposed (ADR-0016), and the schema currently fails
  validation (ADR-0002). Gating dead code on other dead code is circular.
- Deferral must be cheap to implement and cheap to reverse; the models and route logic
  contain genuinely salvageable work (workspace-role checks, pagination, moderation
  workflow design).
- Schema validity is non-negotiable regardless of deferral: the duplicate
  `AutoModerationRule.actions` field blocks `prisma generate` for the whole platform,
  so it cannot be "deferred with the subsystem".

## Considered Options

1. **Repair the community subsystem now.** Fix the schema mismatches, build the missing
   reply/vote/comment endpoints and the entire public forum UI, replace mock metrics.
   Rejected: this is multiple engineer-months of work (the missing UI alone is a
   product-sized effort) for a feature with no current users, taken directly from
   support/RBAC/billing capacity.
2. **Delete the community code entirely** (aggressive ADR-0024 hygiene): remove routes,
   components, and models; restore from git history if ever needed. Cleanest tree and
   zero maintenance, but discards salvageable design work, forces model removal to be
   coordinated with ADR-0002 migrations, and makes un-deferral a re-import project
   rather than a repair project. The owner's decision is defer, not abandon.
3. **Defer behind a static env-based feature flag with a middleware gate.** Add a
   `FEATURE_COMMUNITY` flag (default off) in a small static config module; add a root
   Next.js middleware that 404s `/api/community/**` and `/community/**` when off; remove
   the dead admin-sidebar group and gate the help-center buttons and
   `community-integration` mount. Code and models stay in place; internals are not
   fixed until un-deferral.
4. **Defer behind the DB-backed `FeatureFlag` model.** Same surface changes as option 3
   but evaluated per-workspace from the database. Rejected for now: the flag system
   lives in the broken admin-settings subsystem (ADR-0016 is Proposed, not landed), adds
   a DB read to every gated request, and per-workspace granularity is pointless for a
   feature that is broken for everyone.

## Decision Outcome

**Option 3: defer behind a static env-based feature flag, enforced by middleware, with
all UI entry points removed or gated.**

Mechanics:

- `src/lib/config/features.ts` exports a static `FEATURES` object read once from
  environment variables: `FEATURE_COMMUNITY` (this ADR), plus `FEATURE_DOCS_MANAGEMENT`
  (ADR-0014) and `FEATURE_DISCORD` (ADR-0015) so all three deferrals share one
  mechanism. All default to `false`. Helper: `isFeatureEnabled(name)`.
- A root `src/middleware.ts` (none exists today) matches `/api/community/:path*` and
  `/community/:path*` and returns a JSON 404 (`{ error: 'Not found' }`) for API paths
  and a 404 rewrite for page paths when the flag is off. One file gates all 36 route
  files without touching them; the deferred code stays byte-identical, which keeps the
  eventual repair diff clean. Discord routes live under `/api/community/discord/**` and
  are therefore covered here as well as by ADR-0015.
- UI entry points are removed rather than left to 404: the Community group in
  `admin-sidebar.tsx`, the four community buttons in `help-center.tsx`, and the
  `CommunityIntegration` mount. Hiding the launch points is defense in depth on top of
  the middleware; users should never see a door that opens onto a 404.
- Internals of deferred code are **not** fixed now (including the malformed URL in
  `community-integration.tsx:90` — the component is simply not mounted). Exception:
  schema validation errors (duplicate `actions` field, relation-name mismatches on
  `User`) are fixed under ADR-0002 because they block `prisma generate` platform-wide.
  The community tables may ship in migrations as inert tables; empty tables are harmless.
- When ADR-0016 lands a working `FeatureFlag` runtime, the static gate *may* be migrated
  to it; until then env config is the source of truth.

**Un-defer criteria (all required before any repair work starts):**

1. ADR-0011 support remediation shipped and stable in production.
2. ADR-0012 admin RBAC remediation shipped (community moderation is meaningless without
   trustworthy admin authorization).
3. Core publishing pipeline (ADR-0008) and Stripe billing (ADR-0019) live and stable.
4. ADR-0002 migration-first workflow landed (valid schema, real migrations).
5. An explicit product decision that a public forum is wanted, with UI designs — the
   missing forum UI is the largest single work item and must not be rebuilt "because
   the API exists".

## Consequences

### Positive

- Zero user-visible breakage from this subsystem: no 500s from undefined Prisma models,
  no dead sidebar links, no buttons opening nonexistent pages.
- Roughly 36 route files (~thousands of lines) removed from the operational and security
  surface with a one-file gate; support/RBAC/billing work proceeds undistracted.
- Deferral is reversible by flipping one env var (in a dev environment) — repair work
  can be tested behind the flag without a long-lived branch.
- Shared flag mechanism reused by ADR-0014 and ADR-0015; one pattern to audit.
- The documented repair backlog (below) converts audit findings into an actionable
  checklist so un-deferral starts from knowledge, not re-discovery.

### Negative

- Dead code remains in the tree and will rot: it will not be exercised by tests, and
  drift against evolving conventions (ADR-0003 auth helpers, Next.js 15 params) will
  accumulate, making eventual repair somewhat harder.
- The community Prisma models stay in the schema and ship as empty tables, slightly
  enlarging migrations and the generated client.
- Grep/IDE noise: developers will keep hitting broken code (e.g.
  `prisma.communityForumComment`) that typechecking may flag; suppressions or `README`
  markers are needed to signal intentional deferral.
- An env misconfiguration (`FEATURE_COMMUNITY=true` in production) would expose broken
  endpoints; mitigated below.

## Implementation Plan

Phase 1 — Gate (do now, alongside ADR-0011/0012 work):

1. **(S)** Create `src/lib/config/features.ts`: static `FEATURES` map from
   `process.env.FEATURE_COMMUNITY` / `FEATURE_DOCS_MANAGEMENT` / `FEATURE_DISCORD`
   (all default `false`), `isFeatureEnabled()` helper. Document the vars in
   `.env.example` and the Docker compose env (ADR-0022).
2. **(S)** Create root `src/middleware.ts` with a `matcher` covering
   `/api/community/:path*` and `/community/:path*`; when `FEATURE_COMMUNITY` is off,
   return JSON 404 for `/api/*` and rewrite pages to the 404 route. Coordinate the
   matcher list with ADR-0014 so docs paths are added to the same middleware.
3. **(S)** `src/components/admin/admin-sidebar.tsx`: delete the Community nav group
   (parent `/dashboard/admin/community` plus the four children at lines 79–85 — all
   five targets are nonexistent pages today).
4. **(S)** `src/components/dashboard/help/help-center.tsx`: remove or flag-gate the
   community tab content — the four `window.open('/community/...')` buttons (lines
   309, 313, 448, 452) — and stop rendering `<CommunityIntegration>` when the flag is
   off (which is always, until un-deferral).
5. **(S)** Add a `src/app/api/community/README.md` stating the subsystem is deferred
   per this ADR, with the repair backlog reference, so future contributors do not
   "fix" or extend it casually (supports ADR-0024).
6. **(S)** Tests (ADR-0021): a smoke test asserting that with the flag off,
   `GET /api/community/forum` and `GET /community/forum` return 404, and the admin
   sidebar renders no community links. Exclude `src/app/api/community/**` from coverage
   thresholds so dead code does not distort quality gates.

Phase 2 — Schema hygiene (owned by ADR-0002, prerequisite for everything):

7. **(M)** Fix `AutoModerationRule` duplicate `actions` field (rename the relation to
   `moderationActions`), fix `User` moderation relation-name mismatches
   (`UserModerationHistory`/`ContentReport`), and land community tables in the
   migration baseline as inert tables. This is not community repair — it unblocks
   `prisma generate` for the whole platform.

Phase 3 — Repair backlog (executed only after un-defer criteria are met; recorded here
so the audit knowledge is not lost):

8. **(M)** Rewrite `SpamDetection` writes in `spam-detection/route.ts` and
   `content-filtering/route.ts` to the real fields (`contentType`, `contentId`,
   `isSpam`, `confidenceScore`, `spamType`, `detectionFactors`, `matchedPatterns`,
   `suspiciousWords`); make `workspaceId` required in the request path.
9. **(M)** Reconcile `CommunityActivityType`: extend the enum (e.g. add
   `MODERATION_ACTION`, `REPORT_SUBMITTED`, `DISCORD_WEBHOOK_SENT`,
   `DISCORD_ADMIN_ACTION`, `DISCORD_MEMBER_ACTION`, `FEATURE_REQUEST_MERGED`,
   `FEATURE_REQUEST_MODERATED`, `FEATURE_REQUEST_BULK_MODERATION`) or map writes to
   existing values across the ~20 call sites; replace `startsWith` enum filters in
   `discord/admin/route.ts` and `discord/webhooks/route.ts` with explicit `in: [...]`
   lists.
10. **(S)** Replace `prisma.communityForumComment` with `prisma.communityForumReply`
    at the 8 call sites in `analytics/route.ts`, `insights/route.ts`,
    `health/route.ts`.
11. **(S)** Remove the invalid `GET_TEMPLATES` export from
    `content-filtering/rules/route.ts:302` (fold into `GET` via a query param or a
    `/templates` route); fix the malformed activity URL in
    `community-integration.tsx:90`; fix the nonexistent `severity` select in
    `users/[userId]/route.ts`.
12. **(L)** Build the missing API surface: forum replies, forum votes, single-post
    view, feature-request comments; management APIs for `ModerationQueue` and
    `CommunityAnalytics`. Follow ADR-0003 conventions and Next.js 15 awaited params.
13. **(L)** Build the missing UI: public `/community/forum` and
    `/community/feature-requests` pages and the four `/dashboard/admin/community/*`
    admin pages, then restore the sidebar/help-center entry points behind the flag.
14. **(M)** Replace mock metrics (`Math.random()` health history, hardcoded dashboard
    values, mock sentiment analysis) with real aggregations per ADR-0023, or remove
    the affected panels.

## Risks and Mitigations

- **Flag accidentally enabled in production.** Default is off; the flag is not exposed
  in any settings UI; ADR-0022 deployment docs list it under "must remain false in
  production until ADR-0013 Phase 3"; the Phase-1 smoke test runs in CI with the
  production-default env.
- **Middleware is a single point of gating.** UI entry points are independently removed
  (defense in depth); the smoke test pins the 404 behavior so a middleware refactor
  cannot silently un-gate the routes.
- **Dead code rots and confuses contributors.** README marker (step 5), coverage
  exclusion (step 6), and ADR-0024 hygiene rules ("do not extend deferred subsystems")
  contain the blast radius; the repair backlog here keeps the knowledge current.
- **Schema work drags community concerns in early.** Phase 2 is deliberately scoped to
  validation-blocking fixes only; no behavioral repair happens under ADR-0002.
- **Un-deferral scope creep.** Criterion 5 requires an explicit product decision with
  designs before Phase 3 starts; the forum UI is not to be rebuilt just because the
  API exists.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — owns Phase 2
  (duplicate `actions` field, relation-name fixes, migration baseline); prerequisite
  for any un-deferral.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — repaired routes must
  adopt these conventions in Phase 3.
- ADR-0004: Platform Authorization Model and RBAC Enforcement / ADR-0012: Admin
  Dashboard and RBAC Subsystem Remediation — moderation tooling depends on trustworthy
  admin authorization; ADR-0012 shipping is un-defer criterion 2.
- ADR-0008: Background Jobs and the Publishing Pipeline — core-pipeline stability is
  un-defer criterion 3.
- ADR-0011: Support Subsystem Remediation — the repair-now counterpart; its shipping is
  un-defer criterion 1.
- ADR-0014: Documentation Management: Defer Behind Feature Flag — shares the
  `features.ts` config and middleware gate introduced here.
- ADR-0015: Discord Integration: Defer — Discord routes are nested under
  `/api/community/**` and are gated by this ADR's middleware in addition to their own
  deferral.
- ADR-0016: System Settings & Configuration — owns the DB-backed `FeatureFlag` model;
  the static gate may migrate to it once that ADR lands.
- ADR-0019: Billing and Subscriptions with Stripe — competing in-scope work; un-defer
  criterion 3.
- ADR-0021: Testing Strategy and Honest Quality Gates — flag-off smoke tests and
  coverage exclusions.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — environment variable
  management for the flags.
- ADR-0023: Observability: Real Metrics, Logging, and Health — governs replacing the
  mock metrics during Phase 3.
- ADR-0024: Codebase Hygiene — deferred-code markers and the rule against extending
  deferred subsystems.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — no community seed data exists;
  any future seeds are Phase 3 work.
