# ADR-0011: Support Subsystem Remediation (Tickets, Chat, Agents)

- Date: 2026-07-02
- Status: Accepted
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

The support subsystem (tickets, live chat, contact form, agents) is one of the largest AI-generated
surfaces in the codebase. The query logic, SLA-deadline calculation, least-loaded agent
auto-assignment, update timelines, internal notes, and bulk operations are genuinely implemented —
this is not scaffolding. But the subsystem is currently not runnable and has per-route defects that
would break it even after the schema is repaired. Verified against the code on 2026-07-02:

1. **Not runnable at all until ADR-0002 lands.** `prisma/schema.prisma` fails validation (33
   errors); the generated client (73 models) contains none of the `SupportTicket`, `SupportAgent`,
   `SupportChat`, etc. models (defined at `prisma/schema.prisma:3519-3922`), and the sole migration
   has none of their tables. Every support route throws `prisma.supportTicket is undefined`.

2. **Invalid enum write on agent reply.**
   `src/app/api/admin/support/tickets/[id]/reply/route.ts:176` writes
   `updateType: isResolution ? 'RESOLUTION' : 'REPLY'`. `TicketUpdateType`
   (`prisma/schema.prisma:3911-3922`) has no `REPLY` member — the correct value is `AGENT_REPLY`
   (`USER_REPLY` exists for the user side). Every non-resolution agent reply would fail at the
   database layer.

3. **Broken import and a competing agent paradigm.**
   `src/app/api/admin/support-agents/route.ts:5` imports `normalizeUserId` from
   `'@/lib/auth/utils'`, which does not exist (`src/lib/auth/` contains only `auth-options.ts`,
   `config.ts`, `demo-user.ts`, `index.ts`) — module resolution failure. Worse, the route
   implements "support agents" as RBAC `Role`/`UserRole` records with string permissions
   (`support_tickets_manage`, `support_technical_manage`, …), while every other support route —
   ticket auto-assignment, chat assignment, replies, notes — uses the dedicated `SupportAgent`
   model (1:1 with `User`, `prisma/schema.prisma:3519`). Two incompatible definitions of "who is
   an agent" cannot coexist.

4. **Unauthenticated ticket access hole.** In
   `src/app/api/support/tickets/[ticketId]/route.ts:20-38` (and the sibling `/updates` and
   `/attachments` routes), the where-clause starts as `{ id: ticketId }` and ownership constraints
   are added only `if (session?.user?.id)`. An unauthenticated request with a known ticket ID can
   read any ticket, change its status/priority, post updates, and upload or delete attachments.

5. **Legacy Next.js params signatures.** The user ticket routes
   (`tickets/[ticketId]/{route,updates,attachments}.ts`) and admin ticket routes
   (`admin/support/tickets/[id]/{route,reply,notes}.ts`) use the deprecated synchronous
   `{ params: { id: string } }` signature. The chat routes already do it correctly
   (`params: Promise<{ chatId: string }>` + `await params` in
   `src/app/api/support/chat/[chatId]/route.ts:6-12`), so the codebase is internally inconsistent.

6. **Emails never send.** The agent-reply notification is a literal TODO —
   `reply/route.ts:201-209` ends in `console.log('Email notification should be sent to …')` — and
   the contact form (`src/app/api/support/contact/route.ts:93`) has only a comment: "Send
   confirmation email (you could implement this with your email service)". Meanwhile a working
   nodemailer-based `EmailService` singleton already exists at
   `src/lib/notifications/email-service.ts` (exported as `emailService`, line 445).

7. **Attachments are world-readable.**
   `src/app/api/support/tickets/[ticketId]/attachments/route.ts:149` writes uploads to
   `public/uploads/tickets` and stores `fileUrl: '/uploads/tickets/<filename>'` — every ticket
   attachment is served statically to anyone, bypassing all authorization.

8. **No seed data.** `prisma/seed.ts` contains zero support rows — no agents, no tickets, no
   chats — so the admin UI renders empty and the auto-assignment path is untestable locally.

