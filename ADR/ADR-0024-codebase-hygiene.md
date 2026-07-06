# ADR-0024: Codebase Hygiene: Dead Code, Duplicates, and Repo Cleanup

- Date: 2026-07-02
- Status: Accepted — **Implemented 2026-07-06** (all 7 phases; Phase 5 had already landed via ADR-0016)
- Deciders: Hennadii Shvedko (owner), Claude (architect)

> **Implementation note (2026-07-06, commit `f16f63c`).** All phases executed with the
> mandatory re-verify-then-delete procedure; no surprise importers found. **Deleted:** every
> Phase-1 dead file (incl. `lazy-components` + its 6 dead component dependents), the showcase/
> customers/about pages + nav entries, the fake API-versioning layer, the schema-broken mock
> admin video suite (13 routes + page + components; public `/api/video-tutorials` intact), the
> mock FAQ auto-generate endpoint + panel, committed `logs/` (now gitignored + untracked), and
> two knip-confirmed orphans (`material-design-showcase`, syntax-broken `performance-dashboard`).
> **Honesty repairs:** FAQ analytics fabricated blocks stripped; help search now actually sorts
> by its computed `relevanceScore`; dead `puppeteer` import removed. **Config:** single
> `next.config.js` (Docker watch-polling merged in, guarded); compose now bind-mounts
> `package.json`/lock so container installs see the current manifest. **Docs:** README
> 2,722→125, TODO.md reconciled with per-ADR pointers, TODO_HELP_DASHBOARD → 35-line pointer.
> **Gate:** `knip.config.ts` + `npm run knip` (honest 33-unused-file baseline, non-blocking for
> one sprint; CI wiring in ADR-0022).
>
> **The headline: `next build` completes (EXIT=0, 241 pages) for the FIRST TIME in the repo's
> recorded history** — five deferred documentation routes carried duplicate `export POST`
> declarations (parse errors), so no prior tree could ever have compiled. Getting there
> surfaced and fixed, beyond the audit's list: 6 more undeclared live-surface deps
> (`remark-breaks`, `rehype-highlight`, `rehype-raw`, `@dnd-kit/modifiers`,
> `react-syntax-highlighter`, `cmdk`) + 2 missing shadcn components (`ui/alert-dialog`,
> `ui/table`); 2 community-route identifier typos; an invalid `GET_TEMPLATES` route export;
> `withApiAuth`'s optional context param (rejected by Next 15.5 route validators — fixed for
> all 7 wrapped dynamic routes); and 5 pages calling `useSearchParams()` without the Suspense
> boundary Next 15 requires for prerender. `eslint`/`typescript` checks inside the build are
> deferred to their own CI stages with loud comments (pre-existing ~1.4k-lint / ~1.1k
> deferred-subsystem-type backlogs would make the gate permanently red; module resolution +
> compilation — the class that caught the `sonner` incident — is fully enforced).

## Context and Problem Statement

The 2026-07-02 audit confirmed that the repository carries a significant amount of dead,
duplicated, and misleading code and documentation. None of it is exercised by the running
product, but all of it costs us: it inflates review surface, confuses new contributors, makes
audits slower, advertises endpoints and features that do not exist, and in several cases
actively contradicts our own configuration (two Next.js configs where one is silently ignored).

Every item below was re-verified against the working tree on 2026-07-02 before being listed.

**Leftover files and demo pages (verified present):**

- `src/app/page.tsx.backup` (20 KB) and `src/app/simple.tsx` — two abandoned landing-page
  variants sitting next to the live 717-line `src/app/page.tsx`.
- `src/app/test/page.tsx` — a Tailwind/shadcn styling scratch page, publicly routable at `/test`.
- `src/app/dashboard/showcase/page.tsx` — a Material-Design component demo mounted in the
  production navigation (`src/components/layout/sidebar.tsx:46` and
  `src/components/layout/mobile-navigation.tsx:49` both link "Material Showcase").
