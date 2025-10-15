'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Settings, 
  Trash2, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  BarChart3,
  Users,
  MessageSquare,
  Calendar,
  ExternalLink,
  Zap
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AccountSettingsDialog } from './account-settings-dialog'

interface SocialAccount {
  id: string
  provider: 'TWITTER' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE'
  accountId: string
  displayName: string
  handle: string
  accountType: string
  status: 'ACTIVE' | 'TOKEN_EXPIRED' | 'REVOKED' | 'ERROR'
  scopes: string[]
  metadata: any
  tokenExpiry: string | null
  createdAt: string
  updatedAt: string
  stats?: {
    postsCount: number
    inboxItemsCount: number
    lastPostDate?: string
  }
  client?: {
    id: string
    name: string
  }
}

interface SocialAccountsManagerProps {
  workspaceId: string
  workspaceName: string
}

export function SocialAccountsManager({ workspaceId, workspaceName }: SocialAccountsManagerProps) {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<SocialAccount['provider'] | null>(null)
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(null)
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false)
  const [clients, setClients] = useState<Array<{id: string, name: string}>>([])
  const [availablePlatforms, setAvailablePlatforms] = useState<Array<{
    id: string
    name: string
    displayName: string
    icon: string
    color: string
    available: boolean
    reason?: string
  }>>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    accountId: string | null
    accountName: string
  }>({
    isOpen: false,
    accountId: null,
    accountName: ''
  })

  const handleOpenSettings = (account: SocialAccount) => {
    setSelectedAccount(account)
    setIsSettingsDialogOpen(true)
  }

  const handleSaveSettings = async (accountId: string, settings: any) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        // Refresh accounts list
        fetchSocialAccounts()
        setNotification({
          type: 'success',
          message: 'Account settings updated successfully'
        })
      } else {
        const error = await response.json()
        setNotification({
          type: 'error',
          message: error.error || 'Failed to update account settings'
        })
      }
    } catch (error) {
      console.error('Settings save error:', error)
      setNotification({
        type: 'error',
        message: 'Failed to update account settings'
      })
    }
  }

  // Simple refresh function for individual calls
  const fetchSocialAccounts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/accounts?workspaceId=${workspaceId}`)
      
      if (response.ok) {
        const data = await response.json()
        setAccounts(data || [])
      } else {
        console.error('Failed to fetch accounts:', response.status, response.statusText)
        setAccounts([])
      }
    } catch (error) {
      console.error('Error fetching social accounts:', error)
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  // Proper useEffect for initial data loading
  useEffect(() => {
    let mounted = true

    const loadInitialData = async () => {
      try {
        setIsLoading(true)
        
        // Load data in parallel
        const [accountsResponse, platformsResponse, clientsResponse] = await Promise.all([
          fetch(`/api/accounts?workspaceId=${workspaceId}`),
          fetch('/api/accounts/platforms'),
          fetch(`/api/clients?workspaceId=${workspaceId}`)
        ])

        if (mounted) {
          // Handle accounts
          if (accountsResponse.ok) {
            const accountsData = await accountsResponse.json()
            setAccounts(accountsData || [])
          } else {
            setAccounts([])
          }

          // Handle platforms
          if (platformsResponse.ok) {
            const platformsData = await platformsResponse.json()
            setAvailablePlatforms([...platformsData.supported, ...platformsData.unavailable])
          } else {
            // Fallback platforms - enable them for demo/development purposes
            const defaultPlatforms = [
              { id: 'twitter', name: 'Twitter', displayName: 'Twitter/X', icon: '𝕏', color: 'bg-black text-white', available: true },
              { id: 'facebook', name: 'Facebook', displayName: 'Facebook', icon: '󠁦', color: 'bg-blue-600 text-white', available: true },
              { id: 'instagram', name: 'Instagram', displayName: 'Instagram', icon: '📷', color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white', available: true },
              { id: 'linkedin', name: 'LinkedIn', displayName: 'LinkedIn', icon: '💼', color: 'bg-blue-700 text-white', available: true },
              { id: 'tiktok', name: 'TikTok', displayName: 'TikTok', icon: '🎵', color: 'bg-black text-white', available: true },
              { id: 'youtube', name: 'YouTube', displayName: 'YouTube', icon: '📺', color: 'bg-red-600 text-white', available: true }
            ]
            setAvailablePlatforms(defaultPlatforms)
          }

          // Handle clients
          if (clientsResponse.ok) {
            const clientsData = await clientsResponse.json()
            setClients(clientsData.clients?.map((client: any) => ({
              id: client.id,
              name: client.name
            })) || [])
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error)
        if (mounted) {
          setAccounts([])
          setAvailablePlatforms([])
          setClients([])
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      mounted = false
    }
  }, [workspaceId])

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams?.get('success')
    const error = searchParams?.get('error')
    const provider = searchParams?.get('provider')

    if (success === 'account_connected' && provider) {
      setNotification({
        type: 'success',
        message: `Successfully connected ${provider.charAt(0).toUpperCase() + provider.slice(1)} account!`
      })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_error: 'OAuth authorization failed',
        missing_params: 'Missing required parameters',
        invalid_state: 'Invalid state parameter',
        invalid_state_data: 'Invalid state data',
        token_exchange_failed: 'Failed to exchange authorization code for token',
        profile_fetch_failed: 'Failed to fetch user profile',
        connection_failed: 'Connection failed',
        callback_error: 'Callback processing error'
      }
      
      setNotification({
        type: 'error',
        message: errorMessages[error] || 'Connection failed'
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])

  // Auto-hide notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Manual notification dismiss
  const dismissNotification = () => {
    setNotification(null)
  }

  const handleConnectAccount = async (provider: SocialAccount['provider']) => {
    setIsConnecting(true)
    setSelectedProvider(provider)
    
    try {
      const response = await fetch('/api/accounts/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: provider.toLowerCase(),
          workspaceId
        })
      })

      const result = await response.json()

      if (result.success) {
        if (result.authUrl) {
          // Redirect to OAuth flow for real connections
          window.location.href = result.authUrl
        } else if (result.demo) {
          // Handle demo connection success
          setNotification({
            type: 'success',
            message: result.message || `Demo ${provider} account connected successfully!`
          })
          setIsConnecting(false)
          setSelectedProvider(null)
          setIsConnectDialogOpen(false)
          // Refresh accounts list to show new demo account
          fetchSocialAccounts()
        }
      } else {
        console.error('Connection failed:', result.error)

        let errorMessage = result.error
        if (result.code === 'PROVIDER_NOT_CONFIGURED') {
          errorMessage = `${provider} is not available because API credentials are not configured. Please contact your administrator.`
        }

        setNotification({
          type: 'error',
          message: errorMessage
        })
        setIsConnecting(false)
        setSelectedProvider(null)
      }
    } catch (error) {
      console.error('Connection error:', error)
      setNotification({
        type: 'error',
        message: 'Connection failed. Please try again.'
      })
      setIsConnecting(false)
      setSelectedProvider(null)
    }
  }

  const handleRefreshAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/refresh`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchSocialAccounts()
      }
    } catch (error) {
      console.error('Refresh error:', error)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setAccounts(prev => prev.filter(acc => acc.id !== accountId))
        setNotification({
          type: 'success',
          message: 'Account disconnected successfully'
        })
      } else {
        setNotification({
          type: 'error',
          message: 'Failed to disconnect account'
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      setNotification({
        type: 'error',
        message: 'Failed to disconnect account'
      })
    } finally {
      setDeleteConfirm({ isOpen: false, accountId: null, accountName: '' })
    }
  }

  const confirmDeleteAccount = (account: SocialAccount) => {
    setDeleteConfirm({
      isOpen: true,
      accountId: account.id,
      accountName: `${account.displayName} (@${account.handle})`
    })
  }

  const getProviderIcon = (provider: SocialAccount['provider']) => {
    // In a real app, these would be actual social media icons
    const iconMap = {
      TWITTER: '𝕏',
      FACEBOOK: '󠁦',
      INSTAGRAM: '📷',
      LINKEDIN: '💼',
      TIKTOK: '🎵',
      YOUTUBE: '📺'
    }
    return iconMap[provider] || '📱'
  }

  const getProviderColor = (provider: SocialAccount['provider']) => {
    const colorMap = {
      TWITTER: 'bg-black text-white',
      FACEBOOK: 'bg-blue-600 text-white',
      INSTAGRAM: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      LINKEDIN: 'bg-blue-700 text-white',
      TIKTOK: 'bg-black text-white',
      YOUTUBE: 'bg-red-600 text-white'
    }
    return colorMap[provider] || 'bg-gray-600 text-white'
  }

  const getStatusIcon = (status: SocialAccount['status']) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />
      case 'TOKEN_EXPIRED': return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'REVOKED': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: SocialAccount['status']) => {
    switch (status) {
      case 'ACTIVE': return 'Connected'
      case 'ERROR': return 'Connection Error'
      case 'TOKEN_EXPIRED': return 'Token Expired'
      case 'REVOKED': return 'Access Revoked'
      default: return 'Unknown'
    }
  }

  // This will be populated from availablePlatforms state

  return (
    <div className="flex flex-col space-y-6">
      {/* Notification Banner */}
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
          <h1 className="text-3xl font-bold">Social Accounts</h1>
          <p className="text-muted-foreground">
            Connect and manage your social media accounts for posting and monitoring
          </p>
        </div>
        
        <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Social Account</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Choose a platform to connect your social media account
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {availablePlatforms.map((platform) => {
                  const isConnected = accounts.some(acc => acc.provider.toLowerCase() === platform.id && acc.status === 'ACTIVE')
                  const isAvailable = platform.available

                  return (
                    <div key={platform.id} className="relative">
                      <Button
                        variant="outline"
                        className={cn(
                          "h-24 w-full flex-col gap-2 p-4 hover:bg-muted/50 transition-colors",
                          isAvailable && "hover:border-primary",
                          isConnected && "bg-green-50 border-green-200 text-green-700",
                          !isAvailable && "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                        onClick={() => isAvailable && handleConnectAccount(platform.id.toUpperCase() as SocialAccount['provider'])}
                        disabled={isConnecting || !isAvailable}
                      >
                        <div className="text-2xl">{platform.icon}</div>
                        <div className="text-sm font-medium text-center">
                          {platform.displayName}
                        </div>
                        {isConnected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                        )}
                        {!isAvailable && (
                          <div className="absolute top-2 right-2">
                            <XCircle className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </Button>
                      {isConnected && (
                        <div className="absolute -bottom-2 left-0 right-0 text-xs text-center text-green-600 bg-background px-2 rounded">
                          Connected - Add Another
                        </div>
                      )}
                      {!isAvailable && (
                        <div className="absolute -bottom-2 left-0 right-0 text-xs text-center text-muted-foreground bg-background px-2 rounded">
                          {platform.reason || 'Not configured'}
                        </div>
                      )}
                      {isAvailable && !isConnected && (
                        <div className="absolute -bottom-2 left-0 right-0 text-xs text-center text-blue-600 bg-background px-2 rounded">
                          Click to Connect
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Help text */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Connection Tips:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• You'll be redirected to authorize SociallyHub</li>
                      <li>• Only necessary permissions are requested</li>
                      <li>• You can disconnect anytime from settings</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connected Accounts */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading accounts...</p>
        </div>
      ) : accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card key={account.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-lg",
                      getProviderColor(account.provider)
                    )}>
                      {getProviderIcon(account.provider)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{account.displayName}</h3>
                      <p className="text-sm text-muted-foreground">{account.handle}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(account.status)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={account.status === 'ACTIVE' ? 'default' : 'destructive'}>
                    {getStatusText(account.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground capitalize">
                    {account.provider.toLowerCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Account Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground mb-1">
                        <BarChart3 className="h-3 w-3" />
                        <span>Posts</span>
                      </div>
                      <div className="text-lg font-semibold">{account.stats?.postsCount || 0}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground mb-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>Inbox</span>
                      </div>
                      <div className="text-lg font-semibold">{account.stats?.inboxItemsCount || 0}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" />
                        <span>Last</span>
                      </div>
                      <div className="text-sm font-medium">
                        {account.stats?.lastPostDate 
                          ? new Date(account.stats.lastPostDate).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshAccount(account.id)}
                        disabled={account.status === 'ERROR' || account.status === 'REVOKED'}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenSettings(account)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Settings
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirmDeleteAccount(account)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Client Association */}
                  {account.client && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>Client: {account.client.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Connection Status Details */}
                  {account.status === 'ERROR' && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center space-x-2 text-sm text-red-600">
                        <XCircle className="h-3 w-3" />
                        <span>Connection failed. Please reconnect.</span>
                      </div>
                      <Button 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => handleConnectAccount(account.provider)}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Reconnect
                      </Button>
                    </div>
                  )}

                  {account.status === 'TOKEN_EXPIRED' && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center space-x-2 text-sm text-orange-600">
                        <AlertCircle className="h-3 w-3" />
                        <span>Access token expired. Please reauthorize.</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => handleConnectAccount(account.provider)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Reauthorize
                      </Button>
                    </div>
                  )}

                  {account.status === 'REVOKED' && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center space-x-2 text-sm text-red-600">
                        <XCircle className="h-3 w-3" />
                        <span>Access has been revoked. Please reconnect.</span>
                      </div>
                      <Button 
                        size="sm" 
                        className="mt-2 w-full"
                        onClick={() => handleConnectAccount(account.provider)}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Reconnect
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No social accounts connected</h3>
          <p className="text-muted-foreground mb-4">
            Connect your social media accounts to start posting and managing content
          </p>
          <Button onClick={() => setIsConnectDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Connect Your First Account
          </Button>
        </div>
      )}

      {/* Connection Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">✅ What you can do:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Schedule and publish posts</li>
                <li>• Monitor mentions and comments</li>
                <li>• Track engagement metrics</li>
                <li>• Manage multiple accounts</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🔒 Your data is safe:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• We only request necessary permissions</li>
                <li>• Tokens are encrypted and secure</li>
                <li>• You can revoke access anytime</li>
                <li>• No passwords are stored</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Settings Dialog */}
      <AccountSettingsDialog
        account={selectedAccount}
        isOpen={isSettingsDialogOpen}
        onClose={() => {
          setIsSettingsDialogOpen(false)
          setSelectedAccount(null)
        }}
        onSave={handleSaveSettings}
        clients={clients}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, accountId: null, accountName: '' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Disconnect Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to disconnect <strong>{deleteConfirm.accountName}</strong>? 
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">This action will:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Remove access to post and manage content</li>
                    <li>• Stop monitoring mentions and comments</li>
                    <li>• Disable analytics for this account</li>
                    <li>• You can reconnect anytime</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex space-x-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setDeleteConfirm({ isOpen: false, accountId: null, accountName: '' })}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => deleteConfirm.accountId && handleDeleteAccount(deleteConfirm.accountId)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Disconnect Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}