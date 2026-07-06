'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Flag,
  ArrowLeft,
  Plus,
  AlertCircle,
  X,
  RefreshCw,
  Info
} from 'lucide-react'

// ADR-0016 Phase 4 — Feature Flags admin page. Global scope (platform admin).
//
// IMPORTANT: there is currently NO `/api/admin/settings/feature-flags/[id]`
// route — only GET (list) and POST (create) exist. So this page is honestly
// read-only for existing flags (rollout %, active state, targeting and
// prerequisites are shown but cannot be edited here) plus a create form. A
// future ADR must add the [id] PUT route before inline toggle/rollout editing
// can be wired without faking success.

const CATEGORIES = [
  'FEATURE', 'EXPERIMENT', 'ROLLOUT', 'KILL_SWITCH', 'PERMISSION',
  'CONFIGURATION', 'UI_VARIATION', 'INTEGRATION', 'PERFORMANCE', 'SECURITY'
] as const

const ENVIRONMENTS = ['DEVELOPMENT', 'STAGING', 'PRODUCTION', 'TEST'] as const

interface FeatureFlag {
  id: string
  name: string
  key: string
  description: string | null
  category: string
  isActive: boolean
  rolloutPercent: number
  environment: string
  userTargeting: any
  groupTargeting: any
  geoTargeting: any
  timeTargeting: any
  prerequisites: any
  tags: string[]
  evaluationCount?: number
}

interface CreateForm {
  name: string
  key: string
  description: string
  category: string
  environment: string
  isActive: boolean
  rolloutPercent: number
}

const emptyForm: CreateForm = {
  name: '',
  key: '',
  description: '',
  category: 'FEATURE',
  environment: 'PRODUCTION',
  isActive: false,
  rolloutPercent: 0
}

export default function FeatureFlagsPage() {
  const [grouped, setGrouped] = useState<Record<string, FeatureFlag[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/feature-flags')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setGrouped(data.flags || {})
    } catch (e: any) {
      setError(e.message || 'Failed to load feature flags')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setSaving(true)
    setActionError(null)
    try {
      const payload: any = {
        name: form.name.trim(),
        key: form.key.trim(),
        category: form.category,
        environment: form.environment,
        isActive: form.isActive,
        rolloutPercent: form.rolloutPercent
      }
      if (form.description.trim()) payload.description = form.description.trim()

      const res = await fetch('/api/admin/settings/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Create failed (${res.status})`)
      }
      setShowCreate(false)
      setForm(emptyForm)
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to create feature flag')
    } finally {
      setSaving(false)
    }
  }

  const hasTargeting = (f: FeatureFlag) =>
    !!(f.userTargeting || f.groupTargeting || f.geoTargeting || f.timeTargeting || f.prerequisites)

  const categories = Object.keys(grouped).sort()
  const totalCount = categories.reduce((sum, c) => sum + grouped[c].length, 0)

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
            <Flag className="mr-3 h-6 w-6" />
            Feature Flags
          </h1>
          <p className="mt-1 text-gray-600">Global feature flags and rollout state.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => { setForm(emptyForm); setActionError(null); setShowCreate(true) }}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Flag
          </button>
        </div>
      </div>

      {/* Honest read-only notice */}
      <div className="mb-6 flex items-start rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="mr-3 h-5 w-5 flex-shrink-0 text-blue-600" />
        <p className="text-sm text-blue-800">
          Existing flags are read-only here. There is no update endpoint yet
          (<code className="rounded bg-blue-100 px-1">/api/admin/settings/feature-flags/[id]</code> does not exist),
          so rollout percentage, active state and targeting cannot be edited from this page. You can still create new flags.
        </p>
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
          <span className="ml-3 text-gray-600">Loading feature flags…</span>
        </div>
      ) : error ? (
        <div className="flex items-start rounded-lg border border-red-200 bg-red-50 p-6">
          <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button onClick={load} className="mt-2 text-sm font-medium text-red-700 underline">Try again</button>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Flag className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No feature flags yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first global feature flag.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category} className="rounded-lg border bg-white">
              <div className="border-b px-6 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  {category} <span className="text-gray-400">({grouped[category].length})</span>
                </h2>
              </div>
              <div className="divide-y">
                {grouped[category].map((f) => (
                  <div key={f.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{f.name}</span>
                          <span className="font-mono text-xs text-gray-400">{f.key}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              f.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {f.isActive ? 'active' : 'inactive'}
                          </span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                            {f.environment}
                          </span>
                          {hasTargeting(f) && (
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                              targeting
                            </span>
                          )}
                        </div>
                        {f.description && <p className="mt-1 text-sm text-gray-600">{f.description}</p>}
                        {f.tags?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {f.tags.map((tag) => (
                              <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ml-4 w-40 flex-shrink-0">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>rollout</span>
                          <span className="font-medium text-gray-900">{f.rolloutPercent}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-600"
                            style={{ width: `${Math.min(100, Math.max(0, f.rolloutPercent))}%` }}
                          />
                        </div>
                        {typeof f.evaluationCount === 'number' && (
                          <p className="mt-1 text-right text-xs text-gray-400">
                            {f.evaluationCount} evaluations
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">New feature flag</h3>
              <button onClick={() => setShowCreate(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Key *</label>
                  <input
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                    placeholder="e.g. new_dashboard"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Environment</label>
                  <select
                    value={form.environment}
                    onChange={(e) => setForm({ ...form, environment: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    {ENVIRONMENTS.map((env) => (
                      <option key={env} value={env}>{env}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Rollout percentage: {form.rolloutPercent}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.rolloutPercent}
                  onChange={(e) => setForm({ ...form, rolloutPercent: parseInt(e.target.value, 10) })}
                  className="w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim() || !form.key.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
