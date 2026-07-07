# ADR-0021: Testing Strategy and Honest Quality Gates

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-07** (phases 0–5; ratchet raises continue with future suites)

> **Implementation note (2026-07-07, commit `cfe02a4`).** The suite runs green for the first
> time: **12/12 suites, 158/158 tests**. Root cause of the never-ran state: the jest
> `projects[]` array bypassed `next/jest` wrapping entirely — fixed by wrapping each project
> individually. The 70% fantasy gate is replaced by the measured ratchet (global floor 1%,
> `src/lib/encryption.ts` pinned at its real 82/75/83/82; up-only rule documented in the
> config). Pyramid delivered: unit (entitlements matrix, plans, backup-cron evaluator,
> client-report schedule, crypto tamper, storage traversal, auth helpers), integration
> (route-handler harness + auth triples for billing/user-settings + webhook
> signature/idempotency against real Postgres), e2e (deterministic `prisma/seed-e2e.ts`
> fixtures; golden paths **proven in a live chromium session**: signup→Mailhog→verify→signin
> →dashboard, inbox honest-failure, client report create+render, billing live data — 17/17
> specs; axe accessibility over 4 pages passes after fixing real `button-name` criticals;
> `color-contrast` excluded with a design-tokens TODO). visual-regression/performance
> projects deleted; broken seed-require fallback deleted. **The CI Jest job is flipped to
> blocking** ('Jest (gate — ratcheted coverage)'). The new tests found real bugs: the
> date-fns `zh` import error, unnamed a11y-critical buttons, a stale verify-page redirect
> assumption. **Remaining:** e2e job flips blocking after proving green in CI (runs against
> the prod image); golden path 2's worker assertion (ADR-0008 stub providers) and path 5
> checkout (Stripe keys) pending.
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

The test infrastructure is elaborate on paper and almost entirely non-functional in practice.
Verified against the code on 2026-07-02:

1. **13 test files against ~216k LoC.** `src/` contains 216,299 lines of TS/TSX. The entire test
   suite is 7 Jest files (`__tests__/api/{auth,posts,version}.test.ts`,
   `__tests__/components/{ui/button,dashboard/overview-cards,forms/post-creation-form}.test.*`,
   `__tests__/performance/api-performance.test.ts`) and 6 Playwright specs (`e2e/auth.spec.ts`,
   `e2e/dashboard.spec.ts`, `e2e/dashboard-with-seeded-data.spec.ts`, plus one each under
   `e2e/{accessibility,performance,visual}/`). The Jest "Unit" project's configured directory
   `__tests__/unit/` does not exist (`jest.config.js:84`).

2. **A 70% coverage gate that can never pass — twice over.** `jest.config.js:53-60` sets a global
   `coverageThreshold` of 70% on branches/functions/lines/statements, unreachable from a 13-file
   base. `.github/workflows/ci.yml` then re-enforces the same threshold with an inline `node -e`
   script — and that script is broken independently of coverage level: it reads
   `./coverage/coverage-summary.json`, but `jest.config.js:51` sets
   `coverageReporters: ['json', 'lcov', 'text', 'html']` with no `json-summary`, so the file is
   never written; and it destructures `coverage.total.pct` when the real istanbul shape is
   `coverage.total.<metric>.pct`. The script's catch branch exits 1 unconditionally. The gate is
   not strict — it is fictional, and it trains everyone to expect red CI.

3. **The `@/` alias never resolves in Jest.** `jest.config.js` uses the invalid option name
   `moduleNameMapping` twice (lines 25 and 116; the correct key is `moduleNameMapper`). Jest
   silently ignores unknown keys, so any test importing `@/lib/...` — i.e., any test of real
   application code — fails at module resolution. The three component tests survive only because
   they use relative imports or mock everything.

