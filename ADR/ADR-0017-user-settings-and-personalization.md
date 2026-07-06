# ADR-0017: User Settings, Personalization, and i18n Scope

- **Date:** 2026-07-02
- **Status:** Accepted — **Implemented 2026-07-06** (A2+B2+C2+D3+E4; Phase 4 app-wide `formatDate` sweep deferred as designed). *Promoted from Proposed on implementation + live verification.*
- **Deciders:** Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-06, commit `4eff35a`).** Phases 1–3 shipped and the
> backend was live-verified against an authenticated demo session. **Mounted the stack:**
> next-themes `ThemeProvider` + `SettingsProvider` in `providers.tsx`; the context now
> delegates theme *application* to next-themes' `setTheme` (DB stays authoritative, synced
> on load + save) and keeps `--font-scale`/`compact-mode` (real CSS added to `globals.css`);
> `chart-components.tsx`'s `useTheme()` resolves for free. **Settings page** rewritten onto
> `useSettings()` (schema-correct fields, `TIMEZONES` select, real 16×3 notification matrix +
> global/digest/DND, working Save; 2FA toggle + `showAvatars` removed). **PUT /api/user/settings**
> hardened with per-field value validation (enums, `isValidTimezone`, boolean checks → 400).
> **GDPR:** new `GET/PUT /api/user/profile` (name/image only), `GET|POST /api/user/export`
> (user-scoped, no password/2FA leakage), `DELETE /api/user/account` (bcrypt re-auth + typed
> `DELETE` confirm + sole-owner guard + solo-workspace pre-delete + honest P2003 + idempotent +
> `TODO(ADR-0019)` Stripe hook). **Profile page** shows real `createdAt`, no fabricated stats.
> **i18n** cut to `en` (static dictionaries only; runtime OpenAI MT removed; `translation-service`
> moved offline behind `scripts/i18n-generate.ts` + `i18n:generate`). **Deleted** the mock
> `/dashboard/workspace` switcher + its header entry. *Proven live:* profile PUT ignores `phone`
> (no column); settings validation rejects bad theme/timezone/non-boolean (400) and persists valid
> values; export returns 200 with **no** password field; the deletion guard chain returns
> 400→401→**409 SOLE_OWNER** (demo protected, nothing deleted). No schema change (by design).
> **Deferred here:** the Phase-4 incremental `formatDate` app-wide sweep; **2FA → ADR-0026**;
> **real workspace switching → ADR-0027** (both stubs filed). In-browser interactive render was
> not visually captured — the docker app hits a pre-existing `next-auth/react` webpack chunk quirk
> (documented since ADR-0006) and a host dev server was not viable in this environment; the pages
> are tsc-clean, serve server-side, and every API they call is proven.

## Context and Problem Statement

The user-personalization layer is built on both ends but disconnected in the middle. Verified against the code on 2026-07-02:

**The server side works.** `src/app/api/user/settings/route.ts` and `src/app/api/user/notification-preferences/route.ts` are real, DB-backed GET/PUT routes: they auto-create default rows on first GET, upsert on PUT, and filter request bodies through explicit field allow-lists (17 fields for `UserSettings`, 14 for `NotificationPreferences`). The notification route additionally validates the per-type channel structure (`{ email, push, inApp }` for 16 event types in `DEFAULT_PREFERENCES`) and `HH:mm` formats for `digestTime`/`dndStartTime`/`dndEndTime`. Both import `authOptions` from `@/lib/auth/config`, matching the ADR-0003 convention. The Prisma models (`UserSettings` at `prisma/schema.prisma:2454`, `NotificationPreferences` at `:2492`) are 1:1 with `User` with sensible defaults and `onDelete: Cascade`.

**The client integration layer exists but is mounted nowhere.** `src/contexts/settings-context.tsx` (296 lines) implements everything the UI needs: parallel fetch of both APIs on sign-in, `updateUserSettings`/`updateNotificationPreferences` PUT wrappers, `formatDate`/`formatTime`/`formatDateTime` helpers driven by user preferences via `src/lib/utils/date-time.ts` (date-fns, IANA timezone list, 10 date-fns locales), and an `applyTheme()` that toggles the `dark` class, a `--font-scale` CSS variable, and `compact-mode`/`sidebar-collapsed` classes. No file in the repository imports `SettingsProvider` or `useSettings`. `src/app/providers.tsx` mounts only `LocaleProvider → QueryClientProvider → SessionProvider`.

