# ADR-0012: Admin Dashboard and RBAC Subsystem Remediation

- Date: 2026-07-02
- Status: Accepted
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

The admin subsystem — `src/app/dashboard/admin/**` (an overview page, six user-management pages, an SSO settings page) and ~14 API route files under `src/app/api/admin/**` — was written against a Prisma schema that never landed. The verified audit (2026-07-02) and direct code inspection establish:

**The subsystem cannot run at all today.**

- `prisma/schema.prisma` fails `prisma validate` (33 errors), anchored by a duplicate `model UserSession` (analytics version at line 632, RBAC version at line 5072) and a duplicate `User.userSessions` field. Remediation of the schema/migration workflow itself is owned by ADR-0002.
- The generated client (`node_modules/.prisma/client`, 72 models) and the sole migration (`20250901141259_init`) contain **none** of the ten RBAC models (`Role`, `UserRole`, `Permission`, `Team`, `TeamMember`, `UserActivity`, `AuditLog`, `UserInvitation`, `SSOProvider`, `SSOAccount`). Every `prisma.role`/`prisma.auditLog`/`prisma.sSOProvider`/etc. call in the admin routes targets a model that does not exist at runtime.
- All 14 admin API files (26 files across `src` total) import `normalizeUserId` from `'@/lib/auth/utils'`, a module that does not exist — a build-breaking import. The real helper is `async normalizeUserId()` in `src/lib/auth/demo-user.ts` (line 50), and every call site invokes it synchronously. `src/app/dashboard/admin/layout.tsx:19` imports from the correct path but still omits `await`, passing a `Promise` as `userId` into a Prisma where-clause.

**The authorization model is wrong.** The gate everywhere is `userWorkspace.findFirst({ userId, role: { in: ['OWNER','ADMIN'] } })` — OWNER/ADMIN of *any one* workspace grants platform-wide admin over *all* users, workspaces, roles, and SSO providers; admin queries are not workspace-scoped. Meanwhile the custom `Role`/`Permission` tables the UI manages are never consulted for authorization anywhere in the app; only the `WorkspaceRole` enum on `UserWorkspace` gates anything. This is the privilege-escalation class ADR-0005 targets and the enforcement question ADR-0004 answers.

**Route code disagrees with the schema it was allegedly written for.** Verified mismatches: `src/app/api/admin/sso/route.ts` reads/writes `workspaceId`, `callbackUrl`, `scopes`, `autoProvisioning`, `defaultRole`, `domainRestrictions` and an `ssoAccounts` relation, and validates types `GOOGLE/MICROSOFT/OKTA/SAML/LDAP` — while `SSOProvider` (schema line 5171) has none of those fields, names the relation `accounts`, and `enum SSOType` is `OAUTH2/SAML/LDAP/OIDC`. `bulk-operations/route.ts:599` writes `UserInvitation.role` (model has `roleIds String[]`); lines 135/205 set `UserRole.updatedAt` (field absent). `permissions/route.ts:162-169` creates a `Permission` with `isActive`/`isSystem` (absent) and omits the required `resource`/`action`. `teams/route.ts:177` writes `Team.settings` (absent). `workspaces/route.ts` filters/creates on `status`/`plan`/`domain` which `Workspace` (line 17) lacks — it has only `name`, `timezone`, `branding`, `defaultLocale`, `supportedLocales`. `audit-logs/route.ts:375-387` writes `description`/`metadata` that `AuditLog` lacks. `bulk-operations/route.ts:283,436` pass a nonexistent `UserWorkspace.joinedAt` and omit the **required** `permissions Json`. Dynamic routes use the pre-Next-15 sync `{ params: { id } }` signature on Next 15.5.0.

**The UIs are half real, half theater.** `users/administration/page.tsx:477` renders "User creation/editing modal would be implemented here"; the permission matrix save is `console.log` only (`users/permissions/page.tsx:143`); bulk operations fabricate user IDs from CSV emails (`` `user_${email.split('@')[0]}` ``, `bulk-operations/page.tsx:233`) and hardcode `demo-user-1/2/3` (line 339) with never-populated role/workspace dropdowns; the root `admin/page.tsx` is 100% hardcoded stats ("23 open tickets", "1,234 users") with sidebar links to nonexistent pages; access-logs "Export" saves JSON with a `.csv` extension because the API ignores `export=true`; invitation and password-reset emails are `console.log` stubs, and bulk password reset returns temp passwords in the HTTP response body.

