'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Settings, 
  User, 
  Shield, 
  Clock, 
  Key,
  Link,
  AlertCircle,
  CheckCircle,
  Calendar
} from 'lucide-react'

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
  client?: {
    id: string
    name: string
  }
}

interface Client {
  id: string
  name: string
}

interface AccountSettingsDialogProps {
  account: SocialAccount | null
  isOpen: boolean
  onClose: () => void
  onSave: (accountId: string, settings: any) => void
  clients: Client[]
}

export function AccountSettingsDialog({ 
  account, 
  isOpen, 
  onClose, 
  onSave,
  clients 
}: AccountSettingsDialogProps) {
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [isActive, setIsActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (account) {
      setDisplayName(account.displayName || '')
      setHandle(account.handle || '')
      setSelectedClientId(account.client?.id || '')
      setIsActive(account.status === 'ACTIVE')
      setNotes(account.metadata?.notes || '')
    }
  }, [account])

  const handleSave = async () => {
    if (!account) return

    setIsLoading(true)
    try {
      await onSave(account.id, {
        displayName,
        handle,
        clientId: selectedClientId || null,
        status: isActive ? 'ACTIVE' : 'ERROR',
        metadata: {
          ...account.metadata,
          notes
        }
      })
      onClose()
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getProviderIcon = (provider: string) => {
    const iconMap: Record<string, string> = {
      TWITTER: '𝕏',
      FACEBOOK: '󠁦',
      INSTAGRAM: '📷',
      LINKEDIN: '💼',
      TIKTOK: '🎵',
      YOUTUBE: '📺'
    }
    return iconMap[provider] || '📱'
  }

  const getProviderColor = (provider: string) => {
    const colorMap: Record<string, string> = {
      TWITTER: 'bg-black text-white',
      FACEBOOK: 'bg-blue-600 text-white',
      INSTAGRAM: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
      LINKEDIN: 'bg-blue-700 text-white',
      TIKTOK: 'bg-black text-white',
      YOUTUBE: 'bg-red-600 text-white'
    }
    return colorMap[provider] || 'bg-gray-600 text-white'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!account) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getProviderColor(account.provider)}`}>
              {getProviderIcon(account.provider)}
            </div>
            <div>
              <div className="text-lg font-semibold">Account Settings</div>
              <div className="text-sm text-muted-foreground">{account.provider} • {account.handle}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Basic Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Account display name"
                />
              </div>
              <div>
                <Label htmlFor="handle">Handle/Username</Label>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@username or handle"
                />
              </div>
              <div>
                <Label htmlFor="client">Associated Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client assigned</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Account Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Account Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable this account for posting and monitoring
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Current Status</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    {account.status === 'ACTIVE' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={account.status === 'ACTIVE' ? 'default' : 'destructive'}>
                      {account.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Account Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{account.accountType}</Badge>
                  </div>
                </div>
              </div>
              
              {account.tokenExpiry && (
                <div>
                  <Label className="text-sm font-medium">Token Expires</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDate(account.tokenExpiry)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Permissions & Scopes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-4 w-4" />
                <span>Permissions & Scopes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label className="text-sm font-medium">Current Scopes</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {account.scopes.map((scope, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
              {account.scopes.length === 0 && (
                <p className="text-sm text-muted-foreground">No scopes granted</p>
              )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Additional Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this account..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="font-medium">Connected</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(account.createdAt)}</span>
                  </div>
                </div>
                <div>
                  <Label className="font-medium">Last Updated</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(account.updatedAt)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="font-medium">Account ID</Label>
                <div className="mt-1">
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {account.accountId}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}