- `src/app/api/debug/session/route.ts` — a debug endpoint that dumps session and workspace
  state to any authenticated caller.
- `src/app/dashboard/customers/page.tsx` — a wholesale duplicate of `/dashboard/clients`: it
  mounts the identical `ClientDashboard` component from
  `src/components/dashboard/clients/client-dashboard.tsx` behind a second route.
- `src/app/about/page.tsx` — a marketing page with a fictional team (e.g. a "CTO & Co-Founder"
  bio reading "Ex-Facebook engineer… PhD in Computer Science from MIT") and an invented company
  timeline including a Series A. Publishing invented people and funding events is a
  reputational/legal liability.

**A fake API-versioning layer that advertises nonexistent endpoints (verified):**

- `src/app/api/posts/v1/route.ts` and `src/app/api/posts/v2/route.ts` return hardcoded mock
  post arrays ("Hello from v1 API!").
- Their shared wrapper `src/middleware/api-versioning.ts` is imported by exactly three files:
  the two mock routes above and `src/app/api/version/route.ts` (`getVersionInfo`).
- `/api/version` advertises `/api/docs`, `/api/workspaces/*`, and `/api/webhooks/*` — none of
  these route directories exist under `src/app/api/` — plus fictitious rate-limit tiers.
- Downstream, `src/components/api-docs/` (`api-explorer.tsx`, `webhook-documentation.tsx`,
  `api-versioning.tsx`, `code-examples.tsx`) has zero imports from any page, and
  `src/lib/api-docs/` is imported only by the files being removed here.

**A schema-mismatched, mock-riddled admin video suite that no ADR owns (verified):**

- All 13 route files under `src/app/api/admin/help/videos/**` (videos root and `[id]`,
  playlists and `playlists/[id]`, upload, chapters, transcripts, thumbnails, analytics, seo,
  embed, access, integrations) are broken against the real schema: they call
  `prisma.videoChapter` (no `VideoChapter` model exists) and filter/include `VideoTutorial`
  fields the model does not have (`workspaceId`, `analytics`, `chapters`, `playlist`,
  `status` — see `prisma/schema.prisma:2804`).
- Their analytics, thumbnails, chapters, transcripts, integrations, and access-token/QR
  features are explicitly mock (`generateMockTimeSeriesData`, `generateMockDropoffData`,
  `generateMockHeatmapData`, "mock implementation" comments throughout).
- Consumers: one mounted but nav-unlinked page, `src/app/dashboard/admin/help/videos/page.tsx`
  (fetches `/api/admin/help/videos` and `.../[id]`; no navigation component links it), and two
  zero-import components, `src/components/admin/help/videos/VideoUploader.tsx` and
  `VideoPlayer.tsx`. Note: the audit shorthand called the consumers "unmounted components" —
  the page is a mounted App Router route, so it must delete together with the API.
- No ADR repairs, defers, or flag-gates this suite. ADR-0003 only fixes its 12 broken
  `@/lib/auth-utils` imports and 12 prisma default-imports — which would make dead-broken
  code compile and reachable — and its Related-ADRs note names deletion under this ADR as the
  acceptable alternative. The public `/api/video-tutorials/**` routes are unaffected: they
  work against the real `VideoTutorial`/`VideoPlaylist`/`VideoUserProgress` models.

**Mock and defective leaves in the live Help Center admin layer (verified):**

- `POST /api/admin/help/faqs/auto-generate` returns a hardcoded list of "support ticket
  patterns" (`ticketPatterns`, route.ts:38) instead of analyzing real tickets — and it has a
  mounted consumer (`FAQAutoGeneration`, rendered by
  `src/app/dashboard/admin/help/faqs/page.tsx:512`).
- The FAQ analytics route fabricates its trend and search-frequency blocks
  (`src/app/api/admin/help/faqs/analytics/route.ts:144` — `Math.random()` views trend;
  line 178 — hardcoded `searchFrequency`), interleaved with real aggregates.
