'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Settings,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Lock,
  AlertCircle,
  X,
  RefreshCw
} from 'lucide-react'

// ADR-0016 Phase 4 — System Configuration admin page.
// Global scope only (workspaceId = null → platform admin). Secret values come
// back from the API masked as '***HIDDEN***'; we render them as bullets and,
// crucially, only send `value` on edit when the admin actually types a new one
// (the /system route has no mask-skip, so re-submitting the mask would clobber
// the real secret).

const DATA_TYPES = ['STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON', 'URL', 'EMAIL', 'PASSWORD', 'TEXT', 'ENUM'] as const

interface SystemConfig {
  id: string
  category: string
  key: string
  value: string
  dataType: string
  description: string | null
  isRequired: boolean
  isSecret: boolean
  defaultValue: string | null
  updatedAt: string
  updatedByUser?: { name: string | null; email: string | null } | null
}

interface CreateForm {
  category: string
  key: string
  value: string
  dataType: string
  description: string
  isRequired: boolean
  isSecret: boolean
  defaultValue: string
}

const emptyCreateForm: CreateForm = {
  category: '',
  key: '',
  value: '',
  dataType: 'STRING',
  description: '',
  isRequired: false,
  isSecret: false,
  defaultValue: ''
}

export default function SystemConfigurationPage() {
  const [grouped, setGrouped] = useState<Record<string, SystemConfig[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm)
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<SystemConfig | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editValueTouched, setEditValueTouched] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editIsRequired, setEditIsRequired] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/system')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setGrouped(data.configurations || {})
    } catch (e: any) {
      setError(e.message || 'Failed to load configurations')
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
        category: createForm.category.trim(),
        key: createForm.key.trim(),
        value: createForm.value,
        dataType: createForm.dataType,
        isRequired: createForm.isRequired,
        isSecret: createForm.isSecret
      }
      if (createForm.description.trim()) payload.description = createForm.description.trim()
      if (createForm.defaultValue.trim()) payload.defaultValue = createForm.defaultValue.trim()

      const res = await fetch('/api/admin/settings/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Create failed (${res.status})`)
      }
      setShowCreate(false)
      setCreateForm(emptyCreateForm)
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to create configuration')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (config: SystemConfig) => {
    setEditing(config)
    setEditValue(config.isSecret ? '' : config.value)
    setEditValueTouched(false)
    setEditDescription(config.description || '')
    setEditIsRequired(config.isRequired)
    setActionError(null)
  }

  const handleEdit = async () => {
    if (!editing) return
    setSaving(true)
    setActionError(null)
    try {
      const payload: any = {
        description: editDescription,
        isRequired: editIsRequired
      }
      // Only send value when the admin actually changed it. For secret rows the
      // field starts empty; sending the untouched/empty value would overwrite
      // the real secret with an empty string or the mask.
      if (editValueTouched) {
        payload.value = editValue
      } else if (!editing.isSecret) {
        payload.value = editValue
      }

      const res = await fetch(`/api/admin/settings/system/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Update failed (${res.status})`)
      }
      setEditing(null)
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (config: SystemConfig) => {
    if (config.isRequired) return
    if (!window.confirm(`Delete configuration "${config.category}.${config.key}"? This cannot be undone.`)) return
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/settings/system/${config.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Delete failed (${res.status})`)
      }
      await load()
    } catch (e: any) {
      setActionError(e.message || 'Failed to delete configuration')
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
            <Settings className="mr-3 h-6 w-6" />
            System Configuration
          </h1>
          <p className="mt-1 text-gray-600">
            Global platform settings (platform-admin scope). Secret values are masked.
          </p>
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
            onClick={() => { setShowCreate(true); setCreateForm(emptyCreateForm); setActionError(null) }}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Configuration
          </button>
        </div>
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
          <span className="ml-3 text-gray-600">Loading configurations…</span>
        </div>
      ) : error ? (
        <div className="flex items-start rounded-lg border border-red-200 bg-red-50 p-6">
          <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button onClick={load} className="mt-2 text-sm font-medium text-red-700 underline">
              Try again
            </button>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <Settings className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No global configurations yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create your first system configuration to get started.
          </p>
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
                {grouped[category].map((config) => (
                  <div key={config.id} className="flex items-start justify-between px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-900">{config.key}</span>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {config.dataType}
                        </span>
                        {config.isSecret && (
                          <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            <Lock className="mr-1 h-3 w-3" />
                            secret
                          </span>
                        )}
                        {config.isRequired && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            required
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-sm text-gray-700 break-all">
                        {config.isSecret ? '••••••••' : config.value || <span className="text-gray-400">(empty)</span>}
                      </div>
                      {config.description && (
                        <p className="mt-1 text-sm text-gray-500">{config.description}</p>
                      )}
                    </div>
                    <div className="ml-4 flex flex-shrink-0 gap-1">
                      <button
                        onClick={() => openEdit(config)}
                        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config)}
                        disabled={config.isRequired}
                        className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title={config.isRequired ? 'Required configurations cannot be deleted' : 'Delete'}
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

      {/* Create modal */}
      {showCreate && (
        <Modal title="New System Configuration" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category *">
                <input
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  placeholder="e.g. GENERAL"
                  className={inputClass}
                />
              </Field>
              <Field label="Key *">
                <input
                  value={createForm.key}
                  onChange={(e) => setCreateForm({ ...createForm, key: e.target.value })}
                  placeholder="e.g. site_name"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Data type *">
              <select
                value={createForm.dataType}
                onChange={(e) => setCreateForm({ ...createForm, dataType: e.target.value })}
                className={inputClass}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Value *">
              <input
                value={createForm.value}
                onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Default value">
              <input
                value={createForm.defaultValue}
                onChange={(e) => setCreateForm({ ...createForm, defaultValue: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createForm.isRequired}
                  onChange={(e) => setCreateForm({ ...createForm, isRequired: e.target.checked })}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createForm.isSecret}
                  onChange={(e) => setCreateForm({ ...createForm, isSecret: e.target.checked })}
                />
                Secret (mask value)
              </label>
            </div>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          </div>
          <ModalActions
            onCancel={() => setShowCreate(false)}
            onConfirm={handleCreate}
            confirmLabel="Create"
            saving={saving}
            disabled={!createForm.category.trim() || !createForm.key.trim() || createForm.value === ''}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal
          title={`Edit ${editing.category}.${editing.key}`}
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <Field label={editing.isSecret ? 'New value (leave blank to keep current secret)' : 'Value'}>
              <input
                type={editing.isSecret ? 'password' : 'text'}
                value={editValue}
                onChange={(e) => { setEditValue(e.target.value); setEditValueTouched(true) }}
                placeholder={editing.isSecret ? '•••••••• (unchanged)' : ''}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">Expected type: {editing.dataType}</p>
            </Field>
            <Field label="Description">
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editIsRequired}
                onChange={(e) => setEditIsRequired(e.target.checked)}
              />
              Required
            </label>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          </div>
          <ModalActions
            onCancel={() => setEditing(null)}
            onConfirm={handleEdit}
            confirmLabel="Save changes"
            saving={saving}
          />
        </Modal>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
  saving,
  disabled
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  saving: boolean
  disabled?: boolean
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t px-0 pt-4">
      <button
        onClick={onCancel}
        disabled={saving}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={saving || disabled}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : confirmLabel}
      </button>
    </div>
  )
}
