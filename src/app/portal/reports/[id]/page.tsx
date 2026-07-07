'use client'

// ADR-0020 Phase 2 (Track E) — portal report detail.
//
// Renders the SAME shared snapshot component as the public share page
// (<ReportSnapshotView>): snapshot-only, from ClientReport.data — no live
// analytics queries from the portal. The API enforces client scoping for
// CLIENT_VIEWER sessions; a 403/404 here gets one honest not-found message.

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ReportSnapshotView,
  type ReportSnapshotData,
} from '@/components/reports/report-snapshot-view'
import { usePortalSummary } from '../../layout'

interface PortalReportDetail {
  id: string
  name: string
  type: string
  description: string | null
  frequency: string | null
  lastGenerated: string | null
  data: ReportSnapshotData | null
  client: { id: string; name: string; email: string | null; company: string | null } | null
}

export default function PortalReportDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const reportId = params?.id
  const { branding } = usePortalSummary()

  const [report, setReport] = React.useState<PortalReportDetail | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'not-found' | 'error'>(
    'loading'
  )

  React.useEffect(() => {
    if (!reportId) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/client-reports/${reportId}`)
        if (cancelled) return
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        if (res.status === 403 || res.status === 404) {
          setState('not-found')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (!data?.report) {
          setState('not-found')
          return
        }
        setReport(data.report)
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reportId, router])

  if (state === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (state === 'not-found') {
    return (
      <div className="rounded-md border p-8 text-center">
        <h1 className="text-lg font-semibold">Report not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This report does not exist or you no longer have access to it.
        </p>
        <Link
          href="/portal/reports"
          className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
        >
          Back to reports
        </Link>
      </div>
    )
  }

  if (state === 'error' || !report) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-8 text-center text-sm">
        This report could not be loaded. Please try again.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/portal/reports"
          className="text-sm font-medium text-muted-foreground underline underline-offset-4"
        >
          ← Back to reports
        </Link>
        <a
          href={`/api/client-reports/${report.id}/download`}
          className="text-sm font-medium underline underline-offset-4"
        >
          Printable report
        </a>
      </div>
      <ReportSnapshotView
        meta={{
          name: report.name,
          type: report.type,
          clientName: report.client?.name ?? '',
          generatedAt: report.lastGenerated,
          description: report.description,
          frequency: report.frequency,
        }}
        data={report.data}
        branding={branding}
      />
    </div>
  )
}
