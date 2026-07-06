'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  Database,
  ArrowLeft,
  Play,
  Download,
  RotateCcw,
  AlertCircle,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react'

// ADR-0016 Phase 4 — Backup & Recovery admin page. Global scope (platform
// admin). Lists backup configurations and recent BackupRecords with their REAL
// status/size/checksum/duration/error. "Run now" POSTs to the execute
// endpoint. Download and Restore call the documented per-record endpoints and
// surface their real response — including an honest failure if the backend
// returns an error — rather than faking success.

interface BackupConfig {
  id: string
  workspaceId: string | null
  name: string
  backupType: string
  schedule: string
  storageLocation: string
  isActive: boolean
  retention: number
  priority: string
  lastSuccess: string | null
  lastFailure: string | null
  nextRun: string | null
  successCount: number
  failureCount: number
}

interface BackupRecord {
  id: string
  configurationId: string | null
  filename: string
  fileSize: string | number
  checksum: string
  backupType: string
  status: string
  startTime: string | null
  endTime: string | null
  duration: number | null
  recordCount: number | null
  errorMessage: string | null
  createdAt: string
}

interface BackupStats {
  totalConfigurations: number
  activeConfigurations: number
  recentBackups: number
  successfulBackups: number
  failedBackups: number
  lastSuccessfulBackup: string | null
  successRate: number
}

function formatBytes(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" /> completed
      </span>
    )
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="mr-1 h-3 w-3" /> failed
      </span>
    )
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <Clock className="mr-1 h-3 w-3 animate-pulse" /> in progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {status.toLowerCase()}
    </span>
  )
}

