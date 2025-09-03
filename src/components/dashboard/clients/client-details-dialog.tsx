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
  Activity
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
              {client.billingInfo ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Billing Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Contract Value</p>
                        <p className="text-xl font-semibold">
                          {formatCurrency(client.billingInfo.contractValue, client.billingInfo.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Billing Cycle</p>
                        <p className="font-medium">{client.billingInfo.billingCycle}</p>
                      </div>
                    </div>
                    
                    {client.billingInfo.nextBillingDate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Next Billing Date</p>
                        <p className="font-medium">
                          {formatDate(client.billingInfo.nextBillingDate)}
                        </p>
                      </div>
                    )}
                    
                    {client.billingInfo.billingEmail && (
                      <div>
                        <p className="text-sm text-muted-foreground">Billing Email</p>
                        <p className="font-medium">{client.billingInfo.billingEmail}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No billing information available</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Activity tracking would be implemented here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recent communications, campaigns, and interactions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Client Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Client-specific settings and preferences</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Notification preferences, access levels, and customizations
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}