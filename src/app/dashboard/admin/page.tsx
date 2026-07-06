'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Ticket,
  Users,
  MessageSquare,
  FileText,
  Video,
  Shield,
  BarChart3,
  Building2,
  Activity,
  AlertCircle,
} from 'lucide-react'

interface OverviewStats {
  totalUsers: number
  totalWorkspaces: number
  openTickets: number
}

interface ActivityEntry {
  id: string
  action: string
  resource: string
  resourceId: string | null
  timestamp: string
  actor: { name: string | null; email: string | null } | null
}

interface OverviewResponse {
  stats: OverviewStats
  recentActivity: ActivityEntry[]
}

function formatCount(value: number): string {
  return value.toLocaleString()
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

function actorLabel(actor: ActivityEntry['actor']): string {
  if (!actor) return 'System'
  return actor.name || actor.email || 'Unknown user'
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/overview', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(
            res.status === 403
              ? 'You do not have permission to view the admin overview.'
              : 'Failed to load admin overview.'
          )
        }
        const json = (await res.json()) as OverviewResponse
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load admin overview.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = data?.stats
  const recentActivity = data?.recentActivity ?? []

  const statCards = [
    {
      label: 'Total Users',
      value: stats ? formatCount(stats.totalUsers) : null,
      icon: Users,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Workspaces',
      value: stats ? formatCount(stats.totalWorkspaces) : null,
      icon: Building2,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      label: 'Open Tickets',
      value: stats ? formatCount(stats.openTickets) : null,
      icon: Ticket,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
  ]

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-600 mt-2">
          System overview and quick access to admin functions
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Quick Stats — real DB counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div
                    className={`w-8 h-8 ${card.iconBg} rounded-lg flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">{card.label}</p>
                  <div className="flex items-baseline">
                    {loading || card.value === null ? (
                      <span className="mt-1 inline-block h-7 w-16 animate-pulse rounded bg-gray-200" />
                    ) : (
                      <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Support Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Support Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/dashboard/admin/support/tickets"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Ticket className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div>Manage Support Tickets</div>
                  <div className="text-xs text-gray-500 mt-1">
                    View, assign, and resolve support tickets
                  </div>
                </div>
                {stats && (
                  <div className="text-sm text-gray-400">
                    {formatCount(stats.openTickets)} open
                  </div>
                )}
              </Link>

              <Link
                href="/dashboard/admin/support/agents"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="w-5 h-5 text-green-500 mr-3" />
                <div className="flex-1">
                  <div>Agent Management</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Configure agents, departments, and availability
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/admin/support/analytics"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <BarChart3 className="w-5 h-5 text-purple-500 mr-3" />
                <div className="flex-1">
                  <div>Support Analytics</div>
                  <div className="text-xs text-gray-500 mt-1">
                    View performance metrics and reports
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Content Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Content Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/dashboard/admin/content/articles"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div>Help Articles</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Create and edit help documentation
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/admin/content/faqs"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-5 h-5 text-green-500 mr-3" />
                <div className="flex-1">
                  <div>FAQ Management</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Manage frequently asked questions
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/admin/content/videos"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Video className="w-5 h-5 text-purple-500 mr-3" />
                <div className="flex-1">
                  <div>Video Tutorials</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Upload and organize video content
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              User Management
            </h3>
            <div className="space-y-3">
              <Link
                href="/dashboard/admin/users/administration"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Users className="w-5 h-5 text-blue-500 mr-3" />
                <div className="flex-1">
                  <div>User Accounts</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Manage user accounts and profiles
                  </div>
                </div>
                {stats && (
                  <div className="text-sm text-gray-400">
                    {formatCount(stats.totalUsers)} users
                  </div>
                )}
              </Link>

              <Link
                href="/dashboard/admin/users/roles"
                className="flex items-center p-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Shield className="w-5 h-5 text-green-500 mr-3" />
                <div className="flex-1">
                  <div>Roles &amp; Permissions</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Workspace role capability reference
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity — real AuditLog entries */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                <Activity className="h-5 w-5 text-gray-400" />
                No recorded admin activity yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Activity className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {entry.action}
                        <span className="font-normal text-gray-500">
                          {' '}
                          on {entry.resource}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {actorLabel(entry.actor)} &middot;{' '}
                        {formatTimestamp(entry.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
