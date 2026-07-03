# ADR-0016: System Settings & Configuration: Real Operations over Simulations

- Date: 2026-07-02
- Status: Proposed
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

The admin settings subsystem is the largest single feature area in the codebase that is
simultaneously mostly real and dangerously fake. Verified state as of 2026-07-02:

**What is genuinely real.** Twelve Prisma models (`SystemConfiguration`, `EmailTemplate`,
`IntegrationSetting`, `NotificationConfiguration`, `SecurityConfiguration`,
`PerformanceConfiguration`, `BackupConfiguration`, `BackupRecord`, `SystemHealthMetric`,
`FeatureFlag`, `FeatureFlagEvaluation`, plus the dead `BrandingConfiguration`) back 19 route
handlers under `src/app/api/admin/settings/**`. These are real Prisma CRUD with consistent
conventions: session checks, workspace OWNER/ADMIN checks via `UserWorkspace`, enum validation,
uniqueness 409s, and secret masking (`***HIDDEN***`). Feature-flag evaluation
(`src/app/api/admin/settings/feature-flags/evaluate/route.ts`) is genuinely implemented —
deterministic hash-based percentage rollout (`flag.rolloutPercent` bucketing at line 111-120),
user/group/geo/time targeting, and persisted `FeatureFlagEvaluation` audit rows — though
prerequisite checks are a no-op stub ("For now, assume prerequisites are met", line 57).

**What is simulated, and in one case dangerous:**

