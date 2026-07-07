# ADR-0019: Billing and Subscriptions with Stripe

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-07** (Option A; live checkout/portal await real Stripe keys, by design)

> **Implementation note (2026-07-07, commit `cfe02a4`).** All five phases shipped. Models
> migrated (`20260707082411_0019_billing_subscriptions`); `src/lib/billing/` (lazy Stripe
> client — module-scope constructors are banned per the ADR-0022 build lesson; plans;
> entitlements with the pure `resolveEffectiveTier` matrix and the 402 `limit_exceeded`
> contract); all four routes; server-side enforcement at accounts/posts/team-invite/AI-service;
> 14-day no-card PRO trial at signup (**proven live**: a browser signup created the
> `TRIALING` row, `trialEndsAt = now+14d`); `/dashboard/billing` rebuilt on live data (mock
> plans/invoices/VISA-4242 deleted; honest `stripe_not_configured` notice without keys —
> no mock fallback). **Tested per ADR-0021**: 14/14 billing integration tests (auth triples;
> webhook signature/tamper/idempotency-replay via Stripe's `generateTestHeaderString`, no
> network; FREE workspace's 4th account → 402) + entitlements unit matrix + a real-browser
> billing golden path (seeded Business plan renders, no fabricated data). Stripe v22
> "dahlia" API shapes (periods on subscription items; `invoice.parent.subscription_details`).
> **Deferred (needs real keys):** live Checkout/Portal redirect flows, golden-path-5 checkout
> e2e, Stripe dashboard config (step 19); reconciliation scheduling → ADR-0023.
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub has no SaaS billing whatsoever. Verified against the code on 2026-07-02:

1. **The billing page is 100% hardcoded.** `src/app/dashboard/billing/page.tsx` renders a static
   `plans` array (lines 22–77: Free $0, Pro $29, Business $79 with `limits.accounts/posts/users`),
   a `mockInvoices` array (lines 79–101), and a fake payment method ("VISA •••• •••• •••• 4242",
   lines 222–225). The current plan is a client-side `useState("Free")`. Nothing calls any API.

2. **No Stripe dependency, no billing API.** `package.json` has no `stripe` package, and
   `src/app/api/` contains no `billing/` or `subscriptions/` route. The only Stripe strings in the
   repo are a mock agency-side payment-processor dialog
   (`src/components/dashboard/clients/payment-settings-dialog.tsx`), a help-content seeder, and an
   admin integrations test stub.

3. **No plan enforcement anywhere.** `POST /api/accounts/connect`
   (`src/app/api/accounts/connect/route.ts:137`) creates `SocialAccount` rows without any count
   check; `POST /api/posts` creates posts without a monthly cap; `POST /api/team/invite` has no
   seat check; AI routes write `AIUsageTracking` rows (`prisma/schema.prisma:1002`, with
   `tokensUsed`/`costCents`) but never meter against a quota. The tier limits advertised on the
   billing page are fiction.

4. **The `Workspace` model has no billing fields.** `prisma/schema.prisma:17` — no customer ID,
   no plan, no subscription linkage. Workspaces are created in the signup transaction
   (`src/app/api/auth/signup/route.ts:54`) with the creator as `OWNER`
   (`WorkspaceRole` enum, `prisma/schema.prisma:861`).

**Critical disambiguation:** the existing `Invoice` model (`prisma/schema.prisma:328`, with
`clientId`, `lineItems Json`, string status `draft/sent/paid/...`) and `/api/invoices/*` are
**client invoicing** — the agency user billing *their own clients* inside the CRM. That subsystem
is real, DB-backed, and stays exactly as it is. This ADR concerns something entirely different:
**SociallyHub billing its own customers** for platform subscriptions. The two must never share
models, routes, or UI. The `payment-settings-dialog.tsx` "Stripe" tab likewise belongs to the
(mock) agency-side client-payment framework, not to this ADR.

Owner decision (2026-07-02): SaaS billing is **in scope now**. We must design it from scratch:
payment collection, subscription lifecycle, plan tiers with enforced limits, trial policy,
dunning, and a rebuilt `/dashboard/billing` page — on a self-hosted Docker deployment
(ADR-0022), which affects webhook reachability and rules out platform-specific billing shortcuts.

## Decision Drivers

- **Minimal PCI surface and engineering cost.** A solo-owner project cannot afford to build and
  maintain card UI, SCA/3DS flows, tax handling, or dunning emails by hand.
- **Workspace is the natural billing boundary.** All resources (accounts, posts, seats, AI usage)
  are already workspace-scoped via `UserWorkspace`; RBAC already defines `OWNER` as the role with
  full control (ADR-0004).
- **Schema changes must follow migration-first** (ADR-0002): the schema currently fails
  validation and only one init migration exists; billing models must land as a real migration
  after ADR-0002 repairs.
- **Webhooks are the source of truth** for subscription state and must be idempotent —
  self-hosted deployments get retries, replays, and out-of-order delivery.
- **Limits must be enforced server-side** in the API routes, not just displayed; a single
  entitlements helper avoids per-route drift.
- **Honesty about existing UI**: the advertised Free/Pro/Business tiers and their numbers are
  already user-visible, so v1 tiers should stay recognizably close to them.

## Considered Options

### Option A — Stripe Checkout + Billing Portal (hosted pages)

Stripe-hosted Checkout for purchase/upgrade and the hosted Billing Portal for payment-method
changes, plan switches, cancellation, and invoice history. Our app stores only a thin
`Subscription` mirror updated by webhooks.

- Pros: near-zero PCI scope (SAQ A); Stripe handles SCA, taxes (Stripe Tax optional), proration,
  card updates, invoice PDFs, and dunning emails; smallest code surface; the fake "VISA 4242"
  card UI is simply deleted rather than rebuilt.
- Cons: redirect-based UX (leaves the app for checkout); less visual control; plan display in-app
  must be kept consistent with Stripe Prices manually or via config.

### Option B — Stripe Elements / Payment Element with custom in-app billing UI

Embed Stripe's Payment Element; build our own subscription management screens, payment-method
management, invoice list, and cancellation flows against the Stripe API.

- Pros: fully branded in-app UX; no redirects.
- Cons: 3–5× the implementation and maintenance surface (SetupIntents, SCA retry flows, webhook
  edge cases, invoice rendering); SAQ A-EP compliance scope; duplicates what the Billing Portal
  gives for free. Not justified at this stage.

### Option C — Merchant of record (Paddle / Lemon Squeezy)

Outsource tax liability entirely to a reseller.

- Pros: no tax registration anywhere; simple.
- Cons: 5%+ fees vs Stripe's ~2.9%; weaker API/webhook ergonomics; harder migration path later;
  Stripe Tax covers the practical tax need without switching the merchant of record.

### Option D — Defer billing; keep everything free

- Pros: zero work now, focus on subsystem repairs (ADR-0011, ADR-0012).
- Cons: rejected by explicit owner decision — billing is a launch requirement, and limit
  enforcement is needed anyway to protect OpenAI spend and platform abuse.

## Decision Outcome

**Option A: Stripe Checkout + Billing Portal**, with workspace-level subscriptions, a thin local
`Subscription` mirror, webhook-driven state, and a single entitlements helper enforced in API
routes.

Key design points:

1. **Billing attaches to `Workspace`.** One `Subscription` row per workspace (`workspaceId`
   unique). Only members with `WorkspaceRole.OWNER` may start Checkout or open the Billing
   Portal (consistent with ADR-0004).

2. **Plan definitions live in code, prices live in Stripe.** `src/lib/billing/plans.ts` defines
   tiers and limits; Stripe Price IDs come from env (`STRIPE_PRICE_PRO_MONTHLY`,
   `STRIPE_PRICE_BUSINESS_MONTHLY`). No DB `Plan`/`Price` cache model in v1 — with two paid
   tiers, a lookup table in code is simpler and versioned with the code. Revisit only if plans
   become dynamic.

3. **v1 tiers and limits** (aligned with the numbers already shown in
   `src/app/dashboard/billing/page.tsx` so no user-visible promise is silently broken):

   | Limit                          | Free | Pro ($29/mo) | Business ($79/mo) |
   |--------------------------------|------|--------------|-------------------|
   | Social accounts per workspace  | 3    | 15           | 50                |
   | Posts created per calendar month | 10 | 100          | Unlimited         |
   | Team seats (members incl. owner) | 1  | 5            | 25                |
   | AI credits per month (1 credit = 1 AI request, metered via `AIUsageTracking`) | 20 | 500 | 2,000 |
   | Free workspaces owned per user | 1    | n/a (each paid workspace carries its own subscription) | n/a |

   Because billing is per-workspace, the "workspaces" limit is expressed on the owner: a user may
   own at most **one FREE-tier workspace**; every additional workspace must be on a paid plan.
   Enforced at workspace creation (signup already creates the first one).

4. **Trial policy: 14-day app-level Pro trial, no card required.** New workspaces get a
   `Subscription` row with `status = TRIALING`, `planTier = PRO`, `trialEndsAt = now + 14d`, and
   no Stripe IDs. On expiry the entitlements helper resolves them as FREE. This avoids forcing
   Checkout at signup and keeps Stripe out of the demo/seed path (ADR-0025). Stripe-native trials
   can replace this later if card-up-front is wanted.

5. **Dunning is delegated to Stripe.** Enable Smart Retries + Stripe's failed-payment emails in
   the Stripe dashboard; configure "cancel subscription if all retries fail". Our webhook maps
   `invoice.payment_failed` → local `status = PAST_DUE` (entitlements keep the paid tier during
   the retry window) and `customer.subscription.deleted` → `CANCELED` → FREE entitlements. A
   banner on `/dashboard/billing` surfaces `PAST_DUE` with a "Fix payment" Portal link.

6. **Webhooks: signature-verified, idempotent, raw-body.** A single route
   `POST /api/billing/webhook` verifies with `stripe.webhooks.constructEvent` against
   `STRIPE_WEBHOOK_SECRET` (reading `await req.text()`, never parsed JSON), is exempt from
   session auth (but covered by ADR-0005 hardening review), and records each Stripe event ID in a
   `StripeEvent` table with a unique PK — a duplicate insert short-circuits reprocessing.

7. **Entitlements helper is the only enforcement path.**
   `src/lib/billing/entitlements.ts` exposes `getEntitlements(workspaceId)` and
   `assertWithinLimit(workspaceId, limitKey)`; routes never hardcode numbers. `TRIALING` resolves
   as PRO; `PAST_DUE` resolves as the paid tier until Stripe gives up; `CANCELED`/missing row
   resolves as FREE. Over-limit requests return `402` with a machine-readable
   `{ error: "limit_exceeded", limit, upgradeUrl }` body.

### New Prisma models (migration-first per ADR-0002)

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  workspaceId          String             @unique
  stripeCustomerId     String?            @unique
  stripeSubscriptionId String?            @unique
  stripePriceId        String?
  planTier             PlanTier           @default(FREE)
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  trialEndsAt          DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@map("subscriptions")
}