**The settings page is a façade.** `src/app/dashboard/settings/page.tsx` (458 lines) holds one hardcoded `useState` object and never calls any API. Its field names do not even match the schema (`profileVisibility` vs. schema `profileVisible`, `analyticsSharing` vs. `analyticsOptOut`, `showAvatars` has no schema field at all), and its timezone select offers values like `"UTC-5"` that are not the IANA names (`America/New_York`, …) the formatting layer and schema default (`"UTC"`) expect. The **Save Changes** button (line 451), the 2FA **Enable/Disable** button (line 354), **Export** (line 375), and **Delete** (line 386) have no `onClick` handlers — four dead controls presented as working features.

**Theme handling is split three ways.** `next-themes@^0.4.6` is a dependency and `tailwind.config` uses `darkMode: ["class"]`, but no `ThemeProvider` is mounted anywhere; `src/components/dashboard/analytics/chart-components.tsx` calls `useTheme()` from next-themes and therefore always sees an undefined theme today. Meanwhile `settings-context.tsx` implements its own theme application that is never mounted, and `src/app/globals.css` defines **no** rules for `--font-scale` or `.compact-mode`, so two of its personalization hooks would be visually inert even if mounted.

**i18n over-declares.** `src/lib/i18n/config.ts` declares 11 locales (`en, es, fr, de, it, pt, ru, zh, ja, ko, ar`) and the mounted `LocaleProvider` + `LanguageSelector` (used on the settings page) let users pick any of them, persisting to `localStorage` only. But `src/lib/i18n/dictionaries/` contains only `en.json`; `get-dictionary.ts` handles every other locale by machine-translating the English dictionary **at runtime through the OpenAI API** (`translation-service.ts`), silently serving untranslated English when `OPENAI_API_KEY` is unset. `src/lib/utils/date-time.ts`'s `LOCALE_MAP` covers 10 locales and omits `ar` entirely. Language is additionally stored in three places: `UserSettings.language`, `User.locale` (schema line ~152), and `localStorage['sociallyhub-locale']` — with no synchronization.

**2FA is schema-only.** `User.twoFactorEnabled Boolean @default(false)` exists (`prisma/schema.prisma:150`), but there is no TOTP secret storage, no backup codes, no enrollment or challenge flow, and no data export or account deletion endpoint anywhere under `/api/user/`.

**Two sibling façade pages hang off the same user menu.** The header dropdown (`src/components/layout/header.tsx:159,165`) links "Profile" and "Switch Workspace" alongside the Settings entry this ADR rewrites. `/dashboard/profile` (`src/app/dashboard/profile/page.tsx`) renders an edit form whose submit handler is a `// TODO: Implement profile update logic` no-op (line 28) — a dead Save identical in kind to the settings page's four — plus a fabricated "Account Statistics" card (12 connected accounts, 248 posts, 1.2K engagement), a hardcoded "Free Plan" badge, and "Member since Dec 2023"; its `phone`/`company`/`location`/`bio` inputs have no `User` columns behind them (the model has only `name`/`image`/`email`). `/dashboard/workspace` (`src/app/dashboard/workspace/page.tsx`) renders a hardcoded `mockWorkspaces` array (lines 23–45) whose "Switch" button only mutates local component state (`// TODO: Implement actual workspace switching logic`, line 68) and whose "Create Workspace" dialog persists nothing. Neither page appears in ADR-0024's deletion inventory (which covers `/dashboard/customers` and `/dashboard/showcase`) or in any other ADR — without a decision here they would survive all 25 ADRs as user-facing fabricated UI.

We must decide how to connect this stack, which of the dead controls to implement now versus defer, what i18n surface we can honestly ship, and what to do with the two façade pages sharing the settings menu.

## Decision Drivers

- **Dead UI erodes trust**: four non-functional buttons on the settings page — plus a dead profile Save and a mock workspace switcher one menu entry away — contradict the product's "production ready" claim; this is the same honesty principle driving ADR-0013/0014/0016.
- **The expensive parts are already built**: two solid API routes, two clean models, and a complete provider — the remaining work is wiring, not architecture.
- **GDPR exposure is now real**: Stripe billing is in scope (ADR-0019, Accepted), so we will hold paying customers' data; data export (Art. 15/20) and account deletion (Art. 17) move from nice-to-have to obligation.
- **Avoid theme flash and split-brain theming**: `next-themes` exists precisely to solve SSR dark-mode flash; a second hand-rolled theme engine competing with it is a bug factory.
- **Single source of truth**: language/timezone currently live in three and two places respectively.
- **Runtime machine translation is not localization**: per-session OpenAI translation is nondeterministic, unreviewed, adds latency and token cost, and silently degrades to English.
- **Schema changes are constrained**: `prisma generate`/`db push` are currently broken (ADR-0002); anything requiring new columns must ride the ADR-0002 remediation.

