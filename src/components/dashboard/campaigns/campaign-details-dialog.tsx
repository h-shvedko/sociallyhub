'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Calendar as CalendarIcon, DollarSign, Target, Save, Edit, BarChart3 } from 'lucide-react'
import { Campaign } from '@/types/campaign'

interface CampaignDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: Campaign | null
  onSave?: (campaignId: string, updates: any) => void
}

export function CampaignDetailsDialog({ 
  open, 
  onOpenChange, 
  campaign,
  onSave 
}: CampaignDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: '',
    type: '',
    budget: {
      totalBudget: 0,
      spentAmount: 0,
      dailyBudget: 0,
      currency: 'USD'
    }
  })

  useEffect(() => {
    if (campaign) {
      const budget = (campaign as any).budget || {}
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        status: campaign.status || '',
        type: campaign.type || '',
        budget: {
          totalBudget: budget.totalBudget || 0,
          spentAmount: budget.spentAmount || 0,
          dailyBudget: budget.dailyBudget || 0,
          currency: budget.currency || 'USD'
        }
      })
    }
  }, [campaign])

  const handleSave = async () => {
    if (!campaign || !onSave) return

    setIsLoading(true)
    try {
      await onSave(campaign.id, {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        type: formData.type,
        budget: formData.budget
      })
      // Update the campaign object with new data after successful save
      Object.assign(campaign, {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        type: formData.type,
        budget: formData.budget
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving campaign:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (campaign) {
      const budget = (campaign as any).budget || {}
      setFormData({
        name: campaign.name || '',
        description: campaign.description || '',
        status: campaign.status || '',
        type: campaign.type || '',
        budget: {
          totalBudget: budget.totalBudget || 0,
          spentAmount: budget.spentAmount || 0,
          dailyBudget: budget.dailyBudget || 0,
          currency: budget.currency || 'USD'
        }
      })
    }
    setIsEditing(false)
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-purple-100 text-purple-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const budgetProgress = formData.budget.totalBudget > 0 
    ? (formData.budget.spentAmount / formData.budget.totalBudget) * 100 
    : 0

  const remainingBudget = formData.budget.totalBudget - formData.budget.spentAmount

  if (!campaign) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{campaign.name}</DialogTitle>
              <DialogDescription>Campaign details and management</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Campaign
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Campaign Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Campaign Name</Label>
                      {isEditing ? (
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="Enter campaign name"
                        />
                      ) : (
                        <p className="text-sm font-medium">{campaign.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      {isEditing ? (
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          placeholder="Enter campaign description"
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {campaign.description || 'No description provided'}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        {isEditing ? (
                          <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DRAFT">Draft</SelectItem>
                              <SelectItem value="ACTIVE">Active</SelectItem>
                              <SelectItem value="PAUSED">Paused</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                              <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status.toLowerCase()}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Type</Label>
                        {isEditing ? (
                          <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BRAND_AWARENESS">Brand Awareness</SelectItem>
                              <SelectItem value="LEAD_GENERATION">Lead Generation</SelectItem>
                              <SelectItem value="ENGAGEMENT">Engagement</SelectItem>
                              <SelectItem value="SALES">Sales</SelectItem>
                              <SelectItem value="CUSTOM">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm">{campaign.type.replace('_', ' ')}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Start Date:</span>
                      <span>{formatDate(campaign.startDate)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">End Date:</span>
                      <span>{formatDate(campaign.endDate)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Created:</span>
                      <span>{formatDate(campaign.createdAt)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated:</span>
                      <span>{formatDate(campaign.updatedAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="budget" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Budget Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Total Budget ({formData.budget.currency})</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={formData.budget.totalBudget}
                          onChange={(e) => setFormData({
                            ...formData, 
                            budget: {...formData.budget, totalBudget: Number(e.target.value)}
                          })}
                          placeholder="0"
                          min="0"
                          step="100"
                        />
                      ) : (
                        <p className="text-2xl font-bold">{formatCurrency(formData.budget.totalBudget, formData.budget.currency)}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Spent Amount ({formData.budget.currency})</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={formData.budget.spentAmount}
                          onChange={(e) => setFormData({
                            ...formData, 
                            budget: {...formData.budget, spentAmount: Number(e.target.value)}
                          })}
                          placeholder="0"
                          min="0"
                          step="10"
                        />
                      ) : (
                        <p className="text-xl font-semibold text-orange-600">
                          {formatCurrency(formData.budget.spentAmount, formData.budget.currency)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Daily Budget ({formData.budget.currency})</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={formData.budget.dailyBudget}
                          onChange={(e) => setFormData({
                            ...formData, 
                            budget: {...formData.budget, dailyBudget: Number(e.target.value)}
                          })}
                          placeholder="0"
                          min="0"
                          step="10"
                        />
                      ) : (
                        <p className="text-lg font-medium">{formatCurrency(formData.budget.dailyBudget, formData.budget.currency)}</p>
                      )}
                    </div>

                    {isEditing && (
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={formData.budget.currency} onValueChange={(value) => setFormData({
                          ...formData, 
                          budget: {...formData.budget, currency: value}
                        })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD ($)</SelectItem>
                            <SelectItem value="EUR">EUR (€)</SelectItem>
                            <SelectItem value="GBP">GBP (£)</SelectItem>
                            <SelectItem value="CAD">CAD ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Budget Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Budget Usage</span>
                        <span>{budgetProgress.toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.min(budgetProgress, 100)} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(remainingBudget, formData.budget.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Over/Under Budget</p>
                        <p className={`font-semibold ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {remainingBudget < 0 ? '-' : '+'}{formatCurrency(Math.abs(remainingBudget), formData.budget.currency)}
                        </p>
                      </div>
                    </div>

                    {budgetProgress > 75 && (
                      <div className={`p-3 rounded-lg text-sm ${
                        budgetProgress > 90 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                      }`}>
                        {budgetProgress > 90 
                          ? '🚨 Critical: Over 90% of budget used'
                          : '⚠️ Warning: Over 75% of budget used'
                        }
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6 mt-6">
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Performance Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Detailed performance metrics and insights will be displayed here
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}