enum PlanTier { FREE PRO BUSINESS }
enum SubscriptionStatus { ACTIVE TRIALING PAST_DUE CANCELED INCOMPLETE }

model StripeEvent {
  id          String   @id            // Stripe event id (evt_...), natural idempotency key
  type        String
  apiVersion  String?
  processedAt DateTime @default(now())
  @@map("stripe_events")
}
```

Enums use distinct names (`PlanTier`, `SubscriptionStatus`) to avoid colliding with the existing
`InvitationStatus`/CRM string statuses; nothing touches the client-invoicing `Invoice` model.

## Consequences

### Positive

- No card data ever touches our servers; SAQ A compliance scope; SCA/3DS handled by Stripe.
- Deletes rather than rebuilds the fake billing UI (mock plans, `mockInvoices`, VISA 4242 card).
- Real limit enforcement protects OpenAI spend (AI credits) and abuse vectors (unbounded
  accounts/posts/seats) even for workspaces that never pay.
- Subscription state survives restarts/replays because webhooks are idempotent and the local
  mirror is rebuildable from Stripe (`stripe subscriptions list`).
- Clean separation from client invoicing prevents the two billing domains from cross-contaminating.

### Negative

- Checkout/Portal redirects leave the app; branding is limited to Stripe's customization options.
- A local mirror can drift from Stripe if webhook delivery breaks silently — requires the
  monitoring hook noted below (ADR-0023).
- Plan/limit numbers exist in two places (code config + Stripe Prices); changing a price requires
  a coordinated env + Stripe dashboard change.
- App-level trial without a card invites trial farming; acceptable at current scale, revisit with
  Stripe-native trials + card if abused.
- New env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`) must be managed
  per ADR-0006 secrets practices and wired into the Docker deployment (ADR-0022).

