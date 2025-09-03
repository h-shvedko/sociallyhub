'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Users,
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  Tag,
  FileText,
  Activity,
  Settings
} from 'lucide-react'
import { Client, ClientStatus, OnboardingStatus } from '@/types/client'

interface ClientDetailsDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSendMessage?: (client: Client) => void
  onEditClient?: (client: Client) => void
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [clientData, setClientData] = useState<any>(null)
  const [billingData, setBillingData] = useState<any>(null)
  const [activityData, setActivityData] = useState<any[]>([])
  const [messagesData, setMessagesData] = useState<any[]>([])

  useEffect(() => {
    if (open && client) {
      fetchClientDetails()
    }
  }, [open, client])

  const fetchClientDetails = async () => {
    if (!client?.id) return
    
    setIsLoading(true)
    try {
      // Fetch full client details from API
      const response = await fetch(`/api/clients/${client.id}`)
      if (response.ok) {
        const data = await response.json()
        setClientData(data)
      }

      // Since we don't have billing/messages in the database yet,
      // we'll set empty states for now
      setBillingData(null)
      setActivityData([])
      setMessagesData([])
    } catch (error) {
      console.error('Error fetching client details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!client) return null

  const displayClient = clientData || client

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case ClientStatus.ACTIVE:
        return 'bg-green-100 text-green-800'
      case ClientStatus.PROSPECT:
        return 'bg-blue-100 text-blue-800'
      case ClientStatus.ON_HOLD:
        return 'bg-yellow-100 text-yellow-800'
      case ClientStatus.CHURNED:
        return 'bg-red-100 text-red-800'
      case ClientStatus.ARCHIVED:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOnboardingColor = (status: OnboardingStatus) => {
    switch (status) {
      case OnboardingStatus.COMPLETED:
        return 'bg-green-100 text-green-800'
      case OnboardingStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800'
      case OnboardingStatus.STALLED:
        return 'bg-red-100 text-red-800'
      case OnboardingStatus.NOT_STARTED:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Button click handlers
  const handleSetupBilling = () => {
    console.log('🏦 Setting up billing for client:', displayClient.name)
    // TODO: Open billing setup dialog or redirect to billing configuration
    alert(`Setting up billing for ${displayClient.name}. This would open a billing configuration dialog.`)
  }

  const handleSendFirstMessage = () => {
    console.log('📧 Opening send message dialog for client:', displayClient.name)
    // TODO: Open send message dialog
    alert(`Opening message composer for ${displayClient.name}. This would open the send message dialog.`)
  }

  const handleViewCampaignDetails = () => {
    console.log('📊 Viewing campaign details for client:', displayClient.name)
    // TODO: Navigate to campaigns page filtered by client
    alert(`Viewing campaigns for ${displayClient.name}. This would navigate to the campaigns page.`)
  }

  const handleConfigureSettings = () => {
    console.log('⚙️ Configuring settings for client:', displayClient.name)
    // TODO: Open settings configuration dialog
    alert(`Configuring settings for ${displayClient.name}. This would open a settings dialog.`)
  }

  const handleViewMessageDetails = (message: any) => {
    console.log('📄 Viewing message details:', message)
    // TODO: Open message details modal
    alert(`Viewing message details: "${message.subject}". This would show the full message content.`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={displayClient.logo} alt={displayClient.name} />
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(displayClient.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-2xl">{displayClient.name}</DialogTitle>
              <DialogDescription className="text-base">
                {displayClient.company && displayClient.company !== displayClient.name && (
                  <span className="mr-3">{displayClient.company}</span>
                )}
                {displayClient.industry && (
                  <span className="text-muted-foreground">{displayClient.industry}</span>
                )}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getStatusColor(displayClient.status || 'ACTIVE')}>
                  {displayClient.status || 'ACTIVE'}
                </Badge>
                {displayClient.onboardingStatus && (
                  <Badge className={getOnboardingColor(displayClient.onboardingStatus)}>
                    {displayClient.onboardingStatus}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Client Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm font-medium">
                        {formatDate(displayClient.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Updated</span>
                      <span className="text-sm font-medium">
                        {formatDate(displayClient.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Workspace</span>
                      <span className="text-sm font-medium">
                        {displayClient.workspace?.name || 'Default'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Quick Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Social Accounts</span>
                      <span className="text-sm font-medium">{displayClient.socialAccountsCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Campaigns</span>
                      <span className="text-sm font-medium">{displayClient.campaignsCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Posts</span>
                      <span className="text-sm font-medium">{displayClient.postsCount || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tags and Notes */}
              {(displayClient.tags && displayClient.tags.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {displayClient.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {displayClient.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{displayClient.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{displayClient.email || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  {displayClient.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{displayClient.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {displayClient.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Website</p>
                        <a 
                          href={displayClient.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {displayClient.website}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4 mt-4">
              {billingData ? (
                <div className="space-y-4">
                  {/* Show real billing data when available */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Billing Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Billing information would appear here when available.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <DollarSign className="h-12 w-12 mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">No Billing Information</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Billing information will appear here once a payment plan is configured for this client.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={handleSetupBilling}
                    >
                      Set Up Billing
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Recent Activity Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activityData.length > 0 ? (
                      <div className="space-y-4">
                        {activityData.map((activity, index) => {
                          const Icon = activity.icon || Activity
                          return (
                            <div key={index} className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <Icon className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{activity.title}</p>
                                <p className="text-sm text-muted-foreground">{activity.time}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No recent activity to display.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Activity will appear here as you interact with this client.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Messages History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Message History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {messagesData.length > 0 ? (
                      <div className="space-y-3">
                        {messagesData.map((message, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{message.subject}</p>
                                  <p className="text-sm text-muted-foreground">{message.date}</p>
                                </div>
                              </div>
                              <Badge variant="outline">{message.type}</Badge>
                            </div>
                            {message.content && (
                              <div className="mt-3 p-3 bg-accent rounded-md">
                                <p className="text-sm">{message.content}</p>
                              </div>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => handleViewMessageDetails(message)}
                            >
                              View Details
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No messages sent to this client yet.
                        </p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={handleSendFirstMessage}
                        >
                          Send First Message
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Campaign Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Campaign Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Active Campaigns</span>
                        <span className="font-medium">{displayClient.campaignsCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Posts</span>
                        <span className="font-medium">{displayClient.postsCount || 0}</span>
                      </div>
                      {displayClient.campaignsCount > 0 && (
                        <div className="mt-4">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={handleViewCampaignDetails}
                          >
                            View Campaign Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Settings className="h-12 w-12 mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Client Settings</p>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Client-specific settings and preferences will be available here once configured.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={handleConfigureSettings}
                  >
                    Configure Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}