4. **Playwright CI has no server.** `playwright.config.ts:114` sets
   `webServer: process.env.CI ? undefined : {...}`, and the ci.yml e2e job installs browsers,
   seeds the DB, downloads `.next/` build artifacts (via deprecated `download-artifact@v3`), and
   runs `npm run test:e2e` — without ever starting the app. Every CI e2e/visual/performance run
   fails at `e2e/global-setup.ts`'s server-readiness loop.

5. **The e2e reseeding fallback is broken and dangerous.** `e2e/global-setup.ts:72-74` does
   `const seedModule = require('../prisma/seed.ts')` and calls it only
   `if (typeof seedModule === 'function')` — never true, since `prisma/seed.ts` exports nothing.
   Worse, `seed.ts` invokes `main()` at module top level, so the `require` fires a full 30k-record
   reseed as an *unawaited side effect* that races the test run (and calls `process.exit(1)` on
   failure).

6. **Nine Playwright projects, three of them theatrical.** chromium/firefox/webkit, two mobile
   devices, tablet, plus dedicated `visual-regression`, `performance`, and `accessibility`
   projects (`playwright.config.ts:48-107`) — a browser matrix sized for a mature product, none of
   which has ever run green in CI. Meanwhile `package.json`'s `test:performance` actually runs
   *Jest* (`--testPathPattern=performance`), while the ci.yml performance job pointlessly installs
   Playwright chromium.

Meanwhile the repair roadmap (ADR-0005 security hardening, ADR-0011 support, ADR-0012 admin RBAC,
ADR-0019 Stripe billing, ADR-0008 publishing pipeline) is about to touch hundreds of routes.
Fixing authorization holes without a regression net means they will silently reopen.

## Decision Drivers

- **Honesty**: gates must measure reality and be passable today, or they are noise that everyone
  learns to ignore.
- **Regression protection for the repair roadmap**: ADR-0005/0011/0012/0019 fix authz and
  correctness bugs route by route; each fix needs a test that keeps it fixed.
- **Single maintainer economics**: every test must earn its maintenance cost; broad browser
  matrices and visual baselines do not, at this stage.
- **Alignment with ADR-0022**: CI runs against the self-hosted Docker stack; Vercel is gone. Test
  infrastructure must match what actually deploys.
- **Determinism**: e2e must not depend on a 799-line random mock-data generator
  (`prisma/seed.ts`) whose output varies per run (see ADR-0025).

## Considered Options

1. **Aspire and enforce (status quo + backfill).** Keep the 70% threshold, fix the configs, and
   write tests until the gate passes. *Trade-off*: months of test-writing before CI is ever green;
   strong incentive to write junk snapshot tests to move the number; blocks the entire repair
   roadmap behind a coverage grind. Coverage percentage becomes the goal instead of regression
   safety.

2. **Rip the gates out.** Delete `coverageThreshold` and the CI check; tests are advisory.
   *Trade-off*: cheapest today, but the codebase got into this state precisely because nothing
   enforced anything; new routes would ship untested and coverage would decay from its already-low
   baseline.

3. **Honest ratchet + targeted pyramid (chosen).** Fix the config bugs; measure the real baseline;
   set thresholds *at* the baseline so CI is green on day one; fail only on regression; raise
   deliberately when a testing milestone lands. Direct all new test effort at a small pyramid tied
   to the repair roadmap instead of chasing a global number. *Trade-off*: the headline number
   stays embarrassingly low for a while, and the ratchet needs occasional manual raising.

4. **Diff coverage.** Gate only on coverage of changed lines (e.g., 80% on the PR diff).
   *Trade-off*: best theoretical incentive, but needs extra tooling (danger/jest-diff-coverage or
   Codecov paid features) and a reliable base-branch coverage artifact; overkill for a single-dev
   repo now. Revisit once the ratchet plateaus.

## Decision Outcome

**Option 3: honest ratchet + targeted pyramid.** Specifically:

### 1. Fix the broken configs (prerequisite, not policy)

