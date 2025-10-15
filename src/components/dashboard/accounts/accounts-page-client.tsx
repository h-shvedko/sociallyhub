'use client'

import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SocialAccountsManager } from './social-accounts-manager'
import { PlatformCredentialsManager } from './platform-credentials-manager'
import {
  Users,
  Key,
  Shield,
  Info
} from 'lucide-react'

interface AccountsPageClientProps {
  workspaceId: string
  workspaceName: string
  userRole: string
  canManageCredentials: boolean
}

export function AccountsPageClient({
  workspaceId,
  workspaceName,
  userRole,
  canManageCredentials
}: AccountsPageClientProps) {
  const [activeTab, setActiveTab] = useState('accounts')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Account Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage your social media connections and platform credentials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{workspaceName}</Badge>
          <Badge variant="secondary">{userRole}</Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Social Accounts
          </TabsTrigger>
          <TabsTrigger
            value="credentials"
            className="flex items-center gap-2"
            disabled={!canManageCredentials}
          >
            <Key className="h-4 w-4" />
            Platform Credentials
            {!canManageCredentials && <Shield className="h-3 w-3" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          <SocialAccountsManager
            workspaceId={workspaceId}
            workspaceName={workspaceName}
          />
        </TabsContent>

        <TabsContent value="credentials" className="mt-6">
          {canManageCredentials ? (
            <PlatformCredentialsManager
              workspaceId={workspaceId}
              workspaceName={workspaceName}
            />
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
              <p className="text-muted-foreground mb-4">
                Only workspace owners and administrators can manage platform credentials.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Why this restriction?</p>
                    <p>
                      Platform credentials contain sensitive API keys that grant access to social media accounts.
                      Only trusted administrators should have access to manage these credentials.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}