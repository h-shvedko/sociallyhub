'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Building,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

// ADR-0004 / ADR-0012: WorkspaceRole is the enforcement primitive. The custom
// Role/UserRole catalog was cut; the only cross-tenant capability is the
// `isPlatformAdmin` flag on User.
const WORKSPACE_ROLES: Array<{ value: string; label: string }> = [
  { value: 'OWNER', label: 'Owner' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'PUBLISHER', label: 'Publisher' },
  { value: 'ANALYST', label: 'Analyst' },
  { value: 'CLIENT_VIEWER', label: 'Client Viewer' },
]

interface WorkspaceMembership {
  role: string
  workspace: {
    id: string
    name: string
  }
}

interface User {
  id: string
  email: string
  name: string
  image?: string
  // emailVerified is a nullable DateTime serialized to a string (or null).
  emailVerified: string | null
  twoFactorEnabled: boolean
  isPlatformAdmin: boolean
  timezone: string
  locale: string
  createdAt: string
  updatedAt: string
  workspaces: WorkspaceMembership[]
  userSessions: Array<{
    id: string
    lastActivity: string
    ip?: string | null
  }>
  _count: {
    userActivities: number
    auditLogs: number
    userSessions: number
  }
}

interface UserStats {
  total: number
  active: number
  verified: number
  twoFactorEnabled: number
}

interface WorkspaceOption {
  id: string
  name: string
}

// Draft membership rows managed inside the create/edit form.
interface MembershipDraft {
  workspaceId: string
  role: string
}

