'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  TestTube,
  Loader2,
  Shield,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlatformCredentials {
  id: string
  platform: string
  isActive: boolean
  environment: string
  validationStatus: 'pending' | 'valid' | 'invalid' | 'expired'
  validationError?: string
  lastValidated?: string
  lastUsed?: string
  usageCount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

interface PlatformCredentialsManagerProps {
  workspaceId: string
  workspaceName: string
}

const platformConfigs = {
  TWITTER: {
    name: 'Twitter/X',
    icon: '𝕏',
    color: 'bg-black text-white',
    docsUrl: 'https://developer.twitter.com/en/docs/authentication',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your Twitter app Client ID' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Your Twitter app Client Secret' },
      { name: 'apiKey', label: 'API Key (Optional)', type: 'text', required: false, placeholder: 'Twitter API Key' },
      { name: 'apiSecret', label: 'API Secret (Optional)', type: 'password', required: false, placeholder: 'Twitter API Secret' },
      { name: 'bearerToken', label: 'Bearer Token (Optional)', type: 'password', required: false, placeholder: 'Bearer Token for app-only auth' }
    ]
  },
  FACEBOOK: {
    name: 'Facebook',
    icon: '󠁦',
    color: 'bg-blue-600 text-white',
    docsUrl: 'https://developers.facebook.com/docs/',
    fields: [
      { name: 'appId', label: 'App ID', type: 'text', required: true, placeholder: 'Your Facebook App ID' },
      { name: 'appSecret', label: 'App Secret', type: 'password', required: true, placeholder: 'Your Facebook App Secret' }
    ]
  },
  INSTAGRAM: {
    name: 'Instagram',
    icon: '📷',
    color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Instagram Client ID' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Instagram Client Secret' }
    ]
  },
  LINKEDIN: {
    name: 'LinkedIn',
    icon: '💼',
    color: 'bg-blue-700 text-white',
    docsUrl: 'https://docs.microsoft.com/en-us/linkedin/',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'LinkedIn Client ID' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'LinkedIn Client Secret' }
    ]
  },
  TIKTOK: {
    name: 'TikTok',
    icon: '🎵',
    color: 'bg-black text-white',
    docsUrl: 'https://developers.tiktok.com/',
    fields: [
      { name: 'clientId', label: 'Client Key', type: 'text', required: true, placeholder: 'TikTok Client Key' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'TikTok Client Secret' }
    ]
  },
  YOUTUBE: {
    name: 'YouTube',
    icon: '📺',
    color: 'bg-red-600 text-white',
    docsUrl: 'https://developers.google.com/youtube/v3',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Google OAuth Client ID' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Google OAuth Client Secret' },
      { name: 'apiKey', label: 'API Key (Optional)', type: 'text', required: false, placeholder: 'YouTube Data API Key' }
    ]
  }
}