One supplement to the audit: a working invitation accept/decline flow **already exists** for the migrated `TeamInvitation` model (`role WorkspaceRole`, unique `token`, `status`, `expiresAt`) at `src/app/api/team/invitations/[token]/route.ts` — its POST creates the `UserWorkspace` membership. The unmigrated `UserInvitation` model duplicates this.

The owner has decided (2026-07-02): repair Admin RBAC **now**, shaped by ADR-0004's authorization model; Stripe billing is in scope now (ADR-0019); Community/Documentation/Discord are deferred behind flags (ADR-0013/0014/0015).

## Decision Drivers

- **ADR-0004 alignment**: the platform authorization primitive is the `WorkspaceRole` enum (`OWNER/ADMIN/PUBLISHER/ANALYST/CLIENT_VIEWER`) on `UserWorkspace`. A parallel, database-driven `Role`/`Permission` catalog that nothing enforces is unenforced configuration — worse than no configuration, because it lies to operators.
- **Security first (ADR-0005)**: the any-workspace-admin → platform-admin escalation must close before any admin page is considered "repaired". Secrets handling (SSO client secrets, temp passwords in responses) must follow ADR-0006.
- **Migration-first (ADR-0002)**: no admin feature may depend on models absent from the migration chain; every schema decision here lands as a reviewed migration.
- **Don't extend the schema for fantasy features**: fields should be added only where a working runtime consumes them. SSO config without an SSO login flow (NextAuth is not wired to `SSOProvider`; the test endpoint is explicitly mock) is fantasy.
- **Reuse what is already migrated**: `TeamInvitation` + its accept endpoint, `AuditEvent`, the analytics `UserSession`, and `src/lib/notifications/email-service.ts` all exist in the working client today.
- **Small-team pragmatism**: v1 must be a shippable operator console (users, audit, analytics, bulk ops), not an IAM product.

## Considered Options

### Option 1 — Full repair: land all ten RBAC models and make the code true

Migrate `Role`, `UserRole`, `Permission`, `Team`, `TeamMember`, `UserActivity`, `AuditLog`, `UserInvitation`, `SSOProvider`, `SSOAccount`; extend `SSOProvider` and `Workspace` with every field the routes assume (schema-wins everywhere); build a permission-resolution engine so the Role/Permission catalog actually gates requests; build a real SSO login flow.

- Pro: nothing is cut; the existing UI surface all becomes real.
- Con: weeks of work to productionize an IAM system a single-team SaaS does not need; contradicts ADR-0004 (two competing authorization sources); ships an SSO admin UI for a login capability that does not exist; duplicates `TeamInvitation` and `AuditEvent`; largest possible migration risk.

### Option 2 — Demolish: delete the admin subsystem, rebuild later

Remove `src/app/dashboard/admin` and `src/app/api/admin` entirely (per ADR-0024) and revisit after billing/support land.

- Pro: fastest path to a green build; zero migration risk.
- Con: directly contradicts the owner decision to repair now; support operations (ADR-0011) need an admin shell; the user-administration, audit-log, and analytics pages are substantially real and worth keeping.

### Option 3 — Scoped repair on the WorkspaceRole primitive (inventory-driven schema-wins/code-wins per cluster)

Repair the admin console as a **platform-operator console** gated by a new explicit platform-admin flag. Land only the models the v1 pages consume (`AuditLog`, `UserActivity`). Cut the unenforced `Role`/`UserRole`/`Permission` catalog and the SSO admin surface (feature-flagged stub, models stay unmigrated). Reuse `TeamInvitation` for invitations. Fix code where fields were fantasy; extend schema only where a working feature needs the field.

- Pro: aligns with ADR-0004; closes the escalation hole; smallest migration that makes every remaining page real; deletes ~40% of broken surface instead of repairing it; honest UI (no unenforced knobs).
- Con: cuts visible (if fake) features — roles/permissions/SSO pages disappear or become read-only; some rework later if custom roles are ever genuinely needed.

## Decision Outcome

**Option 3 — scoped repair on the WorkspaceRole primitive.** The deciding argument: every hour spent making the Role/Permission/SSO surfaces *persist* is an hour spent making the platform *lie better*, because nothing enforces them. ADR-0004 already names `WorkspaceRole` as the enforcement primitive; the admin console must administer what is enforced.

