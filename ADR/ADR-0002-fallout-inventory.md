# ADR-0002 Phase 2 Divergence Inventory (Fallout of Client Regeneration)

- Date: 2026-07-02
- Status: Informational — tracked checklist, not a spec
- Produced by: ADR-0002 Implementation Plan, Phase 2 (client regeneration and fallout inventory)
- Purpose: **Entry-criteria handoff** for the owners of ADR-0003 (auth helpers), ADR-0011
  (support), ADR-0012 (admin/RBAC), ADR-0013 (community), ADR-0014 (documentation), per
  ADR-0002 Phase 5 item 2. Per Decision Outcome item 5, **schema wins over route code**:
  nothing below is fixed by editing `prisma/schema.prisma`; every item is route-/lib-side work
  owned by the ADR named next to it.

## Regeneration result (Phase 2 step 1)

- `npx prisma generate` succeeded (Prisma Client v6.15.0).
- `node_modules/.prisma/client/schema.prisma` now contains **137 models** (was 72 in the stale
  2025-10-16 client; 146 declared before Phase 1 minus the duplicate RBAC `UserSession` and the
  eight ADR-0004/0012 model deletions).
- Client accessors verified: `prisma.supportTicket` ✅ present, `prisma.documentationPage` ✅
  present, single `prisma.userSession` ✅ (canonical analytics shape: `startTime`, `endTime`,
  `lastActivity`, `duration`, `userAgent`, `ip`, `pages`, `metadata`, plus the new
  `userActivities` back-relation). `prisma.role` ❌ absent and `prisma.team` ❌ absent, as
  required by Decision Outcome item 6.

## How the error inventory was measured (read this before comparing numbers)

`npx tsc --noEmit` (Phase 2 step 2) exits 2 but prints **only 38 errors** — all of them
syntax/parse errors in 5 files. TypeScript's CLI **suppresses all semantic diagnostics while any
syntactic error exists in the program**, so the CLI output is *identical before and after* this
remediation; the real fallout is hidden behind the parse errors. The five syntactically broken
files (pre-existing, untouched by ADR-0002; hygiene owner ADR-0024):

- [ ] `__tests__/utils/test-helpers.ts` (9 parse errors) — ADR-0024
- [ ] `src/app/api/community/analytics/route.ts` (1) — ADR-0013
- [ ] `src/app/api/community/moderation/audit/route.ts` (3) — ADR-0013
- [ ] `src/components/api-docs/code-examples.tsx` (15) — ADR-0024
- [ ] `src/components/performance/performance-dashboard.tsx` (1) — ADR-0024
- [ ] `src/lib/lazy-components.ts` (8) — ADR-0024

The semantic inventory below was therefore extracted with the TypeScript compiler API
(`program.getSemanticDiagnostics()` against the project `tsconfig.json`, same compiler version)
so the parse-error gate could not mask it.

## Totals

| Layer | Count |
|---|---|
| Syntactic errors (what the `tsc` CLI shows) | 38 |
| Semantic errors (compiler API, masked from the CLI) | 2,382 |
| **Total** | **2,420** |
| Distinct files with errors | 348 |

Top error codes (semantic): TS2339 ×596, TS2322 ×476, TS2304 ×252, TS2353 ×222, TS7006 ×145,
TS2307 ×85, TS2582 ×75, TS2345 ×62.

## Pre-existing vs newly surfaced (as far as grep allows)

Strict caveat: because the CLI gate hid *all* semantic errors both before and after Phase 1,
"newly surfaced" here means *newly attributable to the regenerated 137-model client's types*;
grep against error signatures is the classifier, not a before/after tsc diff (the stale client
was overwritten by `prisma generate` and cannot be re-diffed cheaply).

### A. Pre-existing, independent of the schema/client (already broken before ADR-0002)

