# ADR-0020: Client Portal and Shareable Reports

- Date: 2026-07-02
- Status: Proposed
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

"Develop a Client Portal" is one of the two TODO.md roadmap items that is genuinely
unbuilt (the other, Billing, is now covered by ADR-0019). SociallyHub is an agency
product: workspaces manage `Client` records, generate `ClientReport`s, and email them —
but a client today has no way to see their own data except an email attachment, and an
agency has no way to hand a client a link. Verified against the code on 2026-07-02:

- **`CLIENT_VIEWER` exists but is never enforced.** The `WorkspaceRole` enum
  (`prisma/schema.prisma:861-867`) has carried `CLIENT_VIEWER` since the init migration
  (`prisma/migrations/20250901141259_init/migration.sql:2`). The team-invite UI offers it
  ("Client Viewer - Read-only client access", `src/components/dashboard/team/team-manager.tsx:530`),
  the seeder assigns it (`prisma/seed.ts:57,323-325`), and invitation acceptance writes a
  `permissions` JSON for it (`canViewAnalytics: true`,
  `src/app/api/team/invitations/[token]/route.ts:207-214`) — but no feature API route
  reads that JSON or branches on the role. Per ADR-0004, the `UserWorkspace.permissions`
  JSON is write-only dead data.
- **Enforcement is inconsistent in exactly the surface a portal needs.**
  `GET/POST /api/client-reports` requires `role in ['OWNER','ADMIN','PUBLISHER']`
  (`src/app/api/client-reports/route.ts:27,120`) — so a `CLIENT_VIEWER` (or `ANALYST`)
  cannot even list reports — while `GET /api/client-reports/[id]/download`
  (`src/app/api/client-reports/[id]/download/route.ts:24-31`) checks **no role at all**:
  it does `prisma.userWorkspace.findFirst({ where: { userId } })` and uses the user's
  *first* workspace, the exact multi-workspace bug pattern ADR-0004 catalogues. A
  `CLIENT_VIEWER` invited today can download any report in the workspace but cannot see
  the list it came from.
- **The existing "client permissions" UI is fiction.**
  `src/components/dashboard/clients/client-permission-system.tsx` performs zero `fetch`
  calls and renders hardcoded `mockClientUsers` (lines 58-59, 133-134) against a
  `ClientRole` enum (`src/types/client.ts:282-287`: `CLIENT_ADMIN`, `CLIENT_MANAGER`,
  `CLIENT_VIEWER`, `CLIENT_CONTRIBUTOR`) that does not exist in the Prisma schema. It
  must be deleted or rebuilt, not extended (ADR-0024).
- **No sharing primitives exist.** `ClientReport` (`prisma/schema.prisma:693-721`) has
  `filePath`, `recipients`, `downloadCount` — but no share token, password, or expiry
  field. A repo-wide search for `shareToken`/`shareLink`/`publicToken` finds nothing, and
  there is no `/share`, `/portal`, or public route group under `src/app`. There is no
  root `middleware.ts`; every route does its own session check, so an unauthenticated
  public route is *possible* but must be deliberately designed and hardened (ADR-0005).
- **Clients are not users.** `Client` (`prisma/schema.prisma:298-326`) holds contact
  info (`email`, `company`, …) with no relation to `User`. Report delivery is SMTP email
  only (`/api/client-reports/[id]/send`, schedules run endpoint). Note also that
  scheduled report generation currently fills `ClientReport.data` from mock metrics
  (`/api/client-reports/schedules/run`, per the core-social audit) — whatever we expose
  to clients must not launder demo numbers as real results (ADR-0025).
- **The "PDF" exports clients will receive are print-styled HTML.**
  `GET /api/client-reports/[id]/download` serves `text/html` under a
  `*_Report.pdf.html` filename with embedded "press Ctrl/Cmd+P" instructions when
  `format = PDF` (`src/app/api/client-reports/[id]/download/route.ts:79-87`), and
  `/api/invoices/download-pdf` likewise returns HTML with a comment deferring "true PDF
  generation" to production (`src/app/api/invoices/download-pdf/route.ts:62-70`). No
  other ADR remediates this for the agency surfaces: ADR-0014's real-PDF item covers
  only the deferred documentation exports, and ADR-0019's Stripe-hosted invoice PDFs
  are SaaS-subscription billing — it explicitly leaves the client-invoicing `Invoice`
  model untouched. These are the exact artifacts this ADR hands to external clients.