- `jest.config.js`: rename both `moduleNameMapping` occurrences to a single merged
  `moduleNameMapper` (`^@/(.*)$` → `<rootDir>/src/$1`, plus the CSS `identity-obj-proxy` mapping);
  add `'json-summary'` to `coverageReporters`; delete the "Unit" project until `__tests__/unit/`
  exists with content, and delete the "Performance" project (see §5).
- `playwright.config.ts`: replace the `webServer: CI ? undefined : {...}` hack with an honest
  split — `webServer` (`npm run dev`) runs **locally only**; in CI the server is *external*: the
  `docker-compose.ci.yml` stack running the image under test (ADR-0022 pipeline step 6), with
  `baseURL` taken from the environment. No `next start` path in CI — the image that passes e2e
  is the image that deploys (mechanics owned by ADR-0022).
- `e2e/global-setup.ts`: delete the `require('../prisma/seed.ts')` fallback entirely. Seeding is a
  pipeline-step responsibility (`tsx prisma/seed-e2e.ts`, see §4); global setup only verifies
  expected fixture rows exist and fails fast with an actionable message.
- `.github/workflows/ci.yml`: delete the inline coverage script. There is exactly **one** gate:
  Jest's own `coverageThreshold`. Duplicated gates drift; this one already had.

### 2. Coverage ratchet instead of the 70% fantasy

- After the config fix, run `npm run test:coverage` and record the true baseline (expected low
  single digits).
- Set `coverageThreshold.global` in `jest.config.js` to the measured values rounded *down* to the
  nearest integer. CI is green from that moment.
- **Ratchet rule**: thresholds only move up, in the same PR that lands the tests justifying the
  raise (Implementation Plan phases each end with a raise). Lowering a threshold requires an ADR
  amendment.
- Add per-directory thresholds as critical modules gain suites, e.g.
  `'src/lib/auth/**': { lines: 80 }` and the ADR-0006 crypto module at 90 — high bars where bugs
  are security incidents, ratchet-level bars elsewhere. Remove `--passWithNoTests` from the CI
  invocation once phase 2 lands.

### 3. Test pyramid tied to the repair roadmap

- **Unit (Jest, node env, no DB)** — the pure logic where bugs are catastrophic and tests are
  cheap: authz helpers from ADR-0003/ADR-0004 (`requireRole`-style guards, workspace-membership
  checks, `normalizeUserId`), token encryption/decryption from ADR-0006, plan
  entitlement/limit calculations from ADR-0019, schedule next-run calculation
  (`calculateNextRunTime`), and SLA-deadline / agent-assignment logic from ADR-0011.
- **API integration (Jest, node env, real Postgres)** — the regression net for ADR-0005: invoke
  route handlers directly (Next 15 route modules are plain functions taking `Request`) against a
  disposable schema. **Every route repaired under ADR-0005/0011/0012/0019 ships with the "auth
  triple": 401 unauthenticated, 403 wrong-workspace-or-role, 2xx happy path.** This is where the
  ADR-0011 unauthenticated-ticket-access class of bug gets pinned down permanently. Stripe
  webhook signature verification (ADR-0019) lives here too.
