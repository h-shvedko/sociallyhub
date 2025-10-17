'use client'

import { useState, useEffect } from 'react'
import {
  KeyRound,
  Plus,
  Search,
  Filter,
  Check,
  X,
  Edit,
  Save,
  RefreshCw,
  Shield,
  Users,
  Settings,
  Eye
} from 'lucide-react'

interface Permission {
  id: string
  name: string
  displayName: string
  category: string
  description?: string
  isActive: boolean
}

interface Role {
  id: string
  name: string
  displayName: string
  permissions: string[]
  isSystem: boolean
  isActive: boolean
  color?: string
  priority: number
}

interface PermissionMatrix {
  roles: Role[]
  permissions: Permission[]
  matrix: Array<{
    roleId: string
    roleName: string
    roleDisplayName: string
    isSystem: boolean
    permissions: Array<{
      permissionId: string
      permissionName: string
      hasPermission: boolean
    }>
  }>
}

interface PermissionStats {
  totalPermissions: number
  categories: number
  activePermissions: number
}

export default function PermissionMatrixPage() {
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix | null>(null)
  const [permissionsByCategory, setPermissionsByCategory] = useState<Record<string, Permission[]>>({})
  const [stats, setStats] = useState<PermissionStats>({ totalPermissions: 0, categories: 0, activePermissions: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [changedPermissions, setChangedPermissions] = useState<Record<string, Record<string, boolean>>>({})
  const [showCreatePermissionModal, setShowCreatePermissionModal] = useState(false)

  const fetchPermissions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/permissions?includeMatrix=true')
      if (response.ok) {
        const data = await response.json()
        setPermissionMatrix(data.permissionMatrix)
        setPermissionsByCategory(data.permissionsByCategory)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPermissions()
  }, [])

  const filteredPermissions = Object.entries(permissionsByCategory).reduce((acc, [category, permissions]) => {
    const filteredPerms = permissions.filter(permission => {
      const matchesSearch = permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          permission.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = !categoryFilter || category === categoryFilter
      return matchesSearch && matchesCategory
    })

    if (filteredPerms.length > 0) {
      acc[category] = filteredPerms
    }
    return acc
  }, {} as Record<string, Permission[]>)

  const filteredRoles = permissionMatrix?.roles.filter(role => {
    if (!roleFilter) return true
    if (roleFilter === 'system') return role.isSystem
    if (roleFilter === 'custom') return !role.isSystem
    if (roleFilter === 'active') return role.isActive
    if (roleFilter === 'inactive') return !role.isActive
    return true
  }) || []

  const togglePermission = (roleId: string, permissionName: string, currentValue: boolean) => {
    if (!editMode) return

    setChangedPermissions(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permissionName]: !currentValue
      }
    }))
  }

  const hasPermission = (roleId: string, permissionName: string) => {
    if (changedPermissions[roleId]?.[permissionName] !== undefined) {
      return changedPermissions[roleId][permissionName]
    }

    const roleMatrix = permissionMatrix?.matrix.find(m => m.roleId === roleId)
    const permission = roleMatrix?.permissions.find(p => p.permissionName === permissionName)
    return permission?.hasPermission || false
  }

  const saveChanges = async () => {
    try {
      // In a real implementation, this would save the permission changes
      console.log('Saving permission changes:', changedPermissions)
      setChangedPermissions({})
      setEditMode(false)
      await fetchPermissions()
    } catch (error) {
      console.error('Failed to save permission changes:', error)
    }
  }

  const discardChanges = () => {
    setChangedPermissions({})
    setEditMode(false)
  }

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'user':
      case 'users':
        return Users
      case 'admin':
      case 'administration':
        return Shield
      case 'system':
      case 'settings':
        return Settings
      default:
        return KeyRound
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800'
    ]

    let hash = 0
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading permission matrix...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <KeyRound className="mr-3 h-6 w-6" />
              Permission Matrix
            </h1>
            <p className="text-gray-600 mt-1">
              Manage role-based permissions across your organization
            </p>
          </div>
          <div className="flex space-x-3">
            {editMode && (
              <>
                <button
                  onClick={discardChanges}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={saveChanges}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </button>
              </>
            )}
            {!editMode && (
              <>
                <button
                  onClick={() => setShowCreatePermissionModal(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Permission
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Permissions
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <KeyRound className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Permissions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPermissions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Settings className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-gray-900">{stats.categories}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Permissions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activePermissions}</p>
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
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {Object.keys(permissionsByCategory).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Roles</option>
              <option value="system">System Roles</option>
              <option value="custom">Custom Roles</option>
              <option value="active">Active Roles</option>
              <option value="inactive">Inactive Roles</option>
            </select>
          </div>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b sticky top-0">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-900 min-w-[300px]">
                  Permission
                </th>
                {filteredRoles.map((role) => (
                  <th key={role.id} className="px-4 py-4 text-center text-sm font-medium text-gray-900 min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                        style={{ backgroundColor: role.color ? `${role.color}20` : '#f3f4f6' }}
                      >
                        <Shield
                          className="h-4 w-4"
                          style={{ color: role.color || '#6b7280' }}
                        />
                      </div>
                      <span className="font-medium">{role.displayName}</span>
                      <span className="text-xs text-gray-500">{role.name}</span>
                      {role.isSystem && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                          System
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(filteredPermissions).map(([category, permissions]) => (
                <>
                  {/* Category Header */}
                  <tr key={`category-${category}`} className="bg-gray-50">
                    <td colSpan={filteredRoles.length + 1} className="px-6 py-3">
                      <div className="flex items-center">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(category)}`}>
                          {category}
                        </div>
                        <span className="ml-3 text-sm text-gray-600">
                          {permissions.length} permissions
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Permission Rows */}
                  {permissions.map((permission) => (
                    <tr key={permission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">
                              {permission.displayName}
                            </p>
                            {!permission.isActive && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{permission.name}</p>
                          {permission.description && (
                            <p className="text-xs text-gray-400 mt-1">{permission.description}</p>
                          )}
                        </div>
                      </td>
                      {filteredRoles.map((role) => {
                        const hasPermissionValue = hasPermission(role.id, permission.name)
                        const isChanged = changedPermissions[role.id]?.[permission.name] !== undefined

                        return (
                          <td key={role.id} className="px-4 py-4 text-center">
                            <button
                              onClick={() => !role.isSystem && togglePermission(role.id, permission.name, hasPermissionValue)}
                              disabled={role.isSystem && !editMode}
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                ${hasPermissionValue
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }
                                ${editMode && !role.isSystem ? 'cursor-pointer' : 'cursor-default'}
                                ${isChanged ? 'ring-2 ring-blue-500' : ''}
                                ${role.isSystem ? 'opacity-50' : ''}
                              `}
                              title={
                                role.isSystem
                                  ? 'System role permissions cannot be modified'
                                  : editMode
                                  ? `Click to ${hasPermissionValue ? 'remove' : 'grant'} permission`
                                  : hasPermissionValue ? 'Permission granted' : 'Permission not granted'
                              }
                            >
                              {hasPermissionValue ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                            </button>
                            {isChanged && (
                              <div className="text-xs text-blue-600 mt-1">Changed</div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Permission Modal */}
      {showCreatePermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Create New Permission</h2>
            <p className="text-gray-600 mb-4">
              Permission creation modal would be implemented here
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreatePermissionModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Create Permission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}