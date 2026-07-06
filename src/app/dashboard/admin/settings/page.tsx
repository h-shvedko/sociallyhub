'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Settings,
  Mail,
  Globe,
  Database,
  Flag,
  KeyRound,
  Wrench,
  ChevronRight,
  AlertCircle
} from 'lucide-react'

// ADR-0016 Phase 4 — honest admin settings hub.
//
// The previous hub rendered 10 hardcoded cards with fake setTimeout stats
// (e.g. a hardcoded "198 total configurations") and linked to 9 pages that
// returned 404. This rebuild links ONLY to pages that exist and shows REAL
// counts fetched from the list endpoints. If a count cannot be fetched we
// show nothing rather than inventing a number.

interface Workspace {
  id: string
  name: string
}

interface HubCounts {
  system: number | null
  backupConfigs: number | null
  lastBackup: string | null
  featureFlags: number | null
  emailTemplates: number | null
  integrations: number | null
  workspaceName: string | null
}

interface CardDef {
  id: string
  name: string
  description: string
  icon: any
  href: string
  scope: 'global' | 'workspace' | 'none'
  count: number | null
  extra?: string | null
}

export default function AdminSettingsPage() {
  const [counts, setCounts] = useState<HubCounts>({
    system: null,
    backupConfigs: null,
    lastBackup: null,
    featureFlags: null,
    emailTemplates: null,
    integrations: null,
    workspaceName: null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadCounts = async () => {
      setLoading(true)
      setError(null)

      // Each fetch is independent — one failure must not blank the others.
      const safeJson = async (url: string): Promise<any | null> => {
        try {
          const res = await fetch(url)
          if (!res.ok) return null
          return await res.json()
        } catch {
          return null
        }
      }

      // Global-scope counts.
      const [systemData, backupData, flagsData, workspacesData] = await Promise.all([
        safeJson('/api/admin/settings/system'),
        safeJson('/api/admin/settings/backup'),
        safeJson('/api/admin/settings/feature-flags'),
        safeJson('/api/admin/workspaces')
      ])

      // Workspace-scoped counts (email templates / integrations) — fetched for
      // the first workspace the admin can see, purely to give the hub a real
      // (non-fabricated) number. Omitted entirely if there is no workspace.
      let emailTemplates: number | null = null
      let integrations: number | null = null
      let workspaceName: string | null = null

      const workspaces: Workspace[] = workspacesData?.workspaces ?? []
      const firstWorkspace = workspaces[0]
      if (firstWorkspace) {
        workspaceName = firstWorkspace.name
        const [emailData, integrationData] = await Promise.all([
          safeJson(`/api/admin/settings/email-templates?workspaceId=${encodeURIComponent(firstWorkspace.id)}`),
          safeJson(`/api/admin/settings/integrations?workspaceId=${encodeURIComponent(firstWorkspace.id)}`)
        ])
        if (typeof emailData?.total === 'number') emailTemplates = emailData.total
        if (typeof integrationData?.total === 'number') integrations = integrationData.total
      }

      if (cancelled) return

      // If literally every source failed, surface an honest error.
      if (!systemData && !backupData && !flagsData && !workspacesData) {
        setError('Unable to load settings data. You may not have platform-admin access, or the services are unavailable.')
      }

      setCounts({
        system: typeof systemData?.total === 'number' ? systemData.total : null,
        backupConfigs: typeof backupData?.total === 'number' ? backupData.total : null,
        lastBackup: backupData?.stats?.lastSuccessfulBackup ?? null,
        featureFlags: typeof flagsData?.total === 'number' ? flagsData.total : null,
        emailTemplates,
        integrations,
        workspaceName
      })
      setLoading(false)
    }

    loadCounts()
    return () => {
      cancelled = true
    }
  }, [])

  const cards: CardDef[] = [
    {
      id: 'system',
      name: 'System Configuration',
      description: 'Global platform settings and core system parameters (secrets masked).',
      icon: Settings,
      href: '/dashboard/admin/settings/system',
      scope: 'global',
      count: counts.system
    },
    {
      id: 'email-templates',
      name: 'Email Templates',
      description: 'Manage per-workspace notification, welcome, and system email templates.',
      icon: Mail,
      href: '/dashboard/admin/settings/email-templates',
      scope: 'workspace',
      count: counts.emailTemplates,
      extra: counts.workspaceName ? `in ${counts.workspaceName}` : null
    },
    {
      id: 'integrations',
      name: 'Integrations',
      description: 'Configure per-workspace third-party integrations. Credentials stay masked.',
      icon: Globe,
      href: '/dashboard/admin/settings/integrations',
      scope: 'workspace',
      count: counts.integrations,
      extra: counts.workspaceName ? `in ${counts.workspaceName}` : null
    },
    {
      id: 'backup',
      name: 'Backup & Recovery',
      description: 'Backup configurations and recent backup records with real status.',
      icon: Database,
      href: '/dashboard/admin/settings/backup',
      scope: 'global',
      count: counts.backupConfigs,
      extra: counts.lastBackup
        ? `last success ${new Date(counts.lastBackup).toLocaleDateString()}`
        : 'no successful backup yet'
    },
    {
      id: 'feature-flags',
      name: 'Feature Flags',
      description: 'View feature flags and their rollout state; create new flags.',
      icon: Flag,
      href: '/dashboard/admin/settings/feature-flags',
      scope: 'global',
      count: counts.featureFlags
    },
    {
      id: 'sso',
      name: 'Single Sign-On',
      description: 'External identity providers. Disabled until a real SSO flow ships.',
      icon: KeyRound,
      href: '/dashboard/admin/settings/sso',
      scope: 'none',
      count: null
    }
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Wrench className="mr-3 h-6 w-6" />
          Settings &amp; Configuration
        </h1>
        <p className="text-gray-600 mt-1">
          Platform and workspace configuration. Counts below are read live from the
          backing services — no placeholder data.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.id}
              href={card.href}
              className="group block rounded-lg border bg-white transition-all duration-200 hover:border-blue-300"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-blue-100 p-3 transition-colors group-hover:bg-blue-200">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
                        {card.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        {loading ? (
                          <span className="inline-block h-3 w-16 animate-pulse rounded bg-gray-200" />
                        ) : card.scope === 'none' ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            disabled
                          </span>
                        ) : card.count !== null ? (
                          <span>
                            {card.count} {card.count === 1 ? 'item' : 'items'}
                            {card.extra ? ` · ${card.extra}` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {card.extra ?? 'count unavailable'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 transition-colors group-hover:text-blue-600" />
                </div>
                <p className="mt-3 text-sm text-gray-600">{card.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