## Considered Options

### A. Wiring approach

1. **Mount `SettingsProvider` as-is and let its `applyTheme()` own theming (drop next-themes).**
   Pro: zero refactoring of the context. Con: re-implements what next-themes already does, poorly — no SSR script injection, so every hard navigation flashes the wrong theme before the client fetch of `/api/user/settings` resolves; leaves `chart-components.tsx`'s existing `useTheme()` call broken; duplicates the `prefers-color-scheme` listener next-themes ships.

2. **Mount `SettingsProvider` for data/formatting, delegate theme application to a mounted next-themes `ThemeProvider`; rewrite the settings page onto `useSettings()`.** *(Chosen)*
   Pro: each library does what it is good at — next-themes handles class toggling, system-preference tracking, and no-flash SSR (`attribute="class"` matches `darkMode: ["class"]`); `SettingsProvider` remains the single client cache of DB-backed preferences and the app-wide date/time formatter; `chart-components.tsx` starts working with no changes. Con: `theme` is stored twice (DB + next-themes' localStorage) and must be synced on login and on save — a small, well-understood reconciliation.

3. **Delete `settings-context.tsx`; rebuild the page on React Query hooks against the APIs.**
   Pro: React Query (already mounted) gives caching/invalidation for free. Con: throws away working code including the formatting helpers that must be consumed app-wide, not just on the settings page; a context is the right shape for "current user's preferences everywhere".

4. **Defer the whole personalization layer behind a feature flag and strip the settings page to a stub.**
   Rejected: unlike Community/Documentation (ADR-0013/0014), the backend here is finished and sound; deferral would discard near-complete work while leaving a core SaaS expectation (a working settings page) unmet.

### B. 2FA scope

1. **Implement TOTP now.** Requires encrypted secret storage (ADR-0006 envelope), backup codes, enrollment QR flow, NextAuth credentials-flow changes, and recovery UX — a multi-week security-sensitive feature.
2. **Defer to a follow-up ADR; remove the dead toggle now.** *(Chosen)* — half-shipped 2FA is worse than none; a dead "Enable" button is worse than either.

### C. Data export and account deletion

1. **Defer alongside 2FA.** Rejected: GDPR obligations attach as soon as ADR-0019 billing takes real customers, and the buttons already exist in the UI.
2. **Implement both now.** *(Chosen)* — export is a bounded JSON-assembly task over user-owned rows; deletion is mostly `onDelete: Cascade` plus guard rails (sole-owner workspaces, Stripe cancellation).

### D. i18n scope

1. **Commit to en + 1–2 reviewed locales now.** Requires a translator/review loop we do not have; picking which locales is a market decision not yet made.
2. **Keep the 11-locale picker with runtime OpenAI translation.** Rejected: unreviewed MT presented as product localization, per-session latency/cost, silent English fallback, and `ar` would render with a `dir="rtl"` document but English strings and no `ar` date-locale.
3. **Honestly cut the picker to `en` and keep the infrastructure; re-enable locales only when reviewed static dictionaries exist.** *(Chosen)* — the `translation-service.ts` machinery is repurposed as an offline dictionary-generation script (generate → human review → commit `xx.json`), giving a cheap, honest path back to option 1 later.

### E. Sibling façade pages (`/dashboard/profile`, `/dashboard/workspace`)

1. **Leave both to a future hygiene pass.** Rejected: no other ADR claims them, so they would ship as the last user-facing fabricated UI after the whole ADR set executes.
2. **Wire both now.** Rejected for workspace: real switching requires a session-scoped active-workspace concept that exists nowhere today — every route resolves "the" workspace via its own `userWorkspace.findFirst` (even `GET /api/user/workspace` just returns the first membership), a pattern ADR-0004 is centralizing — so a working switcher is a cross-cutting ADR-0004-scale design, not a wiring task.
3. **Remove both.** Rejected for profile: a profile page is a core account expectation, and the fix is small wiring — `User.name`/`image` already exist and a `PUT /api/user/profile` follows the exact pattern of the settings route ("the expensive parts are already built").
4. **Wire `/dashboard/profile`; remove `/dashboard/workspace` and defer switching to a follow-up ADR.** *(Chosen)* — same logic as B2: a mock switcher is worse than none, and a dead Save is worse than either.

## Decision Outcome

**Chosen: A2 + B2 + C2 + D3 + E4.**

1. **Mount the stack**: `SettingsProvider` goes into `src/app/providers.tsx` *inside* `SessionProvider` (it calls `useSession`); a next-themes `ThemeProvider attribute="class" defaultTheme="system" enableSystem` wraps the tree. `settings-context.tsx`'s `applyTheme()` is reduced to: call next-themes' `setTheme(userSettings.theme)` and apply the non-theme hooks (`--font-scale`, `compact-mode`), whose CSS rules are added to `globals.css`. DB is the source of truth for the theme *preference*; next-themes owns *application*.
2. **Rewrite `/dashboard/settings`** onto `useSettings()`: state initialized from `userSettings`/`notificationPreferences`, field names corrected to schema names (`profileVisible`, `analyticsOptOut`), timezone select fed from `TIMEZONES` in `src/lib/utils/date-time.ts`, Save wired to `updateUserSettings`, and a real per-event-type notification matrix (16 types × 3 channels) wired to `updateNotificationPreferences`. Remove the `showAvatars` toggle (no backing field) rather than adding a column while ADR-0002 is in flight.
3. **Harden the settings PUT**: add per-field value validation (enum allow-lists for `theme`, `fontScale`, `dateFormat`, `timeFormat`, `weekStartDay`, `defaultView`, `colorScheme`; `isValidTimezone()` for `timezone`; boolean type checks) per ADR-0005. Today the allow-list filters keys but accepts any value.
4. **Implement data export and account deletion**; **remove the 2FA toggle** and defer 2FA to a follow-up ADR (`User.twoFactorEnabled` stays dormant).
5. **Cut the locale picker to `en`**; move machine translation out of the request path; make `UserSettings.language` the authoritative language store for authenticated users (localStorage is a pre-auth hint only). `User.locale`/`User.timezone` are declared deprecated in favor of `UserSettings`; the column removal itself is batched into ADR-0002's migration work.
6. **Notification preferences become a contract**: ADR-0010's delivery pipeline MUST consult `NotificationPreferences` (per-type channels, global toggles, DND window, digest settings) before dispatching. This ADR owns the preference data and UI; ADR-0010 owns enforcement at send time.
7. **Wire `/dashboard/profile`**: add `GET`/`PUT /api/user/profile` (`src/app/api/user/profile/route.ts`) updating `User.name`/`User.image` via the ADR-0003 helper conventions, and connect the page's save handler. The `phone`/`company`/`location`/`bio` inputs are removed (no backing columns — same no-new-columns rule as `showAvatars`), email stays read-only (changing it re-triggers verification; out of scope here), and the fabricated "Account Statistics" card, "Free Plan" badge, and hardcoded "Member since Dec 2023" are replaced with real data (`User.createdAt`) or dropped (plan display belongs to ADR-0019).
8. **Remove `/dashboard/workspace`**: delete the page and its "Switch Workspace" entry in the header menu under ADR-0024's verified-deletion procedure; real workspace switching (a session-scoped active workspace built on ADR-0004's helpers) is deferred to a follow-up ADR, so the page cannot ship as mock in the interim.

