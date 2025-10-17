'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Mail,
  Globe,
  Palette,
  Bell,
  Shield,
  Zap,
  Database,
  Activity,
  Flag,
  Search,
  Filter,
  Plus,
  ExternalLink,
  Wrench,
  ChevronRight
} from 'lucide-react'

interface SettingCategory {
  id: string
  name: string
  description: string
  icon: any
  status: 'active' | 'warning' | 'error' | 'disabled'
  lastUpdated?: string
  count?: number
  route: string
}

interface SettingsStats {
  totalConfigurations: number
  activeIntegrations: number
  pendingAlerts: number
  lastBackup: string
}

export default function AdminSettingsPage() {
  const [stats, setStats] = useState<SettingsStats>({
    totalConfigurations: 0,
    activeIntegrations: 0,
    pendingAlerts: 0,
    lastBackup: ''
  })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const settingCategories: SettingCategory[] = [
    {
      id: 'system',
      name: 'System Configuration',
      description: 'Global platform settings and core system parameters',
      icon: Settings,
      status: 'active',
      lastUpdated: '2 hours ago',
      count: 45,
      route: '/dashboard/admin/settings/system'
    },
    {
      id: 'email-templates',
      name: 'Email Templates',
      description: 'Manage notification, welcome, and system email templates',
      icon: Mail,
      status: 'active',
      lastUpdated: '1 day ago',
      count: 12,
      route: '/dashboard/admin/settings/email-templates'
    },
    {
      id: 'integrations',
      name: 'Integration Settings',
      description: 'Configure third-party integrations like Discord, analytics tools',
      icon: Globe,
      status: 'warning',
      lastUpdated: '3 days ago',
      count: 8,
      route: '/dashboard/admin/settings/integrations'
    },
    {
      id: 'branding',
      name: 'Branding Management',
      description: 'Platform branding, white-label options, custom domains',
      icon: Palette,
      status: 'active',
      lastUpdated: '1 week ago',
      count: 1,
      route: '/dashboard/admin/settings/branding'
    },
    {
      id: 'notifications',
      name: 'Notification Settings',
      description: 'Global notification preferences and delivery settings',
      icon: Bell,
      status: 'active',
      lastUpdated: '2 days ago',
      count: 23,
      route: '/dashboard/admin/settings/notifications'
    },
    {
      id: 'security',
      name: 'Security Settings',
      description: 'Password policies, session management, security headers',
      icon: Shield,
      status: 'error',
      lastUpdated: '5 hours ago',
      count: 18,
      route: '/dashboard/admin/settings/security'
    },
    {
      id: 'performance',
      name: 'Performance Settings',
      description: 'Caching configuration, CDN settings, optimization',
      icon: Zap,
      status: 'active',
      lastUpdated: '6 hours ago',
      count: 34,
      route: '/dashboard/admin/settings/performance'
    },
    {
      id: 'backup',
      name: 'Backup & Recovery',
      description: 'Database backup scheduling and restoration tools',
      icon: Database,
      status: 'active',
      lastUpdated: '30 minutes ago',
      count: 5,
      route: '/dashboard/admin/settings/backup'
    },
    {
      id: 'health',
      name: 'System Health',
      description: 'Monitor system performance, error rates, uptime',
      icon: Activity,
      status: 'warning',
      lastUpdated: 'Live',
      count: 156,
      route: '/dashboard/admin/settings/health'
    },
    {
      id: 'feature-flags',
      name: 'Feature Flags',
      description: 'Enable/disable features for testing and gradual rollouts',
      icon: Flag,
      status: 'active',
      lastUpdated: '4 hours ago',
      count: 27,
      route: '/dashboard/admin/settings/feature-flags'
    }
  ]

  const fetchStats = async () => {
    try {
      setLoading(true)
      // Mock stats for now - in real implementation, fetch from multiple APIs
      await new Promise(resolve => setTimeout(resolve, 1000))

      setStats({
        totalConfigurations: 198,
        activeIntegrations: 12,
        pendingAlerts: 3,
        lastBackup: '2 hours ago'
      })
    } catch (error) {
      console.error('Failed to fetch settings stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const filteredCategories = settingCategories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         category.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = !categoryFilter || category.status === categoryFilter
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'warning':
        return 'text-yellow-600 bg-yellow-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      case 'disabled':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return '●'
      case 'warning':
        return '⚠'
      case 'error':
        return '✕'
      case 'disabled':
        return '○'
      default:
        return '○'
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading settings...</span>
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
              <Wrench className="mr-3 h-6 w-6" />
              Settings & Configuration Management
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive system configuration and management dashboard
            </p>
          </div>
          <div className="flex space-x-3">
            <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Quick Setup
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center">
              <ExternalLink className="mr-2 h-4 w-4" />
              System Status
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Configurations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalConfigurations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Integrations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeIntegrations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Bell className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingAlerts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Last Backup</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lastBackup}</p>
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
                placeholder="Search settings categories..."
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
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Settings Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((category) => {
          const IconComponent = category.icon
          return (
            <div
              key={category.id}
              className="bg-white rounded-lg border hover:border-blue-300 transition-all duration-200 cursor-pointer group"
              onClick={() => window.location.href = category.route}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <IconComponent className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {category.name}
                      </h3>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(category.status)}`}>
                          {getStatusIcon(category.status)} {category.status}
                        </span>
                        {category.count && (
                          <span className="ml-2 text-sm text-gray-500">
                            {category.count} items
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>

                <p className="text-gray-600 mt-3 text-sm">
                  {category.description}
                </p>

                {category.lastUpdated && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Last updated: {category.lastUpdated}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12">
          <Filter className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No settings found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}
    </div>
  )
}