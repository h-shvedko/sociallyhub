# ADR-0004: Platform Authorization Model and RBAC Enforcement

- Date: 2026-07-02
- Status: Accepted
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub has exactly one enforced authorization primitive today: the `WorkspaceRole` enum
(`OWNER | ADMIN | PUBLISHER | ANALYST | CLIENT_VIEWER`, `prisma/schema.prisma:861-867`) stored on
`UserWorkspace`. Everything else that looks like an authorization system is unenforced scaffolding.
The verified problems this ADR must resolve:

1. **"Admin of anything" means "admin of everything".** The admin panel gate
   (`src/app/dashboard/admin/layout.tsx:22-40`) and every `/api/admin/**` route (e.g.
   `src/app/api/admin/roles/route.ts:17-26`, `src/app/api/admin/users/route.ts:18-22`) run the same
   check: `prisma.userWorkspace.findFirst({ where: { userId, role: { in: ['OWNER','ADMIN'] } } })`
   with **no `workspaceId` filter**. Any user who is OWNER or ADMIN of *any one* workspace — which
   includes every user who self-serves a new workspace — passes, and the admin queries themselves
   are not workspace-scoped: they list, update, and delete users, workspaces, roles, and SSO
   providers across all tenants. There is no platform-admin concept anywhere; `model User`
   (`prisma/schema.prisma:143`) has no `isPlatformAdmin` or equivalent field.

