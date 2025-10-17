'use client'

import { useState, useEffect } from 'react'
import {
  Eye,
  Filter,
  Search,
  Download,
  RefreshCw,
  Calendar,
  User,
  Shield,
  Activity,
  AlertTriangle,
  Clock,
  Globe,
  Settings
} from 'lucide-react'

interface AuditLog {
  id: string
  userId: string
  workspaceId?: string
  roleId?: string
  action: string
  resource: string
  resourceId?: string
  description?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  changes?: Record<string, any>
  metadata?: Record<string, any>
  timestamp: string
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
  workspace?: {
    id: string
    name: string
  }
  role?: {
    id: string
    name: string
    displayName: string
  }
}

interface UserActivity {
  id: string
  userId: string
  workspaceId?: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, any>
  timestamp: string
  ipAddress?: string
  user: {
    id: string
    name: string
    email: string
    image?: string
  }
  workspace?: {
    id: string
    name: string
  }
}

interface SecurityEvent {
  id: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  timestamp: string
  user?: {
    id: string
    name: string
    email: string
  }
}

interface AccessLogsData {
  auditLogs: AuditLog[]
  userActivities?: UserActivity[]
  pagination: {
    total: number
    totalUserActivities?: number
    limit: number
    offset: number
    hasMore: boolean
  }
  statistics: {
    recentAuditLogs: number
    recentUserActivities: number
    totalEvents: number
    actionDistribution: Array<{
      action: string
      count: number
    }>
    resourceDistribution: Array<{
      resource: string
      count: number
    }>
    mostActiveUsers: Array<{
      user: {
        id: string
        name: string
        email: string
        image?: string
      }
      activityCount: number
    }>
    dailyActivityTrend: Record<string, number>
    securityEvents: number
  }
  securityEvents: SecurityEvent[]
}

const ACTION_COLORS = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  login: 'bg-purple-100 text-purple-800',
  logout: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
  denied: 'bg-orange-100 text-orange-800'
}

export default function AccessLogsPage() {
  const [logsData, setLogsData] = useState<AccessLogsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    userId: '',
    workspaceId: '',
    startDate: '',
    endDate: ''
  })
  const [includeUserActivity, setIncludeUserActivity] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(50)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString(),
        includeUserActivity: includeUserActivity.toString()
      })

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogsData(data)
      }
    } catch (error) {
      console.error('Failed to fetch access logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [currentPage, filters, includeUserActivity])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setCurrentPage(0)
  }

  const getActionColor = (action: string) => {
    const actionType = action.toLowerCase()
    if (actionType.includes('create')) return ACTION_COLORS.created
    if (actionType.includes('update') || actionType.includes('edit')) return ACTION_COLORS.updated
    if (actionType.includes('delete') || actionType.includes('remove')) return ACTION_COLORS.deleted
    if (actionType.includes('login')) return ACTION_COLORS.login
    if (actionType.includes('logout')) return ACTION_COLORS.logout
    if (actionType.includes('fail')) return ACTION_COLORS.failed
    if (actionType.includes('denied') || actionType.includes('reject')) return ACTION_COLORS.denied
    return 'bg-gray-100 text-gray-800'
  }

  const getResourceIcon = (resource: string) => {
    switch (resource.toLowerCase()) {
      case 'user':
        return User
      case 'role':
      case 'permission':
        return Shield
      case 'workspace':
        return Globe
      case 'settings':
        return Settings
      default:
        return Activity
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: getRelativeTime(date)
    }
  }

  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) return `${diffInDays}d ago`

    return date.toLocaleDateString()
  }

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams(filters)
      params.append('export', 'true')

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `access-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  if (!logsData) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading access logs...</span>
            </>
          ) : (
            <span>Failed to load access logs</span>
          )}
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
              <Eye className="mr-3 h-6 w-6" />
              Access Logs & Audit Trail
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor user activities, system changes, and security events
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </button>
            <button
              onClick={exportLogs}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </button>
            <button
              onClick={fetchLogs}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{logsData.statistics.totalEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Audit Logs</p>
              <p className="text-2xl font-bold text-gray-900">{logsData.statistics.recentAuditLogs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">User Activities</p>
              <p className="text-2xl font-bold text-gray-900">{logsData.statistics.recentUserActivities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Security Events</p>
              <p className="text-2xl font-bold text-gray-900">{logsData.statistics.securityEvents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white p-4 rounded-lg border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Actions</option>
                {logsData.statistics.actionDistribution.map((action) => (
                  <option key={action.action} value={action.action}>
                    {action.action} ({action.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resource</label>
              <select
                value={filters.resource}
                onChange={(e) => handleFilterChange('resource', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Resources</option>
                {logsData.statistics.resourceDistribution.map((resource) => (
                  <option key={resource.resource} value={resource.resource}>
                    {resource.resource} ({resource.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Include User Activity</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeUserActivity}
                  onChange={(e) => setIncludeUserActivity(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900">Show activities</span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({
                    action: '',
                    resource: '',
                    userId: '',
                    workspaceId: '',
                    startDate: '',
                    endDate: ''
                  })
                  setCurrentPage(0)
                }}
                className="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Events Alert */}
      {logsData.securityEvents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-sm font-medium text-red-800">
              Recent Security Events ({logsData.securityEvents.length})
            </h3>
          </div>
          <div className="mt-2 text-sm text-red-700">
            Recent security-related activities detected. Review the audit logs below for details.
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Activity Logs</h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {logsData.pagination.total} total events
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage + 1}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!logsData.pagination.hasMore}
                  className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading access logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logsData.auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No audit logs found matching your criteria
                  </td>
                </tr>
              ) : (
                logsData.auditLogs.map((log) => {
                  const timestamp = formatTimestamp(log.timestamp)
                  const ResourceIcon = getResourceIcon(log.resource)

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{timestamp.relative}</div>
                          <div className="text-gray-500">{timestamp.date} {timestamp.time}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {log.user.image ? (
                            <img
                              src={log.user.image}
                              alt=""
                              className="h-8 w-8 rounded-full mr-3"
                            />
                          ) : (
                            <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                              <span className="text-xs font-medium text-gray-700">
                                {log.user.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{log.user.name}</div>
                            <div className="text-sm text-gray-500">{log.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ResourceIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{log.resource}</span>
                        </div>
                        {log.workspace && (
                          <div className="text-xs text-gray-500 mt-1">
                            in {log.workspace.name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {log.description || `${log.action} ${log.resource}`}
                        </div>
                        {log.resourceId && (
                          <div className="text-xs text-gray-500 mt-1">
                            ID: {log.resourceId.slice(0, 8)}...
                          </div>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            + metadata
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}