- **Useful building blocks already exist**: `ClientBranding`
  (`prisma/schema.prisma:2532`, workspace-level with optional `clientId`) for portal
  white-labeling, `TeamInvitation.token` as a (weak, cuid-based) token-link precedent,
  and AES helpers in `src/lib/encryption.ts` (ADR-0006).

The problem: define the smallest credible client-facing surface — how clients access it
(accounts vs. links), what `CLIENT_VIEWER` may query, and how report links are secured —
without building it before its prerequisites (billing, auth helpers, core repairs) land.

## Decision Drivers

- **Client friction**: agencies lose the value of reports if clients must register,
  verify email, and log in to see one page. Most competitors ship "copy shareable link".
- **Security**: this is the first *unauthenticated* data-bearing surface in the app; it
  must not become an enumeration or lateral-movement vector (ADR-0005 rate limiting,
  ADR-0006 token handling).
- **RBAC coherence**: `CLIENT_VIEWER` is already offered in the invite UI; every day it
  stays unenforced is a live mis-permission (download-anything, list-nothing).
- **Sequencing**: owner decisions (2026-07-02) put Stripe billing (ADR-0019) and
  support/admin repairs (ADR-0011, ADR-0012) ahead of growth features. The portal is
  growth work and may itself be plan-gated by billing.
- **Reuse over invention**: `ClientReport.data` snapshots, `ClientBranding`, and the
  ADR-0003/0004 auth helpers should carry this feature; no new frameworks.
- **Migration-first** (ADR-0002): all schema additions ship as real migrations.

## Considered Options

### Option 1: Tokenized share links only (no client identities)

Signed random token per report, optional password + expiry, public render route. No
portal, no accounts, `CLIENT_VIEWER` stays unused (or is removed).

- Good: smallest surface; zero client friction; ships value in one sprint.
- Good: no session/identity complexity on the public path; report renders from the
  stored `data` snapshot, so a leaked token exposes one document, not an API.
- Bad: no recurring destination for clients ("where's last month's report?"); no basis
  for v2 features (post approvals need an identity to attribute approval to).
- Bad: leaves `CLIENT_VIEWER` dangling in the invite UI — the current mis-permission
  persists.

### Option 2: Full client accounts first (portal as filtered dashboard)

Client contacts become real `User`s with `UserWorkspace` role `CLIENT_VIEWER`; the
portal is `/dashboard` with most nav hidden and queries filtered to their client.

- Good: one auth system (NextAuth) end to end; identity from day one enables approvals,
  comments, audit trails.
- Bad: highest friction for the end client; agencies must shepherd sign-ups.
- Bad: largest blast radius — `CLIENT_VIEWER` must be *default-denied* across all ~200+
  route files before a single client logs in, because today the role's behavior is
  accidental (see download route). That is ADR-0004's rollout, not this feature's.
- Bad: reusing `/dashboard` risks data bleed through any endpoint that checks session
  but not role — the exact class of bug the audit found.

### Option 3 (chosen): Phased hybrid — share links first, scoped portal accounts second, approvals third