- **90 errors — broken auth-helper imports (ADR-0003, exactly as predicted in ADR-0002
  "Consequences"):**
  - 26 × TS2307 `Cannot find module '@/lib/auth/utils'` (26 importing files, repo-grep confirmed)
  - 12 × TS2307 `Cannot find module '@/lib/auth-utils'` (12 importing files)
  - 19 × TS2305 `'@/lib/utils'` has no exported member `normalizeUserId`
  - 7 × TS2305 `'@/lib/auth'` has no exported member `normalizeUserId`
  - 26 × TS2459 `'@/app/api/auth/[...nextauth]/route'` declares `authOptions` locally but does
    not export it
  - Distribution: 78 in `src/app/api/admin/**`, 12 in `src/app/api/documentation/**`
- **47 errors — missing npm packages / missing local modules** (TS2307 other than the two auth
  paths): `sonner` ×8, `openapi-types` ×3, `react-markdown`/`remark-*`/`rehype-*` ×7,
  `@/components/ui/alert-dialog` ×3, `node-mocks-http` ×2, `@tinymce/tinymce-react` ×2,
  `@/components/ui/collapsible` ×2, `puppeteer`, `cmdk`, `react-datepicker`,
  `react-syntax-highlighter` ×2, `@dnd-kit/modifiers`, plus 9 missing local component/route
  modules — ADR-0024 (or the subsystem ADR that owns the importing file).
- **~281 errors — test globals not typed** (`expect` ×171, `it` ×54, `jest` ×41, `describe` ×11,
  `test` ×10, `beforeEach` ×4) in `__tests__/**` and `e2e/**`: jest/playwright types not wired
  into the type-check — ADR-0024 / ADR-0021.
- **237 errors — `Promise<string>` used where `string` expected**: unawaited async helpers /
  Next.js 15 async `params`–`headers()` misuse in route code (concentrated in
  `src/app/api/community` ×136 and `src/app/api/admin` ×73; also `support`, `documentation`).
  Pre-existing route-code defects; owned by each route's subsystem ADR.
- **49 errors — `.next/types/**` build artifacts** (stale Next.js 15 typegen checking old route
  signatures for the async-`params` contract). Regenerated on next build; exclude from counts
  when triaging. — ADR-0024/ADR-0022.
- **145 × TS7006 implicit `any`**, duplicate function implementations (TS2393/TS2323 ×28 in
  `src/app/api/documentation/{comments,cross-references,templates,versions,workflow}/route.ts`,
  `src/lib/cache/next-cache.ts`, `src/lib/jobs/job-scheduler.ts`), and assorted lib-level API
  mismatches (`BusinessLogger.logSystemEvent` ×41 etc.) — pre-existing.

### B. Newly surfaced/attributable to the regenerated client (schema-vs-route divergences)

- **42 errors — accessors for models that do not exist on `PrismaClient`:**
  - Cut by Decision Outcome item 6 (routes must be rewritten, ADR-0012): `role` ×14,
    `sSOProvider` ×8, `permission` ×5, `team` ×2, `sSOAccount` ×2, `userInvitation` ×1
  - Never defined in the schema at all: `communityForumComment` ×8 (ADR-0013),
    `postingTimeAnalysis` ×1 (ADR-0024 dead code or future ADR)
- **~191 × TS2353 — unknown properties in Prisma input types** (`...WhereInput`, `...Include`,
  `...CreateInput`, ...): routes write fields the schema does not have, e.g. `forumComments` on
  `UserWhereInput` ×13 (ADR-0013), `action` on `DocumentationReview` create ×9 (ADR-0014),
  `analyticsMetrics` on `PostInclude` (automation libs), `permissions` on
  `UserWorkspaceCreateInput` (`prisma/seed.ts:284` — see seed section).
- **~174 × TS2339 — properties missing on generated model payload types**, e.g. community
  models missing `botToken` ×18, `targetId` ×13, `targetType` ×10, `user` ×18 (ADR-0013);
  `DocumentationPage`/version/workflow shape gaps ×17+ (ADR-0014); `Post.contentType`/
  `Post.platforms`/`Post.analyticsMetrics` in `src/lib/automation` ×13.
