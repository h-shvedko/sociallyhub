// Shared snapshot renderer (ADR-0020) — used by BOTH the public share page
// (/share/reports/[token]) and the client portal (/portal/reports/*).
//
// CONTRACT (do not break):
// - Pure presentational, hook-free, no fetch, no auth imports — it must work
//   as a React Server Component AND inside client components.
// - Renders EXCLUSIVELY from the frozen ClientReport.data snapshot passed in;
//   it never triggers live analytics queries (leaked link ⇒ one frozen
//   document, never an API).
// - Honesty: shows "Generated on …", a sparse-data notice when the snapshot
//   says so, and a "Sample data" banner when data.simulated === true
//   (ADR-0025 stance — demo numbers are never presented silently as real).

import * as React from 'react'

/** Metadata shown in the header (never derived from live queries). */
export interface ReportSnapshotMeta {
  name: string
  type: string // EXECUTIVE | PERFORMANCE | ANALYTICS | CUSTOM
  clientName: string
  /** ISO timestamp of generation (ClientReport.lastGenerated). */
  generatedAt: string | null
  description?: string | null
  frequency?: string | null
}

/** Optional ClientBranding subset for white-labeling the page. */
export interface ReportBrandingProps {
  title: string
  logoUrl?: string | null
  primaryColor: string
  accentColor?: string | null
  hideCredits?: boolean
}

/** The ClientReport.data JSON as written by the report generator (ADR-0008). */
export interface ReportSnapshotData {
  dateRange?: { start: string; end: string }
  dataPoints?: number
  sparse?: boolean
  growthRate?: number | null
  metrics?: Record<string, number>
  byMetricType?: Record<string, { total: number; count: number }>
  byPlatform?: Record<string, number>
  simulated?: boolean
  [key: string]: unknown
}

const METRIC_LABELS: Record<string, string> = {
  impressions: 'Impressions',
  reach: 'Reach',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  engagement: 'Engagement',
  clicks: 'Clicks',
  conversions: 'Conversions',
  followers: 'Followers',
  pageViews: 'Page Views',
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US').format(Math.round(value * 100) / 100)
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ReportSnapshotView({
  meta,
  data,
  branding,
}: {
  meta: ReportSnapshotMeta
  data: ReportSnapshotData | null
  branding?: ReportBrandingProps | null
}) {
  const primary = branding?.primaryColor || '#3B82F6'
  const generatedOn = formatDate(meta.generatedAt)
  const rangeStart = formatDate(data?.dateRange?.start)
  const rangeEnd = formatDate(data?.dateRange?.end)
  const metrics = data?.metrics ?? {}
  const metricEntries = Object.entries(metrics)
  const platformEntries = Object.entries(data?.byPlatform ?? {})

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 print:max-w-none print:px-0">
      {/* Branded header */}
      <header
        className="mb-8 rounded-lg border p-6"
        style={{ borderTopWidth: 4, borderTopColor: primary }}
        data-testid="report-snapshot-header"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.title}
                className="mb-2 h-10 w-auto object-contain"
              />
            ) : (
              <p className="mb-1 text-sm font-semibold" style={{ color: primary }}>
                {branding?.title || 'SociallyHub'}
              </p>
            )}
            <h1 className="text-2xl font-bold">{meta.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Prepared for <span className="font-medium">{meta.clientName}</span>
              {' · '}
              {meta.type.charAt(0) + meta.type.slice(1).toLowerCase()} report
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {generatedOn && <span data-testid="generated-on">Generated on {generatedOn}</span>}
          {rangeStart && rangeEnd && (
            <span data-testid="date-range">
              Reporting period: {rangeStart} – {rangeEnd}
            </span>
          )}
          {typeof data?.dataPoints === 'number' && (
            <span>{formatNumber(data.dataPoints)} data points</span>
          )}
        </div>
        {meta.description && (
          <p className="mt-3 text-sm text-muted-foreground">{meta.description}</p>
        )}
      </header>

      {/* Honesty banners */}
      {data?.simulated === true && (
        <div
          className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          data-testid="sample-data-banner"
        >
          <strong>Sample data.</strong> This report was generated from simulated
          demo data, not live platform metrics.
        </div>
      )}
      {data?.sparse === true && data?.simulated !== true && (
        <div
          className="mb-6 rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground"
          data-testid="sparse-data-notice"
        >
          Limited data was available for this reporting period; some metrics may
          be zero or incomplete.
        </div>
      )}

      {!data && (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          This report has no generated data yet.
        </div>
      )}

      {/* Metric cards */}
      {metricEntries.length > 0 && (
        <section className="mb-8" data-testid="metric-cards">
          <h2 className="mb-3 text-lg font-semibold">Key metrics</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {metricEntries.map(([key, value]) => (
              <div key={key} className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {METRIC_LABELS[key] || key}
                </p>
                <p className="mt-1 text-xl font-bold" style={{ color: primary }}>
                  {formatNumber(value)}
                </p>
              </div>
            ))}
          </div>
          {typeof data?.growthRate === 'number' && (
            <p className="mt-3 text-sm text-muted-foreground">
              Engagement growth vs. previous period:{' '}
              <span
                className="font-medium"
                style={{ color: data.growthRate >= 0 ? '#059669' : '#DC2626' }}
              >
                {data.growthRate >= 0 ? '+' : ''}
                {formatNumber(data.growthRate)}%
              </span>
            </p>
          )}
        </section>
      )}

      {/* Platform breakdown */}
      {platformEntries.length > 0 && (
        <section className="mb-8" data-testid="platform-breakdown">
          <h2 className="mb-3 text-lg font-semibold">By platform</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Platform</th>
                  <th className="p-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {platformEntries.map(([platform, total]) => (
                  <tr key={platform} className="border-b last:border-0">
                    <td className="p-3">{platform}</td>
                    <td className="p-3 text-right">{formatNumber(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t pt-4 text-center text-xs text-muted-foreground">
        {generatedOn && <p>Snapshot generated on {generatedOn}. Figures are frozen as of that date.</p>}
        {!branding?.hideCredits && <p className="mt-1">Powered by SociallyHub</p>}
      </footer>
    </div>
  )
}
