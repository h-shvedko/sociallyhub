# ADR-0002: Prisma Schema Remediation and Migration-First Workflow

- Date: 2026-07-02
- Status: Accepted
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

`prisma/schema.prisma` (5,869 lines, 146 `model` blocks) does not validate. `npx prisma validate`
(Prisma CLI 6.15.0) fails with **Validation Error Count: 33**. Consequently `prisma generate` and
`prisma db push`/`prisma migrate` are impossible against the checked-in schema, and the application
runs on a **stale generated client**: `node_modules/.prisma/client/schema.prisma` (dated 2025-10-16)
contains only **72 models**, while `prisma/schema.prisma` (dated 2025-10-17) declares 146. Every
model added after the client was last generated — the entire Support, Community, Documentation,
Video-admin, and Admin-RBAC surface — has **no client accessor** (`prisma.supportTicket`,
`prisma.role`, etc. are `undefined` at runtime) and **no database table**: the sole migration,
`prisma/migrations/20250901141259_init/migration.sql`, creates only 57 tables.

### Inventory of the 33 validation errors (verified 2026-07-02)

1. **Duplicate model `UserSession`** — 3 errors:
   - Analytics variant at `prisma/schema.prisma:632` (`startTime`, `endTime`, `lastActivity`,
     `duration`, `userAgent`, `ip`, `pages`, `metadata`), relation `"UserSessions"` to
     `User.userSessions` at line 166, `@@map("user_sessions")`.
   - RBAC variant at line 5072 (`sessionToken @unique`, `ipAddress`, `location`, `deviceInfo`,
     `startedAt`, `lastActiveAt`, `endedAt`, `isActive`, `activities UserActivity[]`), also
     `@@map("user_sessions")` — plus a second, duplicate `User.userSessions` field at line 238.
2. **Duplicate field `AutoModerationRule.actions`** — 1 error: `actions Json` (rule action config,
   ~line 4625) collides with `actions ModerationAction[]` (relation back-field, line 4647).
3. **15 referenced-but-undefined `Documentation*` enums** — 16 errors (`DocumentationDifficulty`
   is referenced twice, lines 3106 and 3279): `DocumentationVersionStatus`,
   `DocumentationCodeTestStatus`, `DocumentationDifficulty`, `DocumentationUserType`,
   `DocumentationCommentStatus`, `DocumentationReferenceType`, `DocumentationRole`,
   `DocumentationCollaboratorStatus`, `DocumentationChangeType`, `DocumentationRevisionStatus`,
   `DocumentationReviewStatus`, `DocumentationWorkflowPriority`, `DocumentationExportType`,
   `DocumentationExportScope`, `DocumentationExportStatus`. Seven sibling enums *are* defined
   (lines 4912–4974: `DocumentationStatus`, `DocumentationVisibility`, `DocumentationCodeLanguage`,
   `DocumentationCommentType`, `DocumentationExportFormat`, `DocumentationWorkflowType`,
   `DocumentationWorkflowStatus`), so this is an incomplete paste, not a design choice.
4. **14 cascading index errors** — `@@index`/`@@unique` on the fields whose enum types are
   undefined (e.g. `DocumentationVersion @@index([status])` at line 3076); these disappear once
   the enums exist.

### Latent errors behind the 33

Once the above are fixed, verified relation-name mismatches will surface next:

- `User.moderationHistory @relation("UserModerationHistory")` (line 230) vs
  `UserModerationHistory.user @relation("UserModerations")` (line 4547).
- `User.submittedReports @relation("ReportSubmitter")` (line 231) vs
  `ContentReport.reporter @relation("UserReports")` (line 4596).
- `User.reportedContent @relation("ReportedUser")` (line 232) has **no counterpart field at all**
  on `ContentReport` (there is no `reportedUserId` column).
- `ContentReport.assignedModerator @relation("AssignedReports")` (line 4597) and
  `AutoModerationRule.creator @relation("CreatedModerationRules")` (line 4646) have **no
  back-relation field on `User`**.

### Which `UserSession` does reality use?

The deployed truth favors the analytics variant on every axis:

- **Database**: the `user_sessions` DDL in `20250901141259_init/migration.sql` (lines 346–361) has
  exactly the analytics columns (`startTime`, `lastActivity`, `pages`, …).
- **Generated client**: the stale 72-model client contains the analytics variant.
- **Writers**: `prisma/seed.ts:615` and `src/lib/analytics/user-analytics.ts` create
  analytics-shaped rows.
