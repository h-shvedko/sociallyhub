"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  Users,
  Activity,
  BarChart3,
  Zap,
  Target,
  Clock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CustomLineChart, CustomBarChart, MetricComparisonChart, CustomComposedChart } from "./chart-components"
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns"

interface ComparisonPeriod {
  current: {
    label: string
    start: Date
    end: Date
  }
  previous: {
    label: string
    start: Date
    end: Date
  }
}

interface MetricComparison {
  metric: string
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
  unit: string
  icon: React.ReactNode
}

interface PerformanceComparisonProps {
  initialPeriod?: 'week' | 'month' | 'quarter' | 'year'
  showGoals?: boolean
}

export function PerformanceComparison({ 
  initialPeriod = 'month',
  showGoals = true 
}: PerformanceComparisonProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>(initialPeriod)
  const [comparisonType, setComparisonType] = useState<'previous' | 'goal' | 'average'>('previous')
  const [metrics, setMetrics] = useState<MetricComparison[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchComparisonData()
  }, [selectedPeriod, comparisonType])

  const getComparisonPeriods = (): ComparisonPeriod => {
    const now = new Date()
    
    switch (selectedPeriod) {
      case 'week':
        return {
          current: {
            label: 'This Week',
            start: subDays(now, 7),
            end: now
          },
          previous: {
            label: 'Last Week',
            start: subDays(now, 14),
            end: subDays(now, 7)
          }
        }
      case 'quarter':
        return {
          current: {
            label: 'This Quarter',
            start: subMonths(now, 3),
            end: now
          },
          previous: {
            label: 'Last Quarter',
            start: subMonths(now, 6),
            end: subMonths(now, 3)
          }
        }
      case 'year':
        return {
          current: {
            label: 'This Year',
            start: subMonths(now, 12),
            end: now
          },
          previous: {
            label: 'Last Year',
            start: subMonths(now, 24),
            end: subMonths(now, 12)
          }
        }
      default: // month
        return {
          current: {
            label: 'This Month',
            start: startOfMonth(now),
            end: now
          },
          previous: {
            label: 'Last Month',
            start: startOfMonth(subMonths(now, 1)),
            end: endOfMonth(subMonths(now, 1))
          }
        }
    }
  }

  const fetchComparisonData = async () => {
    setLoading(true)
    try {
      const periods = getComparisonPeriods()
      
      // Mock comparison data - replace with actual API calls
      const mockMetrics: MetricComparison[] = [
        {
          metric: 'Total Users',
          current: 2847,
          previous: 2543,
          change: 304,
          changePercent: 11.9,
          trend: 'up',
          unit: '',
          icon: <Users className="h-4 w-4" />
        },
        {
          metric: 'Active Sessions',
          current: 1250,
          previous: 1180,
          change: 70,
          changePercent: 5.9,
          trend: 'up',
          unit: '',
          icon: <Activity className="h-4 w-4" />
        },
        {
          metric: 'Posts Created',
          current: 456,
          previous: 523,
          change: -67,
          changePercent: -12.8,
          trend: 'down',
          unit: '',
          icon: <BarChart3 className="h-4 w-4" />
        },
        {
          metric: 'Engagement Rate',
          current: 7.2,
          previous: 6.8,
          change: 0.4,
          changePercent: 5.9,
          trend: 'up',
          unit: '%',
          icon: <Zap className="h-4 w-4" />
        },
        {
          metric: 'Avg Response Time',
          current: 245,
          previous: 312,
          change: -67,
          changePercent: -21.5,
          trend: 'up', // Lower is better for response time
          unit: 'ms',
          icon: <Clock className="h-4 w-4" />
        },
        {
          metric: 'Conversion Rate',
          current: 3.4,
          previous: 2.9,
          change: 0.5,
          changePercent: 17.2,
          trend: 'up',
          unit: '%',
          icon: <Target className="h-4 w-4" />
        }
      ]

      // Generate trend comparison data
      const days = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : selectedPeriod === 'quarter' ? 90 : 365
      const mockTrendData = Array.from({ length: days }, (_, i) => {
        const date = format(subDays(new Date(), days - 1 - i), 'MMM dd')
        const currentBase = 1000 + Math.random() * 500
        const previousBase = currentBase * 0.85 + Math.random() * 200
        
        return {
          date,
          current: Math.floor(currentBase),
          previous: Math.floor(previousBase),
          target: 1200
        }
      })

      setMetrics(mockMetrics)
      setTrendData(mockTrendData)
    } catch (error) {
      console.error('Failed to fetch comparison data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-3 w-3" />
      case 'down': return <ArrowDown className="h-3 w-3" />
      default: return <Minus className="h-3 w-3" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'neutral', metric: string) => {
    // For response time, lower is better
    if (metric === 'Avg Response Time') {
      switch (trend) {
        case 'up': return 'text-green-600' // Up trend is good (faster response)
        case 'down': return 'text-red-600' // Down trend is bad (slower response)
        default: return 'text-muted-foreground'
      }
    }
    
    // For other metrics, higher is generally better
    switch (trend) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
  }

  const periods = getComparisonPeriods()

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-8 bg-muted rounded w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod as any}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={comparisonType} onValueChange={setComparisonType as any}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Compare to" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previous">Previous Period</SelectItem>
              <SelectItem value="goal">Goals</SelectItem>
              <SelectItem value="average">Historical Average</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {periods.current.label} vs {periods.previous.label}
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.metric}</CardTitle>
              <div className="text-muted-foreground">
                {metric.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-end space-x-2">
                  <div className="text-2xl font-bold">
                    {metric.current.toLocaleString()}
                    {metric.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{metric.unit}</span>}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "flex items-center text-xs font-medium",
                    getTrendColor(metric.trend, metric.metric)
                  )}>
                    {getTrendIcon(metric.trend)}
                    <span className="ml-1">
                      {Math.abs(metric.changePercent).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {metric.change > 0 ? '+' : ''}{metric.change.toLocaleString()}{metric.unit}
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Previous: {metric.previous.toLocaleString()}{metric.unit}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Comparison Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trend Comparison</TabsTrigger>
          <TabsTrigger value="breakdown">Metric Breakdown</TabsTrigger>
          <TabsTrigger value="analysis">Performance Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <MetricComparisonChart
            data={trendData}
            title="Performance Trend Comparison"
            description={`${periods.current.label} vs ${periods.previous.label}`}
            height={350}
            targetValue={comparisonType === 'goal' ? 1200 : undefined}
            targetLabel="Goal"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CustomComposedChart
              data={trendData.slice(-7)} // Last 7 data points
              lineKeys={['current']}
              barKeys={['previous']}
              title="Week-over-Week Comparison"
              description="Current vs previous period performance"
              height={300}
            />
            
            <Card>
              <CardHeader>
                <CardTitle>Key Changes</CardTitle>
                <CardDescription>Significant period-over-period changes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics
                  .filter(m => Math.abs(m.changePercent) > 10)
                  .map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center space-x-2">
                        {metric.icon}
                        <span className="text-sm font-medium">{metric.metric}</span>
                      </div>
                      <Badge variant={metric.changePercent > 0 ? "default" : "destructive"}>
                        {metric.changePercent > 0 ? '+' : ''}{metric.changePercent.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CustomBarChart
              data={metrics.map(m => ({
                name: m.metric.replace(' ', '\n'),
                current: m.current,
                previous: m.previous
              }))}
              dataKeys={['current', 'previous']}
              title="Current vs Previous Period"
              description="Side-by-side metric comparison"
              height={350}
            />
            
            <CustomBarChart
              data={metrics.map(m => ({
                name: m.metric.replace(' ', '\n'),
                change: Math.abs(m.change)
              }))}
              dataKeys={['change']}
              title="Absolute Change"
              description="Magnitude of change by metric"
              height={350}
            />
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Top Performers</span>
                </CardTitle>
                <CardDescription>Metrics showing strong growth</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics
                  .filter(m => m.changePercent > 0)
                  .sort((a, b) => b.changePercent - a.changePercent)
                  .slice(0, 3)
                  .map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        {metric.icon}
                        <span className="text-sm font-medium text-green-900">{metric.metric}</span>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        +{metric.changePercent.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span>Areas for Improvement</span>
                </CardTitle>
                <CardDescription>Metrics needing attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics
                  .filter(m => m.changePercent < 0)
                  .sort((a, b) => a.changePercent - b.changePercent)
                  .slice(0, 3)
                  .map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        {metric.icon}
                        <span className="text-sm font-medium text-red-900">{metric.metric}</span>
                      </div>
                      <Badge variant="destructive">
                        {metric.changePercent.toFixed(1)}%
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
              <CardDescription>Overall period performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.filter(m => m.changePercent > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Metrics Improved</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.filter(m => m.changePercent < 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Metrics Declined</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {(metrics.reduce((sum, m) => sum + m.changePercent, 0) / metrics.length).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Average Change</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}