- `/api/help/search` computes a `relevanceScore` per result (route.ts:228, 307) but never
  sorts by it: its "relevance" order is a DB proxy (`helpfulVotes`/`views`/`publishedAt`),
  so results are not actually ranked by relevance even though the UI offers a relevance sort.
  The documentation search already does this correctly
  (`src/app/api/documentation/search/route.ts:202`).
- The Help Center is explicitly **not** deferred (ADR-0014 keeps `/api/help/**` live), and
  ADR-0005 only adds auth, caching, and counter dedup to these routes — so absent this ADR,
  fabricated FAQ suggestions/analytics and a broken search ranking ship in the product's
  flagship help surface with no remediation plan.

**Duplicate and dead modules (verified zero external imports each):**

- `src/components/dashboard/posts/post-composer.tsx` — a dead twin of the live composer.
  Note: the audit shorthand named the wrong twin; `src/components/posts/post-composer.tsx` is
  the **live** one, imported by `src/app/dashboard/posts/page.tsx:10`. The unreferenced
  duplicate is the one under `dashboard/posts/`.
- `src/lib/monitoring/alerts.ts` — zero imports (`src/app/api/monitoring/alerts/route.ts`
  queries Prisma directly and never imports this module).
- `src/lib/analytics/user-analytics.ts`, `src/lib/lazy-components.ts`,
  `src/lib/image-optimization.ts` — zero imports each (the only textual match for
  "image-optimization" elsewhere is a string label in `src/app/api/ai/images/optimize/route.ts`).
- `prisma/seed.js` — legacy CommonJS seed; `package.json` wires seeding exclusively to
  `"prisma": { "seed": "tsx prisma/seed.ts" }` and `db:seed` likewise.

**Dead dependencies and config duplication (verified):**

- `fastify@^5.5.0` and `@fastify/cors@^11.1.0` are declared in `package.json` dependencies but
  imported nowhere in `src/` — remnants of a never-built standalone realtime server
  (superseded by the transport decision in ADR-0010).
- Two Next.js configs coexist. Next.js resolves `next.config.js` first, so `next.config.ts`
  (whose only content is dev-mode webpack `watchOptions` polling for Docker hot reload) is
  silently ignored. Meanwhile the active `next.config.js` still sets `swcMinify: true`
  (removed in Next 15) and `experimental.turbo` (deprecated/relocated), and applies a blanket
  `Cache-Control: public, s-maxage=60` header to all `/api/(.*)` responses — a data-leak hazard
  for authenticated APIs that ADR-0005 addresses; the header removal lands with this merge.

**Dead schema surface (verified):**

- `model BrandingConfiguration` (`prisma/schema.prisma:5312`, `@@map("branding_configurations")`)
  plus its relation fields `Workspace.brandingConfiguration` (line 130) and
  `User.brandingConfigUpdates` (line 250) have **zero** references anywhere in `src/`. The live
  branding model is `ClientBranding` (schema line 2532), used by
  `src/app/api/admin/client-branding/route.ts`, `src/lib/utils/branding.ts`, and the client
  branding UI.

**Repo pollution (verified):**

- `logs/` is committed at the repo root with winston runtime output (`combined.log` and
  `http.log`, ~21 KB each, Sep 2025) and `.gitignore` contains no `logs` entry at all.

**Documentation sprawl (verified):**

- `STRUCTURES.md` (10 KB, Sep 2025) is a stale near-duplicate of `STRUCTURE.md` (60 KB,
  Oct 2025) with the same title and none of the Oct 2025 help/admin/RBAC additions.
- `TODO.md` marks items "pending" that are built (Help Center, Custom Dashboards) and items
  it never re-checked; `TODO_HELP_DASHBOARD.md` (89 KB) contradicts itself — its final priority
  list leaves unchecked the same three systems its own "Implementation Summary" sections mark
  ✅ COMPLETED, and it contains a "December 2024" date in an October 2025 file.