- **Readers**: live routes `src/app/api/analytics/dashboard/route.ts` (lines 55, 127, 135),
  `analytics/platform`, `analytics/performance`, `monitoring/metrics`, `community/analytics`.
- The RBAC shape (`lastActiveAt`, `sessionToken`) is referenced only by admin routes that are
  **already inoperable** (`src/app/api/admin/users/route.ts`, `admin/users/[id]/route.ts:149`,
  `admin/analytics/users/route.ts:124`, `admin/support-agents/route.ts`) and are being rewritten
  under ADR-0012 anyway. Its `sessionToken` also duplicates the NextAuth `Session` model
  (`sessions` table), which already owns session-token semantics.

### The workflow that produced this

- Only one migration exists; everything since September 2025 was `db push`, until pushes started
  failing on 2025-10-17.
- `dev-local.sh` (lines ~288–299) silently runs `npx prisma db push --accept-data-loss` on every
  restart of an existing environment — a standing data-loss hazard.
- `package.json` exposes `prisma:push` alongside `prisma:migrate`; `CLAUDE.md` documents
  `npx prisma db push` as the routine command.
- `.github/workflows/ci.yml` (lines 75–77) already runs `npx prisma migrate deploy`,
  `npx prisma generate`, and `npx prisma validate` — all of which **cannot pass today**; there is
  no schema-drift check, and validate runs after generate rather than as a fast first gate.

This ADR gates roughly half the codebase: ADR-0011 (Support) and ADR-0012 (Admin/RBAC) repairs
need generated accessors and real tables; ADR-0019 (Stripe billing) needs new models and therefore
working migrations; ADR-0013/0014 deferrals need the schema to at least validate. It must be the
first executed item in the remediation roadmap.

## Decision Drivers

- **Unblocking dependency**: no subsystem ADR can add or fix a model until
  `validate → generate → migrate` works end-to-end.
- **Single source of truth**: the owner has ruled that the schema wins over divergent route code;
  route-side mismatches are fixed in their subsystem ADRs, not by bending the schema.
- **Deployed truth**: the physical `user_sessions` table and the running client both match the
  analytics `UserSession`; choosing anything else forces a data migration for zero benefit.
- **Cheap baseline window**: there is no production deployment (the Vercel workflow is being
  removed per ADR-0022); all current databases hold disposable seed data, so squaring migrations
  with reality is as cheap now as it will ever be.
- **Recurrence prevention**: the failure mode (invalid schema sitting unnoticed for months) must
  become impossible via CI gates and removal of `db push` from all scripted paths.
- **Minimal blast radius**: prefer relation renames and additive enum definitions over table
  renames or model deletions where working code depends on them.

## Considered Options

### Option 1 — In-place repair, analytics `UserSession` canonical, baseline + migration-first (chosen)

Fix the duplicates and missing enums surgically, keep the analytics `UserSession`, delete the RBAC
copy, regenerate the client, create one catch-up migration from the migration history to the fixed
schema, and outlaw `db push` in scripts and CI.

- Good: smallest diff that reaches a valid schema; DB truth preserved; no table renames; keeps
  the (repair-now) Support models intact for ADR-0011 and lands the `AuditLog`/`UserActivity`
  pair ADR-0012 retains (the rest of the Admin-RBAC models are cut per ADR-0004/0012, carried in
  this same remediation — Decision Outcome item 6).
- Bad: retains ~70 not-yet-functional models (Community/Documentation) in the schema and creates
  their tables; the schema stays very large.

### Option 2 — Same repair, but make the RBAC `UserSession` canonical

Rename or drop the analytics variant, keep `sessionToken`/`lastActiveAt`, and migrate the existing
`user_sessions` table to the RBAC shape.

- Good: admin routes' field expectations (`lastActiveAt`) would match without route edits.
- Bad: requires a destructive data migration of a live, seeded, queried table; breaks five working
  analytics routes plus `prisma/seed.ts` to satisfy routes that are dead code today and rewritten
  under ADR-0012 regardless; duplicates NextAuth's `Session` responsibility.

### Option 3 — Amputation: delete every model absent from the generated client

Cut the schema back to the 72 generated models and reintroduce subsystem models one ADR at a time.

- Good: instantly valid, small schema; perfectly honest about what runs.
- Bad: contradicts owner decision 2 (Support and Admin/RBAC are repair-*now* — the Support models
  and the `AuditLog`/`UserActivity` pair ADR-0012 keeps would have to be re-authored immediately;
  the rest of the Admin-RBAC models are cut per ADR-0004/0012 regardless); deferral ADRs 0013/0014
  gate features at runtime behind flags, not by erasing schema; loses months of reviewed
  data-model design; guarantees painful re-merge conflicts.

