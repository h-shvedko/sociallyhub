'use client'

import { useState, useEffect } from 'react'
import {
  UserPlus,
  Users,
  Building,
  Mail,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  Search,
  KeyRound,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ADR-0012 (Phase 4 item 15): a real bulk-operations console.
//
// No fabricated identities: users come from GET /api/admin/users, the workspace
// dropdown from GET /api/admin/workspaces, and role options from the
// WorkspaceRole enum. CSV import is resolved server-side — known emails become
// real selected users, unknown emails become invitations. There is no
// `demo-user-1` seed and no `user_${localpart}` id fabrication.

interface AdminUser {
  id: string
  email: string
  name: string | null
}

interface WorkspaceOption {
  id: string
  name: string
}

interface OperationField {
  name: 'workspaceId' | 'role'
  type: 'workspaceSelect' | 'roleSelect'
  required: boolean
}

interface OperationTemplate {
  id: string
  name: string
  description: string
  operation: string
  icon: LucideIcon
  color: string
  // Invitation operations act on emails (existing users + brand-new addresses);
  // every other operation acts on selected existing users.
  isInvitation?: boolean
  fields: OperationField[]
}

interface OperationRecord {
  operation: string
  affected: number
  createdAt: string
  status: 'completed' | 'failed'
  results: {
    success: number
    failed: number
    errors: string[]
    processedUsers: Array<{
      userId?: string
      email?: string
      status: 'success' | 'skipped' | 'failed'
      error?: string
    }>
  }
}

// The five WorkspaceRole values are the platform authorization primitive
// (ADR-0004). OWNER is deliberately omitted from bulk grants to avoid
// accidental ownership transfer; the API still validates any submitted role.
const WORKSPACE_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PUBLISHER', label: 'Publisher' },
  { value: 'ANALYST', label: 'Analyst' },
  { value: 'CLIENT_VIEWER', label: 'Client Viewer' },
]

const OPERATION_TEMPLATES: OperationTemplate[] = [
  {
    id: 'add_to_workspace',
    name: 'Add to Workspace',
    description: 'Add selected users to a workspace with a role',
    operation: 'add_to_workspace',
    icon: Building,
    color: 'green',
    fields: [
      { name: 'workspaceId', type: 'workspaceSelect', required: true },
      { name: 'role', type: 'roleSelect', required: true },
    ],
  },
  {
    id: 'remove_from_workspace',
    name: 'Remove from Workspace',
    description: 'Remove selected users from a workspace',
    operation: 'remove_from_workspace',
    icon: Building,
    color: 'orange',
    fields: [{ name: 'workspaceId', type: 'workspaceSelect', required: true }],
  },
  {
    id: 'send_invitation',
    name: 'Send Invitations',
    description: 'Invite people (existing or new emails) to a workspace',
    operation: 'send_invitation',
    icon: Mail,
    color: 'purple',
    isInvitation: true,
    fields: [
      { name: 'workspaceId', type: 'workspaceSelect', required: true },
      { name: 'role', type: 'roleSelect', required: true },
    ],
  },
  {
    id: 'activate_users',
    name: 'Activate Users',
    description: 'Restore sign-in access for selected users',
    operation: 'activate_users',
    icon: CheckCircle,
    color: 'green',
    fields: [],
  },
  {
    id: 'deactivate_users',
    name: 'Deactivate Users',
    description: 'Revoke sign-in access for selected users',
    operation: 'deactivate_users',
    icon: XCircle,
    color: 'red',
    fields: [],
  },
  {
    id: 'reset_passwords',
    name: 'Send Password Reset',
    description: 'Email a password reset link to selected users',
    operation: 'reset_passwords',
    icon: KeyRound,
    color: 'blue',
    fields: [],
  },
]

