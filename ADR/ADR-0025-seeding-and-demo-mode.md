# ADR-0025: Seeding Strategy and Explicit Demo Mode

- Date: 2026-07-02
- Status: **Implemented (2026-07-08)** — Option 3. The demo-generator atomization is pragmatic (see note).
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Implementation note (2026-07-08)

Option 3 shipped via a 5-track workflow + wire-check + test tracks, then independent
verification. Parts had already landed incrementally — ADR-0018 demo-gated the mock AI
provider and deleted `sk-fake-key-for-demo`; ADR-0009 gave `/api/accounts/connect` +
`/api/accounts/platforms` their `isDemoMode()` gates and the honest `PLATFORM_NOT_CONFIGURED`
(503) non-demo path; ADR-0021 built `prisma/seed-e2e.ts` + `e2e/fixtures.ts` (the de-facto
test tier) and a working `e2e/global-setup.ts`; ADR-0024 deleted `prisma/seed.js`. This ADR
delivered the rest.

**D1 — one flag, one helper:** `src/lib/config/demo.ts` rewritten to `isDemoMode() =
process.env.DEMO_MODE === 'true'` — the `NODE_ENV === 'development'` heuristic and the
`ENABLE_DEMO` production backdoor are both **gone** (unit-proven: neither enables demo).
Because the flag is server-only (not `NEXT_PUBLIC_*`), the `'use client'` signin and setup
pages were split into a server `page.tsx` (reads `getPublicDemoConfig()`) + a client child —
a real server→client handoff with no drifting mirror variable. `docker-compose.yml` (dev)
sets `DEMO_MODE=true`; prod compose deliberately does not.

**D2 — enumerated gated behaviors:** `docs/demo-mode.md` is the registry (fake account
connect, mock AI provider, demo credential hints, demo seed tier), each with its file, its
`isDemoMode()` gate, and how its output is marked. `src/app/dashboard/setup/page.tsx`'s
hardcoded `demo@sociallyhub.com / demo123456` block is removed (demo-gated hint or generic
copy). A CI integration test asserts a credential-less config returns `PLATFORM_NOT_CONFIGURED`
and creates **no** `metadata.demoAccount` row — and that flipping `DEMO_MODE=true` re-offers
the demo path (the registry-escape guard, both directions).

**D3 — tiered seeding:** `prisma/seed.ts` is now a dispatcher (`--tier=` / `SEED_TIER`,
default `minimal`; `--wipe` for the demo reset). `seedMinimal()` (prod-safe, idempotent) runs
two NEW seeders — `settings-defaults-seeder` (global SystemConfiguration/SecurityConfiguration/
EmailTemplate + the three DISABLED community/documentation/discord FeatureFlags, attributed to
a login-disabled `system` user) and `admin-user-seeder` (grants `User.isPlatformAdmin` from
`PLATFORM_ADMIN_EMAILS`, creates missing accounts with a generated password printed once,
throws when the allowlist is set but yields no admin, warns when unset). `seedDemo()` hard-aborts
unless `DEMO_MODE=true`, runs `seedMinimal` first, then the (verbatim, parity-preserved) ~30k
generator, wiping only under `--wipe`. `seedTest()` runs `seedMinimal` then delegates to the
existing `seedE2E()`.

**Divergence from the letter of D3:** the demo showcase generator was kept as ONE cohesive
`seedDemo()` rather than atomized into 7 per-domain files (users/workspaces/posts/…). The
ADR's tier *goals* — minimal is prod-safe and separate, demo requires `DEMO_MODE` + gated
wipe, test is deterministic — are fully met; atomizing a proven 30k Math.random generator was
judged higher-risk (parity) than valuable. The genuinely-new seeders (settings-defaults,
admin-user) ARE separate files per the pattern.

**D4 — credential hygiene:** no committed constant passwords — the `password123` (mock users →
per-user random, never printed) and `demo123456` (demo user → `DEMO_USER_PASSWORD` or
generated-and-printed-once) literals are gone from source, enforced by a **blocking CI grep
guard** (`scripts/check-no-committed-demo-secrets.sh`). `scripts/reset-admin-password.ts` is
the recovery path.