### Option 4 — Fix the 33 errors but keep the `db push` workflow

Repair the schema, keep syncing with `db push`, skip migrations.

- Good: least process change.
- Bad: this exact workflow caused the incident (drift invisible, one stale init migration,
  `--accept-data-loss` in `dev-local.sh`); `ci.yml` and `deploy.yml` already call
  `prisma migrate deploy`, which is meaningless without real migrations; no drift detection is
  possible; unacceptable for the Stripe billing tables coming in ADR-0019.

## Decision Outcome

**Option 1.** Specifically:

1. **Canonical `UserSession` is the analytics model at line 632.** The RBAC copy at line 5072 is
   **deleted** (not renamed): its only consumers are inoperable admin routes owned by ADR-0012,
   and its `sessionToken` duplicates NextAuth `Session`. The duplicate `User.userSessions` at
   line 238 is deleted (line 166 stays). `UserActivity.session` is re-pointed to the canonical
   `UserSession` via a named relation, with a `userActivities UserActivity[]` back-field added to
   the canonical model (relation-only; no column changes to `user_sessions`). If ADR-0012 later
   needs device/geo data per session, it adds nullable columns via a normal migration.
2. **`AutoModerationRule.actions Json` stays; the relation field is renamed** to
   `moderationActions ModerationAction[]`. Prisma relation-field names are client-side only — no
   DB impact — and the rules-engine routes consume the Json config under the name `actions`.
3. **The 15 missing `Documentation*` enums are defined**, with values derived from the `@default`
   sites and route literals (e.g. `DocumentationVersionStatus { DRAFT PUBLISHED ARCHIVED }`,
   `DocumentationDifficulty { BEGINNER INTERMEDIATE ADVANCED EXPERT }`). Documentation management
   is deferred behind a feature flag (ADR-0014), but deferral is a runtime gate — the schema must
   still validate, and enum additions are cheap to extend later (`ALTER TYPE ... ADD VALUE`).
4. **Relation names are reconciled to the `User`-side names**: `UserModerationHistory.user` →
   `@relation("UserModerationHistory")`; `ContentReport.reporter` → `@relation("ReportSubmitter")`;
   add `User.assignedReports ContentReport[] @relation("AssignedReports")` and
   `User.createdModerationRules AutoModerationRule[] @relation("CreatedModerationRules")`;
   **delete the dangling `User.reportedContent`** (no backing column exists — ADR-0013 may
   reintroduce it with a real `reportedUserId` when Community is repaired).
5. **Schema wins over route code.** Divergent route expectations (SSO provider shape,
   `SpamDetection` field names, `DocumentationPage.visibility`, `communityForumComment`, etc.) are
   *not* accommodated in the schema; they are fixed route-side under ADR-0011/0012/0013/0014 and
   ADR-0003 (auth helpers).
6. **ADR-0004/0012's authorization schema edits ride this remediation.** Per ADR-0004 (Decision
   item 4, Phase 0) and ADR-0012 (Phase 1): add `User.isPlatformAdmin Boolean @default(false)`;
   **delete** `Role`, `UserRole`, `Permission`, `UserInvitation`, `SSOProvider`, `SSOAccount`,
   `Team`, `TeamMember` (and their relation fields on `User`/`Workspace`); drop
   the never-read `UserWorkspace.permissions Json`. None of these models exist in the generated
   client or the init migration, so the deletions are schema-text only — no `DROP TABLE` appears
   in the catch-up migration. The `UserInvitation` deletion supersedes ADR-0004's
   `roleIds[]` → `WorkspaceRole` collapse (ADR-0012 reuses the migrated `TeamInvitation`). Of the
   Admin-RBAC surface, only `AuditLog` and `UserActivity` land (as amended by ADR-0012).
7. **Migration-first workflow**: baseline the existing state with one catch-up migration generated
   by `prisma migrate diff`, then require `prisma migrate dev` for every future schema change.
   `db push` is removed from `dev-local.sh`, `package.json`, and `CLAUDE.md`.
8. **CI gates** (with ADR-0022): `prisma validate` becomes the first, fastest check; a
   migration-drift check (`prisma migrate diff --from-migrations ... --to-schema-datamodel ...
   --exit-code`) fails the build whenever the schema and the migrations directory disagree.

