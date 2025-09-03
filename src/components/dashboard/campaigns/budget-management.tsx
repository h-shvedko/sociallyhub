'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, TrendingUp, AlertTriangle, Target, Settings } from 'lucide-react'
import { Campaign } from '@/types/campaign'

interface BudgetManagementProps {
  workspaceId: string
  campaigns: Campaign[]
}

export function BudgetManagement({ workspaceId, campaigns }: BudgetManagementProps) {
  // Calculate real budget data from campaigns
  const totalBudget = campaigns.reduce((sum, campaign) => {
    const budget = campaign.objectives?.budget?.totalBudget || 0
    return sum + budget
  }, 0)

  const spentBudget = campaigns.reduce((sum, campaign) => {
    const spent = campaign.objectives?.budget?.spentAmount || 0
    return sum + spent
  }, 0)

  const remainingBudget = totalBudget - spentBudget
  const spentPercentage = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
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
        <Button variant="outline" onClick={() => console.log('Budget Settings clicked')} disabled>
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
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            <p className="text-xs text-muted-foreground">Across {campaigns.length} campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(spentBudget)}</div>
            <p className="text-xs text-muted-foreground">{spentPercentage.toFixed(1)}% of total budget</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(remainingBudget)}</div>
            <p className="text-xs text-muted-foreground">{(100 - spentPercentage).toFixed(1)}% remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">No active alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Budget Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2" />
              <p>Budget tracking dashboard would display here</p>
              <p className="text-xs">Individual campaign budgets, spending trends, and alerts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}