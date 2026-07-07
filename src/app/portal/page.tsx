'use client'

// ADR-0020 Phase 2 (Track E) — portal overview page.
//
// Renders EXCLUSIVELY from the /api/portal/summary payload already fetched by
// the layout (server-side curated snapshot for this client). No fabricated
// numbers, no placeholder values that look like data — sparse periods get an
// honest notice instead.

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { usePortalSummary } from './layout'

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

const numberFormat = new Intl.NumberFormat('en-US')

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFormat.format(Math.round(value * 100) / 100)
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function PortalOverviewPage() {
  const { client, branding, summary, reports } = usePortalSummary()
  const primary = branding?.primaryColor || '#3B82F6'

  const rangeStart = formatDate(summary.dateRange.start)
  const rangeEnd = formatDate(summary.dateRange.end)
  const metricEntries = Object.entries(summary.metrics ?? {})
  const lastGenerated = formatDate(reports.lastGeneratedAt)

  return (
    <div className="space-y-6" data-testid="portal-summary">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Performance summary for <span className="font-medium">{client.name}</span>
          {client.company ? ` (${client.company})` : ''}
        </p>
        {rangeStart && rangeEnd && (
          <p className="mt-1 text-sm text-muted-foreground">
            Reporting period: {rangeStart} – {rangeEnd}
          </p>
        )}
      </div>

      {summary.sparse && (
        <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
          Limited activity data for this period
        </div>
      )}

      {metricEntries.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Key metrics</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {metricEntries.map(([key, value]) => (
              <Card key={key}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {METRIC_LABELS[key] || key}
                  </p>
                  <p className="mt-1 text-xl font-bold" style={{ color: primary }}>
                    {formatNumber(value)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {typeof summary.growthRate === 'number' && (
            <p className="mt-3 text-sm text-muted-foreground">
              Engagement growth vs. previous period:{' '}
              <span
                className="font-medium"
                style={{ color: summary.growthRate >= 0 ? '#059669' : '#DC2626' }}
              >
                {summary.growthRate >= 0 ? '+' : ''}
                {formatNumber(summary.growthRate)}%
              </span>
            </p>
          )}
        </section>
      ) : (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          No metrics have been recorded for this period yet.
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Reports</h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <p>
                <span className="font-semibold">{formatNumber(reports.total)}</span>{' '}
                {reports.total === 1 ? 'report' : 'reports'} delivered
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {lastGenerated
                  ? `Last generated on ${lastGenerated}`
                  : 'No reports have been generated yet.'}
              </p>
            </div>
            <Link
              href="/portal/reports"
              className="text-sm font-medium underline underline-offset-4"
            >
              View reports
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