## Consequences

### Positive

- `validate → generate → migrate dev` works again; the client grows from 72 to ~137 models (146
  declared, minus the duplicate `UserSession` and the eight ADR-0004/0012 RBAC deletions), giving
  ADR-0011/0012 real accessors and tables to repair against, and ADR-0019 a working path to add
  Stripe models.
- The live `user_sessions` table, seed data, and five working analytics routes are untouched.
- Schema drift can never again sit unnoticed: CI fails within seconds of an invalid schema or a
  schema/migrations mismatch.
- The standing `--accept-data-loss` hazard in `dev-local.sh` is eliminated.
- A permanent, reviewable migration history exists from this point forward.

### Negative

- Regenerating the client makes TypeScript surface every schema-vs-route divergence at once
  (`tsc --noEmit` will get noisier before it gets quieter); those errors belong to ADR-0003 and
  ADR-0011..0014 and must be triaged, not silenced. Note the build is already broken today by 26
  imports of nonexistent `@/lib/auth/utils` and 12 of `@/lib/auth-utils`.
- The catch-up migration will create ~81 tables (Community, Documentation, Support, …) that
  deferred features do not use yet — accepted as the cost of keeping Option 3's amputation off
  the table. The Admin-RBAC models are mostly *not* among them: they are cut per ADR-0004/0012
  (Decision Outcome item 6), with only `AuditLog` and `UserActivity` landing.
