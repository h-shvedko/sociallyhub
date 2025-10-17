'use client'

import { useState, useEffect } from 'react'
import {
  KeyRound,
  Plus,
  Edit,
  Trash2,
  Settings,
  TestTube,
  Users,
  Globe,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react'

interface SSOProvider {
  id: string
  name: string
  type: 'GOOGLE' | 'MICROSOFT' | 'OKTA' | 'SAML' | 'LDAP'
  workspaceId: string
  workspace: {
    id: string
    name: string
  }
  clientId?: string
  issuerUrl?: string
  callbackUrl?: string
  scopes: string[]
  config: Record<string, any>
  autoProvisioning: boolean
  defaultRole: string
  domainRestrictions: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: {
    ssoAccounts: number
  }
}

interface SSOStats {
  total: number
  active: number
  inactive: number
  types: {
    GOOGLE: number
    MICROSOFT: number
    OKTA: number
    SAML: number
    LDAP: number
  }
  totalAccounts: number
}

interface TestResult {
  providerId: string
  providerName: string
  providerType: string
  overallStatus: 'passed' | 'warning' | 'failed'
  testResults: Array<{
    name: string
    status: 'passed' | 'warning' | 'failed'
    message: string
    details?: string[]
  }>
}

const SSO_TYPE_COLORS = {
  GOOGLE: { bg: 'bg-red-100', text: 'text-red-800', icon: '🔴' },
  MICROSOFT: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🔵' },
  OKTA: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🟠' },
  SAML: { bg: 'bg-green-100', text: 'text-green-800', icon: '🟢' },
  LDAP: { bg: 'bg-purple-100', text: 'text-purple-800', icon: '🟣' }
}

export default function SSOManagementPage() {
  const [providers, setProviders] = useState<SSOProvider[]>([])
  const [stats, setStats] = useState<SSOStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<SSOProvider | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testResults, setTestResults] = useState<TestResult | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const fetchProviders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/sso?includeAccounts=true')
      if (response.ok) {
        const data = await response.json()
        setProviders(data.ssoProviders)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch SSO providers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm('Are you sure you want to delete this SSO provider? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sso/${providerId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        await fetchProviders()
      }
    } catch (error) {
      console.error('Failed to delete SSO provider:', error)
    }
  }

  const handleTestProvider = async (provider: SSOProvider) => {
    try {
      setTestLoading(true)
      setSelectedProvider(provider)
      setShowTestModal(true)

      const response = await fetch(`/api/admin/sso/${provider.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testEmail: 'test@example.com'
        })
      })

      if (response.ok) {
        const results = await response.json()
        setTestResults(results)
      }
    } catch (error) {
      console.error('Failed to test SSO provider:', error)
    } finally {
      setTestLoading(false)
    }
  }

  const toggleSecretVisibility = (providerId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <KeyRound className="mr-3 h-6 w-6" />
              Single Sign-On (SSO) Management
            </h1>
            <p className="text-gray-600 mt-1">
              Configure and manage SSO providers for seamless authentication
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add SSO Provider
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <KeyRound className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Providers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Connected Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAccounts}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SSO Providers List */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">SSO Providers</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage authentication providers for your organization
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading SSO providers...</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="p-12 text-center">
            <KeyRound className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No SSO Providers</h3>
            <p className="text-gray-600 mb-4">
              Get started by adding your first SSO provider to enable seamless authentication.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Add SSO Provider
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {providers.map((provider) => {
              const typeConfig = SSO_TYPE_COLORS[provider.type]

              return (
                <div key={provider.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg ${typeConfig.bg}`}>
                        <span className="text-2xl">{typeConfig.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900">
                            {provider.name}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.text}`}>
                            {provider.type}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            provider.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {provider.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {provider.workspace.name} • {provider._count.ssoAccounts} connected users
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          {provider.clientId && (
                            <div className="flex items-center">
                              <span className="font-medium">Client ID:</span>
                              <span className="ml-1">{provider.clientId.slice(0, 8)}...</span>
                            </div>
                          )}
                          {provider.issuerUrl && (
                            <div className="flex items-center">
                              <Globe className="h-3 w-3 mr-1" />
                              <span>{new URL(provider.issuerUrl).hostname}</span>
                            </div>
                          )}
                          {provider.autoProvisioning && (
                            <div className="flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              <span>Auto-provisioning</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTestProvider(provider)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Test Configuration"
                      >
                        <TestTube className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProvider(provider)
                          setShowCreateModal(true)
                        }}
                        className="text-green-600 hover:text-green-900 p-2 rounded-lg hover:bg-green-50 transition-colors"
                        title="Edit Provider"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete Provider"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Configuration Details */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Default Role:</span>
                      <span className="ml-2 text-gray-900">{provider.defaultRole}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Scopes:</span>
                      <span className="ml-2 text-gray-900">
                        {provider.scopes.length > 0 ? provider.scopes.join(', ') : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Domain Restrictions:</span>
                      <span className="ml-2 text-gray-900">
                        {provider.domainRestrictions.length > 0
                          ? provider.domainRestrictions.join(', ')
                          : 'None'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {selectedProvider ? 'Edit SSO Provider' : 'Add New SSO Provider'}
            </h2>
            <p className="text-gray-600 mb-4">
              SSO provider configuration form would be implemented here with fields for:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 mb-6 space-y-1">
              <li>Provider name and type (Google, Microsoft, Okta, SAML, LDAP)</li>
              <li>Client ID and Client Secret</li>
              <li>Issuer URL and Callback URL</li>
              <li>Scopes and permissions</li>
              <li>Auto-provisioning settings</li>
              <li>Domain restrictions</li>
              <li>Default role assignment</li>
            </ul>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSelectedProvider(null)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {selectedProvider ? 'Update Provider' : 'Create Provider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Results Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Test Results: {selectedProvider?.name}
              </h2>
              <button
                onClick={() => {
                  setShowTestModal(false)
                  setSelectedProvider(null)
                  setTestResults(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {testLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Testing SSO configuration...</span>
              </div>
            ) : testResults ? (
              <div>
                <div className="mb-6">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(testResults.overallStatus)}`}>
                    {getStatusIcon(testResults.overallStatus)}
                    <span className="ml-2">
                      Overall Status: {testResults.overallStatus.charAt(0).toUpperCase() + testResults.overallStatus.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {testResults.testResults.map((test, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">{test.name}</h4>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(test.status)}`}>
                          {getStatusIcon(test.status)}
                          <span className="ml-1">{test.status}</span>
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{test.message}</p>
                      {test.details && test.details.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-gray-500 space-y-1">
                          {test.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No test results available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}