- `README.md` (124 KB, 2,722 lines) embeds a second roadmap and an "AI Implementation Plan"
  whose checklist is entirely unchecked even though the corresponding `/api/ai/*` routes exist;
  it also both claims and un-claims the same performance work in different sections.
- No dead-export tooling exists (`knip`, `ts-prune`, and `depcheck` are all absent from
  `package.json`), so nothing prevents this class of rot from re-accumulating.

The problem: **how do we remove this dead weight safely, resolve the documentation
contradictions, and keep the codebase clean going forward?**

## Decision Drivers

- Every dead file is audit and onboarding overhead; the recent subsystem audits repeatedly
  burned time disproving code that turned out to be unreachable.
- Misleading surface is worse than missing surface: `/api/version` advertising nonexistent
  endpoints, mock `posts/v1|v2`, a debug session dump, and fictional team bios are all
  externally visible.
- The invalid Prisma schema is being remediated under ADR-0002; dropping `BrandingConfiguration`
  must ride that migration-first workflow rather than a parallel one.
- Deployment now standardizes on self-hosted Docker (ADR-0022), so the Docker hot-reload
  polling currently trapped in the ignored `next.config.ts` genuinely matters and must survive
  the config merge.
- Cleanup must be cheap to review and easy to revert — git history is our archive.
- One-off cleanup without a CI guard decays; the fix must include a "no dead exports" gate.

## Considered Options

1. **Do nothing / rely on tree-shaking.** Bundlers already exclude unimported client code.
   But App Router files (`/test`, `/dashboard/showcase`, `/api/debug/session`, `posts/v1|v2`)
   are *routes* — they ship and are reachable regardless of imports; deps like `fastify`
   install on every build; and docs contradictions are untouched. Rejected.
2. **Quarantine to an `attic/` directory or archive branch.** Moves risk instead of removing
   it: the attic still bloats clones and search results, drifts instantly, and everything here
   is already preserved in git history. Rejected.
3. **Big-bang cleanup in a single PR.** One review, fast. But it mixes zero-risk file deletions
   with a schema migration, a dependency prune, a config merge, and doc rewrites — a revert of
   any one problem reverts everything, and the diff is unreviewable. Rejected.
4. **Phased, verified deletion batches + docs consolidation + a CI dead-export gate.**
   Order batches by blast radius (pure deletions → route/nav removals → config/deps → schema
   migration → docs), verify zero-imports at execution time for each item, and land `knip` in
   CI so the state is enforced, not aspirational. **Chosen.**

## Decision Outcome

**Option 4.** We delete (not quarantine) every verified-dead item listed above, in
blast-radius-ordered phases, with a fresh zero-import check immediately before each deletion
batch. Git history is the archive; nothing needs an attic.

Documentation consolidates as follows:

- **Canonical status** lives in the CLAUDE.md "Current State" section plus the ADR series.
  Historical changelog-style sections in CLAUDE.md are trimmed to match reality.
- **TODO.md is reconciled to reality**: built items (Help Center, Custom Dashboards) are marked
  done with pointers to code; genuinely open items (Client Portal → ADR-0020, Billing →
  ADR-0019, composer/inbox/chart work) remain, each cross-referenced to its owning ADR.
- **TODO_HELP_DASHBOARD.md contradictions are resolved** by making the implementation-summary
  sections authoritative: the final priority checklist is corrected (Support Ticket Console,
  Help Articles CMS, FAQ Management → checked), the stale "December 2024" note and
  "6 remaining systems" claim are fixed, and still-open Phase 3 / sections 8–9 items move into
  TODO.md so there is one open-work list.
- **README.md is slimmed** to overview + setup + links: the embedded roadmap, the stale AI
  implementation plan, and the self-contradicting performance sections are removed (open items
  fold into TODO.md; implemented claims defer to CLAUDE.md/ADRs).
- **STRUCTURES.md is deleted**; `STRUCTURE.md` remains the single structure map.
- `/about` fictional content is an **owner-flagged item**: rewrite with truthful content or
  remove the page; it must not ship as-is. Default if no copy is provided: remove the page and
  its links.