**D5 — prod-image seeding:** `Dockerfile.prod` esbuild-bundles `prisma/seed.ts → dist/seed.js`
(no `tsx` in the runtime image); `docker/entrypoint.sh` runs `node dist/seed.js
--tier="${SEED_TIER:-minimal}"` after migrate, fail-loud (no `|| echo` mask). CI's row-count
smoke now runs the demo tier explicitly, plus a new minimal-tier smoke asserting a platform
admin exists.

**Bug found in verification:** `createDemoConnection()` omitted the required
`SocialAccount.accessToken`, so every `DEMO_MODE=true` `/api/accounts/connect` 500'd — dead
until this ADR's gate re-exposed it. Fixed (encrypted placeholder token per ADR-0006).

**Verification:** 27 new Jest tests (flag matrix proving both backdoors gone, both minimal
seeders, the registry-escape gate) → full suite 23 suites / 297 green; `next build` green;
all three tiers run (minimal/test exit 0, demo aborts when off, demo `--wipe` regenerated the
showcase); the **esbuild seed bundle runs standalone** (`node dist/seed.js --tier=minimal/test`
exit 0 — the prod-image path); e2e `g9-demo-mode` green (signin hint, demo connect offered,
demo login) + live-container proof.

**Deferred (by design):** login-time forced-password-change enforcement (the seeded admin is
flagged via a printed banner + reset script, not a schema field); atomizing the demo generator
into per-domain files; a curated demo snapshot DB (Option 4, rejected).

## Context and Problem Statement

SociallyHub's "demo" behavior is implicit, inconsistent, and leaks into production paths, and the seed
pipeline is a single monolithic script that serves neither production bootstrap nor CI. Verified against
the code on 2026-07-02:

**Demo mode is not one thing — it is three uncoordinated mechanisms:**

1. `src/lib/config/demo.ts` defines
   `enabled: process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO === 'true'` — a NODE_ENV
   heuristic plus a production backdoor (`ENABLE_DEMO=true` flips demo on in a prod build). Critically,
   this helper is consumed by exactly **one** file: `src/app/auth/signin/page.tsx`, which renders the
   `demo@sociallyhub.com / demo123456` hint.
2. `src/app/api/accounts/connect/route.ts` never consults the helper at all. If **no** platform env
   credentials exist (`TWITTER_CLIENT_ID`, `FACEBOOK_APP_ID`, etc. — the default on any fresh install,
   including production), `createDemoConnection()` silently persists a fake `SocialAccount` row with
   `status: 'ACTIVE'`, random follower counts, `metadata.demoAccount: true`, and a 1-year `tokenExpiry`.
   A production operator who has not yet configured OAuth apps gets fabricated "connected accounts"
   with no error and no flag to disable it.
3. `src/app/dashboard/setup/page.tsx` hardcodes `demo@sociallyhub.com / demo123456` into the UI
   **unconditionally** — no demo gate of any kind.

Adjacent to these, `src/lib/ai/ai-service.ts` silently substitutes `MockAIProvider` when
`OPENAI_API_KEY` is unset, and `src/lib/ai/config.ts` defaults the key to `'sk-fake-key-for-demo'` —
the AI-availability policy is ADR-0018's scope, but the *gating flag* it should consume is decided here.

**Seeding is a monolith with no tiers and no coverage of the subsystems being repaired:**

- `prisma/seed.ts` (799 lines, run via `tsx`) wipes prior data (preserving `demo@sociallyhub.com` and
  workspace id `demo-workspace`), creates the demo user with password `demo123456` (bcrypt cost 12),
  then generates ~30k rows: 50 users **all sharing the committed constant password `password123`**,
  15 workspaces, 8 social accounts per workspace with fake tokens, 100 posts/workspace, inbox items,
  analytics metrics, sessions/actions, clients, campaigns. It delegates to three modular seeders that
  already establish the pattern we want: `src/lib/seeders/{client-reports,help-content,video-tutorial}-seeder.ts`.