- Admin routes that read `UserSession.lastActiveAt`/`sessionToken` lose their intended model
  entirely and must be rewritten against the canonical model plus NextAuth `Session` (already in
  ADR-0012's scope).
- Existing drifted dev databases must be reset (`migrate reset` + reseed) — acceptable because all
  current data is seed data.

## Implementation Plan

### Phase 1 — Schema repair (`prisma/schema.prisma` only)

1. Delete RBAC `model UserSession` (lines 5072–5090) and duplicate `User.userSessions` (line 238);
   re-point `UserActivity.session` to the canonical `UserSession` (named relation
   `"UserActivitySessions"`), add `userActivities UserActivity[]` to the canonical model. **(S)**
2. Rename `AutoModerationRule.actions ModerationAction[]` (line 4647) →
   `moderationActions ModerationAction[]`. **(S)**
3. Define the 15 missing `Documentation*` enums near the existing block at lines 4912–4974,
   values sourced from each `@default(...)` plus states used by the (deferred) routes. **(M)**
4. Fix moderation relation names per Decision Outcome item 4; delete `User.reportedContent`. **(S)**
5. Apply the ADR-0004/0012 companion edits per Decision Outcome item 6: add
   `User.isPlatformAdmin`; delete `Role`, `UserRole`, `Permission`, `UserInvitation`,
   `SSOProvider`, `SSOAccount`, `Team`, `TeamMember` and their relation fields; drop
   `UserWorkspace.permissions`. **(M)**
6. Loop `npx prisma validate` to zero errors — expect and fix further latent errors that were
   masked by the first 33 (missing back-relations are the likely class); finish with
   `npx prisma format`. **(M)**

### Phase 2 — Client regeneration and fallout inventory

1. `npx prisma generate`; confirm model count ≈137 and that `prisma.supportTicket` and
   `prisma.documentationPage` exist on the client type — and that `prisma.role` does **not**
   (removed with the ADR-0004/0012 cut, Decision Outcome item 6). **(S)**
2. Run `npx tsc --noEmit`; classify every new error by owning ADR (0003 auth helpers, 0011
   support, 0012 admin/RBAC, 0013 community, 0014 documentation) into a tracked checklist. Do
   **not** edit the schema to appease routes. **(M)**
3. Verify `npm run db:seed` still type-checks and runs (`prisma/seed.ts:615` already writes the
   canonical `UserSession` shape). **(S)**

### Phase 3 — Baseline and catch-up migration

1. Generate the catch-up migration from history to the fixed schema:
   `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel
   prisma/schema.prisma --script > prisma/migrations/<ts>_0002_schema_remediation/migration.sql`;
   review the SQL (must be purely additive: the RBAC `user_sessions` variant and the eight
   ADR-0004/0012 model deletions never had tables, so no `DROP` statements should appear). **(M)**
2. Disposable dev/CI databases: `npx prisma migrate reset` + `npm run db:seed`. **(S)**
3. Any database that must retain data (none known today): per-environment
   `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma`
   review, apply, then `prisma migrate resolve --applied <migration>` to baseline. **(M)**
4. Confirm `npx prisma migrate status` reports a clean state everywhere. **(S)**

### Phase 4 — Workflow and CI hardening

1. `dev-local.sh`: replace the `npx prisma db push --accept-data-loss` fallback (lines ~288–299)
   with `npx prisma migrate deploy`; keep first-run `npm run prisma:migrate` + seed. **(S)**
2. `package.json`: remove the `prisma:push` script; migrate the deprecated `package.json#prisma`
   seed block to `prisma.config.ts` (Prisma 7 removes the old location). **(S)**
3. `.github/workflows/ci.yml`: add a fast first job running `npx prisma validate` and the drift
   check `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel
   prisma/schema.prisma --exit-code`; keep `migrate deploy` in DB-backed jobs. Coordinate with
   ADR-0022, which also deletes the Vercel `deploy.yml`. **(M)**
4. `CLAUDE.md`: replace `npx prisma db push` guidance with `npx prisma migrate dev` /
   `migrate deploy` and document the migration-first rule. **(S)**

### Phase 5 — Guardrails and handoff

1. Add `npm run db:check` (`prisma validate` + drift diff) for local pre-commit use. **(S)**
2. Hand the Phase 2 divergence checklist to ADR-0003/0011/0012/0013/0014 owners as their entry
   criteria; this ADR is done when `validate`, `generate`, `migrate status`, and the CI schema
   gate are all green. **(S)**

## Risks and Mitigations

- **Catch-up migration conflicts with drifted dev DBs** (tables partially created by old pushes):
  treat all current DBs as disposable and `migrate reset`; only baseline-in-place
  (`migrate resolve`) for a DB explicitly declared data-bearing.
- **Wrong guessed enum values for deferred Documentation features**: values are taken from
  `@default(...)` and route literals; enums are additive to extend, and the feature is behind
  ADR-0014's flag, so a wrong guess cannot ship user-visible breakage.
- **Type-error avalanche after regeneration stalls other work**: errors are inventoried and
  assigned per subsystem ADR in Phase 2 rather than fixed ad hoc; the build is already red today,
  so no working pipeline is lost.
- **Someone reintroduces `db push`**: the CI drift check fails any PR whose schema does not match
  its migrations, regardless of how the author synced their local DB.
- **Hidden dependencies on the deleted RBAC `UserSession`**: grep-verified consumer list
  (4 admin route files + 1 admin page) is embedded in ADR-0012's scope; the drift check plus
  `tsc` make any missed reference loudly visible.

## Related ADRs

- **ADR-0001: Record Architecture Decisions** — process this ADR follows.
- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — fixes the 26+12 broken
  `normalizeUserId` imports surfaced alongside Phase 2's inventory.
- **ADR-0004: Platform Authorization Model and RBAC Enforcement** — its schema edits ride this
  remediation migration (hard ordering dependency, both directions): add `User.isPlatformAdmin`;
  delete `Role`, `UserRole`, `Permission`, `UserInvitation`, `SSOProvider`, `SSOAccount`, `Team`,
  `TeamMember` (the ADR-0012 Phase 1 cut list); drop `UserWorkspace.permissions`. The
  `UserInvitation` deletion supersedes ADR-0004's `roleIds[]` → `WorkspaceRole` collapse.
- **ADR-0011: Support Subsystem Remediation** / **ADR-0012: Admin Dashboard and RBAC Subsystem
  Remediation** — direct dependents; blocked until this ADR lands. ADR-0012 owns the rewrite of
  routes that expected the deleted RBAC `UserSession`, and defines the RBAC model cut list carried
  in Decision Outcome item 6.
- **ADR-0013: Community Subsystem: Defer Behind Feature Flag** / **ADR-0014: Documentation
  Management: Defer Behind Feature Flag** — their models/enums stay in the schema; runtime gating
  only. ADR-0013 may reintroduce a real `reportedUser` relation.
- **ADR-0019: Billing and Subscriptions with Stripe** — first ADR to add new models through the
  migration-first workflow.
- **ADR-0021: Testing Strategy and Honest Quality Gates** — consumes the now-truthful
  `migrate deploy` + seed path in test jobs.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — hosts the CI schema gate and
  removes the Vercel `deploy.yml`.
- **ADR-0024: Codebase Hygiene** — removes dead schema consumers (`src/lib/analytics/
  user-analytics.ts`, duplicate seed files) after regeneration.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — reworks `prisma/seed.ts` on top of the
  repaired schema.
