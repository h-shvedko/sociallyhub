'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Mail,
  ArrowLeft,
  Pencil,
  Eye,
  Lock,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react'

// ADR-0016 Phase 4 — Email Templates admin page.
// Workspace-scoped (EmailTemplate.workspaceId is required). The admin picks a
// workspace, we list its templates grouped by category, and offer view / edit
// / preview. isSystem templates are protected (no edit, no delete — the API
// enforces this too).

interface Workspace {
  id: string
  name: string
}

interface EmailTemplate {
  id: string
  workspaceId: string
  name: string
  slug: string
  category: string
  subject: string
  htmlContent: string
  textContent: string | null
  isActive: boolean
  isSystem: boolean
  lastUsed: string | null
  updatedAt: string
}

interface PreviewData {
  subject: string
  htmlContent: string
  textContent: string | null
}

export default function EmailTemplatesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [wsLoading, setWsLoading] = useState(true)
  const [wsError, setWsError] = useState<string | null>(null)

  const [grouped, setGrouped] = useState<Record<string, EmailTemplate[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [editForm, setEditForm] = useState({ name: '', subject: '', htmlContent: '', textContent: '', isActive: true })
  const [saving, setSaving] = useState(false)

  const [preview, setPreview] = useState<{ template: EmailTemplate; data: PreviewData } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load workspaces once; default to the first.
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
      const res = await fetch(`/api/admin/settings/email-templates?workspaceId=${encodeURIComponent(workspaceId)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setGrouped(data.templates || {})
    } catch (e: any) {
      setError(e.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = (t: EmailTemplate) => {
    setEditing(t)
    setEditForm({
      name: t.name,
      subject: t.subject,
      htmlContent: t.htmlContent,
      textContent: t.textContent || '',
      isActive: t.isActive
    })
    setActionError(null)
  }

  const handleEdit = async () => {
    if (!editing) return
    setSaving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/settings/email-templates/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          subject: editForm.subject,
          htmlContent: editForm.htmlContent,
          textContent: editForm.textContent || null,
          isActive: editForm.isActive
        })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Update failed (${res.status})`)
      }
      setEditing(null)
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  const openPreview = async (t: EmailTemplate) => {
    setPreviewLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/settings/email-templates/${t.id}/preview`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Preview failed (${res.status})`)
      }
      const data = await res.json()
      setPreview({ template: t, data: data.preview })
    } catch (e: any) {
      setActionError(e.message || 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const categories = Object.keys(grouped).sort()
  const totalCount = categories.reduce((sum, c) => sum + grouped[c].length, 0)

  return (
    <div className="p-6">
      {/* Header */}
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
            <Mail className="mr-3 h-6 w-6" />
            Email Templates
          </h1>
          <p className="mt-1 text-gray-600">
            Per-workspace email templates. System templates are read-only.
          </p>
        </div>
        <button
          onClick={load}
          disabled={!workspaceId}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
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
          <span className="ml-3 text-gray-600">Loading templates…</span>
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
          <Mail className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No email templates in this workspace</h3>
          <p className="mt-1 text-sm text-gray-500">There are no templates configured for the selected workspace.</p>
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
                {grouped[category].map((t) => (
                  <div key={t.id} className="flex items-start justify-between px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                        <span className="font-mono text-xs text-gray-400">{t.slug}</span>
                        {t.isSystem && (
                          <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            <Lock className="mr-1 h-3 w-3" />
                            system
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            t.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {t.isActive ? 'active' : 'inactive'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-gray-600">{t.subject}</p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => openPreview(t)}
                        disabled={previewLoading}
                        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(t)}
                        disabled={t.isSystem}
                        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title={t.isSystem ? 'System templates are read-only' : 'Edit'}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit template: {editing.name}</h3>
              <button onClick={() => setEditing(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
                <input
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">HTML content</label>
                <textarea
                  value={editForm.htmlContent}
                  onChange={(e) => setEditForm({ ...editForm, htmlContent: e.target.value })}
                  rows={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Text content (optional)</label>
                <textarea
                  value={editForm.textContent}
                  onChange={(e) => setEditForm({ ...editForm, textContent: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Active
              </label>
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={() => setEditing(null)}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Preview: {preview.template.name}</h3>
                <p className="text-sm text-gray-500">Variables filled with sample data by the API.</p>
              </div>
              <button onClick={() => setPreview(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Subject</span>
                <p className="mt-1 rounded bg-gray-50 px-3 py-2 text-sm text-gray-900">{preview.data.subject}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">HTML preview</span>
                <div className="mt-1 overflow-x-auto rounded border">
                  <iframe
                    title="email-preview"
                    srcDoc={preview.data.htmlContent}
                    className="h-96 w-full bg-white"
                    sandbox=""
                  />
                </div>
              </div>
              {preview.data.textContent && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Text version</span>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    {preview.data.textContent}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