export default function BackupPage() {
  const [configs, setConfigs] = useState<Record<string, BackupConfig[]>>({})
  const [records, setRecords] = useState<BackupRecord[]>([])
  const [stats, setStats] = useState<BackupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const [restoreTarget, setRestoreTarget] = useState<{ record: BackupRecord; configName: string } | null>(null)
  const [restoreConfirmText, setRestoreConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings/backup?includeRecords=true')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setConfigs(data.configurations || {})
      setRecords(data.recentRecords || [])
      setStats(data.stats || null)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Poll while any record is IN_PROGRESS so status transitions are visible.
  useEffect(() => {
    const hasInProgress = records.some((r) => r.status === 'IN_PROGRESS')
    if (hasInProgress && !pollRef.current) {
      pollRef.current = setInterval(load, 4000)
    } else if (!hasInProgress && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [records, load])

  const configNameById = (id: string | null): string => {
    if (!id) return 'Unknown'
    for (const location of Object.keys(configs)) {
      const found = configs[location].find((c) => c.id === id)
      if (found) return found.name
    }
    return 'Unknown'
  }

  const handleRun = async (config: BackupConfig) => {
    setRunningId(config.id)
    setActionError(null)
    try {
      const res = await fetch('/api/admin/settings/backup/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configurationId: config.id, immediate: true })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Execution failed (${res.status})`)
      }
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to run backup')
    } finally {
      setRunningId(null)
    }
  }

  const handleDownload = async (record: BackupRecord) => {
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/settings/backup/records/${record.id}/download`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          body.error ||
            `Download failed (${res.status}). The backup-record download endpoint is not available on this deployment.`
        )
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = record.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setActionError(e.message || 'Failed to download backup')
    }
  }

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/settings/backup/records/${restoreTarget.record.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: restoreTarget.configName })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          body.error ||
            `Restore failed (${res.status}). The backup-record restore endpoint is not available on this deployment.`
        )
      }
      setRestoreTarget(null)
      setRestoreConfirmText('')
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to restore backup')
    } finally {
      setRestoring(false)
    }
  }

  const locations = Object.keys(configs).sort()
  const totalConfigs = locations.reduce((sum, l) => sum + configs[l].length, 0)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/admin/settings"
            className="mb-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Settings
          </Link>
          <h1 className="flex items-center text-2xl font-bold text-gray-900">
            <Database className="mr-3 h-6 w-6" />
            Backup &amp; Recovery
          </h1>
          <p className="mt-1 text-gray-600">
            Global backup configurations and recent backup records (real status).
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load() }}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      {actionError && (
        <div className="mb-4 flex items-start rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border bg-white py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading backups…</span>
        </div>
      ) : error ? (
        <div className="flex items-start rounded-lg border border-red-200 bg-red-50 p-6">
          <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button onClick={() => { setLoading(true); load() }} className="mt-2 text-sm font-medium text-red-700 underline">
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="Configurations" value={`${stats.activeConfigurations}/${stats.totalConfigurations} active`} />
              <StatCard label="Recent backups (30d)" value={String(stats.recentBackups)} />
              <StatCard label="Success rate" value={`${stats.successRate}%`} />
              <StatCard
                label="Last successful"
                value={stats.lastSuccessfulBackup ? new Date(stats.lastSuccessfulBackup).toLocaleString() : 'never'}
              />
            </div>
          )}

          {/* Configurations */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Configurations</h2>
            {totalConfigs === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center">
                <Database className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No backup configurations</h3>
                <p className="mt-1 text-sm text-gray-500">There are no global backup configurations defined.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {locations.map((location) => (
                  <div key={location} className="rounded-lg border bg-white">
                    <div className="border-b px-6 py-3">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                        {location} <span className="text-gray-400">({configs[location].length})</span>
                      </h3>
                    </div>
                    <div className="divide-y">
                      {configs[location].map((c) => (
                        <div key={c.id} className="flex items-start justify-between px-6 py-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{c.name}</span>
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{c.backupType}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                  c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {c.isActive ? 'active' : 'inactive'}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-xs text-gray-500">
                              schedule: {c.schedule} · retention: {c.retention}d · ✓{c.successCount} ✗{c.failureCount}
                            </p>
                            {c.lastSuccess && (
                              <p className="mt-0.5 text-xs text-gray-500">
                                last success: {new Date(c.lastSuccess).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRun(c)}
                            disabled={runningId === c.id}
                            className="ml-4 inline-flex flex-shrink-0 items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Play className="mr-1.5 h-4 w-4" />
                            {runningId === c.id ? 'Running…' : 'Run now'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent records */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent backup records</h2>
            {records.length === 0 ? (
              <div className="rounded-lg border bg-white p-12 text-center">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No backup records yet</h3>
                <p className="mt-1 text-sm text-gray-500">Run a backup configuration to create the first record.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <Th>Filename</Th>
                      <Th>Status</Th>
                      <Th>Size</Th>
                      <Th>Duration</Th>
                      <Th>Checksum</Th>
                      <Th>Created</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-gray-900 break-all">{r.filename}</div>
                          {r.status === 'FAILED' && r.errorMessage && (
                            <div className="mt-1 text-xs text-red-600">{r.errorMessage}</div>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {r.status === 'COMPLETED' ? formatBytes(r.fileSize) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {r.duration != null ? `${r.duration}s` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-500">{r.checksum || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'COMPLETED' ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDownload(r)}
                                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setRestoreTarget({ record: r, configName: configNameById(r.configurationId) })
                                  setRestoreConfirmText('')
                                  setActionError(null)
                                }}
                                className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-amber-600"
                                title="Restore"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore confirmation modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="flex items-center text-lg font-semibold text-gray-900">
                <RotateCcw className="mr-2 h-5 w-5 text-amber-600" />
                Restore from backup
              </h3>
              <button onClick={() => setRestoreTarget(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  Restoring will overwrite current data with the contents of{' '}
                  <span className="font-mono">{restoreTarget.record.filename}</span>. This is destructive and cannot be undone.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Type the configuration name <span className="font-mono text-gray-900">{restoreTarget.configName}</span> to confirm
                </label>
                <input
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  placeholder={restoreTarget.configName}
                />
              </div>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={() => setRestoreTarget(null)}
                  disabled={restoring}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={restoring || restoreConfirmText !== restoreTarget.configName}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {restoring ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
      {children}
    </th>
  )
}
