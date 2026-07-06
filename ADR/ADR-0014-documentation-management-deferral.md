# ADR-0014: Documentation Management: Defer Behind Feature Flag

- Date: 2026-07-02
- Status: Accepted — **Phase 0–2 implemented 2026-07-06**; Phase 3 repair (or Help-Center merge) deferred
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-06).** The Documentation management layer is deferred behind
> `FEATURE_DOCS_MANAGEMENT` (default false, shared `src/lib/config/features.ts`). The middleware 404s
> `/api/documentation/**` (all 19 routes) when off — verified live; `src/app/dashboard/documentation/
> layout.tsx` calls `notFound()` when off, gating the browser/viewer/manage pages (`/dashboard/
> documentation` → 404, verified). The Documentation card in `help-center.tsx` is hidden behind
> `NEXT_PUBLIC_FEATURE_DOCS_MANAGEMENT`. A deferral README marker sits in `src/app/api/documentation/`.
> Phase 0 (the 15 missing `Documentation*` enums) already landed in ADR-0002. The **Phase 3 repair**
> (auth, schema alignment, status-casing unification, seed content, real export persistence) — or,
> per this ADR's default un-defer path, a **merge into the Help Center** — remains deferred.

## Context and Problem Statement

SociallyHub contains a large "Documentation" subsystem that is separate from the working
public Help Center. It consists of:

- **12 Prisma models** (`DocumentationSection`, `DocumentationPage`, `DocumentationVersion`,
  `DocumentationCodeExample`, `DocumentationAnalytics`, `DocumentationComment`,
  `DocumentationCrossReference`, `DocumentationTemplate`, `DocumentationCollaborator`,
  `DocumentationRevision`, `DocumentationWorkflow`, `DocumentationExport`) at
  `prisma/schema.prisma:2969-3513`.
- **15 API route directories** under `src/app/api/documentation/` (pages, sections, search,
  analytics, manage, versions, workflow, comments, collaboration, cross-references,
  code-examples, templates, export, export/offline, api-docs).
- **Dashboard UI**: a public docs browser (`src/app/dashboard/documentation/page.tsx`,
  425 lines), a page viewer (`[slug]/page.tsx`), a management dashboard
  (`manage/page.tsx`, 505 lines), and a 931-line editor
  (`src/components/documentation/documentation-editor.tsx`). The only navigation entry
  point is the "Documentation" card in
  `src/components/dashboard/help/help-center.tsx:349`.

This ADR covers that layer only. **The public Help Center (`/api/help/**`,
`/dashboard/help`) is explicitly NOT deferred** — it works against real models with seed
data and stays live.

The documentation layer is non-functional today, on several independent axes (verified
2026-07-02 against the working tree):

