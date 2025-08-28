'use client'

import React, { useState, useEffect } from 'react'
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

interface SocialAccount {
  id: string
  provider: 'TWITTER' | 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE'
  accountId: string
  displayName: string
  handle: string
  profileImageUrl?: string
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'EXPIRED'
  createdAt: string
  updatedAt: string
  stats: {
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
}

export function SocialAccountsManager({ workspaceId }: SocialAccountsManagerProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<SocialAccount['provider'] | null>(null)

  useEffect(() => {
    fetchSocialAccounts()
  }, [workspaceId])

  const fetchSocialAccounts = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/accounts?workspaceId=${workspaceId}`)
      
      if (response.ok) {
        const data = await response.json()
        setAccounts(data || [])
      } else {
        console.error('Failed to fetch accounts')
        // Demo data fallback
        setAccounts([
          {
            id: '1',
            provider: 'TWITTER',
            accountId: 'demo_twitter_123',
            displayName: 'Demo Company',
            handle: '@democompany',
            profileImageUrl: '/demo/twitter-avatar.jpg',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
              postsCount: 45,
              inboxItemsCount: 12,
              lastPostDate: new Date(Date.now() - 3600000).toISOString()
            }
          },
          {
            id: '2',
            provider: 'LINKEDIN',
            accountId: 'demo_linkedin_456',
            displayName: 'Demo Company LinkedIn',
            handle: 'demo-company',
            profileImageUrl: '/demo/linkedin-avatar.jpg',
            status: 'ACTIVE',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
            stats: {
              postsCount: 23,
              inboxItemsCount: 8,
              lastPostDate: new Date(Date.now() - 86400000).toISOString()
            }
          },
          {
            id: '3',
            provider: 'FACEBOOK',
            accountId: 'demo_facebook_789',
            displayName: 'Demo Company Page',
            handle: 'DemoCompanyPage',
            status: 'ERROR',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            updatedAt: new Date(Date.now() - 172800000).toISOString(),
            stats: {
              postsCount: 15,
              inboxItemsCount: 5
            }
          }
        ])
      }
    } catch (error) {
      console.error('Error fetching social accounts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectAccount = async (provider: SocialAccount['provider']) => {
    setIsConnecting(true)
    setSelectedProvider(provider)
    
    try {
      // Redirect to OAuth flow
      window.location.href = `/api/social/connect?provider=${provider.toLowerCase()}&workspaceId=${workspaceId}`
    } catch (error) {
      console.error('Connection error:', error)
      setIsConnecting(false)
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
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
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
      case 'EXPIRED': return <AlertCircle className="h-4 w-4 text-orange-500" />
      case 'INACTIVE': return <AlertCircle className="h-4 w-4 text-gray-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: SocialAccount['status']) => {
    switch (status) {
      case 'ACTIVE': return 'Connected'
      case 'ERROR': return 'Connection Error'
      case 'EXPIRED': return 'Token Expired'
      case 'INACTIVE': return 'Inactive'
      default: return 'Unknown'
    }
  }

  const availableProviders: SocialAccount['provider'][] = [
    'TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'YOUTUBE'
  ]

  return (
    <div className="flex flex-col space-y-6">
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Social Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose a platform to connect your social media account
              </p>
              <div className="grid grid-cols-2 gap-3">
                {availableProviders.map((provider) => {
                  const isConnected = accounts.some(acc => acc.provider === provider && acc.status === 'ACTIVE')
                  return (
                    <Button
                      key={provider}
                      variant="outline"
                      className={cn(
                        "h-20 flex-col space-y-2",
                        getProviderColor(provider),
                        isConnected && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => handleConnectAccount(provider)}
                      disabled={isConnecting || isConnected}
                    >
                      <div className="text-2xl">{getProviderIcon(provider)}</div>
                      <div className="text-sm font-medium capitalize">
                        {provider.toLowerCase()}
                      </div>
                      {isConnected && (
                        <div className="text-xs opacity-75">Connected</div>
                      )}
                    </Button>
                  )
                })}
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
                      <div className="text-lg font-semibold">{account.stats.postsCount}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground mb-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>Inbox</span>
                      </div>
                      <div className="text-lg font-semibold">{account.stats.inboxItemsCount}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" />
                        <span>Last</span>
                      </div>
                      <div className="text-sm font-medium">
                        {account.stats.lastPostDate 
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
                        disabled={account.status === 'ERROR'}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-3 w-3 mr-1" />
                        Settings
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAccount(account.id)}
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

                  {account.status === 'EXPIRED' && (
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
    </div>
  )
}