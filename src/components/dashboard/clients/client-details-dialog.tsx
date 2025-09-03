'use client'

import React from 'react'
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
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  if (!client) return null

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={client.logo} alt={client.name} />
              <AvatarFallback className="text-lg font-semibold">
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-2xl">{client.name}</DialogTitle>
              <DialogDescription className="text-base">
                {client.company && client.company !== client.name && (
                  <span className="mr-3">{client.company}</span>
                )}
                {client.industry && (
                  <span className="text-muted-foreground">{client.industry}</span>
                )}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getStatusColor(client.status)}>
                  {client.status}
                </Badge>
                <Badge className={getOnboardingColor(client.onboardingStatus)}>
                  {client.onboardingStatus}
                </Badge>
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
                        {formatDate(client.createdAt)}
                      </span>
                    </div>
                    {client.lastContactDate && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Last Contact</span>
                        <span className="text-sm font-medium">
                          {formatDate(client.lastContactDate)}
                        </span>
                      </div>
                    )}
                    {client.assignedUserId && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Assigned To</span>
                        <span className="text-sm font-medium">Account Manager</span>
                      </div>
                    )}
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
                      <span className="text-sm font-medium">{client.socialAccountsCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Campaigns</span>
                      <span className="text-sm font-medium">{client.campaignsCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Posts</span>
                      <span className="text-sm font-medium">{client.postsCount || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tags and Notes */}
              {(client.tags && client.tags.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="h-5 w-5" />
                      Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {client.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {client.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{client.notes}</p>
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
                      <p className="font-medium">{client.email || 'Not provided'}</p>
                    </div>
                  </div>
                  
                  {client.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{client.phone}</p>
                      </div>
                    </div>
                  )}
                  
                  {client.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Website</p>
                        <a 
                          href={client.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {client.website}
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Contract & Payment Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Contract & Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Service Plan</p>
                        <p className="text-xl font-semibold">Premium</p>
                        <p className="text-xs text-muted-foreground">$999/month</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Billing Cycle</p>
                        <p className="font-medium">Monthly</p>
                        <p className="text-xs text-muted-foreground">Auto-renewal enabled</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contract Start</p>
                        <p className="font-medium">{formatDate(client.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Next Billing Date</p>
                        <p className="font-medium">
                          {formatDate(new Date(new Date().setMonth(new Date().getMonth() + 1)))}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Payment History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => {
                        const date = new Date()
                        date.setMonth(date.getMonth() - i)
                        return (
                          <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Monthly Subscription</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(999)}</p>
                              <Badge className="bg-green-100 text-green-800">Paid</Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Billing Contact */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Billing Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Email</p>
                      <p className="font-medium">{client.email || 'billing@company.com'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Method</p>
                      <p className="font-medium">Credit Card ending in ****4242</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                    <div className="space-y-4">
                      {[
                        { type: 'message', title: 'Sent campaign report', time: '2 hours ago', icon: Mail },
                        { type: 'campaign', title: 'Launched "Summer Sale" campaign', time: '1 day ago', icon: BarChart3 },
                        { type: 'post', title: 'Published 5 social posts', time: '3 days ago', icon: FileText },
                        { type: 'meeting', title: 'Quarterly review meeting', time: '1 week ago', icon: Users },
                        { type: 'billing', title: 'Payment received', time: '2 weeks ago', icon: DollarSign },
                      ].map((activity, index) => {
                        const Icon = activity.icon
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
                    <div className="space-y-3">
                      {[
                        { subject: 'Monthly Performance Report', date: '2024-01-15', type: 'email' },
                        { subject: 'Campaign Approval Request', date: '2024-01-12', type: 'email' },
                        { subject: 'Quick check-in', date: '2024-01-10', type: 'sms' },
                        { subject: 'Welcome to SociallyHub!', date: '2024-01-01', type: 'email' },
                      ].map((message, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{message.subject}</p>
                              <p className="text-sm text-muted-foreground">{message.date}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{message.type}</Badge>
                        </div>
                      ))}
                    </div>
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
                        <span className="font-medium">{client.campaignsCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Posts This Month</span>
                        <span className="font-medium">{client.postsCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Engagement Rate</span>
                        <span className="font-medium">4.8%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Notification Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Email Reports</p>
                          <p className="text-sm text-muted-foreground">Receive weekly performance reports</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Campaign Alerts</p>
                          <p className="text-sm text-muted-foreground">Get notified about campaign milestones</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Billing Reminders</p>
                          <p className="text-sm text-muted-foreground">Payment due date notifications</p>
                        </div>
                        <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Access & Permissions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team Access
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Team Members</p>
                          <p className="text-sm text-muted-foreground">Users with access to this client</p>
                        </div>
                        <Badge variant="outline">3 members</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">API Access</p>
                          <p className="text-sm text-muted-foreground">External integrations enabled</p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">Limited</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Custom Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Default Posting Time</p>
                          <p className="text-sm text-muted-foreground">Preferred time for scheduled posts</p>
                        </div>
                        <span className="font-medium">9:00 AM EST</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Approval Workflow</p>
                          <p className="text-sm text-muted-foreground">Content approval required</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Required</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Auto-publish</p>
                          <p className="text-sm text-muted-foreground">Publish approved content automatically</p>
                        </div>
                        <Badge className="bg-gray-100 text-gray-800">Off</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}