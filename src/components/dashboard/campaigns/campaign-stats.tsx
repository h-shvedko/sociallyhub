'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Megaphone, 
  Play, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  Calendar,
  Eye,
  MousePointer,
  Heart,
  Share
} from 'lucide-react'
import { CampaignStatsResponse } from '@/types/campaign'

interface CampaignStatsProps {
  stats: CampaignStatsResponse
}

export function CampaignStats({ stats }: CampaignStatsProps) {
  const { overview, breakdowns, topPerformers } = stats

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const budgetUtilization = overview.totalBudget > 0 
    ? (overview.spentBudget / overview.totalBudget) * 100 
    : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Overview Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
          <Megaphone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.totalCampaigns}</div>
          <p className="text-xs text-muted-foreground">
            {overview.recentCampaigns} created this month
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              <Play className="h-3 w-3 mr-1" />
              {overview.activeCampaigns} Active
            </Badge>
            <Badge variant="outline" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {overview.completedCampaigns} Done
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(overview.totalBudget)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(overview.spentBudget)} spent ({budgetUtilization.toFixed(1)}%)
          </p>
          <Progress value={budgetUtilization} className="mt-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Spent</span>
            <span>Remaining: {formatCurrency(overview.remainingBudget)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(overview.totalReach)}</div>
          <p className="text-xs text-muted-foreground">
            {formatNumber(overview.totalImpressions)} impressions
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              {formatNumber(overview.totalImpressions)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MousePointer className="h-3 w-3" />
              {formatNumber(overview.totalClicks)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.averageROI.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">Average ROI</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              {formatNumber(overview.totalEngagement)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              {formatNumber(overview.totalConversions)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Campaign Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(breakdowns.byStatus).map(([status, count]) => {
              const percentage = overview.totalCampaigns > 0 
                ? Math.round((count / overview.totalCampaigns) * 100) 
                : 0
              
              const getStatusColor = (status: string) => {
                switch (status) {
                  case 'ACTIVE': return 'bg-green-500'
                  case 'DRAFT': return 'bg-gray-500'
                  case 'SCHEDULED': return 'bg-blue-500'
                  case 'PAUSED': return 'bg-yellow-500'
                  case 'COMPLETED': return 'bg-purple-500'
                  case 'CANCELLED': return 'bg-red-500'
                  default: return 'bg-gray-500'
                }
              }
              
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                    <span className="text-sm capitalize">
                      {status.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{count}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Campaign Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(breakdowns.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm capitalize">
                  {type.toLowerCase().replace('_', ' ')}
                </span>
                <Badge variant="outline" className="text-xs">
                  {count}
                </Badge>
              </div>
            ))}
            
            {Object.keys(breakdowns.byType).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No campaign types data
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topPerformers.slice(0, 5).map((campaign, index) => (
              <div key={campaign.campaignId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium truncate">
                      {campaign.name}
                    </span>
                  </div>
                  <span className="text-xs text-green-600 font-medium">
                    {campaign.roi.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground ml-8">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatNumber(campaign.reach)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {formatNumber(campaign.engagement)}
                  </div>
                </div>
              </div>
            ))}
            
            {topPerformers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No performance data available
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}