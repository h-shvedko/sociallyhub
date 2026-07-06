'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Globe,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  X,
  RefreshCw,
  Lock
} from 'lucide-react'

// ADR-0016 Phase 4 — Integrations admin page.
// Workspace-scoped (IntegrationSetting.workspaceId required). Credentials and
// webhookSecret come back masked as '***HIDDEN***'. The API treats a
// re-submitted '***HIDDEN***' as "no change", so we leave those fields blank on
// edit and only send a new value when the admin actually types one — the mask
// is never written back over real secrets.

const PROVIDERS = [
  'DISCORD', 'SLACK', 'ZAPIER', 'GOOGLE_ANALYTICS', 'FACEBOOK_PIXEL',
  'STRIPE', 'PAYPAL', 'MAILCHIMP', 'SENDGRID', 'TWILIO', 'AWS', 'AZURE',
  'GCP', 'GITHUB', 'GITLAB', 'JIRA', 'ASANA', 'TRELLO', 'NOTION',
  'AIRTABLE', 'HUBSPOT', 'SALESFORCE', 'ZOOM', 'TEAMS', 'CALENDLY',
  'TYPEFORM', 'INTERCOM', 'ZENDESK', 'FRESHDESK', 'CUSTOM'
] as const

interface Workspace {
  id: string
  name: string
}

interface Integration {
  id: string
  workspaceId: string
  provider: string
  name: string
  config: any
  credentials: string | null // masked ('***HIDDEN***') or null
  isActive: boolean
  isConfigured: boolean
  webhookUrl: string | null
  webhookSecret: string | null // masked or null
  errorCount: number
  lastError: string | null
  updatedAt: string
}

interface FormState {
  provider: string
  name: string
  config: string // JSON text
  credentials: string
  credentialsTouched: boolean
  webhookUrl: string
  webhookSecret: string
  webhookSecretTouched: boolean
  isActive: boolean
}

const emptyForm: FormState = {
  provider: 'CUSTOM',
  name: '',
  config: '{}',
  credentials: '',
  credentialsTouched: false,
  webhookUrl: '',
  webhookSecret: '',
  webhookSecretTouched: false,
  isActive: true
}