### Authorization gate (supersedes the current check)

Add `User.isPlatformAdmin Boolean @default(false)`. Introduce `requirePlatformAdmin()` in the consolidated auth helpers (ADR-0003) — resolves the session, **awaits** `normalizeUserId()`, checks the flag, and returns typed `401/403` failures. `/dashboard/admin/**` layout and all `/api/admin/**` routes use it. Workspace OWNER/ADMIN status no longer grants any platform-wide capability; workspace-scoped team management stays in the existing `/api/team/*` routes. Seeding of the first platform admin is owned by ADR-0025.

### Per-cluster verdicts (schema-wins vs code-wins)

| Cluster | Verdict | Resolution |
|---|---|---|
| Duplicate `UserSession` (lines 632 vs 5072) | schema-wins (analytics copy) | Delete the RBAC copy at line 5072 and the duplicate `User.userSessions` field; it was never migrated. `UserActivity.session` is re-pointed to the canonical analytics `UserSession` via the named `"UserActivitySessions"` relation, with a `userActivities` back-field on the canonical model — per ADR-0002 (Decision item 1), which owns that migration. Fix `api/admin/analytics/users/route.ts` to the real field names (`startTime`/`lastActivity`, not `lastActiveAt`). |
| `Role`, `UserRole`, `Permission` | **cut** | Remove models from `schema.prisma` (never migrated, never enforced) and delete `/api/admin/roles/**`, `/api/admin/permissions/**`. Replace the roles + permission-matrix pages with one read-only page rendering the fixed `WorkspaceRole` capability matrix defined by ADR-0004. Moots `UserRole.updatedAt`, `Permission.isActive/isSystem`, and the missing `resource`/`action` writes. |
| `UserInvitation` | **cut — reuse `TeamInvitation`** | `TeamInvitation` is migrated, carries `role WorkspaceRole` (matching what `bulk-operations` actually writes), and has a working accept/decline endpoint at `src/app/api/team/invitations/[token]/route.ts`. Admin bulk-invite creates `TeamInvitation` rows and sends real email via `src/lib/notifications/email-service.ts`. |
| `AuditLog`, `UserActivity` | schema-wins, amended | Land both via migration; add `metadata Json?` to `AuditLog`; **drop** `description` writes from route code (fold prose into `metadata`). `workspaceId` stays nullable for platform-level actions. The workspace-scoped `AuditEvent` model remains for in-app events; consolidation is deferred to ADR-0024. |
| `SSOProvider`, `SSOAccount` | **defer behind flag** | No NextAuth wiring exists and the test endpoint is a self-described mock. Do not migrate the models, do not extend them with the routes' fantasy fields (`workspaceId`, `callbackUrl`, `scopes`, `autoProvisioning`, `defaultRole`, `domainRestrictions`), do not reconcile `SSOType`. Delete `/api/admin/sso/**`; the SSO page hides behind `FEATURE_SSO_ADMIN=false` with an honest "not available" state. Revisit when a real SSO login flow is specified. |
| `Team`, `TeamMember` | defer | No admin UI consumes `/api/admin/teams` and there is no `teams/[id]` route. Delete the admin teams route (drop the `Team.settings` write with it); models stay unmigrated until a consuming feature exists. |
| `Workspace.status/plan/domain/settings/locale` | code-wins | Strip these filters/selects/writes from `workspaces/route.ts` and `users/[id]/route.ts`. Plan/subscription state is owned by Stripe per ADR-0019 and read from the subscription record, not a `Workspace.plan` column. Workspace suspension, if needed, is proposed separately under ADR-0016. |
| `userWorkspace.create` args | code-wins | Remove the nonexistent `joinedAt` (`createdAt` covers it) and remove `permissions` from the create args entirely — ADR-0004 (Decision item 4) drops `UserWorkspace.permissions Json` from the schema in the same migration wave, so there is no column to write. |
| Next 15 params | code-wins | All `[id]` routes adopt `{ params }: { params: Promise<{ id: string }> }` + `await` per ADR-0003 conventions. |
| `normalizeUserId` | code-wins | Replace all 26 `'@/lib/auth/utils'` imports with the ADR-0003 helper; `await` at every call site, including the admin layout (line 19). |

