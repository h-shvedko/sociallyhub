# ADR-0003: Auth Helper Consolidation and API Route Conventions

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-03**
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-03).** All defect classes eliminated: 64 broken-import files fixed
> (across four nonexistent paths), 352 unawaited `normalizeUserId` calls awaited, 25 no-arg
> `getServerSession()` calls replaced, 12 default-import `prisma` bugs fixed, 40 legacy sync-params
> routes migrated to Next 15 async params. All auth imports resolve through the canonical `@/lib/auth`
> barrel (`getAuthenticatedUser()`, `requireSession()`, `requireAdmin()`, `ApiError` in
> `src/lib/auth/session.ts`; `jsonError`/`handleApiError` in `src/lib/api/respond.ts`). Conventions in
> `docs/api-conventions.md`, enforced by ESLint `no-restricted-imports` + type-aware
> `no-floating-promises` on `src/app/api`. **Note:** helper adoption is partial by design — at delivery
> only ~9 routes had adopted `getAuthenticatedUser()`; admin routes were collapsed onto
> `requireAdmin()` in the 2026-07-03 remediation pass, but ~175 routes still call
> `getServerSession(authOptions)` + `normalizeUserId` directly, pending ADR-0011/0012 (both since
> implemented, adopting the helpers on their touched routes). `requireAdmin()` intentionally kept the
> coarse any-workspace semantics until ADR-0004 (since implemented).

## Context and Problem Statement

SociallyHub has 299 API route files under `src/app/api/**` (Next.js 15.5.0 App Router,
next-auth 4.24.11 with JWT sessions). The authentication *configuration* is sound —
`src/lib/auth/config.ts` defines `authOptions` with a credentials provider and a session
callback that copies `token.id` into `session.user.id` — but the way routes *consume* auth
is fragmented across five import paths (three of which do not resolve), one async helper
that is called synchronously hundreds of times, and two generations of route-handler
signatures. The 2026-07-02 audits (help-docs, admin-rbac, support-community, critic)
flagged this as build-breaking; direct verification confirms and enlarges the findings.

**What actually exists.** `src/lib/auth/` contains exactly four files:

| File | Contents |
|---|---|
| `config.ts` | Defines and exports `authOptions` (the only real definition) |
| `auth-options.ts` | One-line re-export shim: `export { authOptions } from './config'` |
| `demo-user.ts` | `getDemoUser()`, `getDemoUserId()`, `isDemoUser()`, `normalizeUserId()` — all `async` |
| `index.ts` | Exports **only** `authOptions` (nothing else) |

**Problem 1 — `normalizeUserId` is imported from five paths; four are broken.**
Verified import counts across `src`:

| Import path | Files | Resolves? |
|---|---|---|
| `@/lib/auth/demo-user` | 135 | Yes (the real module) |
| `@/lib/auth/utils` | 26 | **No — module does not exist** (all 14 admin RBAC API files, 12 documentation-management routes, `api/admin/support-agents`) |
| `@/lib/utils` | 19 | **No — `src/lib/utils.ts` exports only `cn()`** (all `api/admin/settings/**` routes) |
| `@/lib/auth-utils` | 12 | **No — module does not exist** (all `api/admin/help/videos/**` routes) |
| `@/lib/auth` | 7 | **No — `index.ts` exports only `authOptions`** (all `api/admin/help/faqs/**` routes) |

64 files import `normalizeUserId` from a path that cannot supply it. Since
`next.config.js` does not set `typescript.ignoreBuildErrors`, `next build` fails on
these; in dev, each affected route 500s on first request.

**Problem 2 — the async helper is called synchronously, codebase-wide.**
`normalizeUserId()` in `src/lib/auth/demo-user.ts` is `async` (it may query
`prisma.user` to resolve the demo user). Verified: **346 call sites invoke it without
`await`** versus 109 that await it. In `src/app/api/admin/help/**` alone there are 63
unawaited calls and zero awaited ones. The typical broken pattern
(`src/app/api/admin/help/articles/route.ts`):

```ts
const userId = normalizeUserId(session.user.id)   // Promise<string>, not string
const userWorkspaces = await prisma.userWorkspace.findMany({
  where: { userId, role: { in: ['OWNER', 'ADMIN'] } }  // Promise passed into where → Prisma throws
})
```

Every such site passes a Promise into a Prisma where clause; the OWNER/ADMIN permission
check throws at runtime even when everything else is correct.

