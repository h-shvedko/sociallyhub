'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, AlertTriangle, Target, Settings, Clock, Calendar } from 'lucide-react'
import { Campaign } from '@/types/campaign'
import { BudgetSettingsDialog } from './budget-settings-dialog'

interface BudgetAnalytics {
  overview: {
    totalBudget: number
    totalSpent: number
    totalRemaining: number
    spentPercentage: number
    campaignCount: number
    activeCampaigns: number
    alerts: {
      critical: number
      warning: number
      overBudget: number
      total: number
    }
  }
  campaigns: Array<{
    campaignId: string
    campaignName: string
    clientName: string
    status: string
    budget: {
      total: number
      spent: number
      remaining: number
      daily: number
      currency: string
    }
    performance: {
      spentPercentage: number
      budgetPacing: number
      projectedSpend: number
      daysRemaining: number
      alertLevel: string
      isOverBudget: boolean
      burnRate: number
    }
    dates: {
      startDate: string
      endDate: string
      createdAt: string
    }
  }>
  trends: {
    monthly: Array<{
      month: string
      monthName: string
      budget: number
      spent: number
      campaigns: number
    }>
    budgetByStatus: Record<string, number>
  }
}

interface BudgetManagementProps {
  workspaceId: string
  campaigns: Campaign[]
}

export function BudgetManagement({ workspaceId, campaigns }: BudgetManagementProps) {
  const [analytics, setAnalytics] = useState<BudgetAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    loadBudgetAnalytics()
  }, [workspaceId])

  const loadBudgetAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/budget/analytics?workspaceId=${workspaceId}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        console.error('Failed to load budget analytics')
      }
    } catch (error) {
      console.error('Error loading budget analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const getAlertColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-blue-100 text-blue-800'
      case 'CANCELLED': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading || !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Budget Management</h2>
            <p className="text-sm text-muted-foreground">Loading budget data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Budget Management</h2>
          <p className="text-sm text-muted-foreground">
            Track and manage campaign budgets and spending
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Budget Settings
        </Button>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.overview.totalBudget)}</div>
            <p className="text-xs text-muted-foreground">Across {analytics.overview.campaignCount} campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.overview.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">{analytics.overview.spentPercentage}% of total budget</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analytics.overview.totalRemaining)}</div>
            <p className="text-xs text-muted-foreground">{(100 - analytics.overview.spentPercentage).toFixed(1)}% remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.overview.alerts.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.overview.alerts.critical > 0 && `${analytics.overview.alerts.critical} critical`}
              {analytics.overview.alerts.warning > 0 && `, ${analytics.overview.alerts.warning} warning`}
              {analytics.overview.alerts.total === 0 && 'No active alerts'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Budget Details */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Budget Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-2" />
                <p>No campaign budgets found</p>
                <p className="text-xs">Create campaigns with budgets to see spending analytics here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analytics.campaigns.map((campaign) => (
                  <div key={campaign.campaignId} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{campaign.campaignName}</h4>
                        <p className="text-sm text-muted-foreground">{campaign.clientName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status.toLowerCase()}
                        </Badge>
                        {campaign.performance.alertLevel !== 'none' && (
                          <Badge className={getAlertColor(campaign.performance.alertLevel)}>
                            {campaign.performance.alertLevel}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Budget</p>
                        <p className="font-medium">{formatCurrency(campaign.budget.total, campaign.budget.currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Spent</p>
                        <p className="font-medium">{formatCurrency(campaign.budget.spent, campaign.budget.currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Daily Budget</p>
                        <p className="font-medium">{formatCurrency(campaign.budget.daily, campaign.budget.currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Days Remaining</p>
                        <p className="font-medium flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {campaign.performance.daysRemaining}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Budget Usage</span>
                        <span>{campaign.performance.spentPercentage}%</span>
                      </div>
                      <Progress 
                        value={Math.min(campaign.performance.spentPercentage, 100)} 
                        className="h-2"
                      />
                      {campaign.performance.isOverBudget && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Over budget by {formatCurrency(campaign.budget.spent - campaign.budget.total, campaign.budget.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              {analytics.trends.monthly.map((month) => (
                <div key={month.month} className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{month.monthName}</div>
                  <div className="text-sm font-medium">{formatCurrency(month.budget)}</div>
                  <div className="text-xs text-muted-foreground">{month.campaigns} campaigns</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Settings Dialog */}
      <BudgetSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        workspaceId={workspaceId}
        onSave={() => loadBudgetAnalytics()}
      />
    </div>
  )
}