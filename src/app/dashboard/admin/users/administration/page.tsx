'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  MoreVertical,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Building
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  image?: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  timezone: string
  locale: string
  createdAt: string
  updatedAt: string
  workspaces: Array<{
    role: string
    workspace: {
      id: string
      name: string
    }
  }>
  userRoles: Array<{
    role: {
      id: string
      name: string
      displayName: string
      color?: string
    }
  }>
  userSessions: Array<{
    lastActiveAt: string
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

export default function UserAdministrationPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, verified: 0, twoFactorEnabled: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)

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

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = !roleFilter || user.workspaces.some(ws => ws.role === roleFilter) ||
                       user.userRoles.some(ur => ur.role.name === roleFilter)
    const matchesStatus = !statusFilter ||
                         (statusFilter === 'verified' && user.emailVerified) ||
                         (statusFilter === 'unverified' && !user.emailVerified) ||
                         (statusFilter === '2fa' && user.twoFactorEnabled) ||
                         (statusFilter === 'active' && user.userSessions.length > 0)
    return matchesSearch && matchesRole && matchesStatus
  })

  const getLastActivity = (user: User) => {
    if (user.userSessions.length === 0) return 'Never'
    const lastActivity = new Date(user.userSessions[0].lastActiveAt)
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
    const lastActivity = new Date(user.userSessions[0].lastActiveAt)
    const hoursAgo = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60))

    if (hoursAgo < 1) return { label: 'Online', color: 'bg-green-100 text-green-800' }
    if (hoursAgo < 24) return { label: 'Active', color: 'bg-blue-100 text-blue-800' }
    return { label: 'Away', color: 'bg-yellow-100 text-yellow-800' }
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id))
    }
  }

  return (
    <div className="p-6">
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
              onClick={() => setShowUserModal(true)}
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
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="PUBLISHER">Publisher</option>
              <option value="ANALYST">Analyst</option>
              <option value="CLIENT_VIEWER">Client Viewer</option>
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
                  : `${filteredUsers.length} users`
                }
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
                              <img
                                src={user.image}
                                alt=""
                                className="h-10 w-10 rounded-full mr-3"
                              />
                            ) : (
                              <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name?.charAt(0) || 'U'}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">
                                  {user.name}
                                </p>
                                {user.twoFactorEnabled && (
                                  <Shield className="ml-2 h-4 w-4 text-green-500" title="2FA Enabled" />
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
                          {user.workspaces.map((ws) => (
                            <div key={ws.workspace.id} className="flex items-center text-xs">
                              <Building className="h-3 w-3 mr-1 text-gray-400" />
                              <span className="font-medium">{ws.role}</span>
                              <span className="text-gray-500 ml-1">in {ws.workspace.name}</span>
                            </div>
                          ))}
                          {user.userRoles.map((ur) => (
                            <span
                              key={ur.role.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: ur.role.color ? `${ur.role.color}20` : '#f3f4f6',
                                color: ur.role.color || '#6b7280'
                              }}
                            >
                              {ur.role.displayName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.color}`}>
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
                            onClick={() => {
                              setSelectedUser(user)
                              setShowUserModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
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

      {/* Modals would be implemented here */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">
              {selectedUser ? 'Edit User' : 'Add New User'}
            </h2>
            <p className="text-gray-600 mb-4">
              User creation/editing modal would be implemented here
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setSelectedUser(null)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {selectedUser ? 'Update' : 'Create'} User
              </button>
            </div>
          </div>
        </div>
      )}

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