**Problem 3 — `authOptions` is imported from four paths; one is broken.**
Verified: `@/lib/auth/config` (163 files), `@/lib/auth` (76), `@/lib/auth/auth-options` (1),
and `@/app/api/auth/[...nextauth]/route` (26). The last is a live defect: the NextAuth
route file exports **only** the `GET`/`POST` handlers — there is no `authOptions`
re-export — so those 26 files (all `api/admin/settings/**` and `api/admin/help/faqs/**`)
import a non-existent named export. This fails typecheck; even if forced through,
`getServerSession(undefined)` skips the app's session callback, `session.user.id` is
never populated, and every one of these routes returns an unconditional 401. Next.js 15
also validates route-file exports, so restoring a re-export from `route.ts` is not an
option. Separately, 25 call sites invoke `getServerSession()` with no arguments (e.g.
`src/app/api/support/chat/[chatId]/route.ts`), which has the same
missing-`session.user.id` consequence.

**Problem 4 — mixed Next.js 15 route signatures.** Of 87 dynamic route files, 40 still
use the legacy sync `{ params: { id: string } }` signature while 27 correctly declare
`params: Promise<...>`. On Next 15.5 the sync form is deprecated and slated for removal;
behavior is already inconsistent between neighboring routes (support chat awaits params;
support tickets does not).

**Problem 5 — no shared route conventions.** Only 35 of 299 route files use zod; the
rest hand-roll validation or skip it. Error responses are mostly `{ error: string }`
(1,060 occurrences) but with ad-hoc variants (`{ message: ... }`, bare strings, leaked
internals). Twelve admin video routes also default-import prisma
(`import prisma from '@/lib/prisma'`) although `src/lib/prisma.ts` has only the named
export `export const prisma`.

We must decide on one canonical auth module, a repair plan for all import/await sites, a
single `authOptions` path, a uniform Next 15 route signature, and shared route conventions.

## Decision Drivers

- **Unbreak the build**: 64 broken `normalizeUserId` imports + 26 broken `authOptions`
  imports block `next build` and therefore the Docker deployment pipeline (ADR-0022).
- **Unblock the repair tracks**: ADR-0011 (support) and ADR-0012 (admin RBAC) are
  Accepted "repair now" decisions; both subsystems sit squarely on the broken imports
  and unawaited calls.
- **Deferred code must still compile**: ADR-0013/0014/0015 defer community, documentation
  management, and Discord behind flags — but module resolution is build-time, so their
  broken imports must be fixed (or the files deleted per ADR-0024) regardless.
- **Prevent recurrence**: five import paths for one function is how AI-generated code
  drifted; without lint enforcement the same drift will recur.
- **Minimize churn**: 1,060 call sites already use the `{ error: string }` envelope and
  135 files already import from `demo-user.ts` correctly; conventions should ratify the
  dominant working patterns, not invent new ones.
- **Layering**: authorization *semantics* (workspace scoping, platform-admin) are
  ADR-0004's problem; this ADR must give it one enforcement point without pre-deciding it.

## Considered Options

### Option 1 — Minimal repair codemod only
Rewrite the four broken import paths to `@/lib/auth/demo-user`, add `await` at all 346
sites, fix the 12 prisma default-imports, stop.

- Good: smallest diff; unbreaks the build in a day.
- Bad: leaves five-way import fragmentation as a standing invitation (135 files on
  `demo-user`, 163 on `auth/config`, 76 on `auth`...); every route keeps repeating the
  same 10-line session + normalize + role-check boilerplate that drifted in the first
  place; no seam for ADR-0004 to hook authorization into; no conventions, so the next
  generated route reintroduces the mess.

### Option 2 — Canonical `@/lib/auth` module with session helpers + route conventions (chosen)
Make `@/lib/auth` the single import surface: it exports `authOptions`,
`getAuthenticatedUser()`, `requireSession()`, and `requireAdmin()`. The helpers call
`getServerSession(authOptions)` and resolve the normalized user id **once**, so route
code never touches `normalizeUserId` again. Codemod all import sites to the barrel,
migrate the 40 legacy dynamic routes to async params, and publish a short route
conventions document (session-first structure, zod validation, one error envelope)
enforced by ESLint rules.

