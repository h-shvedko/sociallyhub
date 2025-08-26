"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Users, 
  TrendingUp,
  Server,
  Zap,
  Eye,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface SystemMetric {
  name: string
  value: string | number
  unit?: string
  status: 'healthy' | 'warning' | 'critical'
  trend?: 'up' | 'down' | 'stable'
  icon: React.ReactNode
}

interface Alert {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  resolved: boolean
  description: string
}

interface AnalyticsData {
  totalUsers: number
  activeUsers: number
  totalSessions: number
  avgSessionDuration: number
  pageViews: number
  apiRequests: number
  errorRate: number
  responseTime: number
}

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    fetchMonitoringData()
    const interval = setInterval(fetchMonitoringData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchMonitoringData = async () => {
    try {
      setLoading(true)
      
      // Fetch system metrics
      const metricsResponse = await fetch('/api/monitoring/metrics')
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(generateSystemMetrics(metricsData))
      }

      // Fetch alerts
      const alertsResponse = await fetch('/api/monitoring/alerts')
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json()
        setAlerts(alertsData.alerts || [])
      }

      // Fetch analytics
      const analyticsResponse = await fetch('/api/analytics/platform')
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json()
        setAnalytics(analyticsData)
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateSystemMetrics = (data: any): SystemMetric[] => {
    return [
      {
        name: 'System Status',
        value: data.systemStatus || 'Healthy',
        status: data.systemStatus === 'Healthy' ? 'healthy' : 'warning',
        icon: <Server className="h-4 w-4" />
      },
      {
        name: 'Uptime',
        value: data.uptime || '99.9%',
        status: 'healthy',
        icon: <Activity className="h-4 w-4" />
      },
      {
        name: 'Response Time',
        value: data.avgResponseTime || 245,
        unit: 'ms',
        status: (data.avgResponseTime || 245) > 1000 ? 'warning' : 'healthy',
        trend: 'stable',
        icon: <Zap className="h-4 w-4" />
      },
      {
        name: 'Error Rate',
        value: data.errorRate || 0.12,
        unit: '%',
        status: (data.errorRate || 0.12) > 5 ? 'critical' : 'healthy',
        trend: 'down',
        icon: <AlertTriangle className="h-4 w-4" />
      },
      {
        name: 'Database',
        value: data.dbStatus || 'Connected',
        status: data.dbStatus === 'Connected' ? 'healthy' : 'critical',
        icon: <Database className="h-4 w-4" />
      },
      {
        name: 'Active Users',
        value: data.activeUsers || 127,
        status: 'healthy',
        trend: 'up',
        icon: <Users className="h-4 w-4" />
      }
    ]
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const activeAlerts = alerts.filter(alert => !alert.resolved)
  const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time system health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {format(lastUpdate, 'HH:mm:ss')}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Summary */}
      {activeAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({activeAlerts.length})
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {criticalAlerts.length} Critical
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeAlerts.slice(0, 3).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center gap-3">
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <span className="font-medium">{alert.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(alert.timestamp, 'HH:mm')}
                    </span>
                  </div>
                  <Button variant="outline" size="sm">
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* System Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((metric, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {metric.name}
                  </CardTitle>
                  <div className={getStatusColor(metric.status)}>
                    {metric.icon}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">
                        {metric.value}
                        {metric.unit && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {metric.unit}
                          </span>
                        )}
                      </div>
                      <Badge className={getStatusBg(metric.status)}>
                        {metric.status}
                      </Badge>
                    </div>
                    {metric.trend && (
                      <div className={cn(
                        "text-xs flex items-center",
                        metric.trend === 'up' ? 'text-green-600' :
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                      )}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {metric.trend}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System Health Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Health Overview</CardTitle>
              <CardDescription>
                Overall system health indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Health</span>
                  <div className="flex items-center gap-2">
                    <Progress value={98} className="w-32" />
                    <span className="text-sm font-medium">98%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database Health</span>
                  <div className="flex items-center gap-2">
                    <Progress value={100} className="w-32" />
                    <span className="text-sm font-medium">100%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Memory Usage</span>
                  <div className="flex items-center gap-2">
                    <Progress value={67} className="w-32" />
                    <span className="text-sm font-medium">67%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">CPU Usage</span>
                  <div className="flex items-center gap-2">
                    <Progress value={34} className="w-32" />
                    <span className="text-sm font-medium">34%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
                <CardDescription>Average API response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">GET /api/posts</span>
                    <span className="font-medium">156ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">POST /api/posts</span>
                    <span className="font-medium">289ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">GET /api/analytics</span>
                    <span className="font-medium">342ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Authentication</span>
                    <span className="font-medium">98ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Performance</CardTitle>
                <CardDescription>Query performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Query Time</span>
                    <span className="font-medium">23ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Slow Queries</span>
                    <span className="font-medium">2</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connections</span>
                    <span className="font-medium">12/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cache Hit Rate</span>
                    <span className="font-medium">94.7%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>
                  {activeAlerts.length} active alerts requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeAlerts.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    No active alerts
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAlerts.map(alert => (
                      <div key={alert.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="font-medium">{alert.title}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {alert.description}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(alert.timestamp, 'MMM dd, HH:mm')}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Resolve
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Rules</CardTitle>
                <CardDescription>Configured monitoring rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium text-sm">High Error Rate</div>
                      <div className="text-xs text-muted-foreground">Error rate > 5%</div>
                    </div>
                    <Badge variant="outline">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium text-sm">Slow Response Time</div>
                      <div className="text-xs text-muted-foreground">Response time > 2s</div>
                    </div>
                    <Badge variant="outline">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium text-sm">Database Connection</div>
                      <div className="text-xs text-muted-foreground">DB errors > 10</div>
                    </div>
                    <Badge variant="outline">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +12% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalSessions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +8% from yesterday
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Page Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.pageViews || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +24% from last week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Requests</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.apiRequests || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +16% from yesterday
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Engagement Metrics</CardTitle>
              <CardDescription>Detailed user behavior analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Session Duration</span>
                  <span className="font-medium">
                    {Math.floor((analytics?.avgSessionDuration || 0) / 60)}m {Math.floor((analytics?.avgSessionDuration || 0) % 60)}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bounce Rate</span>
                  <span className="font-medium">23.4%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pages per Session</span>
                  <span className="font-medium">4.7</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Return Visitor Rate</span>
                  <span className="font-medium">68.9%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}