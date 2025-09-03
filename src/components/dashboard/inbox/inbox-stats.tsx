'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Inbox, 
  MessageCircle, 
  UserCheck, 
  Clock, 
  CheckCircle,
  TrendingUp,
  MessageSquare,
  AtSign,
  Mail,
  Star,
  Heart,
  Frown,
  Meh,
  Smile,
  Activity
} from 'lucide-react'

interface InboxStatsProps {
  stats: {
    overview: {
      totalItems: number
      openItems: number
      assignedItems: number
      snoozedItems: number
      closedItems: number
      recentActivity: number
    }
    breakdowns: {
      status: Record<string, number>
      type: Record<string, number>
      sentiment: Record<string, number>
    }
    metrics: {
      responseRate: number
      avgResponseTime: number | null
    }
  }
}

export function InboxStats({ stats }: InboxStatsProps) {
  const { overview, breakdowns, metrics } = stats

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-500'
      case 'ASSIGNED': return 'bg-yellow-500'
      case 'SNOOZED': return 'bg-blue-500'
      case 'CLOSED': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'COMMENT': return MessageSquare
      case 'MENTION': return AtSign
      case 'DIRECT_MESSAGE': return Mail
      case 'REVIEW': return Star
      case 'REPLY': return MessageCircle
      default: return MessageSquare
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return Smile
      case 'negative': return Frown
      case 'neutral': return Meh
      default: return Meh
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100'
      case 'negative': return 'text-red-600 bg-red-100'
      case 'neutral': return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Overview Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
          <Inbox className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.totalItems}</div>
          <p className="text-xs text-muted-foreground">
            {overview.recentActivity} new in 24h
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Open Items</CardTitle>
          <MessageCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{overview.openItems}</div>
          <p className="text-xs text-muted-foreground">
            Require attention
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Assigned</CardTitle>
          <UserCheck className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{overview.assignedItems}</div>
          <p className="text-xs text-muted-foreground">
            Being handled
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{metrics.responseRate}%</div>
          <Progress value={metrics.responseRate} className="mt-2" />
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(breakdowns.status).map(([status, count]) => {
              const percentage = overview.totalItems > 0 
                ? Math.round((count / overview.totalItems) * 100) 
                : 0
              
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                    <span className="text-sm capitalize">
                      {status.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
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

      {/* Message Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Message Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(breakdowns.type).map(([type, count]) => {
              const Icon = getTypeIcon(type)
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm capitalize">
                      {type.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {count}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sentiment Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(breakdowns.sentiment).map(([sentiment, count]) => {
              const Icon = getSentimentIcon(sentiment)
              const colorClass = getSentimentColor(sentiment)
              
              return (
                <div key={sentiment} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-full ${colorClass}`}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <span className="text-sm capitalize">{sentiment}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {count}
                  </Badge>
                </div>
              )
            })}
            
            {Object.keys(breakdowns.sentiment).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No sentiment data available
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}