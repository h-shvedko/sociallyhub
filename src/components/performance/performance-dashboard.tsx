'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

interface PerformanceData {
  timestamp: number
  metrics: Array<{
    name: string
    count: number
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }>
  webVitals: Array<{
    name: string
    value: number
    rating: 'good' | 'needs-improvement' | 'poor'
    id: string
  }>
  systemMetrics: any
  cacheStats: any
  queryStats: any
  totalMetrics: number
}

export default function PerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/performance?summary=true')
      const result = await response.json()
      
      if (result.status === 'ok') {
        setData(result.data)
        setError(null)
      } else {
        setError(result.error || 'Failed to fetch performance data')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Performance data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const formatValue = (value: number, unit: string = 'ms') => {
    if (unit === 'ms') {
      return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`
    }
    if (unit === 'bytes') {
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(value) / Math.log(1024))
      return `${(value / Math.pow(1024, i)).toFixed(1)}${sizes[i]}`
    }
    return `${Math.round(value)}${unit}`
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'bg-green-500'
      case 'needs-improvement': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'needs-improvement': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'poor': return <AlertTriangle className="w-4 h-4 text-red-500" />
      default: return null
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor application performance and Web Vitals
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vitals">Web Vitals</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalMetrics.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Collected performance data points
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Status</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.cacheStats?.redis?.connected ? 'Connected' : 'Disconnected'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Redis: {data.cacheStats?.redis?.keys || 0} keys
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Query Performance</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(data.queryStats?.averageDuration || 0)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg query time ({data.queryStats?.totalQueries || 0} queries)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Slow Queries</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {data.queryStats?.slowQueries || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Queries > {data.queryStats?.slowQueryThreshold || 1000}ms
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.webVitals.map((vital) => (
              <Card key={vital.name}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{vital.name}</CardTitle>
                  {getRatingIcon(vital.rating)}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatValue(vital.value, vital.name === 'CLS' ? '' : 'ms')}
                  </div>
                  <div className="mt-2">
                    <Badge 
                      variant="secondary" 
                      className={getRatingColor(vital.rating)}
                    >
                      {vital.rating}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <Progress 
                      value={getVitalProgress(vital.name, vital.value)} 
                      className="h-2" 
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4">
            {data.metrics.slice(0, 10).map((metric) => (
              <Card key={metric.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{metric.name}</CardTitle>
                  <CardDescription>
                    {metric.count} measurements in the last hour
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Average</p>
                      <p className="font-semibold">{formatValue(metric.avg)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min</p>
                      <p className="font-semibold">{formatValue(metric.min)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max</p>
                      <p className="font-semibold">{formatValue(metric.max)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">P95</p>
                      <p className="font-semibold">{formatValue(metric.p95)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">P99</p>
                      <p className="font-semibold">{formatValue(metric.p99)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {data.systemMetrics?.memory && (
              <Card>
                <CardHeader>
                  <CardTitle>Memory Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Used</span>
                    <span>{formatValue(data.systemMetrics.memory.used, 'bytes')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total</span>
                    <span>{formatValue(data.systemMetrics.memory.total, 'bytes')}</span>
                  </div>
                  <Progress 
                    value={(data.systemMetrics.memory.used / data.systemMetrics.memory.total) * 100} 
                  />
                </CardContent>
              </Card>
            )}

            {data.systemMetrics?.connection && (
              <Card>
                <CardHeader>
                  <CardTitle>Connection Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span>{data.systemMetrics.connection.effectiveType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Downlink</span>
                    <span>{data.systemMetrics.connection.downlink} Mbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RTT</span>
                    <span>{data.systemMetrics.connection.rtt}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Save Data</span>
                    <span>{data.systemMetrics.connection.saveData ? 'Yes' : 'No'}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.systemMetrics?.server && (
              <Card>
                <CardHeader>
                  <CardTitle>Server Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Memory RSS</span>
                    <span>{formatValue(data.systemMetrics.server.memory.rss, 'bytes')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heap Used</span>
                    <span>{formatValue(data.systemMetrics.server.memory.heapUsed, 'bytes')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uptime</span>
                    <span>{Math.round(data.systemMetrics.server.uptime / 60)} minutes</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Helper function to calculate progress for Web Vitals
function getVitalProgress(name: string, value: number): number {
  switch (name) {
    case 'FCP':
      return Math.min((value / 3000) * 100, 100)
    case 'LCP':
      return Math.min((value / 4000) * 100, 100)
    case 'FID':
      return Math.min((value / 300) * 100, 100)
    case 'CLS':
      return Math.min((value / 0.25) * 100, 100)
    case 'TTFB':
      return Math.min((value / 1800) * 100, 100)
    case 'INP':
      return Math.min((value / 500) * 100, 100)
    default:
      return 0
  }
}