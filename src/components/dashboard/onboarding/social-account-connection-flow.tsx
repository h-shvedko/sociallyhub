'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  SocialAccountConnection,
  SocialPlatform,
  ConnectionStatus,
  PlatformPermission,
  ConnectionSettings,
  PostingSchedule
} from '@/types/onboarding'
import {
  Facebook,
  Instagram,
  Twitter,
  Linkedin,
  Youtube,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Link,
  Settings,
  Calendar,
  Users,
  TrendingUp,
  Filter,
  ChevronRight,
  Shield,
  Zap,
  BarChart3,
  MessageSquare,
  DollarSign,
  RefreshCw,
  ExternalLink
} from 'lucide-react'

interface SocialAccountConnectionFlowProps {
  onConnectionComplete?: (connections: SocialAccountConnection[]) => void
  onSkip?: () => void
  initialConnections?: SocialAccountConnection[]
}

export function SocialAccountConnectionFlow({
  onConnectionComplete,
  onSkip,
  initialConnections = []
}: SocialAccountConnectionFlowProps) {
  const [connections, setConnections] = useState<SocialAccountConnection[]>(initialConnections)
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null)
  const [isConnecting, setIsConnecting] = useState<SocialPlatform | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const platforms = [
    {
      platform: SocialPlatform.FACEBOOK,
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600',
      description: 'Connect your Facebook pages to manage posts and engage with your audience',
      features: ['Page Management', 'Post Scheduling', 'Analytics', 'Comments & Messages'],
      permissions: [
        PlatformPermission.READ_PROFILE,
        PlatformPermission.PUBLISH_POSTS,
        PlatformPermission.READ_ANALYTICS,
        PlatformPermission.MANAGE_COMMENTS
      ]
    },
    {
      platform: SocialPlatform.INSTAGRAM,
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      description: 'Manage Instagram Business accounts with posts, stories, and insights',
      features: ['Feed Posts', 'Stories', 'Reels', 'Insights'],
      permissions: [
        PlatformPermission.READ_PROFILE,
        PlatformPermission.PUBLISH_POSTS,
        PlatformPermission.READ_ANALYTICS
      ]
    },
    {
      platform: SocialPlatform.TWITTER,
      name: 'Twitter/X',
      icon: Twitter,
      color: 'bg-black dark:bg-white dark:text-black',
      description: 'Tweet, retweet, and engage with your Twitter/X community',
      features: ['Tweets', 'Threads', 'Analytics', 'Direct Messages'],
      permissions: [
        PlatformPermission.READ_PROFILE,
        PlatformPermission.PUBLISH_POSTS,
        PlatformPermission.READ_ANALYTICS,
        PlatformPermission.READ_MESSAGES
      ]
    },
    {
      platform: SocialPlatform.LINKEDIN,
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-blue-700',
      description: 'Share professional content and connect with your network',
      features: ['Posts', 'Articles', 'Company Pages', 'Analytics'],
      permissions: [
        PlatformPermission.READ_PROFILE,
        PlatformPermission.PUBLISH_POSTS,
        PlatformPermission.READ_ANALYTICS
      ]
    },
    {
      platform: SocialPlatform.YOUTUBE,
      name: 'YouTube',
      icon: Youtube,
      color: 'bg-red-600',
      description: 'Upload videos, manage your channel, and track performance',
      features: ['Video Upload', 'Community Posts', 'Analytics', 'Live Streaming'],
      permissions: [
        PlatformPermission.READ_PROFILE,
        PlatformPermission.PUBLISH_POSTS,
        PlatformPermission.READ_ANALYTICS
      ]
    }
  ]

  const steps = [
    { id: 'select', title: 'Select Platforms', description: 'Choose which social media platforms to connect' },
    { id: 'connect', title: 'Connect Accounts', description: 'Authorize access to your social media accounts' },
    { id: 'configure', title: 'Configure Settings', description: 'Set up posting preferences and permissions' }
  ]

  const getConnectionStatus = (platform: SocialPlatform): ConnectionStatus | null => {
    const connection = connections.find(c => c.platform === platform)
    return connection?.connectionStatus || null
  }

  const getConnection = (platform: SocialPlatform): SocialAccountConnection | null => {
    return connections.find(c => c.platform === platform) || null
  }

  const handleConnect = async (platform: SocialPlatform) => {
    setIsConnecting(platform)
    
    try {
      // Simulate API call to initiate OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Create mock connection
      const newConnection: SocialAccountConnection = {
        id: `${platform}-${Date.now()}`,
        platform,
        accountId: `mock-${platform}-account`,
        displayName: `My ${platforms.find(p => p.platform === platform)?.name} Account`,
        username: `@myaccount`,
        profilePicture: '/placeholder-avatar.jpg',
        followerCount: Math.floor(Math.random() * 10000) + 1000,
        connectionStatus: ConnectionStatus.CONNECTED,
        permissions: platforms.find(p => p.platform === platform)?.permissions || [],
        connectedAt: new Date(),
        settings: {
          autoPost: false,
          syncAnalytics: true,
          syncComments: true
        }
      }

      setConnections(prev => {
        const filtered = prev.filter(c => c.platform !== platform)
        return [...filtered, newConnection]
      })
    } catch (error) {
      // Handle error
      console.error('Connection failed:', error)
    } finally {
      setIsConnecting(null)
    }
  }

  const handleDisconnect = (platform: SocialPlatform) => {
    setConnections(prev => prev.filter(c => c.platform !== platform))
  }

  const updateConnectionSettings = (platform: SocialPlatform, field: string, value: boolean) => {
    setConnections(prev => prev.map(connection => 
      connection.platform === platform 
        ? {
            ...connection,
            settings: {
              ...connection.settings,
              [field]: value
            }
          }
        : connection
    ))
  }

  const renderPlatformCard = (platformData: typeof platforms[0]) => {
    const { platform, name, icon: Icon, color, description, features, permissions } = platformData
    const connection = getConnection(platform)
    const status = getConnectionStatus(platform)
    const isConnected = status === ConnectionStatus.CONNECTED
    const isConnectingThis = isConnecting === platform

    return (
      <Card key={platform} className="relative overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{name}</CardTitle>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isConnected && (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              {status === ConnectionStatus.ERROR && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Error
                </Badge>
              )}
              {status === ConnectionStatus.PENDING && (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Features */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <Zap className="h-4 w-4 mr-1" />
              Features
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {features.map((feature) => (
                <div key={feature} className="flex items-center text-sm text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mr-2 text-green-500" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <Shield className="h-4 w-4 mr-1" />
              Permissions
            </h4>
            <div className="space-y-1">
              {permissions.map((permission) => (
                <div key={permission} className="flex items-center text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mr-2 text-green-500" />
                  {permission.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                </div>
              ))}
            </div>
          </div>

          {isConnected && connection && (
            <>
              <Separator />
              {/* Account Info */}
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  {connection.profilePicture ? (
                    <img 
                      src={connection.profilePicture} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <Users className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{connection.displayName}</div>
                  <div className="text-xs text-muted-foreground">{connection.username}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{connection.followerCount?.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">followers</div>
                </div>
              </div>

              {/* Quick Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center">
                  <Settings className="h-4 w-4 mr-1" />
                  Quick Settings
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Auto-posting</Label>
                      <p className="text-xs text-muted-foreground">Automatically publish scheduled posts</p>
                    </div>
                    <Switch
                      checked={connection.settings.autoPost}
                      onCheckedChange={(checked) => updateConnectionSettings(platform, 'autoPost', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Sync Analytics</Label>
                      <p className="text-xs text-muted-foreground">Import performance data</p>
                    </div>
                    <Switch
                      checked={connection.settings.syncAnalytics}
                      onCheckedChange={(checked) => updateConnectionSettings(platform, 'syncAnalytics', checked)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Button */}
          <div className="pt-2">
            {isConnected ? (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPlatform(platform)}
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect(platform)}
                  className="text-red-600 hover:text-red-700"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => handleConnect(platform)}
                disabled={isConnectingThis}
                className={`w-full ${color.replace('bg-', 'bg-opacity-90 bg-')}`}
              >
                {isConnectingThis ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Connect {name}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Select Platforms
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Connect Your Social Media Accounts</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Connect your social media accounts to start managing all your content from one place. 
                You can always add more accounts later.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {platforms.map(renderPlatformCard)}
            </div>

            {connections.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800 dark:text-green-200 font-medium">
                    {connections.length} account{connections.length > 1 ? 's' : ''} connected
                  </span>
                </div>
                <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                  You're all set! You can add more accounts anytime from your dashboard.
                </p>
              </div>
            )}
          </div>
        )

      case 1: // Configuration (if needed)
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold mb-2">Almost Done!</h2>
              <p className="text-muted-foreground">
                Your accounts are connected. You can start using SociallyHub right away or configure additional settings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="text-center p-6">
                <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Schedule Posts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Plan and schedule your content across all connected platforms
                </p>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Calendar
                </Button>
              </Card>

              <Card className="text-center p-6">
                <BarChart3 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">View Analytics</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Track performance and engagement across all your accounts
                </p>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </Card>

              <Card className="text-center p-6">
                <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Invite Team</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Collaborate with your team on content creation and management
                </p>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Invite Team
                </Button>
              </Card>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const progress = connections.length > 0 ? 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Connect Social Media
            </h1>
            <p className="text-muted-foreground mt-1">
              Link your accounts to start managing your social media presence
            </p>
          </div>
          <Button variant="ghost" onClick={onSkip}>
            Skip for Now
          </Button>
        </div>

        {/* Progress */}
        {connections.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Connection Progress</span>
              <span className="text-sm text-muted-foreground">
                {connections.length} of {platforms.length} platforms connected
              </span>
            </div>
            <Progress value={(connections.length / platforms.length) * 100} className="h-2" />
          </div>
        )}

        {/* Main Content */}
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl mb-8">
          <CardContent className="p-8 md:p-12">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {connections.length === 0 ? (
              "No accounts connected yet"
            ) : connections.length === 1 ? (
              "1 account connected"
            ) : (
              `${connections.length} accounts connected`
            )}
          </div>

          <div className="space-x-2">
            {connections.length > 0 && (
              <>
                <Button variant="outline">
                  Add More Later
                </Button>
                <Button
                  onClick={() => onConnectionComplete?.(connections)}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  Continue to Dashboard
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
            {connections.length === 0 && (
              <Button
                onClick={onSkip}
                variant="outline"
              >
                I'll Connect Later
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}