- **E2E (Playwright, chromium-only in CI)** — exactly five golden paths, nothing else:
  1. Signup → email verification (Mailhog) → sign in.
  2. Create → schedule → publish a post, asserting the worker completes it (enabled once
     ADR-0008's publishing pipeline lands; until then the spec stops at "scheduled").
  3. Inbox: open an item, reply, verify state change.
  4. Client report: create from template, verify generated output.
  5. Billing: Stripe test-mode checkout → workspace shows the paid plan (ADR-0019).

  Support tickets and admin RBAC are covered at the API-integration layer, not e2e — their value
  is authz correctness, not pixel flows.

### 4. Deterministic e2e fixtures, not the mock-data firehose

`prisma/seed.ts` (random users, random posts, random metrics) remains a *demo/dev* tool
(ADR-0025). E2E gets a new `prisma/seed-e2e.ts` that exports an idempotent
`export async function seedE2E(prisma: PrismaClient)` creating a small, fixed fixture set (demo
user, one workspace, known posts/clients/inbox items with stable IDs), plus a thin CLI wrapper.
CI runs it as an explicit step before Playwright. `e2e/test-helpers.ts` asserts against known
fixtures instead of heuristics like "counts look big enough".

### 5. Cut the theatrical Playwright projects

- **Delete** `visual-regression` (no baseline-management discipline exists or is planned; screens
  are changing weekly during remediation — every run would be a false alarm).
- **Delete** the Playwright `performance` project and the Jest "Performance" project /
  `__tests__/performance/api-performance.test.ts`; load/latency measurement belongs to
  observability (ADR-0023), not the PR gate. Remove the `test:visual` and `test:performance`
  scripts and the ci.yml performance job (workflow rewrite owned by ADR-0022).
- **Keep `accessibility` minimal**: one spec running `@axe-core/playwright` over four pages
  (signin, dashboard, composer, client report), chromium-only, serious/critical violations fail.
- CI browser matrix: **chromium only** for the golden paths. firefox/webkit/mobile/tablet
  projects stay in the config for on-demand local runs but are excluded from the CI invocation
  (`--project=chromium --project=accessibility`). Reinstate a wider matrix only when a real
  cross-browser bug report justifies it.

### 6. Testing policy for new code (extends ADR-0003 route conventions)

- Every new or modified API route ships the auth triple in the same PR. No exceptions for routes
  behind feature flags (ADR-0013/0014) — flag-off behavior (404/403) is itself a test case.
- New `src/lib` modules with branching logic ship unit tests; UI components need tests only when
  they contain non-trivial logic (form validation, state machines) — no snapshot tests.
- The PR checklist gains: "auth triple present for touched routes; coverage ratchet not lowered."

## Consequences

### Positive

- CI becomes green and *meaningful* within one small PR (phase 0-1), ending the
  every-run-is-red normalization.
- Each ADR-0005/0011/0012/0019 fix gets a permanent regression pin; authorization holes cannot
  silently reopen.
- E2E actually executes in CI for the first time, against the same Docker image that deploys
  (ADR-0022).
- Test effort concentrates where defect cost is highest (authz, crypto, billing) instead of
  chasing a vanity percentage.
- Deterministic fixtures make e2e failures diagnosable instead of seed-lottery noise.

### Negative

- The headline coverage number stays low for months; anyone reading `jest.config.js` sees
  single-digit thresholds. (That is the honest state; the old 70% was a lie.)
- The ratchet requires manual discipline to raise; a lazy steady-state is possible if phases 2-4
  stall.
- Chromium-only CI can miss webkit/firefox-specific regressions.
- Deleting the visual/performance projects discards some (never-passing) scaffolding that would
  otherwise have been a head start if those practices are adopted later.

## Implementation Plan

**Phase 0 — Make the tooling truthful (S)**
- `jest.config.js`: `moduleNameMapping` → single `moduleNameMapper`; add `json-summary` reporter;
  delete "Unit" and "Performance" projects; keep Components/API.
- `playwright.config.ts`: `webServer` (`npm run dev`) for local runs only; in CI the server is
  external — the compose stack with the image under test, `baseURL` from env (ADR-0022 step 14);
  trim CI default projects to chromium + accessibility.
- `e2e/global-setup.ts`: remove the `require('../prisma/seed.ts')` block.
- `.github/workflows/ci.yml`: drop the inline coverage script; hand remaining workflow surgery
  (artifact@v3, server startup step, job pruning) to ADR-0022.
- Delete `e2e/visual/`, `e2e/performance/`, `__tests__/performance/`; remove `test:visual`,
  `test:performance` scripts.

**Phase 1 — Baseline and ratchet (S)**
- Run coverage; set `coverageThreshold.global` to measured floor; document the ratchet rule in
  `ADR/ADR-0021-testing-strategy-and-quality-gates.md` (this file) and the PR template.

**Phase 2 — Unit suites for critical libs (M)**
- Create `__tests__/unit/` (restoring the Jest project): authz helpers (ADR-0003/0004), crypto
  round-trip + tamper cases (ADR-0006), entitlements (ADR-0019), `calculateNextRunTime`,
  ADR-0011 SLA/assignment logic. Raise `src/lib/auth` and crypto per-directory thresholds.

**Phase 3 — API integration authz net (L)**
- Build the harness: `__tests__/utils/integration.ts` (route-handler invoker, session mocking via
  `getServerSession` mock, per-suite Postgres schema, fixture factories).
- Add the auth triple alongside each route repaired under ADR-0005, and for all ADR-0011 support,
  ADR-0012 admin, ADR-0019 billing/webhook routes. This phase tracks those ADRs' schedules rather
  than preceding them.

**Phase 4 — Golden-path e2e (M)**
- Write `prisma/seed-e2e.ts` (exported function + CLI wrapper, per ADR-0025); rewrite
  `e2e/test-helpers.ts` against fixed fixtures; replace `dashboard-with-seeded-data.spec.ts`
  heuristics; implement golden paths 1, 3, 4 now; path 2's worker assertion lands with ADR-0008;
  path 5 lands with ADR-0019 checkout. Add the minimal axe accessibility spec.

**Phase 5 — Policy enshrined (S)**
- Extend the ADR-0003 route-convention doc with the auth-triple requirement; update the PR
  checklist; correct CLAUDE.md's claims about the 70% gate and enterprise CI.

## Risks and Mitigations

- **Ratchet stagnation** — thresholds never rise after phase 1. *Mitigation*: each phase above
  ends with a mandatory threshold raise in the same PR; the phase is not "done" without it.
- **Route-handler testing friction** (NextAuth session, Next 15 async `params`). *Mitigation*:
  centralize in one harness (phase 3) before writing suites; if direct invocation proves too
  brittle, fall back to HTTP-level tests against `next start` + test DB — the auth-triple policy
  is invariant either way.
- **E2E flake undermines trust** in the newly-green pipeline. *Mitigation*: chromium-only, five
  paths, deterministic fixtures, existing `retries: 2` in CI; a spec that flakes twice gets
  quarantined via `test.fixme` with a tracking issue, not deleted silently.
- **E2E gates on the Docker image build** — a broken `Dockerfile.prod` or slow image build delays
  all e2e feedback. *Mitigation*: acceptable by design — image/prod parity is the point
  (ADR-0022's build-once pipeline); layer caching keeps builds fast, and lint/typecheck/unit jobs
  still give early feedback independent of the image.
- **Coverage gaming** (trivial tests to bump the ratchet). *Mitigation*: ratchet raises are tied
  to named phase deliverables, not opportunistic; review rejects assertion-free tests.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — a valid schema/client is a
  precondition for the integration harness and seed-e2e.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — §6 extends its route
  conventions with the auth-triple testing requirement.
- ADR-0004: Platform Authorization Model and RBAC Enforcement — its helpers are phase-2 unit
  targets.
- ADR-0005: API Security Hardening — the API-integration layer is its permanent regression net.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — crypto module gets the
  highest per-directory threshold.
- ADR-0008: Background Jobs and the Publishing Pipeline — unlocks golden path 2's
  publish-with-worker assertion.
- ADR-0011: Support Subsystem Remediation — covered at the API-integration layer.
- ADR-0012: Admin Dashboard and RBAC Subsystem Remediation — covered at the API-integration layer.
- ADR-0019: Billing and Subscriptions with Stripe — entitlement unit tests, webhook integration
  tests, golden path 5.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — owns workflow mechanics (artifact
  actions, the compose-stack e2e server, job pruning) that this ADR's gates run on; CI e2e runs
  against the real Docker image, which is pushed to GHCR only after e2e passes.
- ADR-0023: Observability: Real Metrics, Logging, and Health — inherits performance testing
  responsibility from the deleted Playwright/Jest performance projects.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — `seed-e2e.ts` vs. the demo mock-data
  generator split is specified there.