- **Backup execution writes no backup.** `src/app/api/admin/settings/backup/execute/route.ts`
  sleeps 2-5s (`setTimeout(resolve, 2000 + Math.random() * 3000)`, line 80), rolls
  `Math.random() > 0.05` for a 95% success rate (line 83), fabricates file sizes and record counts
  per backup type (lines 99-124), computes a `generateMockChecksum()` (line 255), and never writes
  anything to `filePath`. It does persist real `BackupRecord` rows — so the database credibly
  claims backups exist that do not. It also runs inline in the request (comment at line 168: "in
  production, this would be a background job").
- **Performance "optimization" mutates live config from fabricated analysis.** In
  `src/app/api/admin/settings/performance/optimize/route.ts`, `generateOptimizations(config)`
  (line 57) produces mock recommendations, and when `dryRun` is false — **the default**
  (`dryRun = false`, line 17) — the handler writes those values into real
  `PerformanceConfiguration` rows via `prisma.performanceConfiguration.update` (line 68). This is
  the one endpoint that can actively corrupt production configuration and must not survive in its
  current form.
- **Security audit is a hardcoded rule engine** (`security/audit/route.ts`) covering 4 of 12
  `SecurityCategory` values; other categories get a generic result, yet results are persisted as
  `auditResult`, lending them false authority.
- **Integration tests are dice rolls.** `integrations/[id]/test/route.ts` returns
  `Math.random() > 0.3` success with fabricated `responseTime` values (lines 104-111).
- **Health dashboard hardcodes uptime** as `'99.9%'` (`health/dashboard/route.ts` line 135,
  comment: "Mock uptime").

**The UI barely exists.** `src/app/dashboard/admin/settings/page.tsx` renders 10 category cards
with hardcoded stats behind a fake loading delay ("Mock stats for now", `setTimeout`, hardcoded
`totalConfigurations: 198`, lines 158-162). Nine of the ten cards link to pages that do not exist
— `src/app/dashboard/admin/settings/` contains only `page.tsx` and `sso/` — so every card except
SSO 404s.

**Cross-cutting defects:**

- **No platform-admin gate on global scope.** Every route checks workspace OWNER/ADMIN only when a
  `workspaceId` is supplied; global configurations (`workspaceId = null`) can be created and read
  by any authenticated user.
- **`feature-flags/evaluate` never rejects unauthenticated requests** (session is fetched but
  optional, line 28: `targetUserId || (session ? ... : null)`), allowing anonymous flag-key
  enumeration and evaluation-log spam.
- All `[id]` routes use the pre-Next.js-15 synchronous params signature
  (`{ params }: { params: { id: string } }`, e.g. `system/[id]/route.ts` lines 10/72/201) on
  Next 15.5.0.
- `IntegrationSetting.credentials` is documented as "Encrypted credentials" but stored as plain
  JSON (masking is applied only on read).
- `BrandingConfiguration` (`prisma/schema.prisma` line 5312) has zero references in `src/` and
  duplicates `ClientBranding`, which `/api/admin/client-branding` actually uses.
- No seed data exists for any settings model; a fresh install shows an empty subsystem.

The question: which settings categories earn a real v1 implementation, which get cut until they
can be real, and how do we stop the simulations from masquerading as operations?

## Decision Drivers

- **Owner decision (2026-07-02): self-hosted Docker deployment** (ADR-0022) — backups must
  actually protect a self-managed PostgreSQL instance; there is no managed-DB safety net.
- **Owner decision: Community, Documentation, and Discord defer behind feature flags**
  (ADR-0013, ADR-0014, ADR-0015) — those deferrals ship *now* on ADR-0013's static env gate
  (`src/lib/config/features.ts` + middleware), chosen there precisely because this subsystem was
  unproven; making the DB engine real gives them a trustworthy migration target later.
- **Honesty over surface area** (consistent with ADR-0021's honest quality gates): an endpoint
  that fabricates success is worse than a 501, because it destroys the operator's ability to trust
  any signal from the admin panel — fake backup records are the canonical worst case.
- **Safety**: no endpoint may mutate real configuration based on fabricated analysis.
- **Bounded effort**: repair-now budget is committed to Support (ADR-0011) and Admin RBAC
  (ADR-0012); this subsystem gets a focused slice, not a rewrite.
- Platform-admin authorization must come from one model (ADR-0004), not be invented here.

## Considered Options

### Option A — Keep everything, label simulations as "demo mode"

Wrap the fake endpoints in a demo-mode flag (ADR-0025) and ship all 10 categories with mock UIs.

- Good: no deletions; fastest path to a visually complete admin panel.
- Bad: fake `BackupRecord` rows in a production database are a liability, not a demo; an operator
  who believes backups exist and discovers otherwise during an incident is the worst possible
  outcome. `performance/optimize` remains a loaded gun even behind a flag.
- Bad: 9 admin UI pages would still need to be built to make the labels visible.

### Option B — Implement all 10 categories for real

Real backups, a real security scanner, real APM-driven performance tuning, real per-provider
integration tests, real uptime tracking, plus 9 admin pages.

- Good: the admin panel the marketing copy describes.
- Bad: a real security-audit engine and a safe auto-tuning system are each multi-week projects
  with specialized correctness requirements; building them now starves ADR-0011/0012 repair work.
- Bad: performance/health duplicate ADR-0023 (Observability), which is the right home for metrics,
  uptime, and dashboards — building them here creates two competing health systems.

### Option C — Honest v1: real core, cut the theater (chosen)

Keep and make real the categories with clear operational value and near-real implementations:
**backups (real `pg_dump` jobs), feature flags (promoted to the platform standard), email
templates, integrations CRUD (with encrypted credentials), system configuration**. Delete the
fake action endpoints (`security/audit`, `performance/optimize`, mock integration tests) until
real implementations exist. Defer security/performance/notifications/health admin UIs; health
metrics defer to ADR-0023. Build only the 5 admin pages the kept categories need.

- Good: every surviving endpoint tells the truth; backups actually protect data; the flag engine
  becomes a trustworthy migration target for the ADR-0013/0014/0015 env gates.
- Good: effort concentrates on the two categories (backups, flags) where 70% of the work — models,
  CRUD, evaluation logic — already exists and is real.
- Bad: the admin hub shrinks from 10 cards to ~6; the "full-featured" impression is gone.
- Bad: `SecurityConfiguration`/`PerformanceConfiguration`/`NotificationConfiguration` models and
  CRUD remain API-only (kept, since the CRUD is real and harmless) without UI until a later ADR.

### Option D — Cut the whole subsystem; configure via env vars

Delete all 12 models and 19 routes; system configuration lives in environment variables.

- Good: maximal simplification.
- Bad: throws away the genuinely working feature-flag engine that three accepted ADRs
  (0013/0014/0015) name as their eventual migration target, and DB-backed email templates and
  integration settings that support workspace-scoped multi-tenancy env vars cannot express.
  Backups still have to be built somewhere.

## Decision Outcome

**Option C.** The dividing line is simple and defensible: **an admin settings endpoint may exist
only if its effects are real.** Concretely:

**Kept and made real:**

1. **Backups become real `pg_dump` jobs** on the ADR-0008 BullMQ worker. `backup/execute`
   enqueues a `backup:execute` job and returns 202 with the `BackupRecord` id (status
   `IN_PROGRESS`); the worker runs `pg_dump` (database types) and/or archives the media directory
   (ADR-0007) to a Docker volume path (`BACKUP_DIR`), computes a real SHA-256 checksum and byte
   size, and updates the record. A scheduled worker job enforces `retention` by deleting expired
   files and marking records. Download and restore endpoints ship for database backups
   (`BackupRecord` already carries `isRestored`, `downloadCount`, `restoredBy`).
2. **Feature flags are promoted to the platform-standard system for runtime and rollout flags.**
   The ADR-0013/0014/0015 deferrals do *not* move onto this engine: ADR-0013 explicitly rejected
   DB-backed gating for them as circular, and their static env gate
   (`src/lib/config/features.ts`, enforced by edge middleware that cannot query the database)
   remains the source of truth until an explicit ADR-0013 amendment migrates it. `evaluate`
   requires an authenticated session and derives `userId` from it (client-supplied `userId` is
   accepted only from platform admins, for testing); rate limiting per ADR-0005. Seeded default
   flags (ADR-0025): `community-subsystem`, `documentation-management`, `discord-integration`
   (all `false`) — inert placeholders reserved for that future migration, not live gates.
3. **Email templates** CRUD + preview kept as-is (already real); system-template protection kept.
4. **Integrations CRUD kept; credentials encrypted at rest** with the AES-256-GCM envelope from
   ADR-0006, honoring the schema's existing "Encrypted credentials" contract. The mock
   `[id]/test` endpoint is **deleted**; a real connectivity check may return per provider later,
   starting with providers we actually call (SMTP verify, Stripe key check per ADR-0019).
5. **System configuration** CRUD kept (already real); it becomes the storage the admin "General
   Settings" page edits.

**Cut until real:**

- `POST /api/admin/settings/security/audit` — deleted. A 4-of-12-category hardcoded rule engine
  that persists authoritative-looking `auditResult` rows is misinformation.
- `POST /api/admin/settings/performance/optimize` — deleted immediately (Phase 0). Fabricated
  recommendations writing live config with `dryRun` defaulting to `false` is the single most
  dangerous endpoint found in this audit.
- Mock integration test endpoint — deleted (above).
- `health/dashboard` hardcoded uptime and the health UI — health/uptime/metrics move to
  ADR-0023 (Observability); `SystemHealthMetric` recording stays as ADR-0023's storage candidate.
- `SecurityConfiguration`/`PerformanceConfiguration`/`NotificationConfiguration` CRUD routes stay
  (real, harmless), but get no admin UI in v1 and their hub cards are removed.

**Cross-cutting repairs:** platform-admin gate (ADR-0004 `isPlatformAdmin`) required for all
global-scope (`workspaceId = null`) reads and writes across every settings route; async `params`
signatures per ADR-0003; `authOptions` imports consolidated to the `@/lib/auth` barrel per
ADR-0003; `BrandingConfiguration` model dropped via migration (ADR-0002, ADR-0024); defaults
seeded per ADR-0025. The admin hub page is rebuilt with real counts from the kept APIs and cards
only for pages that exist: System, Email Templates, Integrations, Backups, Feature Flags, SSO.

## Consequences

### Positive

- Backups genuinely protect the self-hosted database — the highest-value operational feature this
  subsystem can offer under ADR-0022's deployment model.
- The ADR-0013/0014/0015 deferrals remain enforced by their existing static env gate; the seeded
  flags give them a ready-made target if ADR-0013 is later amended to adopt the DB engine.
- No endpoint fabricates success; no endpoint mutates config from fake analysis; `BackupRecord`
  rows correspond to files on disk with verifiable checksums.
- The global-scope authorization hole (any user creating global config) is closed platform-wide.
- Admin hub 404s disappear; every card links to a working page showing real data.
- Plaintext third-party credentials in the database are eliminated.

### Negative

- Visible scope reduction: security-audit, performance-optimization, notifications, and health
  cards leave the admin hub; anyone expecting the CLAUDE.md feature list will notice.
- Three model families (Security/Performance/NotificationConfiguration) persist as API-only
  surface area — deliberate carry, revisited when a real consumer exists.
- Real backup execution adds `pg_dump` to the worker image and a volume mount — new operational
  dependencies for ADR-0022's compose files.
- Restore is a sharp tool; even gated behind platform-admin and confirmation, it can destroy data
  if misused.

## Implementation Plan

### Phase 0 — Disarm and de-lie (S)

1. **(S)** Delete `src/app/api/admin/settings/performance/optimize/route.ts` and
   `src/app/api/admin/settings/security/audit/route.ts`. Delete
   `src/app/api/admin/settings/integrations/[id]/test/route.ts`.
2. **(S)** In `backup/execute/route.ts`, replace the simulation with a 501 (`"Backup execution
   moves to the worker in Phase 2"`) so no further fake `BackupRecord` rows are created. Purge
   existing fake records (`checksum = ''` or 8-hex-char mock checksums) in the same change.
3. **(S)** Remove the hardcoded `uptime: '99.9%'` block from `health/dashboard/route.ts`; return
   only fields computed from real data, and annotate the route as pending ADR-0023.

### Phase 1 — Authorization and conventions (M)

4. **(M)** Add the ADR-0004 platform-admin check to all 19 routes under
   `src/app/api/admin/settings/**`: global scope (`workspaceId` null/absent) requires platform
   admin; workspace scope keeps the existing OWNER/ADMIN check. Extract a shared
   `requireSettingsScope(request, workspaceId)` helper per ADR-0003 conventions.
5. **(S)** Require an authenticated session in `feature-flags/evaluate/route.ts`; derive `userId`
   from the session; restrict body-supplied `userId`/`workspaceId` overrides to platform admins;
   add ADR-0005 rate limiting.
6. **(S)** Convert all `[id]` routes (`system`, `email-templates`, `integrations`, plus
   `email-templates/[id]/preview`) to the async `params: Promise<{ id: string }>` signature
   (ADR-0003).
7. **(S)** Switch `authOptions` imports from `@/app/api/auth/[...nextauth]/route` to the
   `@/lib/auth` barrel across the settings routes (ADR-0003 makes `@/lib/auth` the only
   permitted path and lint-bans `@/lib/auth/config` outside `src/lib/auth/**`).

### Phase 2 — Real backups on the worker (L)

8. **(L)** Add a `backup:execute` BullMQ processor (ADR-0008 worker): `pg_dump -Fc` for
   `DATABASE_ONLY`/`FULL`/`CONFIGURATION_ONLY` scopes, `tar` of the ADR-0007 media root for
   `MEDIA_ONLY`/`FULL`; write to `${BACKUP_DIR}/{workspaceId|global}/`, stream SHA-256, update
   `BackupRecord` with real `fileSize`, `checksum`, `duration`, status. Collapse unsupported
   `backupType` values (`INCREMENTAL`, `DIFFERENTIAL`) to a validation error rather than
   pretending.
9. **(M)** Rewrite `backup/execute/route.ts` to enqueue and return 202. Replace the naive
   `calculateNextRun` in `backup/route.ts` with `cron-parser`, and register a repeatable worker
   job that runs due configurations and enforces `retention` (delete expired files, mark records
   `EXPIRED`).
10. **(M)** Add `GET /api/admin/settings/backup/records/[id]/download` (streams the file,
    increments `downloadCount`) and `POST .../restore` (platform-admin only, explicit
    `confirm: <configuration name>` body, runs `pg_restore` via a worker job, sets `isRestored`
    and `restoredBy`).
11. **(S)** ADR-0022 compose changes: mount a `backups` volume into app + worker; ensure
    `postgresql-client` matching the server major version is in the worker image.

### Phase 3 — Flags as the standard + secrets (M)

12. **(S)** Seed default flags in `prisma/seed.ts` (ADR-0025): `community-subsystem`,
    `documentation-management`, `discord-integration`, all disabled; seed baseline system email
    templates and a default global `BackupConfiguration` (daily `DATABASE_ONLY`, 30-day
    retention, inactive until enabled by an admin).
13. **(M)** Publish a server-side helper `evaluateFeatureFlag(key, { userId, workspaceId })` in
    `src/lib/feature-flags/db.ts` wrapping the evaluation logic, so application code can gate on
    DB flags without HTTP round-trips. The name and module path deliberately avoid colliding
    with ADR-0013's `isFeatureEnabled` in `src/lib/config/features.ts`, which stays authoritative
    for the three deferred subsystems; migrating those gates onto this engine happens only under
    an ADR-0013 amendment after this ADR ships. Implement the prerequisite check (currently a
    stub) since dependent flags (e.g. Discord requiring Community) will need it after any
    migration.
14. **(M)** Encrypt `IntegrationSetting.credentials` with the ADR-0006 envelope on write in
    `integrations/route.ts` and `integrations/[id]/route.ts`; add a one-off migration script to
    encrypt existing rows; keep read-side masking.

### Phase 4 — Honest admin UI (L)

15. **(M)** Rebuild `src/app/dashboard/admin/settings/page.tsx`: remove the mock-stats
    `setTimeout` block (lines 158-162); render only six cards (System, Email Templates,
    Integrations, Backups, Feature Flags, SSO) with counts fetched from the real list endpoints.
16. **(L)** Build the five missing pages under `src/app/dashboard/admin/settings/`:
    `system/page.tsx` (grouped config editor with secret masking), `email-templates/page.tsx`
    (list/edit/preview via the preview endpoint), `integrations/page.tsx` (CRUD, masked
    credentials), `backup/page.tsx` (configurations, run-now, record list with
    download/restore), `feature-flags/page.tsx` (flag list, rollout slider, targeting,
    per-environment toggle). Reuse the SSO page's fetch/action patterns.
17. **(S)** Fix admin sidebar links that point at removed/never-built settings pages.

### Phase 5 — Schema hygiene (S)

18. **(S)** Drop the `BrandingConfiguration` model via a real migration (ADR-0002 workflow,
    ADR-0024 cleanup); `ClientBranding` remains the single branding model.

## Risks and Mitigations

- **Risk: restore endpoint misuse destroys data.** Mitigate: platform-admin only, typed
  confirmation phrase, worker takes a safety `pg_dump` snapshot before any restore, and the
  action is written to the ADR-0012 admin audit log.
- **Risk: `pg_dump` version drift between worker image and PostgreSQL server** produces
  unrestorable dumps. Mitigate: pin the client package to the server major version in the worker
  Dockerfile; CI job (ADR-0022) runs a dump+restore round-trip against the test database.
- **Risk: deleting audit/optimize/test endpoints breaks unknown callers.** Mitigate: the audit
  found no UI consumers (the pages never existed); grep for route paths before deletion; removed
  endpoints return 410 with a pointer to this ADR for one release.
- **Risk: platform-admin gating lands before ADR-0004 is implemented**, leaving no one able to
  edit global settings. Mitigate: sequence Phase 1 item 4 after ADR-0004's `isPlatformAdmin`
  helper exists; interim fallback is an `PLATFORM_ADMIN_EMAILS` env allow-list, explicitly
  temporary.
- **Risk: credential-encryption migration corrupts existing integrations.** Mitigate: migration
  script is idempotent (skips already-enveloped values), runs in a transaction, and is rehearsed
  against a Phase 2 backup.
- **Risk: backup jobs fill the volume.** Mitigate: retention enforcement ships in the same phase
  as execution (Phase 2, item 9); worker checks free space before starting and fails the record
  with a truthful error.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — migration for dropping
  `BrandingConfiguration`; all schema changes here follow it.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — async params fix, `authOptions`
  import consolidation, shared scope helper.
- ADR-0004: Platform Authorization Model and RBAC Enforcement — source of the platform-admin
  check that closes the global-scope hole.
- ADR-0005: API Security Hardening — rate limiting on flag evaluation.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — envelope encryption for
  `IntegrationSetting.credentials`.
- ADR-0007: Media Storage, Uploads, and Serving Architecture — media root archived by
  `MEDIA_ONLY`/`FULL` backups.
- ADR-0008: Background Jobs and the Publishing Pipeline — worker that hosts backup execution,
  scheduling, retention, and restore jobs.
- ADR-0012: Admin Dashboard and RBAC Subsystem Remediation — admin audit log for restore actions;
  sibling repair track.
- ADR-0013 / ADR-0014 / ADR-0015: Community, Documentation Management, and Discord deferrals —
  remain on ADR-0013's static env gate; the seeded flags are their future migration target,
  adopted only via an ADR-0013 amendment.
- ADR-0019: Billing and Subscriptions with Stripe — first candidate for a real integration
  connectivity check.
- ADR-0021: Testing Strategy and Honest Quality Gates — the honesty principle applied here;
  dump/restore round-trip test.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — backup volume, worker image
  packages, deployment model motivating real backups.
- ADR-0023: Observability: Real Metrics, Logging, and Health — receives health/uptime/dashboard
  scope cut from this subsystem; may adopt `SystemHealthMetric` as storage.
- ADR-0024: Codebase Hygiene: Dead Code, Duplicates, and Repo Cleanup — `BrandingConfiguration`
  removal.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — seeded default flags, system email
  templates, and default backup configuration.