export function PlatformCredentialsManager({ workspaceId, workspaceName }: PlatformCredentialsManagerProps) {
  const [credentials, setCredentials] = useState<PlatformCredentials[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [environment, setEnvironment] = useState('production')
  const [notes, setNotes] = useState('')
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [editingCredential, setEditingCredential] = useState<PlatformCredentials | null>(null)

  useEffect(() => {
    fetchCredentials()
  }, [workspaceId])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const fetchCredentials = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/platform-credentials?workspaceId=${workspaceId}`)

      if (response.ok) {
        const data = await response.json()
        setCredentials(data.credentials || [])
      } else {
        console.error('Failed to fetch credentials:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching credentials:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (platform?: string, credential?: PlatformCredentials) => {
    if (credential) {
      setEditingCredential(credential)
      setSelectedPlatform(credential.platform)
      setEnvironment(credential.environment)
      setNotes(credential.notes || '')
      // Load existing credentials for editing
      loadCredentialForEditing(credential.id)
    } else {
      setEditingCredential(null)
      setSelectedPlatform(platform || '')
      setEnvironment('production')
      setNotes('')
      setFormData({})
    }
    setIsDialogOpen(true)
  }

  const loadCredentialForEditing = async (credentialId: string) => {
    try {
      const response = await fetch(`/api/platform-credentials/${credentialId}`)
      if (response.ok) {
        const data = await response.json()
        setFormData(data.credentials || {})
      }
    } catch (error) {
      console.error('Error loading credential for editing:', error)
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedPlatform('')
    setFormData({})
    setEnvironment('production')
    setNotes('')
    setShowPasswords({})
    setEditingCredential(null)
  }

  const handleSubmit = async () => {
    if (!selectedPlatform || !formData) return

    const config = platformConfigs[selectedPlatform as keyof typeof platformConfigs]
    const requiredFields = config.fields.filter(field => field.required)

    // Validate required fields
    for (const field of requiredFields) {
      if (!formData[field.name]) {
        setNotification({
          type: 'error',
          message: `${field.label} is required`
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/platform-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          platform: selectedPlatform,
          credentials: formData,
          environment,
          notes: notes || undefined
        })
      })

      const result = await response.json()

      if (response.ok) {
        setNotification({
          type: 'success',
          message: result.message || `${selectedPlatform} credentials saved successfully`
        })
        handleCloseDialog()
        fetchCredentials()
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to save credentials'
        })
      }
    } catch (error) {
      console.error('Error saving credentials:', error)
      setNotification({
        type: 'error',
        message: 'Failed to save credentials'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestCredentials = async () => {
    if (!selectedPlatform || !formData) return

    setIsTesting(true)
    try {
      const response = await fetch('/api/platform-credentials/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          credentials: formData
        })
      })

      const result = await response.json()

      if (response.ok) {
        setNotification({
          type: result.isValid ? 'success' : 'error',
          message: result.isValid
            ? `${selectedPlatform} credentials are valid!`
            : `Validation failed: ${result.error}`
        })
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to test credentials'
        })
      }
    } catch (error) {
      console.error('Error testing credentials:', error)
      setNotification({
        type: 'error',
        message: 'Failed to test credentials'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDeleteCredential = async (credentialId: string, platform: string) => {
    if (!confirm(`Are you sure you want to delete ${platform} credentials?`)) return

    try {
      const response = await fetch(`/api/platform-credentials/${credentialId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        setNotification({
          type: 'success',
          message: result.message
        })
        fetchCredentials()
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to delete credentials'
        })
      }
    } catch (error) {
      console.error('Error deleting credentials:', error)
      setNotification({
        type: 'error',
        message: 'Failed to delete credentials'
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'invalid': return <XCircle className="h-4 w-4 text-red-500" />
      case 'expired': return <AlertCircle className="h-4 w-4 text-orange-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid': return 'Valid'
      case 'invalid': return 'Invalid'
      case 'expired': return 'Expired'
      default: return 'Pending'
    }
  }

  const configuredPlatforms = credentials.map(c => c.platform)
  const availablePlatforms = Object.keys(platformConfigs).filter(
    platform => !configuredPlatforms.includes(platform)
  )

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg border ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span>{notification.message}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotification(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Platform Credentials</h2>
          <p className="text-muted-foreground">
            Configure API credentials for social media platforms
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Credentials
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {editingCredential ? 'Edit' : 'Add'} Platform Credentials
              </DialogTitle>
              <DialogDescription>
                Configure API credentials for connecting to social media platforms
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Platform Selection */}
              {!editingCredential && (
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlatforms.map((platform) => {
                        const config = platformConfigs[platform as keyof typeof platformConfigs]
                        return (
                          <SelectItem key={platform} value={platform}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{config.icon}</span>
                              {config.name}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedPlatform && (
                <>
                  {/* Platform Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="text-blue-600 mt-0.5">ℹ️</div>
                      <div>
                        <h4 className="font-medium text-blue-900 mb-2">
                          {platformConfigs[selectedPlatform as keyof typeof platformConfigs].name} Setup
                        </h4>
                        <p className="text-sm text-blue-800 mb-2">
                          To connect {platformConfigs[selectedPlatform as keyof typeof platformConfigs].name}, you'll need to create an app in their developer portal.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-700 border-blue-300"
                          onClick={() => window.open(platformConfigs[selectedPlatform as keyof typeof platformConfigs].docsUrl, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Documentation
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Credentials Form */}
                  <div className="space-y-4">
                    <h4 className="font-medium">API Credentials</h4>
                    {platformConfigs[selectedPlatform as keyof typeof platformConfigs].fields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <Label>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="relative">
                          <Input
                            type={field.type === 'password' && !showPasswords[field.name] ? 'password' : 'text'}
                            placeholder={field.placeholder}
                            value={formData[field.name] || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                          />
                          {field.type === 'password' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                              onClick={() => setShowPasswords(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
                            >
                              {showPasswords[field.name] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Environment */}
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select value={environment} onValueChange={setEnvironment}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add any notes about this configuration..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleTestCredentials}
                disabled={!selectedPlatform || isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedPlatform || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  {editingCredential ? 'Update' : 'Save'} Credentials
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credentials List */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading credentials...</p>
        </div>
      ) : credentials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credentials.map((credential) => {
            const config = platformConfigs[credential.platform as keyof typeof platformConfigs]

            return (
              <Card key={credential.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                        config.color
                      )}>
                        {config.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold">{config.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {getStatusIcon(credential.validationStatus)}
                          {getStatusText(credential.validationStatus)}
                        </div>
                      </div>
                    </div>
                    <Badge variant={credential.isActive ? 'default' : 'secondary'}>
                      {credential.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Environment:</span>
                      <span className="capitalize">{credential.environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Usage:</span>
                      <span>{credential.usageCount} times</span>
                    </div>
                    {credential.lastUsed && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Used:</span>
                        <span>{new Date(credential.lastUsed).toLocaleDateString()}</span>
                      </div>
                    )}
                    {credential.validationError && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-red-600 text-xs">{credential.validationError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(undefined, credential)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCredential(credential.id, credential.platform)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Key className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No credentials configured</h3>
          <p className="text-muted-foreground mb-4">
            Add platform credentials to enable real social media connections
          </p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Credential
          </Button>
        </div>
      )}
    </div>
  )
}