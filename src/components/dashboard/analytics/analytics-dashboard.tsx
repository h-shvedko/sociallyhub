"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity, 
  Download,
  RefreshCw,
  Settings,
  Eye,
  Zap,
  Calendar
} from "lucide-react"
import { format } from "date-fns"

// Import the analytics components
import { DefaultAnalyticsCards } from "./analytics-overview-cards"
import { EngagementMetrics } from "./engagement-metrics"
import { PerformanceComparison } from "./performance-comparison"
import { RealTimeAnalytics } from "./real-time-analytics"
import { ExportReports } from "./export-reports"
import { CustomDashboard } from "./custom-dashboard"

interface AnalyticsDashboardProps {
  initialTab?: string
  autoRefresh?: boolean
}

export function AnalyticsDashboard({ 
  initialTab = "overview",
  autoRefresh = true 
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    fetchAnalyticsData()
    if (autoRefresh) {
      const interval = setInterval(fetchAnalyticsData, 5 * 60 * 1000) // 5 minutes
      return () => clearInterval(interval)
    }
  }, [timeRange, autoRefresh])

  const fetchAnalyticsData = async () => {
    setRefreshing(true)
    try {
      const response = await fetch(`/api/analytics/dashboard?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
        setLastUpdate(new Date())
      } else {
        console.error('Failed to fetch analytics data:', response.statusText)
        // Set empty state instead of mock data
        setAnalyticsData(null)
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
      setAnalyticsData(null)
    } finally {
      setRefreshing(false)
    }
  }

  const handleManualRefresh = async () => {
    await fetchAnalyticsData()
  }

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y') => {
    setTimeRange(range)
  }

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d': return 'Last 7 Days'
      case '30d': return 'Last 30 Days'
      case '90d': return 'Last 90 Days'
      case '1y': return 'Last Year'
      default: return 'Last 30 Days'
    }
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into your social media performance
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <div className="text-xs text-muted-foreground">
            {mounted ? `Updated ${format(lastUpdate, 'HH:mm')}` : 'Updated --:--'}
          </div>
        </div>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="flex items-center space-x-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="engagement" className="flex items-center space-x-1">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Engagement</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center space-x-1">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="realtime" className="flex items-center space-x-1">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Real-time</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-1">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center space-x-1">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Custom</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4">
            {/* Quick Stats Banner */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5" />
                  <span>Quick Overview</span>
                </CardTitle>
                <CardDescription>
                  {getTimeRangeLabel(timeRange)} performance summary
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {analyticsData?.totalUsers?.toLocaleString() || '0'}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {analyticsData?.engagementRate || 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Engagement Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {analyticsData?.pageViews?.toLocaleString() || '0'}
                    </div>
                    <div className="text-sm text-muted-foreground">Page Views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {analyticsData?.postsCreated || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Posts Created</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Analytics Overview Cards */}
            <DefaultAnalyticsCards data={analyticsData} loading={refreshing} />
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <EngagementMetrics 
            timeRange={timeRange} 
            onTimeRangeChange={handleTimeRangeChange}
          />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <PerformanceComparison 
            initialPeriod={timeRange === '7d' ? 'week' : 'month'}
            showGoals={true}
          />
        </TabsContent>

        {/* Real-time Tab */}
        <TabsContent value="realtime" className="space-y-6">
          <RealTimeAnalytics />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <ExportReports />
        </TabsContent>

        {/* Custom Dashboard Tab */}
        <TabsContent value="custom" className="space-y-6">
          <CustomDashboard />
        </TabsContent>
      </Tabs>

      {/* Footer Stats */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>Dashboard last updated: {mounted ? format(lastUpdate, 'PPP p') : 'Loading...'}</span>
              <Badge variant="outline" className="flex items-center space-x-1">
                <Activity className="h-3 w-3" />
                <span>Live Data</span>
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span>Time range: {getTimeRangeLabel(timeRange)}</span>
              <span>Data points: {analyticsData ? '1000+' : '0'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}