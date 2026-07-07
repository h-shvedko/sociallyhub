// Client metric aggregation (ADR-0008, extracted per ADR-0020).
//
// Moved VERBATIM from src/lib/jobs/processors/client-reports.ts so the
// portal summary endpoint (/api/portal/summary) and the report-generation
// worker share one implementation. Behavior is byte-for-byte identical.
//
// HONESTY: metrics come straight from the DB. If a client has few/no seeded
// `AnalyticsMetric` rows the result is genuinely sparse (`sparse: true`,
// zeros) rather than invented — real-but-sparse beats mock.

import { prisma } from '@/lib/prisma'

const ENGAGEMENT_METRIC_TYPES = ['likes', 'comments', 'shares'] as const

/** Lookback window (ms) per frequency — the span the report summarizes. */
const WINDOW_MS: Record<string, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
  QUARTERLY: 90 * 24 * 60 * 60 * 1000,
}

export interface AggregatedReport {
  dateRange: { start: string; end: string }
  dataPoints: number
  sparse: boolean
  growthRate: number | null
  metrics: Record<string, number>
  byMetricType: Record<string, { total: number; count: number }>
  byPlatform: Record<string, number>
}

/**
 * Aggregate real AnalyticsMetric data for a client over the report window.
 *
 * A client's metrics are the union of metrics attributed to its social accounts
 * (`socialAccountId`) and its posts (`postId`). When the client has neither (or
 * no metrics land in the window) the result is an honest empty/sparse report.
 */
export async function aggregateClientMetrics(
  clientId: string,
  workspaceId: string,
  frequency: string
): Promise<AggregatedReport> {
  const end = new Date()
  const windowMs = WINDOW_MS[frequency] ?? WINDOW_MS.MONTHLY
  const start = new Date(end.getTime() - windowMs)
  const prevStart = new Date(start.getTime() - windowMs)

  // Resolve the client's owned metric sources.
  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { clientId, workspaceId }, select: { id: true } }),
    prisma.post.findMany({ where: { clientId, workspaceId }, select: { id: true } }),
  ])
  const accountIds = accounts.map((a) => a.id)
  const postIds = posts.map((p) => p.id)

  const emptyReport = (): AggregatedReport => ({
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    dataPoints: 0,
    sparse: true,
    growthRate: null,
    metrics: {
      impressions: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement: 0,
      clicks: 0,
      conversions: 0,
      followers: 0,
      pageViews: 0,
    },
    byMetricType: {},
    byPlatform: {},
  })

  // No accounts and no posts ⇒ nothing is attributable to this client.
  if (accountIds.length === 0 && postIds.length === 0) {
    return emptyReport()
  }

  const sourceFilter = [
    accountIds.length ? { socialAccountId: { in: accountIds } } : null,
    postIds.length ? { postId: { in: postIds } } : null,
  ].filter(Boolean) as Array<Record<string, unknown>>

  const [byType, byPlatformRows, prevEngagementAgg] = await Promise.all([
    prisma.analyticsMetric.groupBy({
      by: ['metricType'],
      where: { date: { gte: start, lte: end }, OR: sourceFilter },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.analyticsMetric.groupBy({
      by: ['platform'],
      where: { date: { gte: start, lte: end }, OR: sourceFilter },
      _sum: { value: true },
    }),
    prisma.analyticsMetric.aggregate({
      where: {
        date: { gte: prevStart, lt: start },
        metricType: { in: [...ENGAGEMENT_METRIC_TYPES] },
        OR: sourceFilter,
      },
      _sum: { value: true },
    }),
  ])

  const byMetricType: Record<string, { total: number; count: number }> = {}
  let dataPoints = 0
  for (const row of byType) {
    const total = row._sum.value ?? 0
    const count = row._count._all
    byMetricType[row.metricType] = { total, count }
    dataPoints += count
  }

  const byPlatform: Record<string, number> = {}
  for (const row of byPlatformRows) {
    const key = row.platform ?? 'unknown'
    byPlatform[key] = row._sum.value ?? 0
  }

  const sum = (type: string): number => byMetricType[type]?.total ?? 0
  const first = (...types: string[]): number => {
    for (const t of types) {
      if (byMetricType[t]) return byMetricType[t].total
    }
    return 0
  }

  const likes = sum('likes')
  const comments = sum('comments')
  const shares = sum('shares')
  const engagement = likes + comments + shares

  const prevEngagement = prevEngagementAgg._sum.value ?? 0
  const growthRate =
    prevEngagement > 0
      ? Math.round(((engagement - prevEngagement) / prevEngagement) * 1000) / 10
      : null

  return {
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    dataPoints,
    sparse: dataPoints === 0,
    growthRate,
    metrics: {
      impressions: sum('impressions'),
      reach: sum('reach'),
      likes,
      comments,
      shares,
      engagement,
      clicks: first('clicks', 'link_clicks'),
      conversions: first('conversion', 'conversions'),
      followers: first('followers', 'follower_count'),
      pageViews: sum('page_view'),
    },
    byMetricType,
    byPlatform,
  }
}
