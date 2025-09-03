'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Star,
  BarChart3,
  Target,
  AlertTriangle
} from 'lucide-react'
import { ClientStats as ClientStatsType } from '@/types/client'

interface ClientStatsProps {
  stats: ClientStatsType
}

export function ClientStats({ stats }: ClientStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const getChangeIndicator = (current: number, previous: number) => {
    const change = current - previous
    const changePercent = previous > 0 ? (change / previous) * 100 : 0
    
    if (changePercent > 0) {
      return (
        <div className="flex items-center text-green-600 text-xs">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{changePercent.toFixed(1)}%
        </div>
      )
    } else if (changePercent < 0) {
      return (
        <div className="flex items-center text-red-600 text-xs">
          <TrendingDown className="h-3 w-3 mr-1" />
          {changePercent.toFixed(1)}%
        </div>
      )
    }
    
    return (
      <div className="flex items-center text-gray-500 text-xs">
        No change
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {/* Total Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalClients}</div>
          {getChangeIndicator(stats.growthMetrics.newClientsThisMonth, stats.growthMetrics.newClientsLastMonth)}
        </CardContent>
      </Card>

      {/* Active Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.activeClients}</div>
          <p className="text-xs text-muted-foreground">
            {((stats.activeClients / stats.totalClients) * 100).toFixed(1)}% of total
          </p>
        </CardContent>
      </Card>

      {/* Prospects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Prospects</CardTitle>
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats.prospectClients}</div>
          <p className="text-xs text-muted-foreground">
            Potential clients
          </p>
        </CardContent>
      </Card>

      {/* Churned Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Churned</CardTitle>
          <UserX className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.churnedClients}</div>
          <p className="text-xs text-muted-foreground">
            {formatPercentage(stats.churnRate)} churn rate
          </p>
        </CardContent>
      </Card>

      {/* Monthly Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(stats.totalRevenue)} total
          </p>
        </CardContent>
      </Card>

      {/* Average Contract Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Contract</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.averageContractValue)}</div>
          <p className="text-xs text-muted-foreground">
            Per client value
          </p>
        </CardContent>
      </Card>

      {/* Client Satisfaction Score */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-1">
            {stats.clientSatisfactionScore}
            <Star className="h-4 w-4 text-yellow-400 fill-current" />
          </div>
          <p className="text-xs text-muted-foreground">
            Out of 5.0
          </p>
        </CardContent>
      </Card>

      {/* Retention Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Retention</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatPercentage(stats.retentionRate)}
          </div>
          <p className="text-xs text-muted-foreground">
            Client retention
          </p>
        </CardContent>
      </Card>

      {/* Response Time */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.responseTime}h</div>
          <p className="text-xs text-muted-foreground">
            Average response
          </p>
        </CardContent>
      </Card>

      {/* Onboarding Completion */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Onboarding</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPercentage(stats.onboardingCompletionRate)}
          </div>
          <p className="text-xs text-muted-foreground">
            Completion rate
          </p>
        </CardContent>
      </Card>

      {/* Growth Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            +{formatPercentage(stats.growthMetrics.growthRate)}
          </div>
          <p className="text-xs text-muted-foreground">
            Monthly growth
          </p>
        </CardContent>
      </Card>

      {/* Lifetime Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lifetime Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(stats.growthMetrics.clientLifetimeValue)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average LTV
          </p>
        </CardContent>
      </Card>

      {/* Industry Breakdown */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Clients by Industry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.clientsByIndustry)
              .sort(([,a], [,b]) => b - a)
              .map(([industry, count]) => (
                <div key={industry} className="flex items-center justify-between">
                  <span className="text-sm">{industry}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(stats.clientsByIndustry))) * 100}%` 
                        }}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">{count}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Service Level Breakdown */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Clients by Service Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.clientsByServiceLevel)
              .sort(([,a], [,b]) => b - a)
              .map(([level, count]) => (
                <div key={level} className="flex items-center justify-between">
                  <span className="text-sm">{level}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-600 rounded-full"
                        style={{ 
                          width: `${(count / Math.max(...Object.values(stats.clientsByServiceLevel))) * 100}%` 
                        }}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs">{count}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}