Finally, we adopt **knip** (preferred over ts-prune: it detects unused files, exports, *and*
dependencies, and understands Next.js App Router entrypoints) as a CI gate so dead exports,
unused files, and unused dependencies fail the build once the baseline is clean.

## Consequences

### Positive

- Smaller, honest surface: no mock API versions, no debug endpoints, no demo pages, no
  fictional marketing claims, no schema-broken admin video CMS, and no fabricated FAQ
  suggestions/analytics reachable in production; help search's relevance sort actually ranks
  by relevance.
- `next.config` becomes single-source: Next-15-invalid options gone, Docker polling actually
  applied, and the unsafe blanket `/api` cache header removed (with ADR-0005).
- ~2 fewer runtime dependencies (`fastify`, `@fastify/cors`) and one less schema model to carry
  through the ADR-0002 remediation.
- One roadmap (TODO.md), one structure doc (STRUCTURE.md), one status source (CLAUDE.md Current
  State + ADRs) — contributors stop reading contradictory instructions.
- knip in CI makes hygiene self-sustaining instead of a one-time event.

### Negative

- Git-history-only archival means resurrecting a deleted module requires a revert rather than a
  copy-paste; acceptable given everything deleted is verifiably unreferenced.
- The knip baseline will initially require an ignore list for intentionally-unmounted layers
  that other ADRs plan to wire up (AI components per ADR-0018, audience dashboards, BullMQ jobs
  per ADR-0008) — curation effort, and a risk of the ignore list itself rotting.
- Dropping `BrandingConfiguration` is irreversible once the migration runs in production
  (ADR-0002 workflow); if a future white-label feature wanted it, it must be re-designed
  (likely on top of `ClientBranding` anyway).
- README slimming loses some narrative implementation history (mitigated: it remains in git
  history and the ADRs).

## Implementation Plan

Each phase is a separate PR. Before deleting anything, re-run the zero-import check for that
item (`grep -rn "<module-path>" src/ --include="*.ts" --include="*.tsx"`); if a new importer
appeared since this ADR, stop and reassess that item only.

**Phase 1 — Pure dead-file deletions (S).** No behavior change possible:

- Delete `src/app/page.tsx.backup`, `src/app/simple.tsx`.
- Delete `src/app/test/` (page.tsx).
- Delete `src/app/api/debug/session/` (route.ts).
- Delete `prisma/seed.js` (seeding stays on `tsx prisma/seed.ts` per `package.json`).
- Delete dead lib modules: `src/lib/monitoring/alerts.ts`, `src/lib/analytics/user-analytics.ts`,
  `src/lib/lazy-components.ts`, `src/lib/image-optimization.ts`.
- Delete `src/components/dashboard/posts/post-composer.tsx` (dead twin; keep
  `src/components/posts/post-composer.tsx`, which `src/app/dashboard/posts/page.tsx` imports).
- Delete committed `logs/` contents; add `logs/` to `.gitignore` (currently absent).

**Phase 2 — Route + navigation removals (M).** Requires coordinated edits:

- Delete `src/app/dashboard/showcase/` and remove the "Material Showcase" entries from
  `src/components/layout/sidebar.tsx` (line 46) and
  `src/components/layout/mobile-navigation.tsx` (line 49).
- Delete `src/app/dashboard/customers/` (duplicate `ClientDashboard` mount; `/dashboard/clients`
  remains the canonical route). Verified: no nav component links to `/dashboard/customers`.
- Delete the fake versioning layer as one unit: `src/app/api/posts/v1/`, `src/app/api/posts/v2/`,
  `src/app/api/version/`, `src/middleware/api-versioning.ts`, `src/components/api-docs/` (all
  four components are unmounted), and `src/lib/api-docs/` (orphaned once the former are gone —
  re-verify zero imports at execution). If an ops need for a version endpoint emerges later,
  ADR-0023 owns a truthful `/api/health`-adjacent replacement.
