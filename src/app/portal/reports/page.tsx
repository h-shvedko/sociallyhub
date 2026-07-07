'use client'

// ADR-0020 Phase 2 (Track E) — portal delivered-reports list.
//
// GET /api/client-reports already scopes CLIENT_VIEWER sessions server-side
// (forced clientId = membership.clientId, status COMPLETED|SENT), so this
// page passes no query params — the allowlist is enforced by the API, not
// trusted to the UI.

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PortalReportRow {
  id: string
  name: string
  type: string
  lastGenerated: string | null
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatType(type: string): string {
  return type.charAt(0) + type.slice(1).toLowerCase()
}

export default function PortalReportsPage() {
  const router = useRouter()
  const [reports, setReports] = React.useState<PortalReportRow[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/client-reports')
        if (cancelled) return
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        if (!res.ok) {
          setError('Your reports could not be loaded. Please try again.')
          return
        }
        const data = await res.json()
        if (cancelled) return
        setReports(Array.isArray(data.reports) ? data.reports : [])
      } catch {
        if (!cancelled) setError('Your reports could not be loaded. Please try again.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports your agency has delivered to you.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          {error}
        </div>
      )}

      {!error && reports === null && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!error && reports !== null && reports.length === 0 && (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          No reports have been delivered yet.
        </div>
      )}

      {!error && reports !== null && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => {
            const generated = formatDate(report.lastGenerated)
            return (
              <Card key={report.id} data-testid="portal-report-row">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{report.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatType(report.type)} report
                      {generated ? ` · Generated on ${generated}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/portal/reports/${report.id}`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    View report
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