### v1 page scope

**Keep and repair:** `/dashboard/admin` overview (real DB counts; ticket stats from ADR-0011 models), `users/administration` (real create/edit/delete modals), `users/access-logs` (server-side CSV), `users/analytics` (field fixes), `users/bulk-operations` (real user selection; reduced operation set: activate/deactivate, workspace add/remove with role, invite, password-reset **via emailed reset link** using `VerificationToken` — never temp passwords in responses), the new read-only role-matrix page.

**Cut or flag:** roles CRUD, permission matrix editing, SSO (flagged), admin teams/workspaces creation routes. Prune every dead sidebar link (`/users/teams`, `/users/support-agents`, `/support/*`, `/content/*`, `/community/*`, `/settings/general|integrations|security|advanced`, `/users/accounts`) — deletions recorded under ADR-0024.

## Consequences

### Positive

- The admin console becomes truthful: every visible control persists and every persisted setting is enforced.
- The any-workspace-admin privilege escalation is closed with one explicit, auditable flag and a single shared gate helper.
- The migration footprint shrinks from ten models to two models plus one column — the smallest change that makes v1 real (de-risks ADR-0002's chain).
- Invitations, audit logging, and email reuse already-working code (`TeamInvitation` flow, `email-service.ts`) instead of duplicating it.
- Deleting the roles/permissions/SSO routes removes ~8 of the 14 broken API files outright.

### Negative

- Custom roles beyond the five `WorkspaceRole` levels are off the table until a future ADR reverses this; enterprise buyers asking for fine-grained roles or SSO get "not yet".
- Feature-flag stubs (SSO) remain in the tree as intentional dead weight until revisited.
- Two audit stores (`AuditLog` platform-level, `AuditEvent` workspace-level) coexist until ADR-0024 consolidates.
- `isPlatformAdmin` is a new operational secret-of-sorts: granting it must itself be audited (mitigated below).

## Implementation Plan

### Phase 0 — Unbreak the build (prereq: ADR-0002 schema validation fix)

1. **(S)** Replace `'@/lib/auth/utils'` imports in all 26 files with the ADR-0003 helper path; add `await` at every `normalizeUserId` call site, including `src/app/dashboard/admin/layout.tsx:19`.
2. **(S)** Delete the duplicate `model UserSession` (schema line ~5072) and duplicate `User.userSessions` relation, re-pointing `UserActivity.session` to the canonical model (the edit ADR-0002 Phase 1 step 1 owns); confirm `prisma validate` passes.

### Phase 1 — Schema and migration (ADR-0002 workflow)

3. **(S)** Remove `Role`, `UserRole`, `Permission`, `UserInvitation`, `SSOProvider`, `SSOAccount`, `Team`, `TeamMember` models (and their `User`/`Workspace` relation fields) from `prisma/schema.prisma`; retain the source in git history for future revival.
4. **(M)** Add `User.isPlatformAdmin Boolean @default(false)`; amend `AuditLog` (add `metadata Json?`); `UserActivity.session` keeps the relation to the canonical `UserSession` as re-pointed by ADR-0002 Phase 1 step 1; create the migration landing `audit_logs` + `user_activities`; regenerate the client.
5. **(S)** Seed hook: mark the owner account platform-admin in dev seed (coordination with ADR-0025).

### Phase 2 — Authorization gate

6. **(M)** Implement `requirePlatformAdmin()` in the ADR-0003 auth helper module; adopt it in `src/app/dashboard/admin/layout.tsx` and every surviving `/api/admin/**` route; write an `AuditLog` row whenever `isPlatformAdmin` is granted/revoked.
7. **(S)** Convert surviving `[id]` routes to async `params` (Next 15).

### Phase 3 — Route repairs and deletions

8. **(S)** Delete `src/app/api/admin/roles/**`, `permissions/**`, `sso/**`, `teams/**`; gate the SSO page behind `FEATURE_SSO_ADMIN`.
9. **(M)** `users/route.ts` + `users/[id]/route.ts`: drop `workspace.plan` select and all cut-model includes; fix `userWorkspace.create` args (no `joinedAt`, no `permissions` — column dropped per ADR-0004); keep self-demotion/self-delete guards.
10. **(M)** `bulk-operations/route.ts`: reduce to the v1 operation set; switch invitations to `TeamInvitation` + real email; password reset issues `VerificationToken` reset links (no secrets in responses, per ADR-0006); fix `userWorkspace` and audit-log writes.
11. **(S)** `audit-logs/route.ts`: replace `description`/`metadata` misuse with the amended fields; add a `format=csv` export branch (streamed, proper `Content-Type`).
12. **(S)** `analytics/users/route.ts`: correct to the analytics `UserSession` field names; remove cut-model queries.
13. **(S)** `workspaces/route.ts`: reduce to read-only list with real fields only, or delete if the overview page's counts suffice.

### Phase 4 — UI repairs

14. **(L)** `users/administration/page.tsx`: implement the create/edit user modal (name, email, `isPlatformAdmin` toggle, workspace memberships with `WorkspaceRole`), delete confirmation, and working bulk-action handlers.
15. **(M)** `users/bulk-operations/page.tsx`: user picker backed by `GET /api/admin/users` (search + paginate); CSV import resolves emails server-side to real user IDs (unknown emails become invitations); populate role/workspace dropdowns from real endpoints; remove `demo-user-1/2/3` and `user_${localpart}` fabrication.
16. **(M)** Replace `users/roles` + `users/permissions` pages with the read-only `WorkspaceRole` capability-matrix page (content from ADR-0004).
17. **(M)** `admin/page.tsx`: replace hardcoded stats with real queries (user/workspace counts, open tickets via ADR-0011 models, recent `AuditLog` entries); prune `admin-sidebar.tsx` dead links.
18. **(S)** `users/access-logs/page.tsx`: point export at the CSV branch.

### Phase 5 — Verification

19. **(M)** Integration tests per ADR-0021: gate denial for non-platform-admins (including workspace OWNERs), user CRUD, bulk ops against seeded data, CSV export content type, invitation accept round-trip through `/api/team/invitations/[token]`.

Rough sizing: 2 L, 8 M, 9 S — approximately 2–3 focused weeks alongside ADR-0011 work.

## Risks and Mitigations

- **ADR-0004's fine print may shift during implementation** (the ADR itself is Accepted; the two-tier model is decided). Risk: the capability matrix content shifts while this ADR's pages are built. Mitigation: this ADR depends only on ADR-0004's decided primitive (`WorkspaceRole` enum + platform-admin flag); the matrix page reads from one shared constants module so a change is a one-file edit.
- **Migration on a fragile chain.** The `AuditLog`/`isPlatformAdmin` migration rides on ADR-0002's cleanup. Mitigation: Phase 1 lands only after `prisma validate` and `migrate diff` are green in CI (ADR-0022).
- **Deleting routes someone links to.** Mitigation: repo-wide grep for `/api/admin/roles|permissions|sso|teams` before deletion; deletions itemized in the ADR-0024 cleanup log.
- **Lockout.** A misconfigured `isPlatformAdmin` rollout could leave zero admins. Mitigation: seed script asserts at least one platform admin; a documented SQL escape hatch in the runbook.
- **Scope creep back toward IAM.** Mitigation: any request for custom roles or SSO requires a new ADR superseding the relevant cut in this one; the feature flags make the boundary explicit.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — owns the schema-validation fix and migration process this ADR's Phase 0/1 ride on.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — home of `requirePlatformAdmin()` and the async-params convention.
- ADR-0004: Platform Authorization Model and RBAC Enforcement — defines the `WorkspaceRole` primitive and capability matrix this ADR administers; this ADR implements its admin-facing half.
- ADR-0005: API Security Hardening — the escalation class closed by the platform-admin gate.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — governs reset tokens and forbids secrets in responses.
- ADR-0011: Support Subsystem Remediation — supplies real ticket stats for the admin overview; shares the admin shell.
- ADR-0016: System Settings & Configuration — owns the admin settings hub (currently "Mock stats for now") and any workspace-suspension proposal.
- ADR-0019: Billing and Subscriptions with Stripe — owns plan/subscription data; reason no `Workspace.plan` column is added here.
- ADR-0021: Testing Strategy and Honest Quality Gates — Phase 5 test requirements.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — CI gates for migration and build health.
- ADR-0024: Codebase Hygiene — records the route/page/model deletions and future `AuditLog`/`AuditEvent` consolidation.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — owns platform-admin seeding and demo data for admin pages.