**1. The management routes cannot compile.** All 12 authenticated route files under
`src/app/api/documentation/` (`manage/route.ts`, `manage/[id]/route.ts`,
`versions/route.ts`, `workflow/route.ts`, `comments/route.ts`, `collaboration/route.ts`,
`cross-references/route.ts`, `code-examples/route.ts`, `templates/route.ts`,
`export/route.ts`, `export/offline/route.ts`, `api-docs/generate/route.ts`) contain
`import { normalizeUserId } from '@/lib/auth/utils'` — a module that does not exist.
`src/lib/auth/` contains only `auth-options.ts`, `config.ts`, `demo-user.ts`, and
`index.ts`. Module resolution fails the moment these routes build. (26 files repo-wide
share this broken import; the other 14 are outside this ADR's scope.)

**2. The routes were written against a schema that was never adopted.** Field-by-field
divergence between what the routes read/write and what `prisma/schema.prisma` defines:

| Model | Routes use | Schema actually has |
|---|---|---|
| `DocumentationPage` | `visibility` ('PUBLIC'/'INTERNAL'/'PRIVATE'), `metadata` (`manage/route.ts:204,212`) | `isPublic Boolean`; no `metadata` field |
| `DocumentationVersion` | `version` (`versions/route.ts:116,152`) | `versionNumber` |
| `DocumentationRevision` | `action`, `changes`, `comment` (`manage/[id]/route.ts:306-308,358-363`) | `revisionNumber` (required), `changeType`, `changeSummary`, `contentDiff`; `title`/`content` required |
| `DocumentationWorkflow` | `type`, `requestedById`, `notes` (`workflow/route.ts:178-184`) | `workflowType`, `requestedBy`; no `notes`; `title` required |
| `DocumentationExport` | `pageCount`, `metadata`, `createdById` (`export/route.ts:154-160`) | `requestedBy` (required), `exportType` (required); no `pageCount`/`metadata` |

**3. A status-casing split makes managed content invisible.** The public browser routes
filter `status: 'published'` (lowercase — `pages/route.ts:14`, `search/route.ts:119`,
matching `DocumentationPage.status String @default("published")`), while the management
layer writes `'PUBLISHED'` (uppercase — `manage/route.ts:213`, `manage/[id]/route.ts:258`,
`workflow/route.ts:380,523`, `export/route.ts:32`, `api-docs/generate/route.ts:103`).
Even if the routes compiled, content published through the manage UI would never appear
in the public docs browser.

**4. The schema itself does not validate.** `npx prisma validate` fails with **33
errors, 30 of them in Documentation\* models** (the other three are the duplicate
`UserSession` model/`User.userSessions` field and the duplicate
`AutoModerationRule.actions` field — see ADR-0002's inventory). Seven Documentation
enums are defined (`prisma/schema.prisma:4912-4980`: `DocumentationStatus`,
`DocumentationVisibility`, `DocumentationCodeLanguage`, `DocumentationCommentType`,
`DocumentationExportFormat`, `DocumentationWorkflowType`,
`DocumentationWorkflowStatus`), but **fifteen enums referenced by the models are never
defined**: `DocumentationVersionStatus`, `DocumentationCodeTestStatus`,
`DocumentationDifficulty`, `DocumentationUserType`, `DocumentationCommentStatus`,
`DocumentationReferenceType`, `DocumentationRole`, `DocumentationCollaboratorStatus`,
`DocumentationChangeType`, `DocumentationRevisionStatus`, `DocumentationReviewStatus`,
`DocumentationWorkflowPriority`, `DocumentationExportType`, `DocumentationExportScope`,
`DocumentationExportStatus`. Prisma treats the undefined-type fields as relation fields,
so every `@@index` on them errors. This is not a self-contained problem: a schema that
fails `prisma validate` blocks `prisma generate` and `prisma db push` **for the entire
project**. Ironically, `DocumentationVisibility` is defined but used by no model — while
routes try to write a `visibility` field that doesn't exist.

**5. Nothing was ever migrated or seeded.** The sole migration
(`prisma/migrations/20250901141259_init/migration.sql`) creates zero `documentation_*`
tables. `src/lib/seeders/` contains `client-reports-seeder.ts`, `help-content-seeder.ts`,
and `video-tutorial-seeder.ts` — no documentation seeder. The public docs browser renders
an empty state on any fresh install.

**6. The public routes that do compile are insecure.** `POST /api/documentation/pages`
(`pages/route.ts:92` — no session check of any kind) and `PUT`/`DELETE
/api/documentation/sections/[slug]` accept unauthenticated writes.

**7. It duplicates the Help Center.** `DocumentationSection`≈`HelpCategory`,
`DocumentationPage`≈`HelpArticle` (slug, status, views, helpful votes, SEO fields),
`DocumentationRevision`≈`HelpArticleRevision`, `DocumentationWorkflow`≈`HelpArticleWorkflow`,
`DocumentationComment`≈`HelpArticleComment`, `DocumentationAnalytics`≈`HelpArticleAnalytics`,
`DocumentationTemplate`≈`HelpArticleTemplate`. The genuinely docs-specific pieces are
semver versions, code examples, cross-references, per-page collaborators, and export
jobs — none of which currently function.

The owner has decided (2026-07-02) that Support tickets/chat (ADR-0011) and Admin RBAC
(ADR-0012) are repaired now, while Community (ADR-0013), Documentation management (this
ADR), and Discord (ADR-0015) are deferred behind feature flags. The question this ADR
answers: exactly what "defer" means for documentation, what must still happen now, and
what the un-defer path is.

## Decision Drivers

- **Owner priorities**: engineering capacity goes to Support, Admin RBAC, and Stripe
  billing (ADR-0019). Documentation has no current user demand.
- **The broken schema cannot wait**: 30 of the schema's 33 validation errors sit in
  Documentation models, blocking `prisma validate`/`generate`/`db push` repo-wide and
  poisoning the migration-first workflow ADR-0002 establishes. Part of this fix is not
  deferrable.
- **Security**: unauthenticated write endpoints must not remain reachable in a
  self-hosted production deployment (ADR-0005, ADR-0022).
- **No user-visible value today**: no seed data, no migrated tables, broken routes — the
  section shows empty states and 500s at best.
- **Duplication cost**: a second, parallel content-management stack competes with the
  working Help Center for every future maintenance hour.
- **Consistency**: ADR-0013 establishes the deferral pattern (env-driven feature flags,
  404 gating); this ADR should reuse it, not invent a second mechanism.

## Considered Options

### Option 1: Repair the documentation layer now

Rewrite all 12 management routes against the real schema, add the 15 missing enums, adopt
ADR-0003 auth helpers, unify status casing, seed content, persist exports.

- Good: preserves the elaborate feature set (semver versions, collaborators, workflows).
- Bad: large effort (12 route files × field-by-field rewrite + 931-line editor +
  505-line manage page retest) for a feature nobody has asked for.
- Bad: directly competes with the owner-prioritized Support/RBAC/billing work.
- Bad: repairs a duplicate of the Help Center before deciding whether the duplicate
  should exist at all.

### Option 2: Delete the subsystem outright

Remove the 15 route directories, 3 dashboard pages, editor component, and 12 models.

- Good: maximum hygiene (ADR-0024); kills the validation errors at the root.
- Bad: destroys a substantial schema/UI investment before the merge-vs-standalone
  question is answered; model removal also touches `User` and `Workspace` relation
  fields, making it a wider migration than it looks.
- Bad: irreversible in practice — re-adding 12 models and 15 route trees later is a
  rewrite, not a revert.

### Option 3: Defer behind a feature flag, with an immediate schema-validity fix (chosen)

Flag off the entire documentation section (public browser + manage UI + all
`/api/documentation/**` routes, 404 when disabled). Fix only what leaks outside the
subsystem now: make the schema validate (define the 15 missing enums as part of
ADR-0002's remediation) so the shared Prisma toolchain works again. Everything else —
route/schema alignment, auth, seeding, export persistence — happens only if and when the
feature is un-deferred, against explicit criteria.

- Good: near-zero cost now; unauthenticated writes become unreachable (404) as a side
  effect of the gate; the repo-wide toolchain blockage is removed.
- Good: keeps the merge-into-Help-Center option open.
- Bad: dead code remains in the tree behind the flag (mitigated by ADR-0024 tracking and
  the explicit un-defer decision point below).

### Option 4: Merge into the Help Center immediately

Fold docs-specific capabilities (code examples, cross-references) into `HelpArticle` and
delete the Documentation models now.

- Good: ends the duplication decisively.
- Bad: the Help admin layer has its own systemic defect being fixed under ADR-0003 (~63
  un-awaited `normalizeUserId()` call sites in `/api/admin/help/**`); merging a broken
  subsystem into one under active repair maximizes risk.
- Bad: front-loads design work (content-type taxonomy, migration of enums/relations) that
  is only worth doing once there is a real requirement for developer docs.

## Decision Outcome

**Option 3.** The documentation layer — public browser (`/dashboard/documentation`,
`/dashboard/documentation/[slug]`), management UI (`/dashboard/documentation/manage`),
and all `/api/documentation/**` routes — is deferred behind a docs-management feature
flag (env `FEATURE_DOCS_MANAGEMENT`, default `false`), using the same mechanism ADR-0013
establishes for Community. The public browser is included in the gate deliberately: with
no migrated tables and no seed data it can only render an empty shell, and shipping an
empty top-level section erodes product credibility.

Two things are NOT deferred:

1. **Schema validity.** The 15 missing enums are defined (or the affected fields
   converted to `String`) as part of ADR-0002's remediation baseline, because the current
   state blocks `prisma validate`/`generate`/`db push` for every other feature. Additive
   enum definitions are the smallest safe diff; trimming 12 models would ripple into
   `User`/`Workspace` relations.
2. **The gate itself**, which makes the unauthenticated write endpoints
   (`POST /api/documentation/pages`, `PUT/DELETE /api/documentation/sections/[slug]`)
   unreachable in production.

**Long-term direction: merge into the Help Center is the default un-defer path.** The
subsystem duplicates seven Help models nearly one-to-one; its unique capabilities (code
examples, semver versions, cross-references) are cheaper to add to the repaired
`HelpArticle` stack than a parallel 12-model stack is to repair, secure, and maintain.
Standalone repair (Phase 3 below) is retained only for the case where a concrete product
requirement emerges — e.g. a public developer portal with semver-versioned API docs —
that the Help Center's flat article model genuinely cannot express.

## Consequences

### Positive

- Engineering capacity stays on Support (ADR-0011), Admin RBAC (ADR-0012), and Stripe
  billing (ADR-0019), per the owner's decision.
- `prisma validate` passes again; ADR-0002's migration-first workflow is unblocked for
  the whole repo.
- Unauthenticated documentation write endpoints return 404 in production.
- Users no longer reach an empty/broken Documentation section; the Help Center card that
  linked to it is hidden.
- The merge-vs-standalone decision is made deliberately at un-defer time, with the Help
  Center already repaired, instead of by sunk-cost momentum now.

### Negative

- ~2,000 lines of UI (`documentation-editor.tsx`, manage page, browser page) and 15
  route directories sit dormant behind a flag — dead weight for readers and refactors
  (tracked in ADR-0024's inventory).
- The 12 Documentation tables enter the ADR-0002 baseline migration despite being
  unused, enlarging the schema surface. (Accepted: excluding them means hand-editing the
  models out and re-adding later; the tables are inert.)
- No developer-documentation offering for the foreseeable future; the Help Center must
  carry any "how do I use the API" content in the interim.
- Anyone enabling `FEATURE_DOCS_MANAGEMENT=true` before Phase 3 gets the broken behavior
  back; the flag description must say so.

## Implementation Plan

### Phase 0 — Schema validity (now, with ADR-0002) — S

1. `prisma/schema.prisma`: define the 15 missing enums (ADR-0002's inventory, item 3)
   with values matching route usage and model defaults. Eight have values evident from
   route literals: `DocumentationVersionStatus` (DRAFT/PUBLISHED/DEPRECATED/ARCHIVED),
   `DocumentationChangeType` (CREATE/EDIT/DELETE/RESTORE), `DocumentationRevisionStatus`
   (SAVED/PUBLISHED/DISCARDED), `DocumentationReviewStatus` (PENDING/APPROVED/REJECTED),
   `DocumentationWorkflowPriority` (LOW/MEDIUM/HIGH/URGENT), `DocumentationExportType`
   (MANUAL/SCHEDULED/API), `DocumentationExportScope` (SINGLE_PAGE/SECTION/FULL_SITE),
   `DocumentationExportStatus` (PENDING/PROCESSING/COMPLETED/FAILED/EXPIRED). The other
   seven derive their values from the models' `@default(...)` sites:
   `DocumentationCodeTestStatus` (default UNTESTED), `DocumentationDifficulty`
   (BEGINNER/INTERMEDIATE/ADVANCED/EXPERT), `DocumentationUserType` (default VISITOR),
   `DocumentationCommentStatus` (default PUBLISHED), `DocumentationReferenceType`
   (default RELATED), `DocumentationRole` (default VIEWER), and
   `DocumentationCollaboratorStatus` (default PENDING).
2. Confirm `npx prisma validate` reports zero errors; include the `documentation_*`
   tables in ADR-0002's baseline migration.

### Phase 1 — Feature flag and gating (now) — S

1. `src/lib/config/features.ts` (created by ADR-0013): add `FEATURE_DOCS_MANAGEMENT: false`
   to the static `FEATURES` map, read from env `FEATURE_DOCS_MANAGEMENT`, default `false`.
   Document in `.env.example` with a warning that the feature is known-broken pending
   Phase 3.
2. `src/middleware.ts` (shared gate from ADR-0013): add prefixes `/api/documentation`
   and `/dashboard/documentation` → 404 when the flag is off. If ADR-0013 lands the gate
   as per-route guards instead, add `src/app/dashboard/documentation/layout.tsx` calling
   `notFound()` and a one-line `isFeatureEnabled('FEATURE_DOCS_MANAGEMENT')` guard at the
   top of each handler in the 15 route directories.
3. `src/components/dashboard/help/help-center.tsx:349`: render the Documentation card
   only when the flag is on.

### Phase 2 — Quarantine hygiene (now) — S

1. Register the dormant surface in ADR-0024's dead-code inventory: 15 route dirs, 3
   dashboard pages, `documentation-editor.tsx`, and the 12 models.
2. Exclude `/api/documentation/**` from any route-level test-coverage expectations
   (ADR-0021) while flagged off, so quality gates measure live code.

### Phase 3 — Repair plan (deferred; execute only on un-defer, and only if the standalone path is chosen) — L

1. **Auth (M)**: replace all 12 `'@/lib/auth/utils'` imports with the consolidated
   helpers from ADR-0003; every write route enforces session + workspace role per
   ADR-0004; remove the `TODO: Add authentication` writes on `pages`/`sections`.
2. **Schema alignment (M)**: fix routes to match the schema (schema is source of truth
   per ADR-0002) using the table in Context: `visibility/metadata` → `isPublic` (or a
   migration adopting the already-defined `DocumentationVisibility` enum — pick one and
   delete the loser), `version` → `versionNumber`, revision `action/changes/comment` →
   `changeType/contentDiff/changeSummary` + required `title/content/revisionNumber`,
   workflow `type/requestedById/notes` → `workflowType/requestedBy/comments` + required
   `title`, export writes supplying required `exportType`/`requestedBy`.
3. **One status story (S)**: migrate `DocumentationPage.status` from `String
   @default("published")` to the existing `DocumentationStatus` enum
   (DRAFT/REVIEW/PUBLISHED/ARCHIVED) with a lowercase→uppercase data migration; update
   `pages/route.ts:14` and `search/route.ts:119` to filter `PUBLISHED`. One casing,
   enforced by the type system.
4. **Seed content (S)**: add `src/lib/seeders/documentation-seeder.ts` (sections + pages)
   wired into the ADR-0025 seeding strategy, so the browser is never empty on install.
5. **Real export persistence (M)**: export routes create a `DocumentationExport` row,
   process async (ADR-0008 job runner), write the artifact to storage (ADR-0007), set
   `fileUrl`/`fileName`/`fileSize`/`expiresAt` instead of returning inline HTML; real PDF
   generation replaces print-optimized HTML.
6. **Delete the fakes (S)**: remove the mocked code-example "test execution" and the
   hardcoded `api-docs/generate` route list, or reimplement them honestly.

### Phase 4 — Un-defer decision gate — M

Before `FEATURE_DOCS_MANAGEMENT` defaults to `true`, all of:

1. A named product requirement exists that the Help Center cannot satisfy (the merge
   evaluation below happened and chose "standalone").
2. **Merge evaluation (mandatory first step)**: with the Help Center repaired under
   ADR-0003, assess folding docs-unique capabilities into `HelpArticle`
   (content-type/category kind + code-example and cross-reference extensions) and
   deleting the 12 Documentation models. If merge is chosen, Phase 3 is cancelled and
   replaced by the migration + deletion work, and this ADR is superseded.
3. If standalone: Phase 3 complete; E2E coverage for browse/search/manage/publish per
   ADR-0021; security review of all write routes per ADR-0005.

## Risks and Mitigations

- **Risk**: ADR-0002's baseline migration ships tables for models that may later be
  deleted in a merge. *Mitigation*: accepted consciously — dropping empty tables is a
  trivial migration; hand-excluding 12 interrelated models from the baseline is not.
- **Risk**: someone flips `FEATURE_DOCS_MANAGEMENT=true` in production before Phase 3.
  *Mitigation*: flag documented as known-broken in `.env.example` and
  `src/lib/config/features.ts`; default is off; ADR-0022's deployment config does not set it.
- **Risk**: gating diverges from ADR-0013's mechanism, producing two flag systems.
  *Mitigation*: Phase 1 explicitly reuses ADR-0013's `features.ts` and gate; this
  ADR defines no infrastructure of its own.
- **Risk**: dormant code silently rots (imports break under dependency bumps).
  *Mitigation*: it still type-checks in CI (compilation is not excluded — only runtime is
  gated); ADR-0024 inventory keeps it visible; Phase 4 forces a keep-or-kill decision
  rather than indefinite limbo.
- **Risk**: users lose the (never-functional) docs entry point and file support tickets
  asking where docs went. *Mitigation*: the Help Center — the working system — remains
  the single help surface; the removed card only ever led to an empty page.

## Related ADRs

- ADR-0001: Record Architecture Decisions — process this record follows.
- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — Phase 0 (the 15
  missing enums, baseline migration including `documentation_*` tables) executes there.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — the nonexistent
  `@/lib/auth/utils` import is an instance of the problem it solves; Phase 3.1 adopts its
  helpers.
- ADR-0004: Platform Authorization Model and RBAC Enforcement — role checks for any
  future manage routes.
- ADR-0005: API Security Hardening — the unauthenticated write endpoints this gate
  neutralizes; sign-off required at un-defer.
- ADR-0007: Media Storage, Uploads, and Serving Architecture — export artifact storage
  (Phase 3.5).
- ADR-0008: Background Jobs and the Publishing Pipeline — async export processing
  (Phase 3.5).
- ADR-0011: Support Subsystem Remediation (Tickets, Chat, Agents) — where repair
  capacity goes instead.
- ADR-0012: Admin Dashboard and RBAC Subsystem Remediation — likewise.
- ADR-0013: Community Subsystem: Defer Behind Feature Flag — sibling deferral; defines
  the flag + gating mechanism this ADR reuses.
- ADR-0015: Discord Integration: Defer — sibling deferral.
- ADR-0021: Testing Strategy and Honest Quality Gates — coverage exclusion while
  dormant; E2E requirement at un-defer.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — production env must not
  enable the flag.
- ADR-0024: Codebase Hygiene: Dead Code, Duplicates, and Repo Cleanup — tracks the
  dormant surface and the Help/Documentation duplication.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — documentation seeder (Phase 3.4).