2. **Global-scope settings have no gate at all.** The admin settings routes check workspace
   OWNER/ADMIN only *when a `workspaceId` is supplied*
   (`src/app/api/admin/settings/system/route.ts:22-35` — `if (workspaceId) { ... }`); global
   configurations (`workspaceId = null`) can be read and created by **any authenticated user**.
   `POST /api/admin/settings/feature-flags/evaluate` requires no session at all and accepts
   arbitrary `userId`/`workspaceId` in the body. (Endpoint-level closure of these holes is
   ADR-0005's scope; the *model* they must be closed against is decided here.)

3. **The custom RBAC tables are dead weight that cannot even load.** `Role`, `UserRole`, and
   `Permission` (`prisma/schema.prisma:4986-5040`) are managed by admin UI and API routes but are
   **never consulted for any authorization decision** — no `hasPermission`/`checkPermission`
   helper exists under `src/lib`, and nothing reads `Role.permissions` or the required
   `UserWorkspace.permissions Json` field (`prisma/schema.prisma:269`). Worse, the schema fails
   `npx prisma validate` (P1012, e.g. duplicate `userSessions` field on `User` at
   `prisma/schema.prisma:238`; 33 errors total per audit), the generated client contains none of
   the RBAC models, and the sole migration (`20250901141259_init`) creates none of their tables —
   so every `prisma.role/userRole/permission` call in `/api/admin/**` is inoperable
   (schema remediation itself is ADR-0002). `Role` even declares a `userWorkspaces UserWorkspace[]`
   relation with no corresponding field on `UserWorkspace`.

4. **The checks are copy-pasted and often broken.** The literal `role: { in: ['OWNER', 'ADMIN'] }`
   check appears in 58 files under `src/app/api/admin/`; 111 route files across `src/app/api`
   perform inline `userWorkspace.findFirst` membership checks (out of 267 session-checked route
   files). The helper they all depend on, `normalizeUserId` (`src/lib/auth/demo-user.ts:50`), is
   `async`, but the admin layout and routes call it **without `await`**
   (`src/app/dashboard/admin/layout.tsx:19`), passing a `Promise` as the Prisma `userId` filter.
   26 files import it from a nonexistent `@/lib/auth/utils`, and 19 admin settings routes import
   it from `@/lib/utils`, which exports only `cn()` — 45 build-broken route files in total.

We must decide the authorization model the repaired platform enforces: how platform-level admin is
represented, how workspace-level access is checked, and what happens to the unenforced
Role/UserRole/Permission tables and their admin UI.

## Decision Drivers

- **Security first**: cross-tenant admin escalation (driver #1) and ungated global settings
  (driver #2) are exploitable today the moment the build is fixed; the fix must not wait on a
  full RBAC platform.
- **Owner decisions (2026-07-02)**: Admin RBAC is in the "repair now" bucket (ADR-0012);
  Community/Documentation/Discord are deferred behind feature flags (ADR-0013/0014/0015) so their
  permission needs must not drive the model; Stripe billing (ADR-0019) needs a trustworthy
  platform-admin boundary for plan/subscription administration.
- **Schema reality**: ADR-0002 mandates a migration-first workflow on a schema that currently
  fails validation; every table we keep must be one we actually enforce and seed.
- **Maintainability**: 111 copy-pasted inline checks are how the "any workspace" bug shipped;
  the model must be expressible as a small set of central helpers (ADR-0003 conventions).
- **Honesty over theater**: UI that manages roles/permissions nothing enforces (stub modals,
  console.log "saves") is worse than no UI — it misleads operators about their security posture.
- **Future flexibility**: agencies may eventually need custom roles per workspace, but there is
  zero current demand and zero current enforcement; the design should leave a clean seam for a
  permission service without building it now.

## Considered Options

### Option 1 — Patch the existing pattern in place

Keep the `UserWorkspace` OWNER/ADMIN check as the only mechanism; fix the bugs (await
`normalizeUserId`, require `workspaceId` on every admin query, scope all admin queries to
workspaces the caller administers). "Platform admin" remains "admin of any workspace", just with
scoped queries.

- Good: smallest diff; no schema change.
- Bad: there is still no way to gate genuinely global resources (global `SystemConfiguration`,
  cross-tenant user administration, feature flags, Stripe product catalog). Either those endpoints
  die or the escalation persists. The 111 copy-pasted checks remain copy-pasted.
- Bad: `/dashboard/admin` becomes incoherent — it is designed as a platform console (all users,
  all workspaces), which cannot be expressed in a purely workspace-scoped model.

### Option 2 — Land the full custom RBAC system (Role/UserRole/Permission enforced)

Fix the schema, migrate the RBAC tables, seed system roles and a permission catalog, and build a
permission service (`can(user, action, resource, scope)`) consulted by every route; the admin
roles/permissions UI becomes real.

- Good: maximum flexibility (custom roles, fine-grained permissions, the existing UI has a purpose).
- Bad: enormous scope on top of a subsystem where the route code disagrees with the model shapes
  in dozens of places (audit: `UserInvitation.role` vs `roleIds[]`, `Permission.isActive/isSystem`
  absent, etc.), nothing seeds `Role`/`Permission`, and no product requirement exists for
  permissions finer than the five `WorkspaceRole` values. The security fix (drivers #1/#2) would
  be hostage to a multi-week build.
- Bad: two parallel sources of truth (`WorkspaceRole` enum + `Role` rows) unless we also migrate
  every membership — high-risk data surgery for zero enforced benefit today.

### Option 3 — Two-tier model: `User.isPlatformAdmin` + `WorkspaceRole`, central helpers, drop the unused RBAC tables (chosen)

Introduce a platform tier as a single boolean on `User`; keep the workspace tier as the existing
`WorkspaceRole` enum; enforce both exclusively through central helpers
(`requirePlatformAdmin()`, `requireWorkspaceRole(workspaceId, roles)`); delete `Role`, `UserRole`,
and `Permission` from the schema and retire the UI that manages them. A fine-grained permission
service is explicitly deferred as a future ADR behind the same helper seam.

- Good: closes drivers #1 and #2 with a one-field schema change and two helpers; every admin
  surface gets an unambiguous gate; aligns with ADR-0002 (only keep schema we enforce) and
  ADR-0003 (helpers, not copy-paste).
- Good: trivially seedable (ADR-0025) and auditable — "who is platform admin" is one indexed query.
- Bad: no custom roles until the deferred permission service exists; agencies get exactly five
  workspace roles.
- Bad: deletes admin UI that was built (roles, permission matrix) — sunk cost made visible.

### Option 3b (variant, rejected) — `PLATFORM_ADMIN` as a sixth `WorkspaceRole` value or a kept global `Role` row

Represent platform admin either as a special enum value on some `UserWorkspace` row or as a
seeded row in a retained `Role` table.

- Rejected: a `WorkspaceRole` value misuses a workspace-scoped relation for a global grant —
  exactly the category error that produced today's bug ("membership row implies global power").
  A retained `Role` table keeps an entire join-table apparatus alive to answer a boolean
  question, keeps the invalid schema surface, and reintroduces the two-sources-of-truth problem
  of Option 2.

## Decision Outcome

**Chosen option: Option 3 — two-tier authorization (`User.isPlatformAdmin` + `WorkspaceRole`)
enforced via central helpers, with the custom Role/UserRole/Permission tables removed.**

Concretely:

1. **Platform tier.** Add `isPlatformAdmin Boolean @default(false)` to `model User`. It is
   required by: every route under `/api/admin/**` that reads or writes cross-workspace data
   (users, workspaces, sso, audit-logs, bulk-operations, analytics, support-agents), every
   global-scope (`workspaceId = null`) settings mutation *and read of unmasked secrets*
   (ADR-0016), the `/dashboard/admin` layout, and future Stripe catalog administration
   (ADR-0019). It is exposed on the NextAuth session/JWT via callbacks so layouts can gate
   without an extra query; API routes re-verify against the DB (sessions are not revocation-safe).
2. **Workspace tier.** `WorkspaceRole` on `UserWorkspace` remains the only workspace-level
   authority. Workspace-scoped admin settings (`SystemConfiguration`/`EmailTemplate`/... with a
   `workspaceId`) require `requireWorkspaceRole(workspaceId, ['OWNER','ADMIN'])`. A platform
   admin does not implicitly bypass workspace checks except on explicitly platform-scoped
   endpoints (least surprise for tenant data).
3. **Central helpers only** (extends ADR-0003), added to ADR-0003's `src/lib/auth/session.ts`
   and exported through the `@/lib/auth` barrel — no second auth module:
   - `getAuthenticatedUser()` — ADR-0003's existing helper, reused as-is; it remains the sole
     `normalizeUserId` call site (this ADR adds no session or normalization logic).
   - `requirePlatformAdmin()` — 401 if no session, 403 unless `user.isPlatformAdmin`. This is
     the replacement body ADR-0003 promised for its interim `requireAdmin()`: identical
     signature, so its ~40 call sites are unaffected; `requireAdmin` survives only as a
     deprecated alias until a mechanical rename lands.
   - `requireWorkspaceRole(workspaceId, roles)` — 401/403/404 semantics per ADR-0005; returns the
     membership row so handlers can scope queries.
   Direct `prisma.userWorkspace.findFirst` authorization checks in route handlers are banned;
   ADR-0021's quality gates add a lint/grep check for the old pattern.
4. **Fate of the custom RBAC tables.** `Role`, `UserRole`, and `Permission` are **removed from
   `prisma/schema.prisma`** in the ADR-0002 remediation migration (they have no tables, no
   generated client models, and no enforcement — this is a schema-text deletion, not a data
   migration). The required-but-never-read `UserWorkspace.permissions Json` field is removed in
   the same migration (audit shows route code already omits it on create). `UserInvitation.roleIds[]`
   collapses to a single `WorkspaceRole`. A future "Fine-Grained Permissions" ADR may reintroduce
   a permission service behind the `requireWorkspaceRole` seam; until then the enum is the whole
   workspace model.
5. **Fate of the roles/permissions admin UI** (executed under ADR-0012): delete
   `/dashboard/admin/users/roles`, `/dashboard/admin/users/permissions`, and
   `/api/admin/roles*`, `/api/admin/permissions*`; replace with a single static, read-only
   "Workspace roles reference" page documenting the five `WorkspaceRole` capabilities. Bulk
   operations and user administration keep only the actions expressible in the two-tier model
   (workspace membership add/remove/role-change, activate/deactivate, platform-admin toggle —
   the latter restricted to platform admins and audited).

Why: it is the only option that fixes the live escalation and the ungated global scope *now*,
matches what the product actually enforces, and shrinks — rather than grows — the surface that
ADR-0002/0012 must repair. Option 2 remains reachable later through the helper seam.

## Consequences

### Positive

- Cross-tenant admin escalation is structurally impossible: platform power requires an explicit,
  auditable per-user flag, not incidental workspace ownership.
- Global-scope settings, feature flags, SSO, and billing administration get a real gate
  (`requirePlatformAdmin`), closing the audit's "any authenticated user can create global config"
  hole in concert with ADR-0005.
- One authorization vocabulary: 5 enum values + 1 boolean. Every check is greppable, testable
  (ADR-0021), and lives in two helpers instead of 111 inline copies.
- Schema shrinks by three broken models plus a dead Json field, directly reducing ADR-0002's
  validation-error surface and eliminating the `Role.userWorkspaces` dangling relation.
- The 45 build-broken `normalizeUserId` imports are eliminated as a side effect of helper adoption.
- Honest admin UI: no more managing roles and permission matrices that nothing reads.

### Negative

- No custom roles or per-user permission overrides until a future permission-service ADR; any
  customer demanding finer grants than the five roles is blocked.
- Sunk cost: the roles/permissions pages, matrix UI, and their API routes are deleted.
- `isPlatformAdmin` is a blunt instrument — no partial platform roles (e.g. "support-only
  platform staff"); support tooling (ADR-0011) must live with full-admin operators initially.
- Session claim + DB re-check duality adds a small amount of doctrine developers must learn
  (claim for UX gating, DB for enforcement).
- Removing `UserWorkspace.permissions` and `roleIds[]` is a breaking schema change that must ride
  the ADR-0002 remediation migration; ordering between these two ADRs is mandatory.

## Implementation Plan

Phased; sizes are S (≤ ½ day), M (≤ 2 days), L (> 2 days). Phases 1–3 are the "repair now"
commitment; Phase 4 rides ADR-0012's schedule.

**Phase 0 — Schema (with ADR-0002's remediation migration)**
1. (S) Add `isPlatformAdmin Boolean @default(false)` to `model User` in `prisma/schema.prisma`;
   add `@@index([isPlatformAdmin])` if admin listings need it.
2. (M) Delete `model Role`, `model UserRole`, `model Permission` (lines ~4986-5040) and their
   relation fields on `User`; drop `UserWorkspace.permissions Json`; change
   `UserInvitation.roleIds String[]` to `role WorkspaceRole`. Fold into the ADR-0002 migration.
3. (S) Seeding (ADR-0025): grant `isPlatformAdmin` from a `PLATFORM_ADMIN_EMAILS` env allowlist in
   `prisma/seed.ts` plus a `scripts/grant-platform-admin.ts` one-off for production (Docker
   `exec`, per ADR-0022 self-hosted deployment).

**Phase 1 — Helpers (with ADR-0003)**
4. (M) Add `requirePlatformAdmin()` and `requireWorkspaceRole(workspaceId, roles)` to ADR-0003's
   `src/lib/auth/session.ts`, exported via the `@/lib/auth` barrel; both build on the existing
   `getAuthenticatedUser()` and throw ADR-0003's typed `ApiError` mapped to 401/403/404 JSON per
   ADR-0005 response conventions. `requirePlatformAdmin()` replaces the body of the interim
   `requireAdmin()` at its existing call sites; demo-id normalization stays encapsulated in
   `getAuthenticatedUser()` — this ADR adds no new `normalizeUserId` call site.
5. (S) Add NextAuth `jwt`/`session` callbacks in `src/lib/auth/config.ts` to carry
   `isPlatformAdmin` on the session; document "claim for UI, DB for API" in the module docstring.
6. (S) Unit tests for both helpers (ADR-0021): non-admin, workspace-admin-elsewhere,
   platform-admin, expired/missing session.

**Phase 2 — Admin surface enforcement (with ADR-0012)**
7. (M) `src/app/dashboard/admin/layout.tsx`: replace the any-workspace `findMany` gate with the
   session `isPlatformAdmin` claim (redirect otherwise); fixes the unawaited-`normalizeUserId`
   Promise bug at line 19 by deletion.
8. (L) Sweep all `/api/admin/**` route files: replace the copy-pasted
   `userWorkspace.findFirst({ role: { in: ['OWNER','ADMIN'] } })` blocks (58 files) with
   `requirePlatformAdmin()` (cross-tenant routes) or `requireWorkspaceRole(...)`
   (workspace-scoped settings routes); this also removes all 45 broken
   `@/lib/auth/utils` / `@/lib/utils` `normalizeUserId` imports. Delete `/api/admin/roles*` and
   `/api/admin/permissions*` instead of migrating them.
9. (S) `src/app/api/admin/settings/**`: require `requirePlatformAdmin()` whenever
   `workspaceId` is absent (global scope) on GET-with-secrets and all mutations
   (ADR-0016 owns the deeper settings repair).
10. (S) `feature-flags/evaluate`: require a session; ignore body-supplied `userId` unless caller
    is platform admin (hole formally tracked by ADR-0005).

**Phase 3 — Workspace-route adoption**
11. (L) Incrementally migrate the 111 routes with inline `userWorkspace.findFirst` checks to
    `requireWorkspaceRole()`, prioritized by sensitivity (billing/invoices, clients, media,
    posts); mechanical but wide. Add the ADR-0021 grep gate once the sweep completes.

**Phase 4 — UI truth-up (under ADR-0012)**
12. (M) Delete `/dashboard/admin/users/roles` and `/dashboard/admin/users/permissions` pages;
    add the static roles-reference page; update `src/components/admin/admin-sidebar.tsx` links.
13. (M) Rework `/dashboard/admin/users/administration` and `bulk-operations` actions to the
    two-tier vocabulary (workspace role assignment via `WorkspaceRole`, platform-admin toggle
    with confirmation + `AuditEvent` write).

## Risks and Mitigations

- **Risk: nobody holds `isPlatformAdmin` after deploy, locking everyone out of `/dashboard/admin`.**
  Mitigation: seed-time env allowlist (step 3) runs in every environment; the grant script is
  documented in the deployment runbook (ADR-0022); CI smoke test asserts at least one platform
  admin exists in seeded databases (ADR-0025).
- **Risk: the Phase 3 sweep silently changes behavior on some of the 111 routes (e.g. a route
  that previously accepted any member now requires a role).** Mitigation: migrate mechanically to
  the *same* role set first, tighten in a separate reviewed pass; integration tests per ADR-0021.
- **Risk: stale session claims (admin revoked but JWT still says `isPlatformAdmin: true`).**
  Mitigation: claims gate only UI navigation; every API handler re-checks the DB via
  `requirePlatformAdmin()`; NextAuth JWT max age kept short for admin-capable accounts.
- **Risk: dropping `Role`/`UserRole`/`Permission` forecloses a paying customer's custom-role need.**
  Mitigation: tables were never enforced and never migrated, so nothing real is lost; the helper
  seam is the documented extension point, and reintroduction is a green-field ADR rather than a
  rescue of mismatched code.
- **Risk: ordering coupling with ADR-0002 — this ADR's schema edits cannot land before the schema
  validates.** Mitigation: Phase 0 is explicitly part of the ADR-0002 remediation migration;
  Phases 1–2 code can be written against the new client in the same PR train.
- **Risk: support staff need admin access but should not hold full platform power (ADR-0011).**
  Mitigation: accepted for now (Negative consequence); if it bites, the future permission-service
  ADR adds platform-scoped roles without changing the helper call sites.

## Related ADRs

- **ADR-0001: Record Architecture Decisions** — process this record follows.
- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — carries this ADR's
  schema changes (add `isPlatformAdmin`, drop Role/UserRole/Permission, fix duplicate
  `UserSession`); hard ordering dependency.
- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — the authorization helpers
  live in its `src/lib/auth/session.ts` behind the `@/lib/auth` barrel and reuse its
  `getAuthenticatedUser()`; `requirePlatformAdmin()` fulfills its promise to replace the body of
  the interim `requireAdmin()` without changing signature or call sites.
- **ADR-0005: API Security Hardening** — closes the per-endpoint holes (unauthenticated
  feature-flag evaluation, global settings reads) against the model defined here.
- **ADR-0011: Support Subsystem Remediation (Tickets, Chat, Agents)** — support-agent tooling
  initially gated by `isPlatformAdmin`; finer platform roles deferred.
- **ADR-0012: Admin Dashboard and RBAC Subsystem Remediation** — executes the admin UI/API
  repairs and deletions (Phases 2 and 4) under this ADR's model.
- **ADR-0016: System Settings & Configuration: Real Operations over Simulations** — global-vs-
  workspace settings scoping rules defined here apply to its repaired endpoints.
- **ADR-0019: Billing and Subscriptions with Stripe** — platform-admin boundary required for
  catalog/subscription administration.
- **ADR-0021: Testing Strategy and Honest Quality Gates** — helper unit tests and the
  no-inline-authz grep gate.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — production platform-admin
  grant procedure.
- **ADR-0024: Codebase Hygiene** — deletion of dead RBAC routes/pages and the stub modals.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — seeding the first platform admin and
  demo-role fixtures.