- There is **zero** seed coverage for the subsystems the owner has directed us to repair now:
  support (`SupportTicket`, `SupportAgent`, `SupportChat`, `SupportContactForm`, … — `prisma/schema.prisma`
  ~lines 3519–3847, per ADR-0011), RBAC (nothing grants the `User.isPlatformAdmin` flag that
  ADR-0004/ADR-0012 enforce with — the unenforced `Role`/`UserRole`/`Permission` models at
  ~lines 4986–5036 are *deleted* by those ADRs, not seeded), and the 12+ admin settings models
  (`SystemConfiguration`, `SecurityConfiguration`, `FeatureFlag`, `EmailTemplate`, … per ADR-0016).
  All admin settings APIs return empty datasets on a fresh install; nothing seeds the first
  platform admin ADR-0012's gate requires.
- There is no *minimal* production seed at all: a fresh production database gets no settings
  defaults, no feature flags, no platform admin — only the full mock showcase or nothing.
- There are no deterministic test fixtures. `e2e/global-setup.ts` logs in with demo creds and attempts
  re-seeding via `require('../prisma/seed.ts')` with an exported-function check that can never pass
  (seed.ts runs `main()` on import and exports nothing), per ADR-0021's findings.
- **The production image cannot seed**: `docker/entrypoint.sh` runs `npx prisma db seed` when
  `SEED_DATABASE=true`, but `package.json` defines `"prisma": { "seed": "tsx prisma/seed.ts" }` and
  `tsx` is a devDependency; `Dockerfile.prod` installs prod-only deps, so seeding fails — masked by
  `|| echo "⚠️ Database seeding failed or not configured"` (ties to ADR-0022).
- A stale legacy `prisma/seed.js` sits unused beside the real seed (ADR-0024 territory).

With deployment standardizing on self-hosted Docker (owner decision 1) and support/RBAC repair plus
Stripe billing in scope now (decisions 2–3), we need: an explicit, single demo switch; an enumerated,
auditable list of demo-only behaviors; and a tiered seed architecture where production bootstrap,
demo showcase, and CI fixtures are separate, intentional artifacts.

## Decision Drivers

- **Production safety**: a self-hosted prod deploy must never fabricate social accounts, surface demo
  credentials, or serve mock AI output without an explicit operator opt-in.
- **Single source of truth**: demo gating must be one flag consumed through one helper — no NODE_ENV
  heuristics, no per-route env sniffing.
- **Repair alignment**: ADR-0011 (support) and ADR-0012 (RBAC) need seed data to be developable and
  testable; ADR-0004/0012's enforcement needs at least one `User.isPlatformAdmin` grant to exist in
  every environment — the `WorkspaceRole` enum needs no catalog rows.
- **Prod bootstrap**: the Docker prod image (ADR-0022) must be able to initialize settings defaults
  and a first platform admin without devDependencies.
- **Honest testing**: ADR-0021 requires deterministic fixtures, not a `Math.random()`-driven 30k-row
  dump, for CI.
- **Credential hygiene** (ADR-0006): no committed constant passwords; seeded secrets generated and
  printed once.

## Considered Options

### Option 1 — Patch in place: keep NODE_ENV heuristics, add `isDemoMode()` checks where missing

Add the existing helper to `accounts/connect` and the setup page; leave `seed.ts` monolithic and add
support/RBAC/settings blocks to it.

- Good: smallest diff; no operational changes.
- Bad: keeps the `NODE_ENV === 'development'` heuristic (demo silently on for every developer, off in
  prod builds *except* via the `ENABLE_DEMO` backdoor); the 799-line monolith grows past 1,200 lines;
  still no minimal prod seed, no test tier, prod image still can't seed. The core problems survive.

### Option 2 — Remove demo mode entirely

Delete `createDemoConnection`, the demo hints, and the mock AI fallback; unconfigured providers return
errors; keep seeding only as a developer convenience script.

