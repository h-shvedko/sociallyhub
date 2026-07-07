'use client'

// ADR-0020 Phase 2 (Track E) — client portal shell.
//
// Dedicated route group: NO dashboard sidebar/nav is rendered here. The shell
// fetches /api/portal/summary once (cheap, CLIENT_VIEWER-scoped server-side)
// for branding + client/workspace names and shares the result with child
// pages via context so the overview page does not re-fetch.
//
// The root SessionProvider already wraps all routes via src/app/providers.tsx.

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReportBrandingProps } from '@/components/reports/report-snapshot-view'

/** AggregatedReport — mirrors src/lib/reports/aggregate-client-metrics.ts (pinned ADR-0020 contract). */
export interface PortalAggregatedReport {
  dateRange: { start: string; end: string }
  dataPoints: number
  sparse: boolean
  growthRate: number | null
  metrics: Record<string, number>
  byMetricType: Record<string, { total: number; count: number }>
  byPlatform: Record<string, number>
}

/** GET /api/portal/summary response (pinned ADR-0020 contract). */
export interface PortalSummaryResponse {
  client: { id: string; name: string; company: string | null }
  workspace: { name: string }
  branding: ReportBrandingProps | null
  summary: PortalAggregatedReport
  reports: { total: number; lastGeneratedAt: string | null }
}

const PortalSummaryContext = React.createContext<PortalSummaryResponse | null>(null)

/** Child pages read the already-fetched summary (non-null once the shell renders children). */
export function usePortalSummary(): PortalSummaryResponse {
  const value = React.useContext(PortalSummaryContext)
  if (!value) {
    throw new Error('usePortalSummary must be used inside the portal layout')
  }
  return value
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [summary, setSummary] = React.useState<PortalSummaryResponse | null>(null)
  const [state, setState] = React.useState<'loading' | 'ready' | 'forbidden' | 'error'>(
    'loading'
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/portal/summary')
        if (cancelled) return
        if (res.status === 401) {
          router.push('/auth/signin')
          return
        }
        if (res.status === 403) {
          setState('forbidden')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const data: PortalSummaryResponse = await res.json()
        if (cancelled) return
        setSummary(data)
        setState('ready')
      } catch {
        if (!cancelled) setState('error')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background" data-testid="portal-shell">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
          <Skeleton className="mb-6 h-14 w-full" />
          <Skeleton className="mb-3 h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (state === 'forbidden') {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background px-4"
        data-testid="portal-shell"
      >
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">
            Client portal access is not enabled for your account.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The portal is only available to invited client contacts. If you are an
            agency user, your workspace lives in the dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
          >
            Go to the dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (state === 'error' || !summary) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background px-4"
        data-testid="portal-shell"
      >
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">The portal could not be loaded.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong while loading your portal. Please try again.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const branding = summary.branding
  const primary = branding?.primaryColor || '#3B82F6'
  const portalTitle = branding?.title || summary.workspace.name

  const navLinkClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`

  return (
    <div className="min-h-screen bg-background" data-testid="portal-shell">
      <header className="border-b" style={{ borderTopWidth: 3, borderTopColor: primary }}>
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={portalTitle}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-base font-bold" style={{ color: primary }}>
                {portalTitle}
              </span>
            )}
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {summary.client.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              <Link href="/portal" className={navLinkClass(pathname === '/portal')}>
                Overview
              </Link>
              <Link
                href="/portal/reports"
                className={navLinkClass(pathname?.startsWith('/portal/reports') ?? false)}
              >
                Reports
              </Link>
            </nav>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <PortalSummaryContext.Provider value={summary}>
          {children}
        </PortalSummaryContext.Provider>
      </main>
    </div>
  )
}
