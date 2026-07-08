# Demo Mode (ADR-0025)

Demo mode makes SociallyHub demonstrable without real credentials: it fabricates
a connected social account, serves a labeled mock AI provider, shows demo login
hints, and unlocks the showcase seed dataset. Every one of those behaviors is
**opt-in**, gated by a single flag, and marks its output so it can never be
mistaken for real data.

## The one flag

Demo mode is governed by exactly one environment variable:

```
DEMO_MODE=true
```

- **Default is off.** Absent or any value other than `true` means demo is OFF
  **everywhere, including local development**. There is no `NODE_ENV`
  heuristic and no `ENABLE_DEMO` backdoor anymore — both were removed.
- It is read through **one helper only**: `src/lib/config/demo.ts`
  (`isDemoMode()` returns `process.env.DEMO_MODE === 'true'`). No route, service,
  or component may sniff `process.env.DEMO_MODE` or `NODE_ENV` directly.
- `DEMO_MODE` is a **server-only** variable (not `NEXT_PUBLIC_*`). Client
  components must receive the flag and the credentials hint from a server
  component via `getPublicDemoConfig()` — never from a duplicated
  `NEXT_PUBLIC_*` mirror that could drift from the real gate.
- The dev `docker-compose.yml` sets `DEMO_MODE=true` (plus `SEED_TIER=demo` and
  `DEMO_USER_PASSWORD`) for the showcase. Production compose does **not** set it.

## The rule for any demo behavior

Every demo-only behavior MUST:

1. **Gate** on `isDemoMode()` from `@/lib/config/demo` (nothing else).
2. **Mark** its output so it is self-evidently not real — `demo: true` in an API
   response body, `metadata.demoAccount: true` on a persisted row, or
   `{ aiProvider: 'mock', simulated: true }` for AI results.
3. **Be listed** in the registry below.

Anything discovered fabricating data without credentials must either join this
registry (gated + marked) or return an explicit error (e.g. `PROVIDER_NOT_CONFIGURED`).

## Registry of demo-only behaviors

| # | Behavior | File(s) | Gate | Output marking |
|---|----------|---------|------|----------------|
| 1 | **Fake account connect** — connecting a platform with no real OAuth credentials persists a simulated `SocialAccount` instead of failing. When demo is off, unconfigured providers return `400 { code: 'PROVIDER_NOT_CONFIGURED' }`. The `platforms` list advertises a `demo` tier only under the same gate. | `src/app/api/accounts/connect/route.ts` (`createDemoConnection()`), `src/app/api/accounts/platforms/route.ts` | `isDemoMode()` | Row: `metadata.demoAccount: true`; response: `demo: true` |
| 2 | **Mock AI provider** — with no `OPENAI_API_KEY`, AI endpoints are served by `MockAIProvider` instead of returning `503 AI_UNAVAILABLE`. | `src/lib/ai/ai-service.ts` (provider registration), `src/lib/ai/availability.ts` (`getAIAvailability()`) | `isDemoMode()` | Response: `{ aiProvider: 'mock', simulated: true }` (stamped by `withAIMeta()`) |
| 3 | **Demo credential hints** — the signin and workspace-setup pages show the demo login (`demo@sociallyhub.com` + the `DEMO_USER_PASSWORD`-sourced hint). Outside demo mode, setup shows generic "contact your workspace owner" copy and signin shows no hint. | `src/app/auth/signin/page.tsx` (server) → `signin-form.tsx` (client); `src/app/dashboard/setup/page.tsx` (server) | `isDemoMode()` via `getPublicDemoConfig()` / `getDemoCredentialsMessage()` | Rendered only when `demoMode && credentialsHint`; password comes from `DEMO_USER_PASSWORD`, never a committed constant |
| 4 | **Demo seed tier** — the `demo` seed tier generates the full showcase dataset. It refuses to run unless demo mode is on. | `prisma/seed.ts` (`seedDemo()`), run via `npm run db:seed:demo` (`SEED_TIER=demo`) | Aborts unless `DEMO_MODE=true`; destructive reset additionally requires `--wipe` | Seeded rows carry their normal demo markers (e.g. demo accounts' `metadata.demoAccount`) |

## Seed tiers (context)

`prisma/seed.ts` dispatches on `SEED_TIER` (or `--tier=<t>`), default `minimal`:

- **minimal** — prod-safe, idempotent: settings defaults, deferral feature
  flags, and the first platform admin (`PLATFORM_ADMIN_EMAILS`). Wipes nothing.
- **demo** — the showcase; **requires `DEMO_MODE=true`** and runs `minimal` first.
- **test** — deterministic CI fixtures; runs `minimal` first.

## Credential policy (ADR-0025 D4)

No committed constant passwords anywhere in `prisma/`, `src/`, or `scripts/`
(enforced by `scripts/check-no-committed-demo-secrets.sh` in CI). The demo user
password comes from `DEMO_USER_PASSWORD` (or is generated and printed once);
generated mock users get per-user random passwords that are never printed — the
demo user is the only intended login.