## Consequences

### Positive

- User preferences actually persist and take effect; four dead buttons become two working features (export, delete), one honest removal (2FA until its ADR), and one working Save.
- The user menu stops lying end to end: the profile Save actually persists `name`/`image`, and the mock workspace switcher is gone — no user-facing fabricated UI survives this ADR plus ADR-0024.
- One theme engine with no SSR flash; `chart-components.tsx`'s existing `useTheme()` call starts returning real values.
- Dates and times across the dashboard can render in the user's timezone/format via `useSettings().formatDate(...)` — infrastructure that every reporting surface (ADR-0020) can reuse.
- GDPR posture matches the billing reality of ADR-0019.
- The language picker no longer promises 11 locales we cannot deliver; the path to real localization (offline-generated, reviewed dictionaries) is documented, not improvised.

### Negative

- Theme preference lives in two stores (DB + next-themes localStorage) and needs explicit sync on login and save; a logged-out device won't know the user's DB theme until after authentication.
- Cutting the picker to `en` is a visible feature retraction (the selector currently advertises 11 languages).
- Account deletion with `onDelete: Cascade` across 146 models is irreversible and must be carefully guarded; a mistake destroys real customer data.
- Adopting `formatDate`/`formatTime` across existing dashboard components is a long tail of small edits (done incrementally, not big-bang).
- 2FA remains unavailable, a gap for security-conscious customers until the follow-up ADR ships.
- Workspace switching disappears from the UI entirely; users with multiple `UserWorkspace` memberships must wait for the follow-up ADR (no capability is actually lost — today's page only pretended to switch).

## Implementation Plan

### Phase 1 — Mount and wire (this sprint)

1. **(S)** `src/app/providers.tsx`: add next-themes `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) and mount `SettingsProvider` inside `SessionProvider`.
2. **(M)** `src/contexts/settings-context.tsx`: replace manual `dark`-class logic and the `prefers-color-scheme` listener with `useTheme().setTheme(userSettings.theme)`; keep `--font-scale`/`compact-mode` application; sync next-themes on settings load and on `updateUserSettings` when `theme` changes.
3. **(S)** `src/app/globals.css`: add `--font-scale` consumption (e.g. `html { font-size: calc(1rem * var(--font-scale, 1)) }`) and `.compact-mode` density rules so the hooks are not inert.
4. **(L)** Rewrite `src/app/dashboard/settings/page.tsx` onto `useSettings()`: schema-correct field names, `TIMEZONES`-driven timezone select, wired Save with `saving` state and toast feedback, notification matrix (16 types × email/push/inApp) plus global/digest/DND controls against `updateNotificationPreferences`. Remove the 2FA toggle and `showAvatars`.
5. **(S)** `src/app/api/user/settings/route.ts`: add per-field value validation (enums, `isValidTimezone`, booleans) returning 400 on bad values (ADR-0005).
6. **(M)** Wire `/dashboard/profile`: add `GET`/`PUT /api/user/profile` (`src/app/api/user/profile/route.ts`) — GET returns `name`/`image`/`email`/`createdAt`; PUT updates `User.name`/`User.image` only, following the ADR-0003 conventions (`authOptions` from `@/lib/auth/config`, `normalizeUserId`) with ADR-0005 value validation — and connect the page's save handler. Remove the `phone`/`company`/`location`/`bio` inputs, the "Account Statistics" card, and the "Free Plan" badge; render "Member since" from the real `User.createdAt` via `formatDate`.
7. **(S)** Delete `src/app/dashboard/workspace/` and remove the "Switch Workspace" item from `src/components/layout/header.tsx` (line 165), following ADR-0024's re-verify-then-delete procedure; file the follow-up ADR stub ("Workspace switching: session-scoped active workspace on ADR-0004's helpers") in the ADR index.

### Phase 2 — GDPR endpoints (next)

8. **(M)** `POST /api/user/export` (`src/app/api/user/export/route.ts`): assemble a JSON bundle of the user's `User`, `UserSettings`, `NotificationPreferences`, workspace memberships, and user-authored content references; return as a download. Wire the Export button.
9. **(M)** `DELETE /api/user/account` (`src/app/api/user/account/route.ts`): require password re-authentication and a typed confirmation phrase; **block** if the user is the sole `OWNER` of any workspace that has other members (ADR-0004 semantics — transfer ownership first); cancel any Stripe customer/subscription via ADR-0019's billing service before deleting; then delete the `User` row and let `onDelete: Cascade` handle 1:1 rows. Wire the Delete button behind a destructive-confirm dialog.
10. **(S)** Remove the 2FA UI block; file the follow-up ADR stub ("2FA: TOTP enrollment, backup codes, encrypted secret storage per ADR-0006") in the ADR index.

### Phase 3 — Honest i18n (with Phase 2)

11. **(S)** `src/lib/i18n/config.ts`: export `enabledLocales = ['en']` and have `LanguageSelector`/`LocaleProvider` validate against it (keep the full `locales` list and `localeNames` for future re-enablement).
12. **(M)** `src/lib/i18n/get-dictionary.ts`: serve only static dictionaries; delete the runtime `translationService.translateDictionary` call from the request path. Move `translation-service.ts` behind an offline npm script (`i18n:generate`) that produces `dictionaries/xx.json` drafts for human review.
13. **(M)** Language source of truth: on auth, `LocaleProvider` (or a thin bridge in `SettingsProvider`) hydrates locale from `UserSettings.language`; `LanguageSelector` writes through `updateUserSettings({ language })`; localStorage remains only the pre-auth hint. Document `User.locale`/`User.timezone` as deprecated; schedule column removal in ADR-0002's migration batch. Add `ar` to `LOCALE_MAP` in `src/lib/utils/date-time.ts` when/if `ar` is ever enabled.

### Phase 4 — Apply preferences app-wide (incremental)

14. **(L, incremental)** Replace ad-hoc `toLocaleDateString()`/`new Date(...)` rendering in dashboard surfaces (calendar, posts, analytics, client reports) with `useSettings().formatDate/formatTime/formatDateTime`, starting with the highest-traffic pages.
15. **(M)** Tests per ADR-0021: route tests for PUT validation (bad enum, bad timezone, bad `HH:mm`) and profile PUT scope (only `name`/`image` accepted), deletion guard tests (sole-owner block, Stripe cancellation called), and an e2e that saves a theme + timezone and asserts persistence across reload.

## Risks and Mitigations

- **Theme double-store drift** (DB says dark, device localStorage says light): treat DB as authoritative post-login — `SettingsProvider` calls `setTheme` from fetched settings on every session start; next-themes' value is only a pre-hydration hint.
- **Stale Prisma client / broken `prisma generate`** (ADR-0002): Phases 1–3 need **no schema changes** by design (the `showAvatars` field is dropped from UI instead of added to schema; `User.locale` removal is deferred). Only the ADR-0002 batch touches the schema.
- **Catastrophic deletion**: re-auth + typed confirmation + sole-owner block + a 30-day soft-delete option considered and rejected for v1 (adds state complexity); mitigated instead by ADR-0022's database backup requirement. Deletion endpoint is covered by mandatory tests before the button ships.
- **Export leaking cross-tenant data**: export queries filter strictly by `userId` and include workspace *membership* records, never other members' data; reviewed against ADR-0004's authorization model.
- **Notification preferences ignored by senders**: enforcement lives in ADR-0010; until that lands, the UI must label digest/DND controls as "applies when notification delivery ships" or the settings become another false promise. Coordinate landing order with ADR-0010.
- **Locale retraction surprising existing users**: users with a non-`en` localStorage locale are silently mapped to `en` by the `enabledLocales` validation — acceptable because those locales only ever showed MT-or-English anyway.
- **"Switch Workspace" removal surprising multi-workspace users**: acceptable because the page never switched anything (local state, reset on reload); the follow-up ADR stub is filed in the same phase so the capability has an owner.

## Related ADRs

- **ADR-0002: Prisma Schema Remediation and Migration-First Workflow** — schema is currently invalid; `User.locale`/`User.timezone` deprecation and removal ride its migration batch; this ADR deliberately requires no schema change before then.
- **ADR-0003: Auth Helper Consolidation and API Route Conventions** — both user-settings routes already follow the `@/lib/auth/config` convention; new profile/export/deletion routes must too.
- **ADR-0004: Platform Authorization Model and RBAC Enforcement** — sole-owner deletion guard and export scoping semantics; the deferred workspace-switching follow-up ADR must build its session-scoped active workspace on ADR-0004's helpers.
- **ADR-0005: API Security Hardening** — value-level validation added to `PUT /api/user/settings`; re-auth requirement on account deletion.
- **ADR-0006: Cryptography, Token Encryption, and Secrets Management** — prerequisite for the deferred 2FA follow-up ADR (TOTP secret storage).
- **ADR-0010: Realtime Transport and Notification Delivery** — consumes `NotificationPreferences` as its send-time contract (channels, DND, digests).
- **ADR-0016: System Settings & Configuration: Real Operations over Simulations** — sibling decision covering the admin/system settings layer; this ADR covers the user layer.
- **ADR-0019: Billing and Subscriptions with Stripe** — triggers the GDPR obligations behind export/deletion; deletion must cancel Stripe subscriptions.
- **ADR-0021: Testing Strategy and Honest Quality Gates** — required tests for validation, deletion guards, and settings persistence.
- **ADR-0024: Codebase Hygiene** — removal of the dead 2FA toggle and the runtime-MT request path aligns with its dead-code policy; the `/dashboard/workspace` deletion (with its header nav entry) extends its Phase 2 route+nav removal inventory, which covers `/dashboard/customers` and `/dashboard/showcase` but predates these two pages being flagged.
