'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserPlus, Activity } from 'lucide-react'
import { ClientStats as ClientStatsType } from '@/types/client'

interface ClientStatsProps {
  stats: ClientStatsType
}

// ADR-0023: this component shows ONLY real, DB-derived counts. The fabricated cards
// (revenue, avg contract, satisfaction, retention/churn, response time, onboarding,
// growth rate, LTV, industry/service-level splits) were removed — SociallyHub does not
// store that data yet, and we render nothing rather than invent numbers.
export function ClientStats({ stats }: ClientStatsProps) {
  const total = stats?.totalClients ?? 0
  const active = stats?.activeClients ?? 0
  const prospects = stats?.prospectClients ?? 0
  const recent = stats?.recentClients ?? 0
  const engagementRate = stats?.engagementRate ?? 0
  const activePct = total > 0 ? ((active / total) * 100).toFixed(1) : '0.0'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{total}</div>
          <p className="text-xs text-muted-foreground">
            {recent} new in the last 30 days
          </p>
        </CardContent>
      </Card>

      {/* Active Clients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{active}</div>
          <p className="text-xs text-muted-foreground">
            {activePct}% of total
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
          <div className="text-2xl font-bold text-blue-600">{prospects}</div>
          <p className="text-xs text-muted-foreground">
            No active social, campaign, or post yet
          </p>
        </CardContent>
      </Card>

      {/* Engagement Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{engagementRate}%</div>
          <p className="text-xs text-muted-foreground">
            Clients with active social, campaign, or post
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