Phase 1 ships tokenized report links (Option 1's mechanics). Phase 2 makes
`CLIENT_VIEWER` real: client contacts invited as `User`s scoped to one `clientId`, with
a dedicated read-only portal route group and an explicit query allowlist enforced via
ADR-0004 helpers. Phase 3 (v2, separate go/no-go) adds approval-of-scheduled-posts.

- Good: delivers client value immediately; each phase is independently shippable and
  independently securable.
- Good: Phase 2 rides on ADR-0004's `requireWorkspaceRole` seam instead of inventing a
  parallel permission system (and finally kills the mock `ClientRole` UI).
- Bad: two access mechanisms to maintain (links and sessions); mitigated by the portal
  reusing the same render components as the share page.

### Option 4: Status quo plus (email-only delivery, no portal)

Keep SMTP delivery, drop the roadmap item, remove `CLIENT_VIEWER` from the enum and UI.

- Good: zero new attack surface; honest about capacity.
- Bad: abandons a differentiating agency feature already promised in TODO.md and
  TEST_SCENARIOS.md; competitors ship it; still requires cleanup work (role removal,
  mock UI deletion) for no user value.

## Decision Outcome

**Option 3: phased hybrid, share links first.** Recorded as **Proposed** — implementation
must not start until the prerequisites below are met; this ADR fixes the design so the
schema and helper work in ADR-0002/0004 can leave room for it.

**Prerequisites (in order):**
1. ADR-0002 migrations green and ADR-0003/0004 auth helpers (`getAuthenticatedUser()`,
   `requireWorkspaceRole()`) adopted on the client/report route families.
2. ADR-0005 rate limiting available for public routes.
3. ADR-0011/0012 core repairs and ADR-0019 billing shipped (portal access becomes a
   plan-gated feature under ADR-0019's plan model).
4. Real (non-mock) report metrics, or at minimum an honest "sample data" label per
   ADR-0025 — we do not hand clients links to reports generated from `Math.random()`.

**Design decisions:**

1. **New model `ReportShareLink`** (not fields on `ClientReport`): a report can have
   multiple links (per recipient, per revocation cycle) and links need their own audit
   trail.
   ```prisma
   model ReportShareLink {
     id             String    @id @default(cuid())
     workspaceId    String
     reportId       String
     tokenHash      String    @unique   // sha256(token); raw token never stored
     passwordHash   String?             // bcrypt, optional
     expiresAt      DateTime?           // default now()+30d at creation
     revokedAt      DateTime?
     viewCount      Int       @default(0)
     lastAccessedAt DateTime?
     createdById    String
     createdAt      DateTime  @default(now())
     report    ClientReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
     workspace Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
     @@index([reportId])
     @@map("report_share_links")
   }
   ```
   Tokens are 32 bytes from `crypto.randomBytes` (base64url, ~43 chars), shown once at
   creation. Only the SHA-256 hash is persisted (ADR-0006: a DB dump must not yield
   working links). Do **not** reuse the cuid-default pattern from `TeamInvitation.token`.
2. **Public render is snapshot-only.** `/share/reports/[token]` renders exclusively from
   `ClientReport.data` (JSON snapshot) and branding — it never executes live analytics
   queries. A leaked link exposes one frozen document, never an API. Password-protected
   links verify via `POST` + bcrypt compare and set a short-lived, `/share`-scoped
   HttpOnly cookie. All `/api/share/*` endpoints are rate-limited (ADR-0005) and return
   an identical 404 for unknown, expired, and revoked tokens (no oracle).
3. **Phase 2 scopes `CLIENT_VIEWER` to a client** via a nullable `clientId String?`
   column on `UserWorkspace` (required-by-validation when `role = CLIENT_VIEWER`), plus
   a `requireClientViewer(workspaceId)` helper layered on ADR-0004's
   `requireWorkspaceRole`. The dead `permissions` JSON is *not* used (ADR-0004 deletes
   it from the authz path).
4. **`CLIENT_VIEWER` query allowlist (exhaustive; everything else 403):**
   - `GET /api/client-reports` — forced `clientId = membership.clientId`, status
     `COMPLETED|SENT` only
   - `GET /api/client-reports/[id]` and `/download` — same client scope (this also fixes
     the current no-role-check download hole for all roles)
   - `GET /api/portal/summary` — new endpoint returning a curated metric snapshot for
     that client (derived server-side; the portal gets no raw `/api/analytics/*` access)
   - `GET` branding/config needed to render the portal shell
   The portal UI lives in a dedicated route group (`src/app/portal/*`), not
   `/dashboard`, so no dashboard endpoint is reachable by construction of the UI — but
   enforcement is server-side regardless.
5. **Phase 3 (v2) — approval of scheduled posts** — is designed but explicitly deferred:
   a `PostApproval` model (post, clientId, status, decidedById, note) and portal
   approve/reject UI. It is gated on ADR-0008/0009 because today nothing is ever
   actually published (`/api/posts` only logs on `SCHEDULED`; the BullMQ pipeline is
   never started), so an approval gate would guard a no-op.
6. **Export format ruling: print-optimized HTML is the v1 artifact, honestly labeled.**
   No other ADR owns the format of agency-facing exports (see Context), so this ADR
   rules on the two it exposes to clients: client-report downloads and agency invoice
   downloads stay HTML in v1, but the labeling lie goes before any share link ships —
   UI affordances and filenames rename from "PDF" to "Printable report" / plain
   `.html` (no `.pdf.html` double extension), matching the honesty stance taken on
   demo data (ADR-0025) and fictional code (ADR-0024). Real PDFs — chromium
   print-to-PDF, which `scripts/convert-to-pdf-playwright.js` already demonstrates
   with the project's existing playwright dependency — are the designated upgrade
   path: generated in the ADR-0008 worker and stored as artifacts via ADR-0007,
   mirroring ADR-0014's export remediation for docs. That upgrade is gated on the
   ADR-0008 pipeline existing and is not committed by this ADR.
7. **Cleanup folded in** (ADR-0024): delete the mock
   `client-permission-system.tsx` and the phantom `ClientRole` enum in
   `src/types/client.ts`, replacing them with the real invite flow in Phase 2.

## Consequences

### Positive

- Agencies get "copy share link (+ password, + expiry)" on every completed report —
  the highest-value slice — weeks before any portal work.
- `CLIENT_VIEWER` finally means something defined: today's contradictory behavior
  (can-download-anything / can-list-nothing) is replaced by an explicit allowlist, and
  the download route's missing role check gets fixed for *all* roles as part of Phase 2.
- Snapshot-only public rendering caps the blast radius of any leaked link to one
  document; hashed tokens cap the blast radius of a DB leak to zero links.
- Each phase is a separate migration + route group, so it can be plan-gated (ADR-0019)
  and feature-flagged independently.
- Removes two pieces of fictional code (mock permission UI, phantom enum) from the tree.

### Negative

- First unauthenticated data-bearing surface in the product; it requires rate limiting,
  uniform 404s, and abuse monitoring (ADR-0023) that authenticated routes never needed.
- Two access mechanisms (token links, portal sessions) must stay consistent — shared
  render components mitigate but do not eliminate drift.
- `UserWorkspace.clientId` overloads the membership row with a portal concern; if
  multi-client contacts ever appear (one accountant, five clients), this becomes a join
  table migration.
- Snapshots mean clients can see stale numbers relative to the agency dashboard; this is
  accepted and labeled ("Generated on …") rather than solved.
- v1 exports are print-optimized HTML, not true PDFs; clients must print-to-PDF
  themselves until the ADR-0008 worker exists to generate real ones server-side. This
  is accepted and labeled ("Printable report") rather than solved.
- Real work is deferred behind four prerequisites; the roadmap item stays open longer.

## Implementation Plan

**Phase 0 — gate check (S)**
- Verify prerequisites 1-4 above; confirm `requireWorkspaceRole` is live on
  `src/app/api/client-reports/**` (ADR-0004 wave) and the ADR-0005 rate limiter is
  importable by public routes.

**Phase 1 — shareable report links**
1. (S) Migration: add `ReportShareLink` (schema above) + relation on `ClientReport`.
2. (S) `src/lib/sharing/report-share.ts`: `createShareToken()` (randomBytes(32) →
   base64url + sha256), `verifyShareToken()`, bcrypt password helpers; unit tests.
3. (M) `POST/GET/DELETE /api/client-reports/[id]/share-links` — create (returns raw
   token once), list, revoke; guarded by `requireWorkspaceRole(workspaceId,
   ['OWNER','ADMIN','PUBLISHER'])`.
4. (M) Public surface: `src/app/share/reports/[token]/page.tsx` +
   `GET|POST /api/share/reports/[token]` — hash lookup, expiry/revocation/password
   checks, uniform 404, `viewCount`/`lastAccessedAt` update, render from
   `ClientReport.data` with `ClientBranding`; rate-limited.
5. (S) UI: "Share link" action in the client-reports dashboard cards/menus
   (`src/components/dashboard/clients/*`), with copy-to-clipboard, password toggle,
   expiry picker; include link in the send-report email template.
6. (S) Honest export labels (design decision 6): rename "PDF" download affordances to
   "Printable report" in the client-reports and invoice UIs, fix
   `Content-Disposition` filenames (`.html`, not `.pdf.html`) in
   `/api/client-reports/[id]/download` and `/api/invoices/download-pdf` — lands
   before any share link exposes these artifacts to clients.
7. (M) Tests (ADR-0021): token entropy/hashing, expired/revoked/password paths,
   rate-limit behavior, no-live-query assertion on the public route.

**Phase 2 — client portal accounts (CLIENT_VIEWER v1)**
1. (S) Migration: `UserWorkspace.clientId String?` + index; backfill nulls.
2. (S) `requireClientViewer(workspaceId)` helper in the ADR-0004 auth module returning
   `{ user, membership, clientId }`.
3. (M) Enforce the allowlist: add client scoping to `GET /api/client-reports`(+`[id]`,
   `/download`) and fix the download route's missing role/workspace check; add
   `GET /api/portal/summary`.
4. (L) Portal UI: `src/app/portal/layout.tsx` (ClientBranding-themed shell, no dashboard
   nav) + pages for metric summary and delivered-reports list reusing the Phase 1 render
   components.
5. (M) Invite flow: "Invite to portal" on the client detail page → `TeamInvitation` with
   role `CLIENT_VIEWER` + target `clientId`; acceptance creates the scoped membership
   and redirects to `/portal`.
6. (S) Delete `client-permission-system.tsx`; remove `ClientRole`/`ClientPermissionType`
   from `src/types/client.ts` (ADR-0024).

**Phase 3 — post approvals (v2, requires ADR-0008/0009 publishing to be real) (L)**
- `PostApproval` model + portal approve/reject UI + scheduler gate ("await approval"
  post state). Separate go/no-go; not committed by this ADR.

## Risks and Mitigations

- **Token enumeration / brute force** → 256-bit random tokens, hashed at rest, uniform
  404s, per-IP and per-token rate limits, no link-listing on the public side.
- **Link forwarded beyond the client** → default 30-day expiry, one-click revocation,
  optional password; `viewCount`/`lastAccessedAt` surfaced to the agency.
- **Mock metrics leaking to clients** → block share-link creation for reports whose data
  came from the mock schedule generator until it is fixed, or stamp a "sample data"
  banner (ADR-0025 decides which); never silently present demo numbers.
- **CLIENT_VIEWER lateral movement** → default-deny: the role appears in exactly one
  allowlist; every other route family's `requireWorkspaceRole` call simply omits it.
  Add a regression test that walks the route manifest asserting 403s.
- **Session/anonymous confusion on public routes** → `/share/**` handlers never call
  `getAuthenticatedUser()`; code review checklist item + lint rule for imports of the auth module
  under `src/app/share` and `src/app/api/share`.
- **Scope creep toward a second dashboard** → portal v1 is two pages (summary, reports);
  anything more requires a new ADR.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — all schema changes
  here ship as migrations; blocked until the schema validates.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — share-link management
  routes follow the consolidated helper/response conventions.
- ADR-0004: Platform Authorization Model and RBAC Enforcement — supplies
  `requireWorkspaceRole`; this ADR defines the `CLIENT_VIEWER` allowlist that plugs into
  it and retires the dead `UserWorkspace.permissions` JSON path.
- ADR-0005: API Security Hardening — rate limiting and response conventions for the
  public `/share` surface.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — token generation
  and hashed-at-rest storage follow its rules.
- ADR-0007: Media Storage and Serving — storage target for server-generated PDF
  artifacts on the real-PDF upgrade path (design decision 6).
- ADR-0008: Background Jobs and the Publishing Pipeline / ADR-0009: Social Platform
  Integration Completion Strategy — hard prerequisites for Phase 3 approvals and for
  the real-PDF export upgrade path (design decision 6).
- ADR-0014: Documentation Management Deferral — its docs-export remediation (async
  job, stored artifact, real PDF) is the pattern the report/invoice export upgrade
  follows; export format decisions stay consistent across subsystems.
- ADR-0011: Support Subsystem Remediation / ADR-0012: Admin Dashboard and RBAC
  Subsystem Remediation — repair work sequenced before this feature.
- ADR-0019: Billing and Subscriptions with Stripe — sequenced before; portal and share
  links become plan-gated entitlements.
- ADR-0021: Testing Strategy and Honest Quality Gates — test obligations per phase.
- ADR-0023: Observability — abuse monitoring for the public surface.
- ADR-0024: Codebase Hygiene — deletion of the mock permission UI and phantom enums.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — governs whether demo-derived
  report data may be shared externally.
