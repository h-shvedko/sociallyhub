'use client'

import { useState, useEffect } from 'react'
import {
  UserPlus,
  Users,
  Shield,
  Building,
  Mail,
  Download,
  Upload,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  UserCheck
} from 'lucide-react'

interface BulkOperation {
  id: string
  operation: string
  userIds: string[]
  data: Record<string, any>
  results: {
    success: number
    failed: number
    errors: string[]
    processedUsers: Array<{
      userId: string
      status: 'success' | 'failed'
      error?: string
    }>
  }
  createdAt: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface OperationTemplate {
  id: string
  name: string
  description: string
  operation: string
  icon: any
  color: string
  fields: Array<{
    name: string
    type: string
    required: boolean
    options?: Array<{ value: string; label: string }>
  }>
}

const OPERATION_TEMPLATES: OperationTemplate[] = [
  {
    id: 'assign_role',
    name: 'Assign Roles',
    description: 'Assign one or more roles to selected users',
    operation: 'assign_role',
    icon: Shield,
    color: 'blue',
    fields: [
      {
        name: 'roleIds',
        type: 'multiselect',
        required: true,
        options: [] // Will be populated with actual roles
      }
    ]
  },
  {
    id: 'add_to_workspace',
    name: 'Add to Workspace',
    description: 'Add users to a workspace with specified role',
    operation: 'add_to_workspace',
    icon: Building,
    color: 'green',
    fields: [
      {
        name: 'workspaceId',
        type: 'select',
        required: true,
        options: [] // Will be populated with workspaces
      },
      {
        name: 'role',
        type: 'select',
        required: true,
        options: [
          { value: 'ANALYST', label: 'Analyst' },
          { value: 'PUBLISHER', label: 'Publisher' },
          { value: 'ADMIN', label: 'Admin' }
        ]
      }
    ]
  },
  {
    id: 'send_invitation',
    name: 'Send Invitations',
    description: 'Send workspace invitations to users',
    operation: 'send_invitation',
    icon: Mail,
    color: 'purple',
    fields: [
      {
        name: 'workspaceId',
        type: 'select',
        required: true,
        options: []
      },
      {
        name: 'role',
        type: 'select',
        required: true,
        options: [
          { value: 'ANALYST', label: 'Analyst' },
          { value: 'PUBLISHER', label: 'Publisher' }
        ]
      },
      {
        name: 'message',
        type: 'textarea',
        required: false
      }
    ]
  },
  {
    id: 'update_profile',
    name: 'Update Profiles',
    description: 'Update user profile settings in bulk',
    operation: 'update_profile',
    icon: UserCheck,
    color: 'orange',
    fields: [
      {
        name: 'timezone',
        type: 'select',
        required: false,
        options: [
          { value: 'UTC', label: 'UTC' },
          { value: 'America/New_York', label: 'Eastern Time' },
          { value: 'America/Chicago', label: 'Central Time' },
          { value: 'America/Denver', label: 'Mountain Time' },
          { value: 'America/Los_Angeles', label: 'Pacific Time' }
        ]
      },
      {
        name: 'locale',
        type: 'select',
        required: false,
        options: [
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Spanish' },
          { value: 'fr', label: 'French' },
          { value: 'de', label: 'German' }
        ]
      },
      {
        name: 'twoFactorEnabled',
        type: 'checkbox',
        required: false
      }
    ]
  },
  {
    id: 'deactivate_users',
    name: 'Deactivate Users',
    description: 'Deactivate user accounts and revoke access',
    operation: 'deactivate_users',
    icon: XCircle,
    color: 'red',
    fields: []
  },
  {
    id: 'activate_users',
    name: 'Activate Users',
    description: 'Activate user accounts and restore access',
    operation: 'activate_users',
    icon: CheckCircle,
    color: 'green',
    fields: []
  }
]

export default function BulkOperationsPage() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedOperation, setSelectedOperation] = useState<OperationTemplate | null>(null)
  const [operationData, setOperationData] = useState<Record<string, any>>({})
  const [recentOperations, setRecentOperations] = useState<BulkOperation[]>([])
  const [loading, setLoading] = useState(false)
  const [csvInput, setCsvInput] = useState('')
  const [importMethod, setImportMethod] = useState<'csv' | 'manual'>('manual')

  const handleOperationSubmit = async () => {
    if (!selectedOperation || selectedUsers.length === 0) return

    try {
      setLoading(true)
      const response = await fetch('/api/admin/bulk-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: selectedOperation.operation,
          userIds: selectedUsers,
          data: operationData
        })
      })

      if (response.ok) {
        const result = await response.json()
        // Add to recent operations
        setRecentOperations(prev => [result, ...prev.slice(0, 9)])
        // Reset form
        setSelectedUsers([])
        setSelectedOperation(null)
        setOperationData({})
      }
    } catch (error) {
      console.error('Failed to execute bulk operation:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCsvImport = () => {
    const lines = csvInput.trim().split('\n')
    const userIds = lines
      .map(line => line.trim())
      .filter(line => line && line.includes('@'))
      .map(email => `user_${email.split('@')[0]}`) // Mock user ID generation

    setSelectedUsers(userIds)
    setCsvInput('')
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

  const getOperationColor = (operation: string) => {
    const template = OPERATION_TEMPLATES.find(t => t.operation === operation)
    return template?.color || 'gray'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <UserPlus className="mr-3 h-6 w-6" />
              Bulk User Operations
            </h1>
            <p className="text-gray-600 mt-1">
              Perform mass operations on multiple users efficiently
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operation Setup Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Selection */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Select Users
            </h3>

            <div className="mb-4">
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={() => setImportMethod('manual')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    importMethod === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Manual Selection
                </button>
                <button
                  onClick={() => setImportMethod('csv')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    importMethod === 'csv'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  CSV Import
                </button>
              </div>

              {importMethod === 'csv' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste user emails (one per line):
                  </label>
                  <textarea
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    placeholder="user1@example.com
user2@example.com
user3@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={6}
                  />
                  <button
                    onClick={handleCsvImport}
                    className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Import Users
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Manual user selection would be implemented here with a searchable user list,
                    checkboxes, and filters for role, workspace, and status.
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">User selection interface would be here</p>
                    <button
                      onClick={() => setSelectedUsers(['demo-user-1', 'demo-user-2', 'demo-user-3'])}
                      className="mt-4 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                    >
                      Select Demo Users (3)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    {selectedUsers.length} users selected for bulk operation
                  </span>
                </div>
                <div className="mt-2 text-xs text-blue-700">
                  {selectedUsers.slice(0, 3).join(', ')}
                  {selectedUsers.length > 3 && ` and ${selectedUsers.length - 3} more`}
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
                const isSelected = selectedOperation?.id === template.id

                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedOperation(template)}
                    className={`p-4 rounded-lg border-2 transition-colors text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <div className={`p-2 rounded-lg mr-3 bg-${template.color}-100`}>
                        <Icon className={`h-5 w-5 text-${template.color}-600`} />
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

              <div className="space-y-4">
                {selectedOperation.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1')}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {field.type === 'select' && (
                      <select
                        value={operationData[field.name] || ''}
                        onChange={(e) => setOperationData(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select {field.name}</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'multiselect' && (
                      <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <p className="text-sm text-gray-600 mb-2">Select multiple roles:</p>
                        <div className="space-y-2">
                          {['admin', 'publisher', 'analyst', 'client_viewer'].map((role) => (
                            <label key={role} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={(operationData[field.name] || []).includes(role)}
                                onChange={(e) => {
                                  const current = operationData[field.name] || []
                                  const updated = e.target.checked
                                    ? [...current, role]
                                    : current.filter((r: string) => r !== role)
                                  setOperationData(prev => ({ ...prev, [field.name]: updated }))
                                }}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-2"
                              />
                              <span className="text-sm capitalize">{role.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        value={operationData[field.name] || ''}
                        onChange={(e) => setOperationData(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={`Enter ${field.name}...`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    )}

                    {field.type === 'checkbox' && (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={operationData[field.name] || false}
                          onChange={(e) => setOperationData(prev => ({ ...prev, [field.name]: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 mr-2"
                        />
                        <span className="text-sm">
                          Enable {field.name.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                      </label>
                    )}
                  </div>
                ))}

                <div className="pt-4 border-t">
                  <button
                    onClick={handleOperationSubmit}
                    disabled={!selectedOperation || selectedUsers.length === 0 || loading}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Executing Operation...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Execute Operation on {selectedUsers.length} Users
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
                Execute your first bulk operation to see results here
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
                        {operation.operation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(operation.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 mb-2">
                    {operation.userIds.length} users affected
                  </div>

                  {operation.results && (
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
                  )}

                  {operation.results?.errors && operation.results.errors.length > 0 && (
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