- Good: one import path, one place where demo-id normalization lives (and can later be
  deleted per ADR-0025); `requireAdmin()` gives ADR-0004 a single choke point to replace
  the coarse "OWNER/ADMIN of any workspace" check; conventions ratify existing majority
  patterns; lint rules make regression mechanical to catch.
- Bad: touches ~330 files (mostly mechanical one-line rewrites); helpers must be
  designed carefully to stay thin and not pre-empt ADR-0004.

### Option 3 — Higher-order route wrapper / framework layer
Wrap every handler in `withAuth(handler, { role })` (or migrate to tRPC/Hono-style
routers) so auth, validation, and error shaping are injected rather than called.

- Good: strongest consistency guarantee; impossible to forget the session check.
- Bad: a wholesale rewrite of 299 route files while the schema itself is still invalid
  (ADR-0002) and three subsystems are being deferred; wrappers fight Next.js typed route
  exports and the official async-params codemod; large review surface for a codebase
  where much of the wrapped code is scheduled for deletion (ADR-0024). Too much, too early.

### Option 4 — Delete `normalizeUserId` outright and trust `session.user.id`
The helper exists only to map two hard-coded legacy demo IDs to the database demo user.

- Good: removes the async trap entirely.
- Bad: live sessions may still carry legacy demo IDs, and demo-mode policy (including
  whether the demo user exists at all in production) is ADR-0025's open question.
  Deleting now couples this build fix to an unratified decision. Instead we *encapsulate*
  it inside `getAuthenticatedUser()` so its later removal is a one-file change.

## Decision Outcome

**Chosen: Option 2** — consolidate on a canonical `@/lib/auth` module with session
helpers, codemod every import/await site, standardize on Next 15 async params, and adopt
a shared route conventions document, with Option 4 (removing `normalizeUserId`) folded in
as a follow-up owned by ADR-0025.

### The canonical module

`src/lib/auth/index.ts` becomes the **only** permitted import path for auth in
application code:

```ts
// src/lib/auth/index.ts
export { authOptions } from './config'
export { getAuthenticatedUser, requireSession, requireAdmin, ApiError } from './session'
// TEMPORARY (until ADR-0025 removes demo-id mapping): keep old names compiling
export { normalizeUserId, isDemoUser, getDemoUser, getDemoUserId } from './demo-user'
```

```ts
// src/lib/auth/session.ts (new)
export interface AuthUser { id: string; email: string | null; name: string | null }

/** Session lookup + demo-id normalization resolved ONCE. Returns null when unauthenticated. */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const id = await normalizeUserId(session.user.id)   // the ONLY call site left
  return { id, email: session.user.email ?? null, name: session.user.name ?? null }
}

/** Throws ApiError(401) when unauthenticated. */
export async function requireSession(): Promise<AuthUser>

/** Interim admin gate: OWNER/ADMIN membership check, centralized.
 *  ADR-0004 will replace its BODY (workspace scoping / platform roles) without
 *  changing its signature or its ~40 call sites. */
export async function requireAdmin(): Promise<AuthUser>
```

Consequences of this shape:

- `authOptions` is imported from `@/lib/auth` everywhere; `config.ts` remains the
  definition site but is imported only by the index and the NextAuth route;
  `auth-options.ts` (one importer) is deleted.
- `normalizeUserId` disappears from route code. New/repaired routes call
  `getAuthenticatedUser()` / `requireSession()`; the demo-id mapping executes exactly
  once per request inside the helper, and ADR-0025 can delete it by editing one file.
- `requireAdmin()` deliberately reproduces today's coarse semantics (OWNER/ADMIN in any
  workspace ⇒ admin). Fixing those semantics is explicitly **out of scope** here and
  owned by ADR-0004; what this ADR delivers is the single choke point.

### Route conventions (ratified in `docs/api-conventions.md`)

1. **Handler order**: (a) `await params` (Next 15 `Promise` form), (b) `requireSession()`
   / `requireAdmin()`, (c) workspace/resource authorization, (d) zod-parse input,
   (e) work, (f) response. Auth always precedes body parsing.
2. **Async params everywhere**: dynamic routes declare
   `{ params }: { params: Promise<{ id: string }> }` and `await` them. The 40 legacy
   files are migrated; the sync form is banned going forward.
3. **Validation**: request bodies and query params are parsed with zod
   (`schema.safeParse`); failures return 400 with flattened issues. Schemas live next to
   the route or in `src/lib/validations/`.
