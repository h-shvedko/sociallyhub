"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users, 
  Activity, 
  Eye, 
  Heart,
  MessageCircle,
  Share,
  Calendar,
  Clock,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface AnalyticsCardData {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
    period: string
  }
  target?: {
    current: number
    goal: number
    unit: string
  }
  icon: React.ReactNode
  description?: string
  color?: string
}

interface AnalyticsOverviewCardsProps {
  data: AnalyticsCardData[]
  loading?: boolean
}

export function AnalyticsOverviewCards({ data, loading = false }: AnalyticsOverviewCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16 mb-2" />
              <div className="h-3 bg-muted rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const formatValue = (value: string | number) => {
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`
      }
      return value.toLocaleString()
    }
    return value
  }

  const getChangeIcon = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase': return <TrendingUp className="h-3 w-3" />
      case 'decrease': return <TrendingDown className="h-3 w-3" />
      default: return <Minus className="h-3 w-3" />
    }
  }

  const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase': return 'text-green-600'
      case 'decrease': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {data.map((card, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={cn("text-muted-foreground", card.color)}>
              {card.icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatValue(card.value)}
              </div>
              
              {card.change && (
                <div className={cn(
                  "flex items-center text-xs",
                  getChangeColor(card.change.type)
                )}>
                  {getChangeIcon(card.change.type)}
                  <span className="ml-1">
                    {Math.abs(card.change.value)}% from {card.change.period}
                  </span>
                </div>
              )}

              {card.target && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress to goal</span>
                    <span className="font-medium">
                      {card.target.current}/{card.target.goal} {card.target.unit}
                    </span>
                  </div>
                  <Progress 
                    value={(card.target.current / card.target.goal) * 100} 
                    className="h-1"
                  />
                </div>
              )}

              {card.description && (
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Pre-configured analytics cards for different dashboard views
export function DefaultAnalyticsCards({ data, loading }: { data: any, loading?: boolean }) {
  const analyticsData: AnalyticsCardData[] = [
    {
      title: "Total Users",
      value: data?.totalUsers || 0,
      change: {
        value: 12.5,
        type: 'increase',
        period: 'last month'
      },
      icon: <Users className="h-4 w-4" />,
      color: "text-blue-600"
    },
    {
      title: "Active Sessions",
      value: data?.activeSessions || 0,
      change: {
        value: 8.2,
        type: 'increase',
        period: 'yesterday'
      },
      icon: <Activity className="h-4 w-4" />,
      color: "text-green-600"
    },
    {
      title: "Page Views",
      value: data?.pageViews || 0,
      change: {
        value: 15.3,
        type: 'increase',
        period: 'last week'
      },
      icon: <Eye className="h-4 w-4" />,
      color: "text-purple-600"
    },
    {
      title: "Engagement Rate",
      value: `${data?.engagementRate || 0}%`,
      change: {
        value: 3.1,
        type: 'decrease',
        period: 'last week'
      },
      icon: <Heart className="h-4 w-4" />,
      color: "text-pink-600"
    },
    {
      title: "Posts Created",
      value: data?.postsCreated || 0,
      target: {
        current: data?.postsCreated || 0,
        goal: data?.postsGoal || 100,
        unit: 'posts'
      },
      icon: <Calendar className="h-4 w-4" />,
      color: "text-orange-600"
    },
    {
      title: "Avg. Session Duration",
      value: data?.avgSessionDuration ? `${Math.floor(data.avgSessionDuration / 60)}m ${data.avgSessionDuration % 60}s` : '0m 0s',
      change: {
        value: 7.8,
        type: 'increase',
        period: 'last week'
      },
      icon: <Clock className="h-4 w-4" />,
      color: "text-indigo-600"
    },
    {
      title: "Conversion Rate",
      value: `${data?.conversionRate || 0}%`,
      target: {
        current: data?.conversionRate || 0,
        goal: 5,
        unit: '%'
      },
      icon: <Target className="h-4 w-4" />,
      color: "text-emerald-600"
    },
    {
      title: "API Requests",
      value: data?.apiRequests || 0,
      change: {
        value: 23.4,
        type: 'increase',
        period: 'yesterday'
      },
      icon: <BarChart3 className="h-4 w-4" />,
      color: "text-cyan-600"
    }
  ]

  return <AnalyticsOverviewCards data={analyticsData} loading={loading} />
}

// Social Media specific analytics cards
export function SocialMediaAnalyticsCards({ data, loading }: { data: any, loading?: boolean }) {
  const socialData: AnalyticsCardData[] = [
    {
      title: "Total Followers",
      value: data?.totalFollowers || 0,
      change: {
        value: 5.2,
        type: 'increase',
        period: 'last week'
      },
      icon: <Users className="h-4 w-4" />,
      color: "text-blue-600"
    },
    {
      title: "Post Engagement",
      value: data?.postEngagement || 0,
      change: {
        value: 12.8,
        type: 'increase',
        period: 'yesterday'
      },
      icon: <Heart className="h-4 w-4" />,
      color: "text-pink-600"
    },
    {
      title: "Shares",
      value: data?.totalShares || 0,
      change: {
        value: 18.3,
        type: 'increase',
        period: 'last week'
      },
      icon: <Share className="h-4 w-4" />,
      color: "text-green-600"
    },
    {
      title: "Comments",
      value: data?.totalComments || 0,
      change: {
        value: 4.7,
        type: 'decrease',
        period: 'yesterday'
      },
      icon: <MessageCircle className="h-4 w-4" />,
      color: "text-purple-600"
    },
    {
      title: "Reach",
      value: data?.totalReach || 0,
      change: {
        value: 25.1,
        type: 'increase',
        period: 'last month'
      },
      icon: <ArrowUpRight className="h-4 w-4" />,
      color: "text-orange-600"
    },
    {
      title: "Impressions",
      value: data?.totalImpressions || 0,
      change: {
        value: 8.9,
        type: 'increase',
        period: 'last week'
      },
      icon: <Eye className="h-4 w-4" />,
      color: "text-indigo-600"
    },
    {
      title: "Click-through Rate",
      value: `${data?.clickThroughRate || 0}%`,
      target: {
        current: data?.clickThroughRate || 0,
        goal: 3,
        unit: '%'
      },
      icon: <Target className="h-4 w-4" />,
      color: "text-emerald-600"
    },
    {
      title: "Growth Rate",
      value: `${data?.growthRate || 0}%`,
      change: {
        value: 2.3,
        type: 'increase',
        period: 'last month'
      },
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-cyan-600"
    }
  ]

  return <AnalyticsOverviewCards data={socialData} loading={loading} />
}

// Performance analytics cards
export function PerformanceAnalyticsCards({ data, loading }: { data: any, loading?: boolean }) {
  const performanceData: AnalyticsCardData[] = [
    {
      title: "Avg Response Time",
      value: `${data?.avgResponseTime || 0}ms`,
      change: {
        value: 15.2,
        type: data?.responseTimeTrend === 'up' ? 'decrease' : 'increase',
        period: 'yesterday'
      },
      icon: <Activity className="h-4 w-4" />,
      color: "text-blue-600"
    },
    {
      title: "Error Rate",
      value: `${data?.errorRate || 0}%`,
      change: {
        value: 23.4,
        type: 'decrease',
        period: 'last week'
      },
      icon: <ArrowDownRight className="h-4 w-4" />,
      color: "text-red-600"
    },
    {
      title: "Uptime",
      value: `${data?.uptime || 99.9}%`,
      target: {
        current: data?.uptime || 99.9,
        goal: 99.9,
        unit: '%'
      },
      icon: <Activity className="h-4 w-4" />,
      color: "text-green-600"
    },
    {
      title: "Throughput",
      value: `${data?.throughput || 0}/min`,
      change: {
        value: 12.7,
        type: 'increase',
        period: 'yesterday'
      },
      icon: <BarChart3 className="h-4 w-4" />,
      color: "text-purple-600"
    }
  ]

  return <AnalyticsOverviewCards data={performanceData} loading={loading} />
}