9. **UI state (correction to the audit's "thin UI" framing).** The admin ticket list
   (`src/app/dashboard/admin/support/tickets/page.tsx`, 724 lines) and detail
   (`.../[id]/page.tsx`, 899 lines) pages are substantially complete: the detail page already
   renders the SLA-breached badge (lines 351-354), SLA deadline (lines 886-887), an internal-notes
   tab (line 634), and an `assignedAgentId` edit field (lines 149, 187). The actual UI gaps are:
   (a) the assignment control has no agent roster to select from — the page fetches only
   `/api/admin/support/tickets*` endpoints, never an agents list; and (b) the admin sidebar
   (`src/components/admin/admin-sidebar.tsx:62-63,97`) links to `/dashboard/admin/support/agents`,
   `/dashboard/admin/support/analytics`, and `/dashboard/admin/users/support-agents` — none of
   which exist (404s).

Per the binding owner decisions of 2026-07-02, support tickets/chat are in the "repair now" bucket
(unlike Community, Documentation, and Discord, which are deferred — ADR-0013, ADR-0014, ADR-0015),
and Stripe billing (ADR-0019) is in scope now — a paid product needs a working support channel at
launch. This ADR decides how to get from the current state to "support works end-to-end."

## Decision Drivers

- **Owner mandate**: support must be repaired now; it is the customer-facing safety net for the
  billing launch (ADR-0019).
- **Leverage existing investment**: the ticket/chat business logic and ~1,600 lines of admin UI are
  real and mostly correct; a rewrite would discard working code.
- **Security**: the unauthenticated ticket access hole and world-readable attachments are
  exploitable the moment the tables exist; they must close in the same release that makes the
  routes functional.
- **One paradigm per concept**: agent identity must have exactly one source of truth; auth helpers
  must follow the ADR-0003 conventions; storage must follow ADR-0007.
- **Self-hosted deployment** (ADR-0022): the stack standardizes on self-hosted Docker; solutions
  requiring external SaaS dependencies for core support are disfavored.
- **Don't block on realtime**: chat is polling-based today; the realtime transport decision is
  ADR-0010's and must not gate support v1.

## Considered Options

### Option A: Replace with a third-party helpdesk (Chatwoot self-hosted or Zendesk embed)

Delete the custom support code; integrate an off-the-shelf helpdesk.

- Good: mature ticketing/chat/SLA features immediately; no per-route bug-fixing.
- Good: agent management, email pipelines, and attachment security are solved problems there.
- Bad: discards ~20k lines of working domain logic and two finished admin pages; support data
  leaves the app's Postgres (or adds a second self-hosted service to operate per ADR-0022).
- Bad: workspace isolation, RBAC integration (ADR-0004/ADR-0012), and billing-context deep links
  would all need custom bridge code — the integration cost rivals the repair cost.

### Option B: Repair in place; `SupportAgent` is the canonical agent model (chosen)

Fix the enumerated per-route defects after ADR-0002 lands the tables; rewrite
`/api/admin/support-agents` on the `SupportAgent` model; close the auth holes; wire real emails via
the existing `emailService`; move attachments to private storage per ADR-0007; seed demo data per
ADR-0025; finish the two small UI gaps (agent roster + dead links).

- Good: smallest distance to "works end-to-end" — most defects are S/M-sized, file-local fixes.
- Good: keeps all support data in the app database with existing workspace isolation.
- Good: `SupportAgent` is already what assignment, chat, replies, and notes use; choosing it makes
  one route conform instead of rewriting six.
- Bad: we own ongoing maintenance of a custom helpdesk.
- Bad: chat remains polling-based until ADR-0010 delivers a realtime transport.

### Option C: Repair tickets only; delete chat and contact form for v1

Ship tickets; remove `SupportChat`/`SupportMessage` routes and the widget behind a feature flag.

- Good: narrows the repair surface by roughly a third.
- Bad: chat is the *healthiest* part of the subsystem (correct Next 15 params, working assignment
  and polling backend) — deleting the best code to avoid fixing the worst is backwards.
- Bad: the live-chat widget is already mounted in the help center; ripping it out is user-visible
  regression work, not savings.

## Decision Outcome

**Option B: repair in place, with `SupportAgent` as the single canonical agent model.**

The defect list is long but shallow: one enum literal, one import path plus paradigm rewrite, one
where-clause pattern repeated across three routes, a params-signature sweep, two email call sites,
one storage path, and seed data. Every fix is bounded and verifiable. Option A's integration cost
exceeds this repair cost while adding operational surface contrary to ADR-0022; Option C deletes
working code without materially shrinking the risky part of the work (auth, storage, emails all
live on the ticket side anyway).

Sub-decisions:

1. **Agent identity**: `SupportAgent` (profile: `displayName`, `department`, `skills`,
   `maxConcurrentChats`, `isOnline`) is the only definition of a support agent.
   RBAC roles/permissions (ADR-0004, ADR-0012) decide *who may access admin support routes*; they
   do not define *who is an agent*. `/api/admin/support-agents` is rewritten accordingly; the
   `Role`/`UserRole`-based implementation is deleted (ADR-0024 hygiene).
2. **Guest ticket access** is denied outright in Phase 1 (401 for unauthenticated ticket
   detail/update/attachment requests). The proper mechanism — a signed, ticket-scoped guest access
   token issued at creation and delivered by email — is specified in ADR-0005; this ADR only
   sequences it (Phase 2). Guest ticket *creation* and the contact form remain open.
3. **Emails** go through the existing `emailService`
   (`src/lib/notifications/email-service.ts`); no new mail infrastructure.
4. **Attachments** move out of `public/` to the private storage root defined by ADR-0007, served
   only through ADR-0007's single authenticated route (`GET /api/files/[...key]`); this ADR
   supplies the ticket-access authorization helper that route delegates to for `tickets/*` keys.
5. **Chat stays polling-based** for v1; migration to the ADR-0010 transport is explicitly out of
   scope here.
6. **v1 UI scope**: keep the two existing admin pages; add the agent roster to the assignment
   control; add one minimal `/dashboard/admin/support/agents` page (list/create/activate agents —
   required anyway to have anyone to assign); remove the `/dashboard/admin/support/analytics` and
   `/dashboard/admin/users/support-agents` sidebar links for v1 (the analytics API stays; a page
   for it is deferred).

## Consequences

### Positive

- Support works end-to-end on real tables at billing launch: create → assign → reply (with email)
  → resolve, plus live chat, with seeded demo data for development and E2E tests (ADR-0021).
- The unauthenticated-access hole and world-readable attachments close in the same release that
  activates the routes — the vulnerable code is never live.
- One agent paradigm ends the `Role`-string drift; admin authorization composes cleanly with
  ADR-0012 instead of duplicating it.
- The params sweep removes the last deprecated sync-params signatures in the support tree,
  matching the ADR-0003 route conventions.

### Negative

- We own a custom helpdesk long-term: SLA-breach evaluation, satisfaction ratings, and reporting
  will need continued investment (satisfaction metrics in
  `/api/admin/support/tickets/analytics` are currently mocked and stay mocked-but-labeled in v1).
- Guest users temporarily lose ticket *viewing* between Phase 1 (deny) and Phase 2 (token) —
  mitigated by sequencing both into the same release where possible.
- Polling chat adds avoidable load per open widget until ADR-0010 lands.
- Existing `public/uploads/tickets` files (if any environments have them) need a migration move.

## Implementation Plan

Phase 0 is a hard dependency; Phases 1-2 should ship together as one release; Phase 3 completes
hardening. Sizes: S (≤half day), M (≤2 days), L (>2 days).

### Phase 0 — Prerequisites (other ADRs)

1. **[blocking] ADR-0002** delivers a valid schema, a migration containing all `Support*` tables,
   and a regenerated client. Support-relevant checks: `TicketUpdateType`, `SupportAgent`,
   `SupportTicket.slaBreached` survive intact. (Tracked there, not here.)
2. **ADR-0003** consolidated auth helper (`requireUser` / `requireWorkspaceRole` or equivalent)
   available for the rewrites below.

### Phase 1 — Correctness and security repairs

3. **(S) Fix reply enum** — `src/app/api/admin/support/tickets/[id]/reply/route.ts:176`: change
   `'REPLY'` → `'AGENT_REPLY'`. Audit the other `ticketUpdate.create` call sites
   (`tickets/[ticketId]/updates/route.ts`, admin `[id]/route.ts`, bulk route) and confirm each
   writes a real `TicketUpdateType` member (`USER_REPLY` for the user reply path).
4. **(M) Rewrite `/api/admin/support-agents`** — `src/app/api/admin/support-agents/route.ts`:
   fix the import (`normalizeUserId` from `@/lib/auth/demo-user`, or the ADR-0003 helper);
   replace the `Role`/`UserRole` implementation entirely. GET: list `SupportAgent` joined with
   `User` (name/email/image), `isOnline`, `currentChatCount`, open-ticket count via
   `assignedTickets`. POST: create/reactivate a `SupportAgent` profile for a given `userId`
   (`displayName`, `title`, `department`, `skills`, `maxConcurrentChats`). Admin-only per
   ADR-0012. Delete the role-fabrication code (ADR-0024).
5. **(M) Close the guest access hole** — in
   `src/app/api/support/tickets/[ticketId]/route.ts`, `.../updates/route.ts`,
   `.../attachments/route.ts`: return 401 when there is no session (all methods). Never build a
   bare `{ id }` where-clause; always require the `userId`/`workspaceId` OR-constraint. Guest
   *creation* paths in `tickets/route.ts` and `contact/route.ts` are unaffected.
6. **(M) Params signature sweep** — convert to `{ params }: { params: Promise<…> }` + `await` in:
   `support/tickets/[ticketId]/route.ts`, `.../updates/route.ts`, `.../attachments/route.ts`,
   `admin/support/tickets/[id]/route.ts`, `.../reply/route.ts`, `.../notes/route.ts`. (Chat routes
   already conform; community routes are out of scope per ADR-0013.)
7. **(M) Real emails** — using `emailService` from `src/lib/notifications/email-service.ts`:
   (a) agent public reply → notification to `ticket.user.email ?? ticket.guestEmail` (replaces the
   `console.log` at `reply/route.ts:208`); (b) contact-form confirmation in
   `support/contact/route.ts`; (c) ticket-created confirmation (with ticket number) in
   `support/tickets/route.ts`. Templates follow the existing branded-HTML pattern; verified in
   Mailhog (port 8025).
8. **(M) Private attachments (ADR-0007)** — rebuild the upload in
   `support/tickets/[ticketId]/attachments/route.ts:149` on the ADR-0007 storage service: write
   under the `tickets/{ticketId}/{uuid}{ext}` key, persist `TicketAttachment.storageKey`, and set
   `fileUrl` to `/api/files/{key}`. Downloads go through ADR-0007's single serving route
   (`GET /api/files/[...key]`) — no separate download endpoint here. This ADR contributes the
   ticket-access authorization helper (the same rule as step 5) that `/api/files` delegates to
   for `tickets/*` keys. Relocating existing files and backfilling `fileUrl`/`storageKey` rides
   ADR-0007's `scripts/migrate-uploads.ts` migration — no second script.

### Phase 2 — Access for guests, UI completion

9. **(M) Guest access token (mechanism per ADR-0005)** — issue a signed, ticket-scoped,
   expiring token at guest ticket creation; include the link in the confirmation email from step
   7c; the three ticket routes accept it as an alternative to a session, scoped to that ticket,
   read + reply only (no attachment delete, no priority/status editing).
10. **(S) Agent roster in assignment UI** —
    `src/app/dashboard/admin/support/tickets/[id]/page.tsx`: fetch the rewritten
    `GET /api/admin/support-agents` and render a select for `assignedAgentId` (currently a bare
    field with no roster source).
11. **(M) Minimal agents admin page** — new `src/app/dashboard/admin/support/agents/page.tsx`
    (the sidebar already links to it): agent list with online/active status and load, "make user
    an agent" dialog (POST from step 4), activate/deactivate toggle.
12. **(S) Sidebar cleanup** — `src/components/admin/admin-sidebar.tsx`: remove the
    `/dashboard/admin/support/analytics` and `/dashboard/admin/users/support-agents` entries
    (pages deferred); keep Tickets and Agents.

### Phase 3 — Seed data and quality gates

13. **(M) Seed support data (ADR-0025)** — extend `prisma/seed.ts`: 3 `SupportAgent` profiles
    (mixed departments, one online), ~12 `SupportTicket`s spanning statuses/priorities/categories,
    including at least one SLA-breached, one guest ticket, and one resolved with a full
    `TicketUpdate` timeline + internal note; one open `SupportChat` with messages.
14. **(M) Tests (ADR-0021)** — route tests: authz matrix for ticket detail/update/attachments
    (anonymous / owner / other user / workspace admin / guest token), `AGENT_REPLY` enum write,
    agent roster CRUD; one Playwright flow: admin opens seeded ticket → assigns agent → replies →
    email asserted in Mailhog → resolves.
15. **(S) Honesty pass on analytics** — label the mocked satisfaction figures in
    `/api/admin/support/tickets/analytics` as unavailable (return `null` + `satisfactionTracking:
    false`) rather than fabricating numbers; real ratings come later from `SupportChat.rating`
    aggregation (ADR-0023 direction).

### Definition of Done — "support works end-to-end"

- [ ] `npx prisma validate` passes and `migrate deploy` creates all `Support*` tables (ADR-0002).
- [ ] `npm run build` succeeds with no module-resolution or type errors under
      `src/app/api/support/**` and `src/app/api/admin/support*/**`.
- [ ] Authenticated user creates a ticket; SLA deadline set; auto-assignment picks the
      least-loaded online seeded agent; confirmation email visible in Mailhog.
- [ ] Guest creates a ticket via contact/widget and receives a confirmation email with a working
      tokenized ticket link; the token grants access to that ticket only.
- [ ] Unauthenticated request to another ticket's detail/update/attachment routes returns 401;
      authenticated non-owner outside the workspace gets 404/403 — verified by route tests.
- [ ] Admin list page shows seeded tickets with real filter/stats data; detail page loads
      timeline, notes, SLA deadline/breach badge.
- [ ] Admin assigns an agent from the roster dropdown; `SupportTicketAssignment` history row and
      `ASSIGNMENT_CHANGE` update recorded.
- [ ] Agent reply persists a `TicketUpdate` with `updateType: AGENT_REPLY`, sets
      `firstResponseAt` on first reply, and the requester receives the email.
- [ ] Internal notes and `isPublic: false` updates never appear in user-facing ticket responses.
- [ ] Attachment uploads land outside `public/`; download works only through
      `GET /api/files/tickets/...` (ADR-0007's single serving route); the old
      `/uploads/tickets/...` URL returns 404.
- [ ] Live chat: session starts (user and guest), agent auto-assigned, welcome message present,
      messages send/poll, close + rating persists — all against the database.
- [ ] `GET /api/admin/support-agents` returns the `SupportAgent`-backed roster; the agents admin
      page lists, creates, and deactivates agents.
- [ ] `prisma db seed` yields the demo agents/tickets/chat; admin pages are non-empty on a fresh
      environment.
- [ ] No support route ships a `console.log`-only side effect where a real action is expected.

## Risks and Mitigations

- **ADR-0002 slippage blocks everything here.** Mitigation: Phase 1 items 3-6 are pure code
  changes reviewable before the migration lands; only runtime verification waits.
- **Guest lockout window** between denying bare-ID access (step 5) and the token (step 9).
  Mitigation: ship both in the same release; if the token slips, interim lookup requires
  `ticketNumber` + exact `guestEmail` match rather than ID alone.
- **Email misconfiguration in production** silently drops notifications. Mitigation: fail loudly —
  log at error level and surface SMTP health in the ADR-0023 health checks; Mailhog covers dev.
- **Attachment migration** may orphan files referenced by old `fileUrl`s. Mitigation: ADR-0007's
  `scripts/migrate-uploads.ts` maps existing rows to storage keys and is idempotent; run it
  before cutting `fileUrl` over to `/api/files`.
- **Polling chat load** grows with adoption. Mitigation: acceptable at current scale; poll interval
  configurable; ADR-0010 owns the upgrade path.
- **Scope creep toward community features** (forum/feature requests share models and patterns).
  Mitigation: hard boundary — anything under `/api/community/**` is ADR-0013's flag-gated scope.

## Related ADRs

- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — hard dependency; delivers
  the tables and valid client this entire plan assumes.
- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — dependency; the
  `@/lib/auth/utils` fix and params sweep follow its conventions.
- **ADR-0004: Platform Authorization Model and RBAC Enforcement** — RBAC governs admin route
  access; explicitly *not* agent identity (this ADR).
- **ADR-0005: API Security Hardening** — dependency for the guest-access token mechanism
  (sequenced here as Phase 2, step 9).
- **ADR-0007: Media Storage, Uploads, and Serving Architecture** — dependency for the private
  attachment storage and the single `/api/files` serving route (step 8); this ADR supplies the
  ticket-access helper that route delegates to for `tickets/*` keys.
- **ADR-0008: Background Jobs and the Publishing Pipeline** — future home of a scheduled
  SLA-breach evaluator; v1 computes breach state on read.
- **ADR-0010: Realtime Transport and Notification Delivery** — future upgrade path for chat
  polling; out of scope for v1.
- **ADR-0012: Admin Dashboard and RBAC Subsystem Remediation** — companion "repair now" ADR; the
  admin support pages live inside its dashboard shell.
- **ADR-0013 / ADR-0014 / ADR-0015** — Community, Documentation, and Discord deferrals; define the
  boundary of what this ADR deliberately does not touch.
- **ADR-0019: Billing and Subscriptions with Stripe** — business driver; billing launch requires a
  working support channel.
- **ADR-0021: Testing Strategy and Honest Quality Gates** — the authz-matrix and E2E tests in
  step 14.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — deployment context that
  disfavored the third-party option.
- **ADR-0023: Observability** — SMTP health surfacing; future real satisfaction metrics.
- **ADR-0024: Codebase Hygiene** — deletion of the RBAC-role agent implementation.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — support seed data (step 13).