- Delete the admin video suite as one unit: all 13 route files under
  `src/app/api/admin/help/videos/**`, the mounted-but-unlinked
  `src/app/dashboard/admin/help/videos/` page that consumes them, and the zero-import
  `src/components/admin/help/videos/` components — after re-verifying at execution time that
  no other consumer has appeared. Keep the public `/api/video-tutorials/**` routes, which
  work against the real `VideoTutorial`/`VideoPlaylist`/`VideoUserProgress` models. Deletion
  satisfies ADR-0003's import-fix obligation for these files (its stated alternative), and
  removes two of the `public/uploads` writers ADR-0007 catalogues (upload, thumbnails). Any
  future admin video CMS must be a new ADR written against the real schema.
- Delete (or reduce to 501) the mock FAQ auto-generate endpoint
  (`src/app/api/admin/help/faqs/auto-generate/route.ts`) and remove its mounted UI entry
  point (the `FAQAutoGeneration` panel in `src/app/dashboard/admin/help/faqs/page.tsx`);
  strip the mocked trend/search-frequency blocks from
  `src/app/api/admin/help/faqs/analytics/route.ts` (lines 144, 178), keeping the real
  aggregates, until real implementations exist — ADR-0016's no-fabricated-success principle
  applies.
- Fix `src/app/api/help/search/route.ts` to order results by the `relevanceScore` it already
  computes when `sortBy=relevance`, mirroring `src/app/api/documentation/search/route.ts:202`.
  (The one non-deletion item in this phase: the misleading surface here is a sort option that
  silently does not do what it advertises.)
- `/about` (owner-flagged): owner supplies truthful copy, or the page and its links are removed.

**Phase 3 — Config merge (S).**

- Merge `next.config.ts`'s dev-only webpack `watchOptions` polling into `next.config.js`
  (guarded by `dev`), then delete `next.config.ts`.
- In `next.config.js`: remove `swcMinify` and `experimental.turbo`; remove the blanket
  `Cache-Control: public, s-maxage=60` header on `/api/(.*)` (per ADR-0005).
- Validate with `npm run build` and a Docker dev-stack hot-reload smoke test (ADR-0022 stack).

**Phase 4 — Dependency prune (S).**

- Remove `fastify` and `@fastify/cors` from `package.json`; run install + build + test suite.

**Phase 5 — Schema drop (M, sequenced after ADR-0002's schema is valid).**

- Remove `model BrandingConfiguration` (schema line 5312) and the relation fields
  `Workspace.brandingConfiguration` (line 130) and `User.brandingConfigUpdates` (line 250);
  generate a real migration dropping `branding_configurations` via the ADR-0002
  migration-first workflow. `ClientBranding` is untouched.

**Phase 6 — Documentation consolidation (M).**

- Delete `STRUCTURES.md`.
- Reconcile `TODO.md` to code reality; move TODO_HELP_DASHBOARD's still-open items into it;
  fix TODO_HELP_DASHBOARD's contradictory checklists and dates (or collapse it to a short
  pointer document once TODO.md absorbs the open work).
- Slim `README.md`: keep overview/setup/commands; delete the embedded roadmap, stale AI plan,
  and contradictory performance sections; link to CLAUDE.md, TODO.md, and `ADR/`.
- Trim CLAUDE.md changelog sections that contradict the audit (e.g. "zero mock data").

**Phase 7 — Keep-it-clean gate (M).**

- Add `knip` as a devDependency with Next.js App Router entrypoint config; establish a clean
  baseline (explicit, commented ignore entries only for layers other ADRs will wire: AI/audience
  components per ADR-0018, jobs per ADR-0008, notifications per ADR-0010).
- Add a `knip` step to the ADR-0022 CI pipeline that fails on new unused files, exports, or
  dependencies. Review the ignore list quarterly.

## Risks and Mitigations

- **A "dead" module gains an importer between audit and deletion.** Mitigation: mandatory
  re-verification grep per item at execution time; phases are small and individually revertable.