- **37 — enum literal mismatches**, e.g. `"MODERATION_ACTION"` not in `CommunityActivityType`
  ×15, `SpamDetection` string/null filter mismatches (ADR-0013).
- **10 × TS2305 — missing `@prisma/client` exports**: `Platform` ×9 (schema enum is
  `SocialProvider`), `GapAnalysisStatus` ×1.

## Checklist by owning ADR (semantic errors per top-level area)

Counts are semantic errors from the compiler-API run; an area is "done" when its subsystem ADR
lands and the area type-checks against the canonical schema. **Do not edit the schema to appease
any of these.**

### ADR-0003 — Auth helper consolidation (cross-cutting, 90 errors)
- [ ] Create/consolidate `@/lib/auth/utils` & `@/lib/auth-utils` targets or rewrite the 38
      importing files (26 + 12) to the canonical helper
- [ ] Export or relocate `authOptions` from `src/app/api/auth/[...nextauth]/route.ts` (26 uses)
- [ ] Provide `normalizeUserId` where routes expect it (19 expect it from `@/lib/utils`, 7 from
      `@/lib/auth`)

### ADR-0011 — Support subsystem (≈57 errors)
- [ ] `src/app/api/support` — 24 (async `headers()`/`Promise<string>` misuse ×12; `SupportTicket`
      filter/shape mismatches; `userWorkspaces` not in `WorkspaceInclude`)
- [ ] `src/components/support` — 1
- [ ] `src/app/api/help` — 7 and `src/components/help` — 4 (help center; reassign to ADR-0012 if
      admin owns it)
- [ ] Note: `src/app/api/admin/support` (32) and `admin/support-agents` (15) are counted under
      ADR-0012 below but touch the support domain — coordinate

### ADR-0012 — Admin/RBAC subsystem (≈530 errors)
- [ ] `src/app/api/admin` — 492 total, by subarea: `help` 245, `settings` 49, `sso` 34,
      `support` 32, `users` 30, `roles` 18, `support-agents` 15, `bulk-operations` 15,
      `workspaces` 13, `teams` 10, `permissions` 10, `analytics` 9, `audit-logs` 5,
      `client-branding` 4, `landing-page` 3
- [ ] Rewrite consumers of deleted RBAC models: `prisma.role` ×14, `prisma.sSOProvider` ×8,
      `prisma.permission` ×5, `prisma.team` ×2, `prisma.sSOAccount` ×2, `prisma.userInvitation`
      ×1 (Decision Outcome item 6; reuse `TeamInvitation`, `WorkspaceRole`, `isPlatformAdmin`)
- [ ] Rewrite admin routes that expected the deleted RBAC `UserSession`
      (`lastActiveAt`/`sessionToken`) against canonical `UserSession` + NextAuth `Session`
- [ ] `src/components/admin` — 22
- [ ] 78 of the ADR-0003 auth-import errors sit in these same admin files — sequence after 0003

### ADR-0013 — Community subsystem, deferred behind flag (≈580 errors)
- [ ] `src/app/api/community` — 578 (dominant: unawaited `Promise<string>` ×136;
      `botToken`/`targetId`/`targetType`/`user` payload gaps; `forumComments` not in
      `UserWhereInput` ×13; `"MODERATION_ACTION"` not in `CommunityActivityType` ×15;
      `prisma.communityForumComment` undefined ×8; `SpamDetection` filter mismatches)
- [ ] `src/components/community` — 1
- [ ] 2 of the 5 parse-error files are community routes (`analytics/route.ts`,
      `moderation/audit/route.ts`) — fixing them may reveal more semantic errors in those files
- [ ] May reintroduce `User.reportedContent` with a real `reportedUserId` column (via migration)