export default function BulkOperationsPage() {
  const [selectedUsers, setSelectedUsers] = useState<AdminUser[]>([])
  const [unknownEmails, setUnknownEmails] = useState<string[]>([])
  const [selectedOperation, setSelectedOperation] = useState<OperationTemplate | null>(null)
  const [operationData, setOperationData] = useState<Record<string, string>>({})
  const [recentOperations, setRecentOperations] = useState<OperationRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [csvInput, setCsvInput] = useState('')
  const [importMethod, setImportMethod] = useState<'manual' | 'csv'>('manual')
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<AdminUser[]>([])
  const [searching, setSearching] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Load real workspaces for the dropdowns.
  useEffect(() => {
    let cancelled = false
    const loadWorkspaces = async () => {
      try {
        const res = await fetch('/api/admin/workspaces')
        if (!res.ok) throw new Error(`Failed to load workspaces (${res.status})`)
        const data = await res.json()
        const list: WorkspaceOption[] = (data.workspaces || []).map(
          (w: { id: string; name: string }) => ({ id: w.id, name: w.name })
        )
        if (!cancelled) {
          setWorkspaces(list)
          setWorkspacesError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setWorkspacesError(err instanceof Error ? err.message : 'Failed to load workspaces')
        }
      }
    }
    void loadWorkspaces()
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced real user search against GET /api/admin/users.
  useEffect(() => {
    const term = searchTerm.trim()
    if (term.length === 0) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)
    const runSearch = async () => {
      try {
        const res = await fetch(
          `/api/admin/users?search=${encodeURIComponent(term)}&limit=20`
        )
        if (!res.ok) throw new Error('search failed')
        const data = await res.json()
        const results: AdminUser[] = (data.users || []).map(
          (u: { id: string; email: string; name: string | null }) => ({
            id: u.id,
            email: u.email,
            name: u.name,
          })
        )
        if (!cancelled) setSearchResults(results)
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }
    const handle = setTimeout(() => void runSearch(), 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [searchTerm])

  const isSelected = (id: string) => selectedUsers.some((u) => u.id === id)

  const toggleUser = (user: AdminUser) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    )
  }

  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id))
  }

  const clearSelection = () => {
    setSelectedUsers([])
    setUnknownEmails([])
  }

  // Resolve pasted emails server-side: known -> real selected users,
  // unknown -> candidates for invitation.
  const handleCsvResolve = async () => {
    const emails = csvInput
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter((line) => line.includes('@'))

    if (emails.length === 0) {
      setNotice('Enter at least one email address.')
      return
    }

    try {
      setLoading(true)
      setNotice(null)
      const res = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'resolve_emails', data: { emails } }),
      })
      if (!res.ok) throw new Error('Failed to resolve emails')
      const data = await res.json()
      const known: AdminUser[] = (data.known || []).map(
        (u: { id: string; email: string; name: string | null }) => ({
          id: u.id,
          email: u.email,
          name: u.name,
        })
      )
      const unknown: string[] = data.unknown || []

      setSelectedUsers((prev) => {
        const byId = new Map(prev.map((u) => [u.id, u]))
        known.forEach((u) => byId.set(u.id, u))
        return Array.from(byId.values())
      })
      setUnknownEmails((prev) => Array.from(new Set([...prev, ...unknown])))
      setCsvInput('')
      setNotice(
        `Resolved ${known.length} existing user${known.length === 1 ? '' : 's'}; ` +
          `${unknown.length} unknown email${unknown.length === 1 ? '' : 's'} (invite only).`
      )
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to resolve emails')
    } finally {
      setLoading(false)
    }
  }

  const invitationEmails = () =>
    Array.from(
      new Set([...selectedUsers.map((u) => u.email), ...unknownEmails])
    )

  const canExecute = (): boolean => {
    if (!selectedOperation || loading) return false
    for (const field of selectedOperation.fields) {
      if (field.required && !operationData[field.name]) return false
    }
    if (selectedOperation.isInvitation) {
      return invitationEmails().length > 0
    }
    return selectedUsers.length > 0
  }

  const handleOperationSubmit = async () => {
    if (!selectedOperation || !canExecute()) return

    const op = selectedOperation
    let payload: Record<string, unknown>

    if (op.isInvitation) {
      payload = {
        operation: op.operation,
        data: { ...operationData, emails: invitationEmails() },
      }
    } else {
      payload = {
        operation: op.operation,
        userIds: selectedUsers.map((u) => u.id),
        data: operationData,
      }
    }

    try {
      setLoading(true)
      setNotice(null)
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        setNotice(result?.error || 'Operation failed')
        return
      }

      const record: OperationRecord = {
        operation: op.operation,
        affected: result.processedUsers?.length ?? 0,
        createdAt: new Date().toISOString(),
        status: result.failed > 0 && result.success === 0 ? 'failed' : 'completed',
        results: result,
      }
      setRecentOperations((prev) => [record, ...prev.slice(0, 9)])

      // Reset the form after a run.
      clearSelection()
      setSelectedOperation(null)
      setOperationData({})
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to execute bulk operation')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const totalTargets = selectedOperation?.isInvitation
    ? invitationEmails().length
    : selectedUsers.length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <UserPlus className="mr-3 h-6 w-6" />
          Bulk User Operations
        </h1>
        <p className="text-gray-600 mt-1">
          Perform mass operations on real users across the platform
        </p>
      </div>

      {notice && (
        <div className="mb-4 flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-4 text-blue-600 hover:text-blue-800">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operation Setup Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Selection */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Select Users
            </h3>

            <div className="flex space-x-4 mb-4">
              <button
                onClick={() => setImportMethod('manual')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  importMethod === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Search Users
              </button>
              <button
                onClick={() => setImportMethod('csv')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  importMethod === 'csv'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Import Emails
              </button>
            </div>

            {importMethod === 'manual' ? (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y">
                  {searching && (
                    <div className="p-4 text-sm text-gray-500 flex items-center">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Searching...
                    </div>
                  )}
                  {!searching && searchTerm.trim() === '' && (
                    <div className="p-4 text-sm text-gray-500">
                      Type to search for users by name or email.
                    </div>
                  )}
                  {!searching && searchTerm.trim() !== '' && searchResults.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">No users found.</div>
                  )}
                  {searchResults.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected(user.id)}
                        onChange={() => toggleUser(user)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-3"
                      />
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-gray-900">
                          {user.name || user.email}
                        </span>
                        <span className="block text-xs text-gray-500">{user.email}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste emails (one per line or comma-separated):
                </label>
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder={'user1@example.com\nuser2@example.com'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  rows={6}
                />
                <button
                  onClick={() => void handleCsvResolve()}
                  disabled={loading}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Resolve Emails
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Known emails are matched to existing accounts. Unknown emails can
                  only receive workspace invitations.
                </p>
              </div>
            )}

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-full px-3 py-1"
                    >
                      {user.name || user.email}
                      <button
                        onClick={() => removeUser(user.id)}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                        aria-label={`Remove ${user.email}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unknown emails (invite-only) */}
            {unknownEmails.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {unknownEmails.length} unknown email{unknownEmails.length === 1 ? '' : 's'}{' '}
                    (invitation only)
                  </span>
                  <button
                    onClick={() => setUnknownEmails([])}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {unknownEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-full px-3 py-1"
                    >
                      {email}
                      <button
                        onClick={() =>
                          setUnknownEmails((prev) => prev.filter((e) => e !== email))
                        }
                        className="ml-2 text-purple-500 hover:text-purple-700"
                        aria-label={`Remove ${email}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Operation Selection */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Play className="mr-2 h-5 w-5" />
              Choose Operation
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OPERATION_TEMPLATES.map((template) => {
                const Icon = template.icon
                const selected = selectedOperation?.id === template.id
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedOperation(template)
                      setOperationData({})
                    }}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <div className="p-2 rounded-lg mr-3 bg-gray-100">
                        <Icon className="h-5 w-5 text-gray-700" />
                      </div>
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Operation Configuration */}
          {selectedOperation && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Configure Operation
              </h3>

              {selectedOperation.isInvitation && unknownEmails.length === 0 && selectedUsers.length === 0 && (
                <p className="mb-4 text-sm text-gray-500">
                  Select users or import emails above to invite them.
                </p>
              )}
              {!selectedOperation.isInvitation && unknownEmails.length > 0 && (
                <p className="mb-4 text-sm text-orange-600">
                  {unknownEmails.length} unknown email
                  {unknownEmails.length === 1 ? '' : 's'} will be ignored — this
                  operation only affects existing users.
                </p>
              )}

              <div className="space-y-4">
                {selectedOperation.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                      {field.name === 'workspaceId' ? 'Workspace' : 'Role'}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.type === 'workspaceSelect' && (
                      <>
                        <select
                          value={operationData.workspaceId || ''}
                          onChange={(e) =>
                            setOperationData((prev) => ({
                              ...prev,
                              workspaceId: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select a workspace</option>
                          {workspaces.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                        {workspacesError && (
                          <p className="mt-1 text-xs text-red-600">{workspacesError}</p>
                        )}
                      </>
                    )}

                    {field.type === 'roleSelect' && (
                      <select
                        value={operationData.role || ''}
                        onChange={(e) =>
                          setOperationData((prev) => ({ ...prev, role: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select a role</option>
                        {WORKSPACE_ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <button
                    onClick={() => void handleOperationSubmit()}
                    disabled={!canExecute()}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        {selectedOperation.name} ({totalTargets})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Operations Panel */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Recent Operations
          </h3>

          {recentOperations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No recent operations</p>
              <p className="text-sm text-gray-400 mt-1">
                Execute a bulk operation to see results here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOperations.map((operation, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getStatusIcon(operation.status)}
                      <span className="ml-2 text-sm font-medium">
                        {operation.operation
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(operation.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 mb-2">
                    {operation.affected} target{operation.affected === 1 ? '' : 's'} processed
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center">
                      <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                      <span>{operation.results.success} successful</span>
                    </div>
                    <div className="flex items-center">
                      <XCircle className="h-3 w-3 text-red-500 mr-1" />
                      <span>{operation.results.failed} failed</span>
                    </div>
                  </div>

                  {operation.results.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      {operation.results.errors.slice(0, 2).map((error, i) => (
                        <div key={i}>• {error}</div>
                      ))}
                      {operation.results.errors.length > 2 && (
                        <div>• +{operation.results.errors.length - 2} more errors</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