## Implementation Plan

Sequencing: **after ADR-0002 (valid schema + migration baseline) and ADR-0003 (auth helpers)
land**; independent of, and parallel to, ADR-0011/ADR-0012 subsystem repairs.

### Phase 1 — Foundation (models, SDK, config)

1. **(S)** Add `stripe` to `package.json`; create `src/lib/billing/stripe.ts` exporting a
   singleton Stripe client pinned to a fixed API version; fail fast at import if
   `STRIPE_SECRET_KEY` is absent in production (no silent mock fallback — per the anti-pattern
   catalogued in the audits).
2. **(M)** Add `Subscription`, `StripeEvent`, `PlanTier`, `SubscriptionStatus` to
   `prisma/schema.prisma` (+ `subscription` relation on `Workspace`); generate a real migration
   (`prisma migrate dev`) per ADR-0002 — no `db push`.
3. **(S)** Create `src/lib/billing/plans.ts`: tier→limits table (numbers above), tier→env Price
   ID mapping, and types (`LimitKey`, `Entitlements`).
4. **(S)** Extend `.env.example` and Docker compose env plumbing with the four Stripe vars +
   `NEXT_PUBLIC_APP_URL` for Checkout redirect URLs.

### Phase 2 — Checkout, Portal, webhook

5. **(M)** `src/app/api/billing/checkout/route.ts` (POST): session auth via the ADR-0003 helper,
   `normalizeUserId`, require `OWNER` on the target workspace; create-or-reuse
   `stripeCustomerId` (store on `Subscription`); create a Checkout Session
   (`mode: "subscription"`, `client_reference_id = workspaceId`, success/cancel URLs on
   `/dashboard/billing`); return `{ url }`.
