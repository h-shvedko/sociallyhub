# ADR-0018: AI Features: Explicit Availability, Model Policy, and UI Mounting

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-07** (Option 2). *Promoted from Proposed on implementation + verification.*

> **Implementation note (2026-07-07, commit `6fc28e7`).** The three contradictory no-key
> failure modes are gone: `getAIAvailability()` (openai / mock-only-in-explicit-demo / none),
> `guardAIAvailability()` → **503 AI_UNAVAILABLE**, and `aiProvider`/`simulated` stamped on
> every success across all 13 routes. The Priority-1 fix finally landed (`simpleAIService` →
> `aiService`; both bypass files **deleted**, as were the `sk-fake-key-for-demo` fallback and
> the demo-user remap). Model policy is env-driven (`OPENAI_MODEL`, default `gpt-4o-mini`) with
> one cost table (`estimateCostCents`, conservative unknown-model default) and usage-tracking
> coverage extended to ab-testing + image-analyzer; `AICache` is Redis-backed (fail-soft).
> Spend backstop `AI_MONTHLY_COST_LIMIT_CENTS` → 429 (plan credits from ADR-0019 stay primary).
> **UI:** `/dashboard/audience` mounted with three honest tabs + nav; the
> `AudienceIntelligenceDashboard` was **deleted rather than mounted** — 336 lines of hardcoded
> fabricated data (per this ADR's deletion-over-stubs pre-authorization); Visual Insights tab
> added to analytics; composer AI toggles show a disabled+actionable state when unavailable and
> a "Simulated (demo)" badge in mock mode. Along the way more fabrications were removed
> (Math.random hashtag scores → null, a fake fallback image analysis, a debug credential leak).
> **Verified:** 18-case unit availability matrix (keyless-503 proof), integration auth-triple +
> simulated-flag suites, 14/14 suites / 180 tests, `next build` green, and a live chromium
> session (real key, no paid generations fired): status endpoint, audience tabs, composer
> toggle, analytics tab — all green.
- Deciders: Hennadii Shvedko (owner), Claude (architect)

## Context and Problem Statement

SociallyHub ships a substantial, genuinely DB-backed AI feature layer: 13 route files under
`src/app/api/ai/**` (content generate, hashtag suggest, tone analyze, optimize, performance
predict, image analyze/optimize/analytics, and a 5-route A/B-testing sub-API), persisting to real
Prisma models (`AIContentSuggestion`, `HashtagSuggestion`, `ContentToneAnalysis`,
`ContentPerformancePrediction`, `ImageAnalysis`, `AIUsageTracking`). The problem is not that the
features are fake — it is that their **availability behavior is dishonest and inconsistent**, the
**model configuration has rotted**, and parts of the UI layer are orphaned. Verified state as of
2026-07-02:

**Three contradictory failure modes when `OPENAI_API_KEY` is unset:**

1. **Silent fabrication.** `src/lib/ai/ai-service.ts` `initializeProviders()` (lines 32-51)
   registers `MockAIProvider` under the `'openai'` key when the env var is missing, logging only
   `"🚧 Using mock AI provider"`. `src/lib/ai/providers/mock-provider.ts` fabricates results with
   `Math.random()` (`createMockUsage()` lines 24-30; performance prediction
   `Math.random() * 0.1 + 0.02` engagement at line 230) and reports model
   `'mock-gpt-3.5-turbo'`. Routes on this path (`content/generate`, `hashtags/suggest`,
   `optimize`) return `success: true` with fabricated content, costs, and predictions. The only
   hint is the `usage.model` string, which no UI component ever surfaces (zero "mock" references
   in `src/components/ai/*`). A user sees an authoritative-looking engagement prediction that is
   a random number.
2. **Hard 500 on call.** `src/lib/ai/config.ts` line 5 instantiates the OpenAI client with
   `apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key-for-demo'`.
   `src/lib/ai/simple-ai-service.ts` (used by `/api/ai/tone/analyze` and
   `/api/ai/performance/predict`, both importing `simpleAIService` at line 6) calls this client
   directly and rethrows on error (its catch block writes a failed `AIUsageTracking` row then
   `throw error`). With the fake key, OpenAI returns 401 and these routes 500.
   `src/lib/ai/ab-testing-service.ts` (line 3) uses the same raw client, so the entire
   `/api/ai/ab-testing/**` sub-API shares this failure mode — as do the seven automation/audience
   libs that hardcode `gpt-3.5-turbo` against it (`smart-response-system`,
   `audience-segmentation`, `content-gap-analyzer`, `sentiment-analyzer`,
   `content-calendar-optimizer`, `trend-analyzer`, and the `content-intelligence` route).
3. **Crash at import.** `src/lib/ai/openai-client.ts` (used by `src/lib/ai/image-analyzer.ts`,
   which backs `/api/ai/images/analyze`) **throws at module load** if `OPENAI_API_KEY` is unset
   (`throw new Error('OPENAI_API_KEY environment variable is not set')`, line 12).

AI_MOCK_DATA.md documented failure mode 2 and prescribed a "Priority 1" fix (replace
`simpleAIService` with `aiService`, its lines 186-187, 257). It was never applied. The unified
`aiService` already has drop-in `analyzeTone` (line 222) and `predictPerformance` (line 306)
methods, so the fix is mechanical.

**Model policy has rotted and diverged.** The audit brief said "gpt-3.5-turbo hardcodes"; the
code is messier: the mainline `src/lib/ai/providers/openai-provider.ts` hardcodes `'gpt-4o-mini'`
at 7 call sites with its own private cost table (line 328), while `simple-ai-service.ts` and the
seven automation/audience libs hardcode `'gpt-3.5-turbo'`, and `src/lib/ai/config.ts` exports an
`AI_CONFIG.models` map (`gpt-4`, `gpt-3.5-turbo`, `gpt-4-turbo-preview`) and a `COST_ESTIMATES`
table that does not even contain `gpt-4o-mini`. No model is configurable via env. There is an
unused `AIModelVersion` Prisma model (schema line 1022) and an `AIProvider` enum
(OPENAI/ANTHROPIC/GOOGLE) hinting at an intended registry that was never wired.

**UI mounting is half-true.** The audit claimed the entire `src/components/ai/*` layer has zero
page imports. **The code contradicts this**: `src/app/dashboard/posts/page.tsx` (line 10)
imports `src/components/posts/post-composer.tsx` (904 lines, rendered at line 364), which
imports and conditionally renders six AI components — `AIContentGenerator` and
`HashtagSuggestions` behind a `showAIAssistant` toggle (lines 764-782), `ToneAnalyzer`,
`PerformancePredictor`, `ImageAnalyzer`, `ImageOptimizer` behind `showAIAnalysis`
(lines 783-816). TODO.md's "Improve Post Composer & Preview" AI subtasks (lines 190-193) are
therefore already implemented and stale. What **is** genuinely orphaned: all four
`src/components/audience/*` dashboards (audience-intelligence, audience-segmentation,
posting-time, sentiment — zero imports outside their directory, despite real `/api/audience/**`
routes and models), `src/components/ai/visual/visual-analytics-dashboard.tsx`, and the duplicate
308-line `src/components/dashboard/posts/post-composer.tsx` (zero imports).

**No spend or abuse controls.** The only rate limiting is an in-process `RateLimiter`
(RPM/TPM) inside `OpenAIProvider` — global per container, not per workspace or user.
`/api/ai/content/generate` carries the comment `// TODO: Implement subscription/permission
checks here`. `AIUsageTracking` rows (tokensUsed, costCents, model, successful) are written by
`aiService` and `simpleAIService`, but `ab-testing-service` and `image-analyzer` write none.
`AICache` is an in-memory `Map` with a `setInterval` sweeper — per-process, useless across the
Docker containers we standardize on (ADR-0022), even though ioredis is already a dependency
(ADR-0008). There is also a hardcoded seed-coupled hack in `content/generate/route.ts`:
`if (userId === 'demo-user-id') userId = 'cmesceft00000r6gjl499x7dl'`.

We must decide: how AI availability is communicated, what model policy governs the ~10 files
that call OpenAI, and what happens to the orphaned UI.

## Decision Drivers

- **Honesty**: fabricated predictions presented as `success: true` destroy user trust and
  directly contradict the product's "zero mock data" claim; this is the same principle already
  accepted for admin settings in ADR-0016 (real operations over simulations).
- **Protect existing investment**: the routes, models, and mounted composer UI work when a key
  is present; the cheapest path to honest value is repair, not rebuild.
- **Cost control**: LLM spend is unbounded today; with Stripe billing now in scope
  (ADR-0019), per-plan AI quotas need an enforcement point, and `AIUsageTracking` already
  records cost per call.
- **Model churn**: hardcoded model IDs across 10+ files (already inconsistent:
  `gpt-4o-mini` vs `gpt-3.5-turbo`) rot with every OpenAI deprecation cycle.
- **Deployment reality**: self-hosted Docker with multiple processes (ADR-0022) makes
  per-process caches and rate limiters ineffective; Redis is already in the stack (ADR-0008).
- **Demo experience**: seeded demo installs (ADR-0025) legitimately need plausible AI output
  without a paid key — but only when demo mode is explicit.

## Considered Options

### Option 1 — Keep silent fallback, apply only the Priority-1 fix

Swap `simpleAIService` for `aiService` in the two bypass routes so every route degrades to
`MockAIProvider` uniformly.

- Good: smallest diff; no UX work; demo installs keep "working".
- Bad: makes the dishonesty *more* consistent — every AI feature now silently fabricates.
  Leaves model rot, unbounded spend, orphaned audience UI, and the import-crash in
  `openai-client.ts` untouched. Rejected on principle (ADR-0016 precedent).

### Option 2 — Honest availability contract + unified service, mock only in explicit demo mode (chosen)

One provider-resolution path (`aiService`) for all AI callers. When no real key is configured:
return `503 AI_UNAVAILABLE` with an actionable message — unless explicit demo mode (ADR-0025)
is on, in which case the mock provider runs but every response carries
`aiProvider: 'mock'`/`simulated: true` and the UI badges the output. Centralize model selection
in env-driven config; enforce per-workspace quotas from `AIUsageTracking`; move cache to Redis.
Mount the audience dashboards (their APIs are real); delete the dead duplicates.

- Good: honest by default, demo-friendly by explicit opt-in; one seam for model policy, quota,
  and tracking; reuses everything that already works, including the already-mounted composer UI.
- Bad: touches all 13 AI routes plus 9 lib files; needs modest UI work (badges, disabled
  states); demo E2E flows must set the demo flag explicitly.

### Option 3 — Remove MockAIProvider entirely; AI hard-requires a key

Delete the mock layer; every AI surface is 503 without `OPENAI_API_KEY`.

- Good: maximally honest; least code.
- Bad: kills the seeded demo experience ADR-0025 is building, and forces paid API keys into CI
  and local dev for any AI-adjacent test (conflicts with ADR-0021's deterministic test needs —
  the mock provider is a good *test double* even if it is a bad *silent fallback*).

### Option 4 — Defer the AI subsystem behind a feature flag (like Community/Docs)

Flag off all AI routes and UI until after publishing/billing repairs land.

- Bad: unlike Community (ADR-0013), the AI layer is already mounted in the flagship composer
  and demonstrably works with a key; flagging it off removes shipped, differentiating value and
  still leaves the dishonest fallback code in the tree for the flag-on case. Deferral solves
  sequencing, not honesty.

## Decision Outcome

**Option 2.** AI availability becomes an explicit, queryable contract; the mock provider is
demoted from silent fallback to explicit demo-mode/test double; model choice becomes
configuration; spend becomes governed; real orphans are mounted or deleted.

Specifically:

1. **Availability contract.** `aiService` exposes `getAvailability(): { available: boolean,
   provider: 'openai' | 'mock' | 'none', reason?: string }`. Resolution: real key → `openai`;
   no key + `isDemoMode()` true (`src/lib/config/demo.ts`, per ADR-0025) → `mock`; otherwise
   `none`. A new `GET /api/ai/status` returns it so UIs can gate features. All AI routes return
   `503 { error: 'AI_UNAVAILABLE', message: 'Configure OPENAI_API_KEY to enable AI features' }`
   when the provider is `none`, and every successful response body gains top-level
   `aiProvider` and `simulated: boolean` fields. The composer's AI Assistant / AI Analysis
   toggles render a disabled state with that message instead of fabricated output; in demo mode
   a visible "Simulated (demo)" badge appears on all AI results.
2. **Single client, single seam.** All AI callers route through `aiService`/`OpenAIProvider`.
   The `'sk-fake-key-for-demo'` default in `src/lib/ai/config.ts` and the module-load `throw`
   in `src/lib/ai/openai-client.ts` are both removed; `simple-ai-service.ts` is deleted after
   the two bypass routes move to `aiService.analyzeTone`/`predictPerformance` (finally applying
   AI_MOCK_DATA.md's Priority-1 fix). `ab-testing-service`, `image-analyzer`, and the seven
   automation/audience libs migrate to the shared provider (or at minimum the shared client +
   model config + usage tracking) in a follow-up phase.
3. **Model policy.** Models come from env with current defaults:
   `OPENAI_MODEL` (default `gpt-4o-mini`, the model the mainline provider already uses and the
   best cost/quality default among those in the codebase) and `OPENAI_VISION_MODEL` (default
   `gpt-4o-mini`). `AI_CONFIG`/`COST_ESTIMATES` in `src/lib/ai/config.ts` become the single
   source of truth for model IDs and per-1K-token costs (adding the missing `gpt-4o-mini`
   entry; unknown models fall back to a conservative estimate rather than 0). Owners can adopt
   newer models (e.g. the 4.1-mini generation) by changing env, not code. Every provider call
   records the resolved model in `AIUsageTracking.model`. The unused `AIModelVersion` table is
   *not* adopted now (YAGNI) — env config suffices for a single-provider setup; revisit if the
   `AIProvider` enum's Anthropic/Google ambitions materialize.
4. **Quota, rate limiting, caching.** Before each provider call, `aiService` checks a
   per-workspace monthly cost ceiling (`AI_MONTHLY_COST_LIMIT_CENTS`, default 2000) via the
   existing `getUsageStats` aggregate over `AIUsageTracking`, returning
   `429 AI_QUOTA_EXCEEDED` when exhausted — filling the route TODO and creating the hook
   ADR-0019 will later bind to plan tiers. Per-user burst limiting follows the shared
   rate-limit approach of ADR-0005. `AICache` gains a Redis backend (ioredis already present)
   with the in-memory Map as dev fallback.
5. **UI mounting and deletion.** The composer AI integration is already live — no work, but
   TODO.md's stale item is corrected. The four `src/components/audience/*` dashboards are
   mounted on a new `/dashboard/audience` page (tabbed), gated by the availability contract,
   since their `/api/audience/**` routes and models are real;
   `visual-analytics-dashboard.tsx` joins `/dashboard/analytics` as a tab. The duplicate
   `src/components/dashboard/posts/post-composer.tsx` is deleted (ADR-0024). If the audience
   page reveals broken routes during mounting, the fallback is deletion, not a silent stub.

## Consequences

### Positive

- No user ever mistakes a `Math.random()` prediction for analysis; demo output is labeled.
- A default self-hosted install (no key) degrades to a clear, actionable "AI unavailable"
  state instead of a mix of fake successes, 500s, and import crashes.
- One seam for model upgrades, cost accounting, and quota enforcement; `AIUsageTracking`
  becomes trustworthy input for ADR-0019 plan limits and ADR-0023 observability.
- ~1,500 lines of orphaned-but-real audience UI start earning their keep; two dead files and
  one duplicate service are removed (ADR-0024).
- Mock provider survives where it is legitimate: explicit demo mode and deterministic tests
  (ADR-0021).

### Negative

- Touches all 13 AI routes and ~9 lib files; regression surface in the composer's AI panels.
- Demo/E2E environments must explicitly enable demo mode or set a key; anything relying on the
  silent fallback breaks loudly (intended, but it is migration work).
- Response-shape change (`aiProvider`, `simulated`) is a minor API contract change for any
  existing client code reading these endpoints.
- Redis becomes a soft dependency of AI caching/rate limiting in production.

## Implementation Plan

**Phase 1 — Availability contract (S)**
- `src/lib/ai/ai-service.ts`: add `getAvailability()`; in `initializeProviders()`, register
  `MockAIProvider` only when `isDemoMode()` (import from `src/lib/config/demo.ts`); otherwise
  register nothing and let `getProvider()` produce a typed `AIUnavailableError`.
- `src/lib/ai/config.ts`: remove the `'sk-fake-key-for-demo'` fallback; export `getAIModel()`
  reading `OPENAI_MODEL`/`OPENAI_VISION_MODEL`.
- Add `src/app/api/ai/status/route.ts` (auth per ADR-0003) returning availability.
- Shared route helper (e.g. `src/lib/ai/route-guard.ts`) mapping `AIUnavailableError` → 503 and
  injecting `aiProvider`/`simulated` into success payloads; apply to the 13 `src/app/api/ai/**`
  routes. Remove the hardcoded `'demo-user-id'` remap in `content/generate/route.ts` (ADR-0025
  owns demo identity).

**Phase 2 — Kill the bypasses (S)**
- `src/app/api/ai/tone/analyze/route.ts`, `src/app/api/ai/performance/predict/route.ts`:
  replace `simpleAIService` with `aiService.analyzeTone` / `aiService.predictPerformance`
  (AI_MOCK_DATA.md Priority 1). Delete `src/lib/ai/simple-ai-service.ts`.
- `src/lib/ai/openai-client.ts`: delete; point `image-analyzer.ts` at the shared client/provider
  so a missing key can no longer crash module import.

**Phase 3 — Model policy + tracking coverage (M)**
- `openai-provider.ts`: replace 7 hardcoded `'gpt-4o-mini'` literals with `getAIModel()`;
  collapse its private cost table into `COST_ESTIMATES` (add `gpt-4o-mini`; conservative
  default for unknown IDs).
- Migrate `ab-testing-service.ts`, `image-analyzer.ts`, and the automation/audience libs
  (`smart-response-system`, `audience-segmentation`, `content-gap-analyzer`,
  `sentiment-analyzer`, `content-calendar-optimizer`, `trend-analyzer`,
  `automation/content-intelligence` route) off raw clients and `'gpt-3.5-turbo'` literals onto
  the shared config, and ensure each writes `AIUsageTracking` rows.

**Phase 4 — Quota, rate limit, cache (M)**
- `aiService`: pre-call workspace quota check against `AIUsageTracking` aggregates
  (`AI_MONTHLY_COST_LIMIT_CENTS`); 429 mapping in the route guard; per-user burst limit per
  ADR-0005 conventions.
- `src/lib/ai/cache.ts`: Redis-backed implementation behind the existing `AICache` interface;
  in-memory fallback when `REDIS_URL` is absent (dev).

**Phase 5 — Mount or delete UI (M)**
- New `src/app/dashboard/audience/page.tsx` mounting the four `src/components/audience/*`
  dashboards behind the availability gate; add nav entry.
- Add `visual-analytics-dashboard.tsx` as a tab in `/dashboard/analytics`.
- Delete `src/components/dashboard/posts/post-composer.tsx` (unused duplicate, ADR-0024).
- Update TODO.md: mark the Post Composer AI subtasks done; add the audience page item.

## Risks and Mitigations

- **Mock provider drifts from the real provider interface** once it is demo/test-only →
  both implement the same `AIProvider` TypeScript interface; add a contract test (ADR-0021)
  that runs the route suite against the mock provider in demo mode.
- **Quota check adds a DB aggregate per AI call** → cache the monthly aggregate in Redis with
  a short TTL; correctness only needs eventual enforcement, not per-call precision.
- **Model default ages** (`gpt-4o-mini` will eventually deprecate) → env-only change by
  design; document `OPENAI_MODEL` in `.env.example` and the ADR-0022 deployment docs; alert on
  `AIUsageTracking.successful=false` spikes via ADR-0023 observability.
- **Mounting audience dashboards exposes latent bugs in `/api/audience/**`** → mount behind a
  feature flag initially; the decision pre-authorizes deletion if repair exceeds an S/M effort.
- **Existing consumers of the old response shape** → additive fields only where possible;
  the 503/429 behaviors are new states, not changed successes; composer components are updated
  in the same phase that introduces them.

## Related ADRs

- ADR-0003: Auth Helper Consolidation and API Route Conventions — route guard and error-shape
  conventions used by the new AI route helper.
- ADR-0005: API Security Hardening — shared rate-limiting approach the per-user AI burst limit
  follows.
- ADR-0008: Background Jobs and the Publishing Pipeline — establishes Redis/ioredis in the
  stack, reused for AI cache and quota aggregates.
- ADR-0016: System Settings & Configuration: Real Operations over Simulations — the honesty
  principle this ADR applies to AI responses.
- ADR-0019: Billing and Subscriptions with Stripe — plan-tier AI quotas will bind to the
  workspace cost-ceiling hook introduced here.
- ADR-0021: Testing Strategy and Honest Quality Gates — MockAIProvider's legitimate role as a
  deterministic test double.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — multi-process deployment that
  invalidates in-memory caches/limiters; env documentation home for `OPENAI_MODEL`.
- ADR-0023: Observability: Real Metrics, Logging, and Health — `AIUsageTracking` failure-rate
  and spend dashboards.
- ADR-0024: Codebase Hygiene — deletion of `simple-ai-service.ts`, `openai-client.ts`, and the
  duplicate composer.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — `isDemoMode()` is the only switch that
  may activate the mock provider; owns demo identity (removing the hardcoded demo-user remap).