export default function UserAdministrationPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, verified: 0, twoFactorEnabled: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showBulkModal, setShowBulkModal] = useState(false)

  // Fetched workspace list (best source). Falls back to memberships aggregated
  // from the loaded users so the membership picker always has real options.
  const [fetchedWorkspaces, setFetchedWorkspaces] = useState<WorkspaceOption[]>([])

  // Create/edit form state
  const [showUserModal, setShowUserModal] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formIsPlatformAdmin, setFormIsPlatformAdmin] = useState(false)
  const [formMemberships, setFormMemberships] = useState<MembershipDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [hardDelete, setHardDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Transient success/error banner
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/admin/workspaces')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.workspaces)) {
          setFetchedWorkspaces(
            data.workspaces.map((w: { id: string; name: string }) => ({ id: w.id, name: w.name }))
          )
        }
      }
    } catch {
      // Non-fatal: the membership picker falls back to workspaces already
      // referenced by the loaded users.
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchWorkspaces()
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  // Deduped, real workspace options: prefer the admin workspaces endpoint,
  // fall back to workspaces present on the loaded users. Never fabricated.
  const workspaceOptions = useMemo<WorkspaceOption[]>(() => {
    const map = new Map<string, string>()
    fetchedWorkspaces.forEach((w) => map.set(w.id, w.name))
    users.forEach((u) =>
      u.workspaces.forEach((ws) => {
        if (!map.has(ws.workspace.id)) map.set(ws.workspace.id, ws.workspace.name)
      })
    )
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [fetchedWorkspaces, users])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = !roleFilter || user.workspaces.some((ws) => ws.role === roleFilter)
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'verified' && !!user.emailVerified) ||
      (statusFilter === 'unverified' && !user.emailVerified) ||
      (statusFilter === '2fa' && user.twoFactorEnabled) ||
      (statusFilter === 'platform-admin' && user.isPlatformAdmin) ||
      (statusFilter === 'active' && user.userSessions.length > 0)
    return matchesSearch && matchesRole && matchesStatus
  })

  const getLastActivity = (user: User) => {
    if (user.userSessions.length === 0) return 'Never'
    const lastActivity = new Date(user.userSessions[0].lastActivity)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Active now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) return `${diffInDays}d ago`
    return lastActivity.toLocaleDateString()
  }

  const getStatusBadge = (user: User) => {
    if (!user.emailVerified) {
      return { label: 'Unverified', color: 'bg-red-100 text-red-800' }
    }
    if (user.userSessions.length === 0) {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-800' }
    }
    const lastActivity = new Date(user.userSessions[0].lastActivity)
    const hoursAgo = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60))

    if (hoursAgo < 1) return { label: 'Online', color: 'bg-green-100 text-green-800' }
    if (hoursAgo < 24) return { label: 'Active', color: 'bg-blue-100 text-blue-800' }
    return { label: 'Away', color: 'bg-yellow-100 text-yellow-800' }
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map((user) => user.id))
    }
  }

  // ----- Create / Edit modal -----

  const openCreateModal = () => {
    setFormMode('create')
    setEditingUserId(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormIsPlatformAdmin(false)
    setFormMemberships([])
    setFormError(null)
    setShowUserModal(true)
  }

  const openEditModal = (user: User) => {
    setFormMode('edit')
    setEditingUserId(user.id)
    setFormName(user.name || '')
    setFormEmail(user.email || '')
    setFormPassword('')
    setFormIsPlatformAdmin(!!user.isPlatformAdmin)
    setFormMemberships(
      user.workspaces.map((ws) => ({ workspaceId: ws.workspace.id, role: ws.role }))
    )
    setFormError(null)
    setShowUserModal(true)
  }

  const closeUserModal = () => {
    if (saving) return
    setShowUserModal(false)
    setEditingUserId(null)
  }

  const addMembershipRow = () => {
    const used = new Set(formMemberships.map((m) => m.workspaceId))
    const nextWorkspace = workspaceOptions.find((w) => !used.has(w.id)) || workspaceOptions[0]
    if (!nextWorkspace) return
    setFormMemberships((prev) => [...prev, { workspaceId: nextWorkspace.id, role: 'ANALYST' }])
  }

  const updateMembership = (index: number, patch: Partial<MembershipDraft>) => {
    setFormMemberships((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...patch } : m))
    )
  }

  const removeMembershipRow = (index: number) => {
    setFormMemberships((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmitUser = async () => {
    setFormError(null)

    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Name and email are required.')
      return
    }
    if (formMode === 'create' && !formPassword) {
      setFormError('A password is required when creating a user.')
      return
    }
    // Guard against duplicate workspace rows (the API replaces memberships wholesale).
    const workspaceIds = formMemberships.map((m) => m.workspaceId)
    if (new Set(workspaceIds).size !== workspaceIds.length) {
      setFormError('Each workspace can only be assigned once.')
      return
    }

    setSaving(true)
    try {
      let response: Response
      if (formMode === 'create') {
        const primary = formMemberships[0]
        response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            password: formPassword,
            isPlatformAdmin: formIsPlatformAdmin,
            // Admin-created accounts are provisioned verified (no invitation email).
            sendInvitation: false,
            // The current POST persists a single primary membership; the full set
            // is also sent so a memberships-aware POST can apply all of them.
            ...(primary && { workspaceId: primary.workspaceId, role: primary.role }),
            workspaceRoles: formMemberships,
          }),
        })
      } else {
        response = await fetch(`/api/admin/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            isPlatformAdmin: formIsPlatformAdmin,
            workspaceRoles: formMemberships,
            // Leave additionalRoles/teamMemberships empty — the cut Role/Team
            // catalogs are no longer part of the model (ADR-0004/0012).
          }),
        })
      }

      if (!response.ok) {
        let message = `Request failed (${response.status})`
        try {
          const data = await response.json()
          if (data?.error) message = data.error
        } catch {
          /* ignore body parse errors */
        }
        setFormError(message)
        return
      }

      setShowUserModal(false)
      setEditingUserId(null)
      setNotice({
        type: 'success',
        message: formMode === 'create' ? 'User created successfully.' : 'User updated successfully.',
      })
      await fetchUsers()
    } catch (error) {
      console.error('Failed to save user:', error)
      setFormError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ----- Delete -----

  const openDeleteModal = (user: User) => {
    setDeleteTarget(user)
    setHardDelete(false)
    setDeleteError(null)
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const query = hardDelete ? '?hard=true' : ''
      const response = await fetch(`/api/admin/users/${deleteTarget.id}${query}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        let message = `Request failed (${response.status})`
        try {
          const data = await response.json()
          if (data?.error) message = data.error
        } catch {
          /* ignore body parse errors */
        }
        setDeleteError(message)
        return
      }

      const result = await response.json().catch(() => ({}))
      setDeleteTarget(null)
      setSelectedUsers((prev) => prev.filter((id) => id !== deleteTarget.id))
      setNotice({
        type: 'success',
        message: result?.action === 'deleted' ? 'User permanently deleted.' : 'User deactivated.',
      })
      await fetchUsers()
    } catch (error) {
      console.error('Failed to delete user:', error)
      setDeleteError('An unexpected error occurred. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6">
      {/* Transient notification */}
      {notice && (
        <div
          className={`mb-4 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="ml-4 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Users className="mr-3 h-6 w-6" />
              User Administration
            </h1>
            <p className="text-gray-600 mt-1">
              Manage user accounts, roles, and access permissions
            </p>
          </div>
          <div className="flex space-x-3">
            {selectedUsers.length > 0 && (
              <button
                onClick={() => setShowBulkModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Bulk Actions ({selectedUsers.length})
              </button>
            )}
            <button
              onClick={openCreateModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Mail className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Verified</p>
              <p className="text-2xl font-bold text-gray-900">{stats.verified}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Shield className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">2FA Enabled</p>
              <p className="text-2xl font-bold text-gray-900">{stats.twoFactorEnabled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Roles</option>
              {WORKSPACE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="2fa">2FA Enabled</option>
              <option value="platform-admin">Platform Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <span className="ml-3 text-sm text-gray-700">
                {selectedUsers.length > 0
                  ? `${selectedUsers.length} selected`
                  : `${filteredUsers.length} users`}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const statusBadge = getStatusBadge(user)

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-4"
                          />
                          <div className="flex items-center">
                            {user.image ? (
                              <img src={user.image} alt="" className="h-10 w-10 rounded-full mr-3" />
                            ) : (
                              <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name?.charAt(0) || 'U'}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                {user.twoFactorEnabled && (
                                  <Shield className="ml-2 h-4 w-4 text-green-500" aria-label="2FA Enabled" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{user.email}</p>
                              <div className="flex items-center text-xs text-gray-400 mt-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                {user.timezone}
                                <span className="mx-2">•</span>
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {user.isPlatformAdmin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Platform Admin
                            </span>
                          )}
                          {user.workspaces.map((ws) => (
                            <div key={ws.workspace.id} className="flex items-center text-xs">
                              <Building className="h-3 w-3 mr-1 text-gray-400" />
                              <span className="font-medium">{ws.role}</span>
                              <span className="text-gray-500 ml-1">in {ws.workspace.name}</span>
                            </div>
                          ))}
                          {user.workspaces.length === 0 && !user.isPlatformAdmin && (
                            <span className="text-xs text-gray-400">No workspace access</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                          {!user.emailVerified && (
                            <div className="flex items-center text-xs text-red-600">
                              <UserX className="h-3 w-3 mr-1" />
                              Unverified
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Clock className="h-4 w-4 mr-1 text-gray-400" />
                          {getLastActivity(user)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="text-center">
                          <div className="text-lg font-semibold">{user._count.userActivities}</div>
                          <div className="text-xs text-gray-500">actions</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit user dialog */}
      <Dialog open={showUserModal} onOpenChange={(open) => (open ? null : closeUserModal())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'edit' ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {formMode === 'edit'
                ? 'Update the account details, platform access, and workspace memberships.'
                : 'Create a new account, set platform access, and assign workspace memberships.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="flex items-start rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">Name</Label>
                <Input
                  id="user-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            {formMode === 'create' && (
              <div className="space-y-1.5">
                <Label htmlFor="user-password">Password</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Set an initial password"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500">
                  The account is created already verified. Share this password securely or ask the
                  user to reset it.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="user-platform-admin" className="text-sm font-medium">
                  Platform administrator
                </Label>
                <p className="text-xs text-gray-500">
                  Grants cross-tenant access to the admin console. Use sparingly.
                </p>
              </div>
              <Switch
                id="user-platform-admin"
                checked={formIsPlatformAdmin}
                onCheckedChange={setFormIsPlatformAdmin}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Workspace memberships</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMembershipRow}
                  disabled={workspaceOptions.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Add membership
                </Button>
              </div>

              {workspaceOptions.length === 0 && (
                <p className="text-xs text-gray-500">No workspaces available to assign.</p>
              )}

              {formMemberships.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No workspace memberships. The user will have no workspace access.
                </p>
              ) : (
                <div className="space-y-2">
                  {formMemberships.map((membership, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={membership.workspaceId}
                          onValueChange={(value) => updateMembership(index, { workspaceId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select workspace" />
                          </SelectTrigger>
                          <SelectContent>
                            {workspaceOptions.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-44">
                        <Select
                          value={membership.role}
                          onValueChange={(value) => updateMembership(index, { role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            {WORKSPACE_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMembershipRow(index)}
                        title="Remove membership"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeUserModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmitUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {formMode === 'edit' ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  This will remove <span className="font-medium">{deleteTarget.name}</span> (
                  {deleteTarget.email}) from all workspaces and end their sessions.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {deleteError && (
              <div className="flex items-start rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="mr-2 mt-0.5 h-4 w-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600"
              />
              <span>
                Permanently delete this account and all associated activity. This cannot be undone.
                Leave unchecked to deactivate (soft delete).
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {hardDelete ? 'Delete permanently' : 'Deactivate user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Bulk Actions</h2>
            <p className="text-gray-600 mb-4">
              Select an action to perform on {selectedUsers.length} selected users
            </p>
            <div className="space-y-2 mb-6">
              <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 border">
                Assign Roles
              </button>
              <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 border">
                Add to Workspace
              </button>
              <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-50 border">
                Send Invitations
              </button>
              <button className="w-full text-left px-4 py-2 rounded-lg hover:bg-red-50 border border-red-200 text-red-600">
                Deactivate Users
              </button>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