6. **(S)** `src/app/api/billing/portal/route.ts` (POST): OWNER-only; create Billing Portal
   session for the workspace's customer; return `{ url }`.
7. **(L)** `src/app/api/billing/webhook/route.ts` (POST): raw-body signature verification;
   idempotency insert into `StripeEvent` inside the same transaction as the state change;
   handlers for `checkout.session.completed` (attach subscription IDs, set tier/status),
   `customer.subscription.created|updated` (sync tier from price, status, period, `cancelAtPeriodEnd`),
   `customer.subscription.deleted` (→ `CANCELED`), `invoice.payment_failed` (→ `PAST_DUE`),
   `invoice.paid` (→ `ACTIVE`). Unknown event types are recorded and ignored (200).
8. **(S)** Dev workflow: document `stripe listen --forward-to localhost:3099/api/billing/webhook`
   in `DEVELOPMENT.md`; configure the production webhook endpoint on the self-hosted domain
   (ADR-0022).

### Phase 3 — Entitlements and enforcement

9. **(M)** `src/lib/billing/entitlements.ts`: `getEntitlements(workspaceId)` (resolves
   Subscription row → effective tier per the status rules above, defaults to FREE) and
   `assertWithinLimit(workspaceId, key)` with usage queries: `socialAccount.count`, monthly
   `post.count` (by `createdAt` in current calendar month), `userWorkspace.count` + pending
   `TeamInvitation`, monthly `aIUsageTracking.count`.
10. **(S)** Enforce in `src/app/api/accounts/connect/route.ts` before the
    `prisma.socialAccount.create` (currently line 137).
11. **(S)** Enforce posts/month in `POST src/app/api/posts/route.ts`.
12. **(S)** Enforce seats in `POST src/app/api/team/invite/route.ts` (route currently has no
    count checks — verified).
13. **(M)** Enforce AI credits at the single choke point `src/lib/ai/ai-service.ts` (all
    `/api/ai/*` routes flow through it), returning the 402 shape; also closes the
    unmetered-OpenAI-spend gap flagged in ADR-0018.
14. **(S)** Enforce the one-free-workspace-per-owner rule wherever workspaces are created
    (today: `src/app/api/auth/signup/route.ts` — the first workspace is always allowed —
    plus any future workspace-creation route; admin creation in
    `src/app/api/admin/workspaces/route.ts` is exempt but must create a `Subscription` row).
15. **(S)** Signup transaction additionally creates the `TRIALING`/PRO `Subscription` row
    (`trialEndsAt = now + 14d`).

### Phase 4 — Rebuild /dashboard/billing

16. **(M)** `src/app/api/billing/subscription/route.ts` (GET): current tier, status,
    period end, trial end, and usage-vs-limit numbers from the entitlements helper; recent
    invoices via `stripe.invoices.list` (empty for never-subscribed workspaces).