4. **Error envelope**: `{ error: string, code?: string, details?: unknown }` — the shape
   1,060 existing sites already emit — produced via a shared `jsonError(status, message,
   opts?)` helper; `ApiError` thrown by helpers is converted by a shared `handleApiError`.
   Internals (stack traces, Prisma messages) never leak into `error` (see ADR-0005).
5. **Prisma import**: named `import { prisma } from '@/lib/prisma'` only.
6. **`getServerSession` is never called directly in routes** — only via the helpers.

### Enforcement

ESLint (`no-restricted-imports`) bans: `@/lib/auth/utils`, `@/lib/auth-utils`,
`@/lib/auth/auth-options`, `@/lib/auth/demo-user` and `@/lib/auth/config` (outside
`src/lib/auth/**`), and `normalizeUserId` from `@/lib/utils`.
`@typescript-eslint/no-floating-promises` + `no-misused-promises` are enabled for
`src/app/api/**` to make the unawaited-async class of bug a lint failure. These gates
ride the CI pipeline defined in ADR-0021/ADR-0022.

## Consequences

### Positive

- `next build` succeeds again: all 64 broken `normalizeUserId` imports, 26 broken
  `authOptions` imports, and 12 bad prisma default-imports are eliminated.
- The 346-site unawaited-Promise defect class is fixed once and made lint-impossible.
- ADR-0011/ADR-0012 repair work starts from a working auth substrate and a written
  convention instead of re-deciding structure per file.
- ADR-0004 gets a single function body to change; ADR-0025 gets a single file to delete.
- The 26 admin-settings/FAQ routes that today can never authenticate become functional
  (they will finally enforce *real* auth — see Risks).
- Five-way import drift cannot silently return.

### Negative

- Wide mechanical diff (~330 files) lands in one window; noisy `git blame` for a while.
- A temporary re-export of `normalizeUserId` from the barrel keeps legacy names alive
  until Phase 3 completes — a window where new code could still import it (mitigated by
  the ESLint restriction applying to *new* usage immediately).
- Deferred subsystems (documentation management, community, Discord) get their imports
  fixed but not their schema-mismatch bugs — they will compile yet still be broken until
  their own ADRs execute; this must not be mistaken for "working".
- `requireAdmin()` intentionally ships with today's over-broad semantics; anyone reading
  the helper before ADR-0004 lands might assume the semantics are endorsed. A `TODO(ADR-0004)`
  comment marks it.

## Implementation Plan

Phase 1 — Canonical module (S)
1. Add `src/lib/auth/session.ts` (`getAuthenticatedUser`, `requireSession`,
   `requireAdmin`, `ApiError`) and `src/lib/api/respond.ts` (`jsonError`, `handleApiError`).
2. Expand `src/lib/auth/index.ts` exports as above.
3. Retarget the single `@/lib/auth/auth-options` importer to `@/lib/auth`; delete
   `src/lib/auth/auth-options.ts`.

Phase 2 — Import codemod (M) — mechanical rewrites, verified by `tsc`:
1. `from '@/lib/auth/utils'` → `from '@/lib/auth'` (26 files).
2. `from '@/lib/auth-utils'` → `from '@/lib/auth'` (12 files).
3. `normalizeUserId` import in the 19 `api/admin/settings/**` files: `'@/lib/utils'` →
   `'@/lib/auth'` (leave their `cn` imports untouched).
4. `authOptions` from `'@/app/api/auth/[...nextauth]/route'` → `'@/lib/auth'` (26 files).
5. `authOptions` from `'@/lib/auth/config'` → `'@/lib/auth'` (163 files).
6. `import prisma from '@/lib/prisma'` → `import { prisma } from '@/lib/prisma'` (12 files).

Phase 3 — Await/session repair (L)
1. Codemod `= normalizeUserId(` → `= await normalizeUserId(` across `src/app/api`
   (63 sites in `api/admin/help/**`, ~283 elsewhere); hand-review the diff for the few
   non-assignment usages.
2. Replace the 25 no-arg `getServerSession()` calls with `requireSession()` /
   `getAuthenticatedUser()`.
3. Enable `no-floating-promises` / `no-misused-promises` for `src/app/api/**` and add
   the `no-restricted-imports` rules; fix any stragglers the rules surface.

