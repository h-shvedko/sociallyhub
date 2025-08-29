"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { 
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Award,
  Zap,
  Activity,
  Calendar,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CustomLineChart, CustomBarChart, CustomPieChart } from "./chart-components"
import { format, subDays, startOfDay, endOfDay } from "date-fns"

interface EngagementData {
  platform: string
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  impressions: number
  engagementRate: number
  color: string
}

interface EngagementTrend {
  date: string
  likes: number
  comments: number
  shares: number
  reach: number
  engagementRate: number
}

interface EngagementMetricsProps {
  timeRange: '7d' | '30d' | '90d' | '1y'
  onTimeRangeChange: (range: '7d' | '30d' | '90d' | '1y') => void
}

export function EngagementMetrics({ timeRange, onTimeRangeChange }: EngagementMetricsProps) {
  const [engagementData, setEngagementData] = useState<EngagementData[]>([])
  const [trendData, setTrendData] = useState<EngagementTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchEngagementData()
  }, [timeRange])

  const fetchEngagementData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/engagement?timeRange=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setEngagementData(data.platformData || [])
        setTrendData(data.trendData || [])
      } else {
        console.error('Failed to fetch engagement data:', response.statusText)
        setEngagementData([])
        setTrendData([])
      }
    } catch (error) {
      console.error('Failed to fetch engagement data:', error)
      setEngagementData([])
      setTrendData([])
    } finally {
      setLoading(false)
    }
  }

  const totalEngagement = engagementData.reduce((sum, data) => 
    sum + data.likes + data.comments + data.shares, 0
  )

  const avgEngagementRate = engagementData.length > 0 
    ? engagementData.reduce((sum, data) => sum + data.engagementRate, 0) / engagementData.length
    : 0

  const topPerformer = engagementData.reduce((top, current) => 
    current.engagementRate > top.engagementRate ? current : top, 
    engagementData[0] || { platform: 'N/A', engagementRate: 0 }
  )

  const getEngagementLevel = (rate: number) => {
    if (rate >= 8) return { level: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' }
    if (rate >= 6) return { level: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' }
    if (rate >= 4) return { level: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { level: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-100' }
  }

  const platformChartData = engagementData.map(data => ({
    name: data.platform,
    likes: data.likes,
    comments: data.comments,
    shares: data.shares,
    saves: data.saves
  }))

  const reachData = engagementData.map(data => ({
    name: data.platform,
    reach: data.reach,
    impressions: data.impressions
  }))

  const engagementRateData = engagementData.map(data => ({
    name: data.platform,
    rate: data.engagementRate
  }))

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-24" />
                <div className="h-6 bg-muted rounded w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="h-64 bg-muted rounded" />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Engagement Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
            <Heart className="h-4 w-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement.toLocaleString()}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5% from last {timeRange}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement Rate</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagementRate.toFixed(1)}%</div>
            <Badge className={cn("text-xs", getEngagementLevel(avgEngagementRate).bg, getEngagementLevel(avgEngagementRate).color)}>
              {getEngagementLevel(avgEngagementRate).level}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Platform</CardTitle>
            <Award className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topPerformer.platform}</div>
            <p className="text-xs text-muted-foreground">
              {topPerformer.engagementRate.toFixed(1)}% engagement rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Platforms</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementData.length}</div>
            <p className="text-xs text-muted-foreground">
              Connected accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Engagement Analytics */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="grid grid-cols-4 w-fit">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={timeRange === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange('7d')}
            >
              7D
            </Button>
            <Button
              variant={timeRange === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange('30d')}
            >
              30D
            </Button>
            <Button
              variant={timeRange === '90d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange('90d')}
            >
              90D
            </Button>
            <Button
              variant={timeRange === '1y' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeRangeChange('1y')}
            >
              1Y
            </Button>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CustomBarChart
              data={platformChartData}
              dataKeys={['likes', 'comments', 'shares', 'saves']}
              title="Engagement by Platform"
              description="Breakdown of engagement metrics across platforms"
              height={350}
              stacked
            />
            <CustomBarChart
              data={reachData}
              dataKeys={['reach', 'impressions']}
              title="Reach vs Impressions"
              description="Platform reach and impression comparison"
              height={350}
            />
          </div>
          <CustomLineChart
            data={trendData}
            dataKeys={['likes', 'comments', 'shares']}
            title="Engagement Trend"
            description={`Engagement metrics over the last ${timeRange}`}
            height={300}
            yAxisLabel="Engagement Count"
          />
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {engagementData.map((platform) => (
              <Card key={platform.platform}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: platform.color }}
                      />
                      <span>{platform.platform}</span>
                    </CardTitle>
                    <Badge className={cn(
                      "text-xs",
                      getEngagementLevel(platform.engagementRate).bg,
                      getEngagementLevel(platform.engagementRate).color
                    )}>
                      {platform.engagementRate.toFixed(1)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Heart className="h-4 w-4 text-pink-500" />
                      <span>{platform.likes.toLocaleString()} likes</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="h-4 w-4 text-blue-500" />
                      <span>{platform.comments.toLocaleString()} comments</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Share2 className="h-4 w-4 text-green-500" />
                      <span>{platform.shares.toLocaleString()} shares</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4 text-purple-500" />
                      <span>{platform.reach.toLocaleString()} reach</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Engagement Goal</span>
                      <span>{platform.engagementRate.toFixed(1)}% / 8.0%</span>
                    </div>
                    <Progress value={(platform.engagementRate / 8) * 100} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <CustomLineChart
            data={trendData}
            dataKeys={['engagementRate']}
            title="Engagement Rate Trend"
            description="Daily engagement rate percentage"
            height={300}
            yAxisLabel="Engagement Rate (%)"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CustomLineChart
              data={trendData}
              dataKeys={['reach']}
              title="Reach Trend"
              description="Daily reach metrics"
              height={250}
              yAxisLabel="Reach"
            />
            <CustomPieChart
              data={engagementRateData}
              dataKey="rate"
              nameKey="name"
              title="Engagement Rate Distribution"
              description="Platform engagement rate comparison"
              height={250}
            />
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <span>Key Insights</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Peak Engagement Time</p>
                    <p className="text-xs text-muted-foreground">
                      Tuesdays and Thursdays show 23% higher engagement
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Content Performance</p>
                    <p className="text-xs text-muted-foreground">
                      Video content generates 45% more engagement than images
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
                  <div>
                    <p className="text-sm font-medium">Audience Growth</p>
                    <p className="text-xs text-muted-foreground">
                      LinkedIn shows strongest professional audience growth
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <span>Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">Optimize Posting Schedule</p>
                  <p className="text-xs text-blue-700">
                    Post on Tuesday-Thursday, 2-4 PM for maximum engagement
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-900">Content Mix</p>
                  <p className="text-xs text-green-700">
                    Increase video content ratio to 60% for better performance
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-purple-900">Platform Focus</p>
                  <p className="text-xs text-purple-700">
                    Invest more in LinkedIn for B2B audience development
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}