17. **(L)** Rewrite `src/app/dashboard/billing/page.tsx`: delete the `plans` const,
    `mockInvoices`, and the VISA 4242 card block; render live tier + usage meters
    (accounts/posts/seats/AI credits), plan cards driven by `plans.ts`, "Upgrade" →
    `/api/billing/checkout`, "Manage billing" → `/api/billing/portal`, `PAST_DUE` banner,
    real invoice list with Stripe-hosted PDF links. Payment methods are managed only in the
    Portal — no card UI in-app.
18. **(S)** Rename the nav ambiguity: the client-CRM billing surfaces stay under
    `/dashboard/clients` ("Client Invoicing"); `/dashboard/billing` is exclusively
    "Plan & Billing".

### Phase 5 — Hardening and observability

19. **(S)** Configure Stripe dashboard: Smart Retries, failed-payment emails, cancel-on-final-failure,
    Billing Portal features (plan switch between Pro/Business, cancellation with period-end default).
20. **(S)** Emit a log/metric on every webhook processed/failed and a daily reconciliation job
    stub (compare local `Subscription` rows against Stripe) — wire into ADR-0023 observability
    when it lands; until then, a logged cron via the existing job infrastructure (ADR-0008) or a
    manual script `scripts/reconcile-subscriptions.ts`.
21. **(M)** Tests per ADR-0021: unit tests for `entitlements.ts` (status→tier matrix, limit
    math), webhook handler tests with recorded Stripe fixtures (signature + idempotency replay),
    integration test that a FREE workspace's 4th `accounts/connect` gets 402.

## Risks and Mitigations

- **Webhook outage → stale entitlements.** Mitigation: `PAST_DUE`/`ACTIVE` grace semantics fail
  toward the customer, reconciliation script (step 20), Stripe dashboard alerting on failing
  endpoint.
- **Replay/duplicate events.** Mitigation: `StripeEvent` unique-PK insert in the same transaction
  as the mutation; handlers written to be idempotent regardless (upsert by
  `stripeSubscriptionId`).
- **Limit checks race (two parallel requests slip past a count).** Accepted for v1 — worst case
  is one resource over the cap; counts are advisory business limits, not security boundaries.
- **Env/Price drift between code and Stripe.** Mitigation: startup assertion in
  `src/lib/billing/stripe.ts` that configured Price IDs exist and match expected amounts (log
  loudly on mismatch).
- **Trial farming (no card).** Mitigation: one free workspace per user + email verification
  already required at signup; revisit with card-required Stripe trials if abused.
- **Confusion with client invoicing.** Mitigation: this ADR's explicit separation, distinct
  route namespace (`/api/billing/*` vs `/api/invoices/*`), and the nav rename in step 18.

## Related ADRs

- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — hard prerequisite; the
  `Subscription`/`StripeEvent` models must land as a real migration on a valid schema.
- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — all new `/api/billing/*`
  routes use the consolidated session/workspace helpers; the webhook route is the documented
  exception (signature auth instead of session auth).
- **ADR-0004: Platform Authorization Model and RBAC Enforcement** — OWNER-only billing
  management; entitlements complement (not replace) role checks.
- **ADR-0005: API Security Hardening** — webhook raw-body handling, no caching of billing
  responses (the blanket `/api/*` cache header must not apply), rate limiting exemptions.
- **ADR-0006: Cryptography, Token Encryption, and Secrets Management** — handling of
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`.
- **ADR-0008: Background Jobs and the Publishing Pipeline** — host for the reconciliation job
  once workers actually run.
- **ADR-0018: AI Features: Explicit Availability, Model Policy, and UI Mounting** — AI credits
  metering (step 13) is the enforcement half of that ADR's cost policy.
- **ADR-0020: Client Portal and Shareable Reports** — consumer of the *client invoicing*
  subsystem this ADR explicitly leaves untouched.
- **ADR-0021: Testing Strategy and Honest Quality Gates** — test requirements for webhook and
  entitlement logic.
- **ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment** — public webhook endpoint,
  Stripe env plumbing in compose; no Vercel-specific billing assumptions.
- **ADR-0023: Observability: Real Metrics, Logging, and Health** — webhook failure metrics and
  reconciliation alerts.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — seeded/demo workspaces get local
  `TRIALING` or FREE rows and never call Stripe.
