# Documentation management subsystem — DEFERRED (do not extend or "fix" casually)

> **Status: deferred behind a feature flag per [ADR-0014](../../../../ADR/ADR-0014-documentation-management-deferral.md) (Accepted).**

## What this directory is

The **19 route files** across the 15 route directories under
`src/app/api/documentation/**` (pages, sections, search, analytics, manage,
versions, workflow, comments, collaboration, cross-references, code-examples,
templates, export, export/offline, api-docs) make up the Documentation
management subsystem, backed by 12 Prisma models (`DocumentationSection`,
`DocumentationPage`, `DocumentationVersion`, `DocumentationRevision`,
`DocumentationWorkflow`, `DocumentationExport`, …). The dashboard surface it
serves (`src/app/dashboard/documentation/**`) is gated by the sibling
`layout.tsx`.

This is a **separate stack from the working public Help Center** (`/api/help/**`,
`/dashboard/help`), which is **NOT deferred** and stays live.

## Why it is gated off

The subsystem is **KNOWN-BROKEN**. Verified defects (see ADR-0014 for the full
inventory):

- **Divergent schema** — routes read/write fields the models do not have:
  `DocumentationPage.visibility`/`metadata` (schema has `isPublic`, no
  `metadata`), `DocumentationVersion.version` (schema: `versionNumber`),
  revision `action`/`changes`/`comment` (schema: `changeType`/`contentDiff`/
  `changeSummary` + required `revisionNumber`/`title`/`content`), workflow
  `type`/`requestedById`/`notes` (schema: `workflowType`/`requestedBy`), export
  writes missing required `exportType`/`requestedBy`.
- **Status-casing split** — the public browser filters `status: 'published'`
  (lowercase) while the manage layer writes `'PUBLISHED'` (uppercase), so
  managed content would never appear in the browser even if the routes compiled.
- **No migrated seed content** — there is no documentation seeder; the browser
  renders an empty shell on any fresh install.
- **Insecure public writes** — `POST /api/documentation/pages` and
  `PUT`/`DELETE /api/documentation/sections/[slug]` accept unauthenticated
  writes (neutralized only by the gate returning 404).

## How the gate works

`FEATURE_DOCS_MANAGEMENT` in `src/lib/config/features.ts` defaults to `false`.
With the flag off, `/api/documentation/**` and `/dashboard/documentation/**`
return 404 (routes gated by `src/middleware.ts` at the edge; dashboard pages by
`src/app/dashboard/documentation/layout.tsx` calling `notFound()`). The flag must
**remain `false` in production** until the repair phase ships.

## Rules for contributors

- **Do NOT extend, wire up, or casually "fix" any route in this tree.** These
  pre-existing defects are tracked as deferred, not bugs to patch ad hoc.
- **Do NOT flip `FEATURE_DOCS_MANAGEMENT=true` in production.** It re-exposes
  broken, insecure endpoints.
- **The default un-defer path is a MERGE INTO THE HELP CENTER**, not a
  standalone repair. This subsystem duplicates seven Help Center models nearly
  one-to-one; its unique capabilities (code examples, semver versions,
  cross-references) are cheaper to fold into the repaired `HelpArticle` stack.
  Standalone repair (ADR-0014 Phase 3) runs only if a concrete product
  requirement emerges that the Help Center cannot express. See **ADR-0014**
  (Decision Outcome, Phase 3 repair backlog, and Phase 4 un-defer decision gate).