- Good: zero leak risk by construction; simplest mental model.
- Bad: destroys real value — the demo showcase is how the product is evaluated and how developers get a
  populated dashboard; ADR-0018 explicitly wants a mock AI provider available in a controlled mode; CI
  still needs fixtures. We would rebuild an ad-hoc demo mode within a month.

### Option 3 — Explicit `DEMO_MODE` flag + enumerated gated behaviors + tiered modular seeders (chosen)

One env flag, one helper, a documented registry of demo-only behaviors, and `prisma/seed.ts` reduced to
a dispatcher over per-domain seeders in `src/lib/seeders/` with three tiers: `minimal` (prod-safe),
`demo` (showcase), `test` (deterministic CI fixtures).

- Good: demo remains a first-class, *opt-in* capability; production bootstrap becomes possible; the
  seeder pattern already exists in-repo; each repaired subsystem gets its seed alongside its remediation.
- Bad: a real refactor of 799 lines plus Docker build changes; a registry that must be maintained.

### Option 4 — Separate demo deployment with a snapshot database

Demo is not a mode but a dedicated instance seeded from a curated SQL snapshot; the app codebase has no
demo branches at all.

- Good: strongest isolation; app code stays pure.
- Bad: requires infrastructure we don't have (a second maintained deployment, snapshot refresh
  pipeline); doesn't solve local-dev or CI seeding; snapshot drifts from the schema (only one migration
  exists today — ADR-0002). Disproportionate for a single-team product.

## Decision Outcome

**Option 3.** It is the only option that simultaneously closes the production leak, preserves the demo
showcase as a deliberate capability, and gives the repaired subsystems (support, RBAC, settings) and
the prod Docker image the seed data they need.

### D1. One flag, one helper

- Introduce `DEMO_MODE` (values `true`/`false`, default **false** — absent means off, everywhere,
  including development).
- Rewrite `src/lib/config/demo.ts` to be the *only* reader:
  `export function isDemoMode(): boolean { return process.env.DEMO_MODE === 'true' }`.
  Remove `ENABLE_DEMO`, remove all `NODE_ENV` reads from this module. The helper is server-only;
  client components (signin page) receive the flag and the credentials hint from a server component
  wrapper or a tiny config payload — never from a duplicated `NEXT_PUBLIC_*` variable that can drift.
- `docker-compose.yml` (dev) sets `DEMO_MODE=true` explicitly; `docker-compose.prod.yml` and k8s
  manifests do not set it.

### D2. Demo-only behaviors are enumerated and gated

Every demo behavior must (a) call `isDemoMode()`, (b) mark its output (`demo: true` in API responses,
`metadata.demoAccount: true` on rows), and (c) be listed in `docs/demo-mode.md`. Initial registry:

1. **Fake account connect** — `src/app/api/accounts/connect/route.ts`: `createDemoConnection()` runs
   only when `isDemoMode()`. When demo is off and a platform lacks credentials, return
   `400 { code: 'PROVIDER_NOT_CONFIGURED' }` (the branch that already exists for partially-configured
   installs becomes the universal non-demo path). Same gate for `/api/accounts/platforms`' "Demo mode -
   simulated connections" advertisement.
2. **Mock AI provider** — `src/lib/ai/ai-service.ts` registers `MockAIProvider` only when
   `isDemoMode()`; otherwise a missing `OPENAI_API_KEY` makes AI endpoints return the explicit
   feature-unavailable response defined by ADR-0018. Delete the `'sk-fake-key-for-demo'` default in
   `src/lib/ai/config.ts`.
3. **Demo credential hints** — signin page hint gated (already is, now via the new flag); the
   hardcoded credentials block in `src/app/dashboard/setup/page.tsx` is removed and replaced with a
   demo-gated hint plus generic "contact your workspace owner" copy.
4. **Demo seed tier** — the `demo` seeder refuses to run unless `DEMO_MODE=true` (see D3).