- **Deleting `/api/version` or `posts/v1|v2` breaks an unknown external consumer.** Mitigation:
  these return hardcoded mock data, so no real integration can depend on them meaningfully;
  monitor 404s in access logs (ADR-0023) for one release cycle. The same reasoning covers the
  admin video suite: it is session-gated and schema-broken, so nothing real can consume it.
- **The admin video page or FAQ auto-generate panel outlives its API (or vice versa).**
  Mitigation: each is deleted as one unit in a single Phase 2 PR — routes together with the
  `dashboard/admin/help/videos` page and components, the auto-generate route together with
  the `FAQAutoGeneration` panel — so no mounted UI is left fetching 404s.
- **Config merge changes build behavior.** Mitigation: Phase 3 ships alone with build + Docker
  hot-reload verification; `swcMinify`/`experimental.turbo` are already no-ops or warnings on
  Next 15, so removal is inert.
- **`BrandingConfiguration` drop loses data.** Mitigation: table can only contain rows written
  outside the app (no code path writes it); migration runs through ADR-0002's reviewed,
  backup-first workflow (ADR-0022 backup scripts).
- **knip false positives block CI.** Mitigation: start as a non-blocking report for one sprint,
  then flip to blocking once the baseline and ignore list stabilize.
- **Docs consolidation erases context someone relies on.** Mitigation: deletions are moves into
  git history, and open work is transferred (not dropped) into TODO.md before removal.

## Related ADRs

- ADR-0002: Prisma Schema Remediation and Migration-First Workflow — owns the migration
  mechanics for dropping `BrandingConfiguration`; Phase 5 sequences after it.
- ADR-0003: Auth Helper Consolidation and API Route Conventions — deleting
  `src/app/api/admin/help/videos/**` in Phase 2 satisfies its import-fix obligation for those
  files; its Related-ADRs note names this deletion as the acceptable alternative to fixing
  their imports.
- ADR-0005: API Security Hardening — the blanket `/api` cache header removed in Phase 3;
  removal of `/api/debug/session` supports its goals.
- ADR-0007: Media Storage, Uploads, and Serving Architecture — catalogues the admin video
  upload/thumbnail routes among the `public/uploads` writers; their deletion in Phase 2
  removes those writers (the help-article media route stays in ADR-0007's migration scope).
- ADR-0008: Background Jobs and the Publishing Pipeline — reason the BullMQ jobs layer is
  knip-ignored rather than deleted.
- ADR-0010: Realtime Transport and Notification Delivery — supersedes the never-built fastify
  server; basis for removing `fastify`/`@fastify/cors`.
- ADR-0014: Documentation Management: Defer Behind Feature Flag — keeps the Help Center
  explicitly live, which is why its mock FAQ auto-generate/analytics and the search-ranking
  defect are remediated here rather than deferred.
- ADR-0016: System Settings & Configuration: Real Operations over Simulations — source of the
  no-fabricated-success principle applied to the mock FAQ endpoints in Phase 2.
- ADR-0018: AI Features: Explicit Availability, Model Policy, and UI Mounting — reason the
  orphaned AI/audience component layers are knip-ignored rather than deleted here.
- ADR-0019: Billing and Subscriptions with Stripe — owns the real billing work TODO.md now
  points to instead of its stale entry.
- ADR-0020: Client Portal and Shareable Reports — owns the genuinely-unbuilt Client Portal
  TODO item.
- ADR-0022: CI/CD Pipeline and Self-Hosted Docker Deployment — hosts the knip CI gate and the
  Docker dev stack used to validate the config merge.
- ADR-0023: Observability: Real Metrics, Logging, and Health — owns any future truthful
  replacement for `/api/version` and the log-shipping story that replaces committed `logs/`.
- ADR-0025: Seeding Strategy and Explicit Demo Mode — owns `prisma/seed.ts` going forward;
  this ADR only deletes the legacy `seed.js`.