### ADR-0014 — Documentation management, deferred behind flag (≈164 errors)
- [ ] `src/app/api/documentation` — 153 (duplicate `POST`/function implementations ×28 in 5
      route files; `DocumentationReview.action` unknown ×9; page/version/workflow payload shape
      gaps; 12 broken `@/lib/auth/utils` imports → ADR-0003 first)
- [ ] `src/components/documentation` — 3; `src/components/api-docs` — 7 (plus 15 parse errors in
      `code-examples.tsx`); `src/components/video-tutorials` — 1

### ADR-0024 — Codebase hygiene / dead code (≈700 errors, judgment-call bucket)
- [ ] `__tests__` — 313 and `e2e` — 17 (test globals untyped ×281; broken `test-helpers.ts`) —
      coordinate with ADR-0021
- [ ] `.next` — 49 (stale typegen artifacts; regenerate/exclude)
- [ ] `src/lib/jobs` — 115 (`BusinessLogger.logSystemEvent` ×41, `getDuration` ×21,
      `APIResponse<AnalyticsData>` shape drift)
- [ ] `src/lib/automation` — 82 (`Post.contentType`/`platforms`/`analyticsMetrics` divergences;
      `Platform` enum import ×4 — schema says `SocialProvider`)
- [ ] `src/services` — 63 (social API wrapper type drift); `src/app/api/ai` — 47;
      `src/lib` top-level — 35; `src/lib/notifications` — 25; `src/lib/visual` — 20;
      `src/lib/ai` — 18; `src/app/api/notifications` — 17
- [ ] `src/components/dashboard` — 116 (largely missing npm packages: `sonner`, tinymce,
      react-markdown, dnd-kit modifiers, plus missing local components)
- [ ] Remaining long tail (≤16 each): `src/app/dashboard` 16, `src/app/api/analytics` 15,
      `src/lib/database` 12, `src/lib/utils` 11, `src/app/api/automation` 11,
      `src/app/api/accounts` 9, `src/app/api/social` 8, `src/app/api/client-reports` 6, and
      ~30 more areas totaling ≈90 — triage individually; `src/lib/analytics/user-analytics.ts`
      and duplicate seed files are named deletion candidates in ADR-0024
- [ ] `prisma.postingTimeAnalysis` accessor (1) — model never defined; dead code candidate

## `prisma/seed.ts` status (Phase 2 step 3 — checked, not run; DB has no tables yet)

- ✅ **No references to any deleted model**: grep for `prisma.role|userRole|permission|team|
  teamMember|userInvitation|ssoProvider|sSOProvider|ssoAccount|sSOAccount` → zero matches.
- ✅ **Writes the canonical analytics `UserSession` shape**: `prisma/seed.ts:615` creates
  `{ userId, startTime, endTime, lastActivity, duration, userAgent, ip, pages }` — exactly the
  canonical model; `deleteMany` at line 162 also targets `userSession`.
- ❌ **One real blocker for Phase 3 reseed**: `prisma/seed.ts:284` still writes
  `permissions: {...}` inside `prisma.userWorkspace.create(...)`. `UserWorkspace.permissions`
  was dropped by this ADR (Decision Outcome item 6), so this is now TS2353 at type level and
  will throw `PrismaClientValidationError` at runtime when Phase 3 runs `npm run db:seed`
  (`tsx` does not type-check, so the throw is the failure mode). **Must be removed before the
  Phase 3 `migrate reset` + seed step** (ADR-0002-owned; ADR-0025 later reworks seeding
  wholesale).
- ⚠️ 12 further pre-existing type errors in seed.ts (readonly `as const` arrays passed to
  mutable-array params ×6, `unknown`-typed `randomChoice` results ×4, `workspace` possibly
  undefined ×2) — type-level only; harmless at runtime under `tsx`.

## Handoff rule

This inventory is the entry criteria for ADR-0003/0011/0012/0013/0014. ADR-0002 itself proceeds
to Phase 3 (baseline migration) without fixing any item above except the single seed.ts
`permissions` line, which gates Phase 3 step 2.