Anything else discovered to fabricate data without credentials (e.g. mock media-upload IDs inside
providers — ADR-0009's scope) must either join this registry or return an explicit error.

### D3. Tiered, modular seeding

`prisma/seed.ts` becomes a thin dispatcher: parse `SEED_TIER` env (or `--tier` argv), default
`minimal`, and invoke per-domain seeders under `src/lib/seeders/` (extending the existing
client-reports/help-content/video-tutorial pattern). Each seeder is idempotent (upsert by natural key)
and exports a named function.

- **`minimal`** (safe and expected in production; runs on every boot, idempotent). Note: there is
  no RBAC catalog to seed — ADR-0004/ADR-0012 delete `Role`/`UserRole`/`Permission` from the
  schema, and enforcement is the `WorkspaceRole` enum plus `User.isPlatformAdmin`; the admin grant
  below is the entirety of RBAC bootstrap.
  - `settings-defaults-seeder`: global `SystemConfiguration` defaults, baseline
    `SecurityConfiguration`, system `EmailTemplate` rows, and `FeatureFlag` rows for the deferred
    subsystems — `community`, `documentation-management`, `discord` — created **disabled** per
    ADR-0013/0014/0015.
  - `admin-user-seeder`: grants `User.isPlatformAdmin` from the `PLATFORM_ADMIN_EMAILS` env
    allowlist (ADR-0004 Phase 0 step 3), creating the account (password per D4) when no matching
    user exists, and asserts at least one platform admin exists after the run — the seeded-database
    check ADR-0004's lockout risk expects.
  - `billing-defaults-seeder`: local plan/entitlement rows mapping to Stripe Products/Prices
    (ADR-0019); Stripe objects themselves are managed via Stripe, not seeded.
- **`demo`** (the showcase; **requires `DEMO_MODE=true`**, aborts otherwise): the current 30k-row
  generator split into domain seeders (`users`, `workspaces`, `social-accounts`, `posts`, `inbox`,
  `analytics`, `clients-campaigns`, plus existing client-reports/help/video), **and new seeders for the
  repaired subsystems**: `support-seeder` (support agents, open/assigned/resolved tickets with updates
  and notes, chat sessions, contact-form submissions), `admin-settings-seeder` (per-workspace example
  configurations so `/api/admin/settings/**` and the rebuilt admin UI per ADR-0016 render real data),
  and demo `UserWorkspace` memberships covering all five `WorkspaceRole` values — exercising the
  model ADR-0004/0012 actually enforce.
- **`test`** (deterministic fixtures for CI, per ADR-0021): fixed IDs/emails, a seeded PRNG (no bare
  `Math.random()`), small volumes (~2 workspaces, ~20 posts). Replaces `e2e/global-setup.ts`'s broken
  `require('../prisma/seed.ts')` fallback with an import of the exported `seedTest()` function.

Tiers compose: `demo` and `test` both run `minimal` first. Delete the stale `prisma/seed.js`
(ADR-0024).

### D4. Seeded-credential policy (with ADR-0006)

- No committed constant passwords. Remove `password123` and the hardcoded `demo123456`.
- Minimal tier: admin password taken from `ADMIN_INITIAL_PASSWORD` if set, otherwise generated via
  `crypto.randomBytes`, printed **once** to stdout at seed time, and flagged for forced change on
  first login.
- Demo tier: demo user password from `DEMO_USER_PASSWORD` or generated-and-printed once; the generated
  mock users receive random per-user passwords that are never printed (the demo user is the only
  intended login).
- Test tier: a fixed password is acceptable but supplied via CI env (`E2E_USER_PASSWORD`), not
  committed source; workflows and `e2e/global-setup.ts` read the same variable.

### D5. Production-image seeding (with ADR-0022)

- `Dockerfile.prod` build stage compiles the seed entry with esbuild
  (`esbuild prisma/seed.ts --bundle --platform=node --packages=external --outfile=dist/seed.js`) so the
  runtime image needs no `tsx`.
- `docker/entrypoint.sh`: replace the `SEED_DATABASE`/`npx prisma db seed` block with
  `node dist/seed.js --tier="${SEED_TIER:-minimal}"`, run unconditionally after `prisma migrate deploy`
  (minimal is idempotent), and **fail loudly** — remove the `|| echo` that masks failures today.

## Consequences

### Positive

- A credential-less production install returns explicit "provider not configured" errors instead of
  silently fabricating connected accounts and AI output.
- One grep-able flag (`DEMO_MODE`) and one helper govern every demo behavior; the registry in
  `docs/demo-mode.md` makes the surface auditable and testable.
- Fresh production databases boot with settings defaults, feature flags, and a real platform admin
  (`User.isPlatformAdmin` granted from the allowlist) — unblocking ADR-0004/0012 enforcement and
  ADR-0016's admin UI.
- Support and RBAC development (the "repair now" subsystems) get realistic demo data and deterministic
  CI fixtures on day one.
- No shared/committed passwords; seeded secrets are generated and shown once.
- The prod Docker image can actually seed; failures surface instead of being swallowed.

### Negative

- Real refactoring cost: splitting 799 lines into ~12 seeders and re-validating demo-data parity.
- Developers must now set `DEMO_MODE=true` (via compose, done by default) — a fresh bare `npm run dev`
  without it shows an empty, credential-less app; this is intentional but will surprise at first.
- The demo-behavior registry is process overhead: new demo behaviors require a doc entry and a gate.
- Build pipeline gains an esbuild step for the seed bundle; entrypoint failures now block boot (also a
  feature).

## Implementation Plan

### Phase 1 — Flag and gating (do first; closes the production leak)

1. **(S)** Rewrite `src/lib/config/demo.ts`: `DEMO_MODE`-only, delete `ENABLE_DEMO` and `NODE_ENV`
   logic; set `DEMO_MODE=true` in `docker-compose.yml` and `dev-local.sh`, document in `.env.example`.
2. **(S)** Gate `createDemoConnection()` in `src/app/api/accounts/connect/route.ts` behind
   `isDemoMode()`; non-demo unconfigured providers return `400 PROVIDER_NOT_CONFIGURED`. Apply the same
   gate to `/api/accounts/platforms`.
3. **(M)** Gate `MockAIProvider` registration in `src/lib/ai/ai-service.ts` behind `isDemoMode()`;
   remove `'sk-fake-key-for-demo'` from `src/lib/ai/config.ts`; non-demo keyless AI returns ADR-0018's
   feature-unavailable response.
4. **(S)** Remove hardcoded credentials from `src/app/dashboard/setup/page.tsx`; convert the signin
   hint to consume the server-provided flag.
5. **(S)** Add `docs/demo-mode.md` with the initial four-entry registry.

### Phase 2 — Seed refactor (tiers + domain seeders)

6. **(L)** Split `prisma/seed.ts` into a tier dispatcher plus domain seeders under `src/lib/seeders/`
   (`users`, `workspaces`, `social-accounts`, `posts`, `inbox`, `analytics`, `clients-campaigns`),
   keeping the three existing seeders; export `seedMinimal()`, `seedDemo()`, `seedTest()`.
7. **(M)** New `admin-user-seeder.ts` (`User.isPlatformAdmin` grants from `PLATFORM_ADMIN_EMAILS`
   per ADR-0004 Phase 0 step 3, with the at-least-one-admin assertion),
   `settings-defaults-seeder.ts` (`SystemConfiguration`, `SecurityConfiguration`, system
   `EmailTemplate`, deferral `FeatureFlag`s per ADR-0013/0014/0015),
   `billing-defaults-seeder.ts` (ADR-0019). No `rbac-seeder`: `Role`/`UserRole`/`Permission` are
   deleted by ADR-0004/0012, not seeded.
8. **(M)** New demo-tier `support-seeder.ts` (`SupportAgent`, `SupportTicket` + `TicketUpdate`/notes,
   `SupportChat`/`SupportMessage`, `SupportContactForm`) and `admin-settings-seeder.ts` (per-workspace
   examples), plus demo `UserWorkspace` memberships covering all five `WorkspaceRole` values.
9. **(M)** `test` tier: seeded PRNG, fixed identifiers, small volumes; rewrite `e2e/global-setup.ts`
   to import `seedTest()` directly (removing the broken `require` check); wire `SEED_TIER=test` into
   CI jobs per ADR-0021.

### Phase 3 — Credentials and prod image

10. **(M)** Credential policy: generated admin/demo passwords printed once,
    `ADMIN_INITIAL_PASSWORD`/`DEMO_USER_PASSWORD`/`E2E_USER_PASSWORD` env support, forced-change flag
    on the seeded admin; purge `password123`/`demo123456` constants from source, scripts, and docs.
11. **(M)** `Dockerfile.prod`: esbuild-bundle `prisma/seed.ts` → `dist/seed.js`;
    `docker/entrypoint.sh`: run `node dist/seed.js --tier="${SEED_TIER:-minimal}"` after
    `migrate deploy`, remove the `|| echo` failure mask (ADR-0022).
12. **(S)** Delete `prisma/seed.js`; update `package.json` `prisma.seed`, `db:seed`, `seed` scripts to
    the dispatcher; refresh CLAUDE.md's stale `--clean`/creds references (ADR-0024).

## Risks and Mitigations

- **A demo behavior escapes the registry** → add an integration test that runs key routes with
  `DEMO_MODE` unset and asserts no `demo: true` responses and no `metadata.demoAccount` rows are
  created; CI greps for `createDemoConnection`-style branches lacking an `isDemoMode()` call.
- **Demo tier run against production data** → `seedDemo()` hard-aborts unless `DEMO_MODE=true`, and
  its destructive `deleteMany` phase additionally requires an explicit `--wipe` flag.
- **Generated admin password lost** → printed once at seed time with a prominent banner; provide a
  `scripts/reset-admin-password.ts` recovery path; forced change on first login limits exposure.
- **Refactor breaks demo-data parity** → snapshot row counts per model from the current seed and
  assert the refactored `seedDemo()` stays within tolerance before deleting the old code path.
- **Seed drift vs. schema (only one migration exists; models rely on `prisma db push`)** → per
  ADR-0002, seeders run in CI on every PR (`minimal` + `test` tiers) against a migrated database, so
  schema/seed mismatches fail fast.
- **esbuild bundle misses a dynamic import** → the dispatcher uses static imports only; CI builds the
  prod image and executes `node dist/seed.js --tier=minimal` against a scratch database as a smoke test.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — seeders run against migrated
  schemas; CI seed smoke tests.
- ADR-0004: Platform Authorization Model and RBAC Enforcement / ADR-0012: Admin Dashboard and RBAC
  Subsystem Remediation — the `minimal` tier grants `User.isPlatformAdmin` from
  `PLATFORM_ADMIN_EMAILS` and asserts a platform admin exists (ADR-0004 Phase 0 step 3 and its
  lockout mitigation); demo memberships exercise the `WorkspaceRole` enum.
- ADR-0006: Cryptography, Token Encryption, and Secrets Management — governs the generated-password
  and no-committed-secrets policy (D4).
- ADR-0009: Social Platform Integration Completion Strategy — replaces fake connects with real OAuth;
  this ADR supplies the `PROVIDER_NOT_CONFIGURED` non-demo behavior it needs.
- ADR-0011: Support Subsystem Remediation (Tickets, Chat, Agents) — demo/test seed data for the
  support models added here.
- ADR-0013/0014/0015: Community / Documentation Management / Discord deferrals — their feature flags
  are created disabled by the `minimal` tier.
- ADR-0016: System Settings & Configuration: Real Operations over Simulations — settings defaults and
  per-workspace demo examples seeded here.
- ADR-0018: AI Features: Explicit Availability, Model Policy, and UI Mounting — `MockAIProvider`
  becomes demo-gated via `isDemoMode()`.
- ADR-0019: Billing and Subscriptions with Stripe — plan/entitlement defaults in the `minimal` tier.
- ADR-0021: Testing Strategy and Honest Quality Gates — the deterministic `test` tier and
  `e2e/global-setup.ts` rewrite.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — prod-image seed bundling and entrypoint
  changes.
- ADR-0024: Codebase Hygiene — deletion of `prisma/seed.js` and stale doc references.