export default function IntegrationsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [wsLoading, setWsLoading] = useState(true)
  const [wsError, setWsError] = useState<string | null>(null)

  const [grouped, setGrouped] = useState<Record<string, Integration[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadWorkspaces = async () => {
      setWsLoading(true)
      setWsError(null)
      try {
        const res = await fetch('/api/admin/workspaces')
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed to load workspaces (${res.status})`)
        }
        const data = await res.json()
        const list: Workspace[] = data.workspaces ?? []
        setWorkspaces(list)
        if (list[0]) setWorkspaceId(list[0].id)
      } catch (e: any) {
        setWsError(e.message || 'Failed to load workspaces')
      } finally {
        setWsLoading(false)
      }
    }
    loadWorkspaces()
  }, [])

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/settings/integrations?workspaceId=${encodeURIComponent(workspaceId)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setGrouped(data.integrations || {})
    } catch (e: any) {
      setError(e.message || 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setActionError(null)
    setShowForm(true)
  }

  const openEdit = (i: Integration) => {
    setEditingId(i.id)
    setForm({
      provider: i.provider,
      name: i.name,
      config: JSON.stringify(i.config ?? {}, null, 2),
      credentials: '',
      credentialsTouched: false,
      webhookUrl: i.webhookUrl || '',
      webhookSecret: '',
      webhookSecretTouched: false,
      isActive: i.isActive
    })
    setActionError(null)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setActionError(null)
    try {
      let parsedConfig: any
      try {
        parsedConfig = JSON.parse(form.config || '{}')
      } catch {
        throw new Error('Config must be valid JSON')
      }

      const isEdit = !!editingId
      const payload: any = {
        name: form.name.trim(),
        config: parsedConfig,
        webhookUrl: form.webhookUrl.trim() || null,
        isActive: form.isActive
      }
      if (!isEdit) {
        payload.workspaceId = workspaceId
        payload.provider = form.provider
      }
      // Only send secrets when the admin actually typed a new value. Leaving
      // them out (or sending the mask) means "no change" per the API contract.
      if (form.credentialsTouched && form.credentials) {
        payload.credentials = form.credentials
      }
      if (form.webhookSecretTouched && form.webhookSecret) {
        payload.webhookSecret = form.webhookSecret
      }

      const url = isEdit
        ? `/api/admin/settings/integrations/${editingId}`
        : '/api/admin/settings/integrations'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (${res.status})`)
      }
      setShowForm(false)
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to save integration')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (i: Integration) => {
    if (!window.confirm(`Delete integration "${i.provider} · ${i.name}"? This cannot be undone.`)) return
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/settings/integrations/${i.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Delete failed (${res.status})`)
      }
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to delete integration')
    }
  }

  const providers = Object.keys(grouped).sort()
  const totalCount = providers.reduce((sum, p) => sum + grouped[p].length, 0)

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
            <Globe className="mr-3 h-6 w-6" />
            Integrations
          </h1>
          <p className="mt-1 text-gray-600">
            Per-workspace third-party integrations. Credentials are stored encrypted and shown masked.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={!workspaceId}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={openCreate}
            disabled={!workspaceId}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Integration
          </button>
        </div>
      </div>

      {/* Workspace selector */}
      <div className="mb-6 rounded-lg border bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">Workspace</label>
        {wsLoading ? (
          <div className="h-9 w-64 animate-pulse rounded bg-gray-100" />
        ) : wsError ? (
          <p className="text-sm text-red-600">{wsError}</p>
        ) : workspaces.length === 0 ? (
          <p className="text-sm text-gray-500">No workspaces available.</p>
        ) : (
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        )}
      </div>

      {actionError && (
        <div className="mb-4 flex items-start rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {!workspaceId ? null : loading ? (
        <div className="flex items-center justify-center rounded-lg border bg-white py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Loading integrations…</span>
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
          <Globe className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No integrations in this workspace</h3>
          <p className="mt-1 text-sm text-gray-500">Create an integration to connect a third-party provider.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {providers.map((provider) => (
            <div key={provider} className="rounded-lg border bg-white">
              <div className="border-b px-6 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  {provider} <span className="text-gray-400">({grouped[provider].length})</span>
                </h2>
              </div>
              <div className="divide-y">
                {grouped[provider].map((i) => (
                  <div key={i.id} className="flex items-start justify-between px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{i.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            i.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {i.isActive ? 'active' : 'inactive'}
                        </span>
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                            i.isConfigured ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          <Lock className="mr-1 h-3 w-3" />
                          {i.isConfigured ? 'credentials set' : 'not configured'}
                        </span>
                        {i.errorCount > 0 && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            {i.errorCount} error{i.errorCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      {i.webhookUrl && (
                        <p className="mt-1 truncate font-mono text-xs text-gray-500">webhook: {i.webhookUrl}</p>
                      )}
                      {i.lastError && (
                        <p className="mt-1 text-xs text-red-600">Last error: {i.lastError}</p>
                      )}
                    </div>
                    <div className="ml-4 flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(i)}
                        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(i)}
                        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit integration' : 'New integration'}
              </h3>
              <button onClick={() => setShowForm(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Provider</label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  disabled={!!editingId}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {editingId && <p className="mt-1 text-xs text-gray-500">Provider cannot be changed after creation.</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Config (JSON) *</label>
                <textarea
                  value={form.config}
                  onChange={(e) => setForm({ ...form, config: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Credentials {editingId ? '(leave blank to keep current)' : '(JSON or token)'}
                </label>
                <input
                  type="password"
                  value={form.credentials}
                  onChange={(e) => setForm({ ...form, credentials: e.target.value, credentialsTouched: true })}
                  placeholder={editingId ? '•••••••• (unchanged)' : ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Stored encrypted; never displayed after saving.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Webhook URL</label>
                <input
                  value={form.webhookUrl}
                  onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Webhook secret {editingId ? '(leave blank to keep current)' : ''}
                </label>
                <input
                  type="password"
                  value={form.webhookSecret}
                  onChange={(e) => setForm({ ...form, webhookSecret: e.target.value, webhookSecretTouched: true })}
                  placeholder={editingId ? '•••••••• (unchanged)' : ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