Phase 4 — Next 15 async params (M)
1. Run `npx @next/codemod@latest next-async-request-api ./src` to convert the 40 legacy
   dynamic routes to `params: Promise<...>` + `await`.
2. Spot-check the 27 already-migrated files and any `searchParams`/`cookies()` fallout;
   `next build` is the gate.

Phase 5 — Conventions adoption in repair tracks (M, runs with ADR-0011/0012)
1. Write `docs/api-conventions.md` (handler order, zod, envelope, examples).
2. Rewrite the support (`api/support/**`, `api/admin/support/**`) and admin RBAC
   (`api/admin/users|roles|permissions|...`) routes to the template — including closing
   the unauthenticated ticket-access hole via `requireSession()` (details in ADR-0011).
3. Deferred subsystems receive Phases 2–4 only (compile fixes); no behavioral work
   (per ADR-0013/0014/0015; files slated for deletion under ADR-0024 may be deleted
   instead of fixed — deletion satisfies this ADR).

Phase 6 — Follow-up hook (S)
1. `TODO(ADR-0004)` in `requireAdmin()`; `TODO(ADR-0025)` in `demo-user.ts`; remove the
   temporary `normalizeUserId` barrel re-export once `grep` shows zero route-level imports.

Sequencing note: Phases 1–4 are pure compile/runtime repairs and can land immediately.
Nothing here depends on the Prisma schema being fixed, but the *routes* only become
end-to-end functional once ADR-0002 restores `prisma generate` — land ADR-0002 in the
same release train.

## Risks and Mitigations

- **Blanket `await` insertion changes evaluation order.** The dominant pattern is a
  simple assignment immediately before a Prisma call, so risk is low; mitigate with
  `tsc`, the lint rules, and diff review rather than trusting the codemod blindly.
- **Routes that were dead now come alive.** The 26 admin-settings/FAQ routes currently
  401 unconditionally (undefined `authOptions`); after repair they will execute real
  logic for the first time, including any latent schema mismatches. Mitigate: these
  subsystems are behind the ADR-0012/ADR-0016 repair tracks; smoke-test after Phase 3.
- **Compiling ≠ working for deferred code.** Fixed imports make documentation/community
  routes buildable while their Prisma models remain absent (ADR-0002) — hitting them
  throws. Mitigate: feature-flag guards return 404 at handler entry (ADR-0013/0014)
  before any Prisma access.
- **Helper becomes a dumping ground.** Scope discipline: `session.ts` handles
  authentication + id normalization only; authorization semantics live in ADR-0004;
  rate limiting/headers in ADR-0005.
- **163-file `authOptions` path rewrite regressions.** Both old and new paths export the
  identical object during migration, so the rewrite is behavior-neutral; `tsc` + build
  gate it.
- **Convention drift in future generated code.** The ESLint restrictions + a route
  template in `docs/api-conventions.md` give code generators a concrete pattern to copy;
  CI (ADR-0021) blocks violations rather than relying on review vigilance.

## Related ADRs

- **ADR-0001: Record Architecture Decisions** — process this record follows.
- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — hard dependency
  for the repaired routes to run (client generation is currently broken); this ADR fixes
  compile/await defects that persist even after ADR-0002.
- **ADR-0004: Platform Authorization Model and RBAC Enforcement** — will replace the body
  of `requireAdmin()` (workspace scoping, platform-admin role) introduced here.
- **ADR-0005: API Security Hardening** — consumes the error envelope (no internal leak)
  and the session-first convention; also owns the `Cache-Control` header fix for `/api/*`.
- **ADR-0011: Support Subsystem Remediation** / **ADR-0012: Admin Dashboard and RBAC
  Subsystem Remediation** — first adopters of the helpers and route template (Phase 5).
- **ADR-0013 / ADR-0014 / ADR-0015 (Community, Documentation Management, Discord
  deferrals)** — their files receive compile-only fixes here; feature flags gate runtime.
- **ADR-0021: Testing Strategy and Honest Quality Gates** / **ADR-0022: CI/CD Pipeline
  and Self-Hosted Docker Deployment** — host the lint/build gates that enforce this ADR.
- **ADR-0024: Codebase Hygiene** — deleting dead files (e.g. mock admin video routes)
  is an acceptable alternative to fixing their imports.
- **ADR-0025: Seeding Strategy and Explicit Demo Mode** — owns the eventual removal of
  `normalizeUserId` and the legacy demo-id mapping encapsulated here.
