import { notFound } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/config/features'

/**
 * ADR-0014 Phase 1 (item 2) — feature-flag gate for the Documentation
 * management surface.
 *
 * This server-component layout wraps the entire `/dashboard/documentation`
 * section (the public browser `page.tsx`, the `[slug]` viewer, and the
 * `manage/` dashboard). When `FEATURE_DOCS_MANAGEMENT` is off — the default,
 * and the required production value until ADR-0014 Phase 3 repairs the
 * subsystem — every page under this route returns a 404 via `notFound()`.
 *
 * The Documentation subsystem is DEFERRED and KNOWN-BROKEN (routes written
 * against a divergent schema, a published/PUBLISHED status-casing split, no
 * seed data). See `src/app/api/documentation/README.md` and ADR-0014. Do NOT
 * remove this gate to "make the section work"; the default un-defer path is a
 * merge into the Help Center.
 */
export default function DocumentationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isFeatureEnabled('FEATURE_DOCS_MANAGEMENT')) {
    notFound()
  }

  return <>{children}</>
}
