'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Users,
  Settings,
  Search,
  Filter,
  MoreVertical,
  Crown,
  UserCheck
} from 'lucide-react'

interface Role {
  id: string
  name: string
  displayName: string
  description?: string
  permissions: string[]
  isSystem: boolean
  isActive: boolean
  color?: string
  priority: number
  _count?: {
    userRoles: number
    userWorkspaces: number
  }
  userRoles?: Array<{
    user: {
      id: string
      name: string
      email: string
    }
  }>
}

interface RoleStats {
  total: number
  system: number
  active: number
}

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [stats, setStats] = useState<RoleStats>({ total: 0, system: 0, active: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const fetchRoles = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/roles?includeStats=true')
      if (response.ok) {
        const data = await response.json()
        setRoles(data.roles)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         role.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterActive === null || role.isActive === filterActive
    return matchesSearch && matchesFilter
  })

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchRoles()
      }
    } catch (error) {
      console.error('Failed to delete role:', error)
    }
  }

  const getRoleIcon = (role: Role) => {
    if (role.name.includes('owner') || role.name.includes('OWNER')) {
      return Crown
    } else if (role.name.includes('admin') || role.name.includes('ADMIN')) {
      return Shield
    } else {
      return UserCheck
    }
  }

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8) return { label: 'Critical', color: 'bg-red-100 text-red-800' }
    if (priority >= 5) return { label: 'High', color: 'bg-orange-100 text-orange-800' }
    if (priority >= 3) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' }
    return { label: 'Low', color: 'bg-gray-100 text-gray-800' }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Shield className="mr-3 h-6 w-6" />
              Role Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage user roles and permissions across your organization
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Role
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Roles</p>
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
              <p className="text-sm font-medium text-gray-600">Active Roles</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Crown className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">System Roles</p>
              <p className="text-2xl font-bold text-gray-900">{stats.system}</p>
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
                placeholder="Search roles by name or display name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterActive === null ? 'all' : filterActive.toString()}
              onChange={(e) => setFilterActive(e.target.value === 'all' ? null : e.target.value === 'true')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
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
                      <span className="ml-2">Loading roles...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No roles found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => {
                  const RoleIcon = getRoleIcon(role)
                  const priorityBadge = getPriorityBadge(role.priority)

                  return (
                    <tr key={role.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className="p-2 rounded-lg mr-3"
                            style={{ backgroundColor: role.color ? `${role.color}20` : '#f3f4f6' }}
                          >
                            <RoleIcon
                              className="h-5 w-5"
                              style={{ color: role.color || '#6b7280' }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900">
                                {role.displayName}
                              </p>
                              {role.isSystem && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  System
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">{role.name}</p>
                            {role.description && (
                              <p className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                                {role.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityBadge.color}`}>
                          {priorityBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {role.permissions.length} permissions
                        </span>
                        {role.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {role.permissions.slice(0, 3).map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                              >
                                {permission}
                              </span>
                            ))}
                            {role.permissions.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{role.permissions.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">
                            {(role._count?.userRoles || 0) + (role._count?.userWorkspaces || 0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          role.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedRole(role)
                              setShowDetailsModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="View Details"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRole(role)
                              setShowCreateModal(true)
                            }}
                            className="text-green-600 hover:text-green-900 transition-colors"
                            title="Edit Role"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {!role.isSystem && (
                            <button
                              onClick={() => handleDeleteRole(role.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Delete Role"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
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
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">
              {selectedRole ? 'Edit Role' : 'Create New Role'}
            </h2>
            <p className="text-gray-600 mb-4">
              Role creation/editing modal would be implemented here
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSelectedRole(null)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {selectedRole ? 'Update' : 'Create'} Role
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Role Details</h2>
            <p className="text-gray-600 mb-4">
              Detailed role information modal would be implemented here
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedRole(null)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}