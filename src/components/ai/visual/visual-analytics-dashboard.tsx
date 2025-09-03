'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Area, AreaChart
} from 'recharts'
import { 
  TrendingUp, Eye, Palette, Target, Calendar, 
  Image as ImageIcon, BarChart3, PieChart as PieChartIcon 
} from 'lucide-react'

interface VisualAnalytics {
  summary: {
    totalImages: number
    avgAestheticScore: number
    avgBrandConsistency: number
    avgSafetyScore: number
    timeframe: string
  }
  colorAnalytics: {
    topColors: Array<{ color: string; count: number }>
    totalUniqueColors: number
  }
  performanceTrends: Array<{
    date: string
    engagement: number
    reach: number
    aestheticScore: number
    brandConsistency: number
  }>
  platformComparison: Array<{
    platform: string
    totalPosts: number
    avgEngagement: number
    avgReach: number
    avgAestheticScore: number
    avgBrandConsistency: number
  }>
  recentMetrics: Array<{
    id: string
    platform: string
    engagementRate: number
    reach: number
    aestheticScore: number
    brandConsistencyScore: number
    createdAt: string
  }>
}

const PLATFORM_COLORS = {
  TWITTER: '#1DA1F2',
  FACEBOOK: '#1877F2',
  INSTAGRAM: '#E4405F',
  LINKEDIN: '#0077B5',
  YOUTUBE: '#FF0000',
  TIKTOK: '#000000'
}

export function VisualAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<VisualAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30d')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')

  useEffect(() => {
    fetchAnalytics()
  }, [timeframe, selectedPlatform])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ timeframe })
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform)
      }

      const response = await fetch(`/api/ai/images/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')

      const data = await response.json()
      if (data.success) {
        setAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to fetch visual analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Visual Analytics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-8 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No visual analytics data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visual Analytics</h2>
          <p className="text-muted-foreground">
            AI-powered insights into your visual content performance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="TWITTER">Twitter/X</SelectItem>
              <SelectItem value="FACEBOOK">Facebook</SelectItem>
              <SelectItem value="INSTAGRAM">Instagram</SelectItem>
              <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
              <SelectItem value="YOUTUBE">YouTube</SelectItem>
              <SelectItem value="TIKTOK">TikTok</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Images</p>
                <p className="text-2xl font-bold">{analytics.summary.totalImages}</p>
              </div>
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Aesthetic Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(analytics.summary.avgAestheticScore)}`}>
                  {analytics.summary.avgAestheticScore}
                </p>
              </div>
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Brand Consistency</p>
                <p className={`text-2xl font-bold ${getScoreColor(analytics.summary.avgBrandConsistency)}`}>
                  {analytics.summary.avgBrandConsistency}
                </p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Safety Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(analytics.summary.avgSafetyScore)}`}>
                  {analytics.summary.avgSafetyScore}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
          <TabsTrigger value="platforms">Platform Comparison</TabsTrigger>
          <TabsTrigger value="colors">Color Analysis</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Trends
              </CardTitle>
              <CardDescription>
                Visual content performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analytics.performanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="engagement" 
                    stackId="1" 
                    stroke="#8884d8" 
                    fill="#8884d8"
                    name="Engagement Rate"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="aestheticScore" 
                    stackId="2" 
                    stroke="#82ca9d" 
                    fill="#82ca9d"
                    name="Aesthetic Score"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="brandConsistency" 
                    stackId="3" 
                    stroke="#ffc658" 
                    fill="#ffc658"
                    name="Brand Consistency"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Platform Performance Comparison
              </CardTitle>
              <CardDescription>
                Compare visual content performance across platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.platformComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgEngagement" fill="#8884d8" name="Avg Engagement" />
                  <Bar dataKey="avgAestheticScore" fill="#82ca9d" name="Avg Aesthetic Score" />
                  <Bar dataKey="avgBrandConsistency" fill="#ffc658" name="Avg Brand Consistency" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.platformComparison.map((platform) => (
              <Card key={platform.platform}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ 
                        backgroundColor: PLATFORM_COLORS[platform.platform as keyof typeof PLATFORM_COLORS] || '#666' 
                      }}
                    />
                    {platform.platform}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Posts:</span>
                    <span className="font-medium">{platform.totalPosts}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Engagement:</span>
                    <span className="font-medium">{platform.avgEngagement.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Reach:</span>
                    <span className="font-medium">{formatNumber(platform.avgReach)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Aesthetic Score:</span>
                    <span className={`font-medium ${getScoreColor(platform.avgAestheticScore)}`}>
                      {platform.avgAestheticScore.toFixed(1)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="colors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Top Colors Used
                </CardTitle>
                <CardDescription>
                  Most frequently used colors in your visual content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.colorAnalytics.topColors.slice(0, 8)}
                      dataKey="count"
                      nameKey="color"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ color, count }) => `${count}`}
                    >
                      {analytics.colorAnalytics.topColors.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [value, `Color: ${name}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Color Palette Overview</CardTitle>
                <CardDescription>
                  Detailed breakdown of your color usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <span className="text-sm font-medium">Total Unique Colors</span>
                  <Badge variant="secondary">{analytics.colorAnalytics.totalUniqueColors}</Badge>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Most Used Colors</p>
                  <div className="grid grid-cols-4 gap-2">
                    {analytics.colorAnalytics.topColors.slice(0, 8).map((colorData, index) => (
                      <div key={index} className="text-center">
                        <div 
                          className="w-full h-12 rounded-md border mb-1"
                          style={{ backgroundColor: colorData.color }}
                        />
                        <div className="text-xs text-muted-foreground">
                          {colorData.count}x
                        </div>
                        <code className="text-xs">{colorData.color}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Recent Visual Metrics
              </CardTitle>
              <CardDescription>
                Latest performance data for your visual content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recentMetrics.map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ 
                          backgroundColor: PLATFORM_COLORS[metric.platform as keyof typeof PLATFORM_COLORS] || '#666' 
                        }}
                      />
                      <div>
                        <p className="font-medium">{metric.platform}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(metric.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{metric.engagementRate.toFixed(1)}%</div>
                        <div className="text-muted-foreground">Engagement</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{formatNumber(metric.reach)}</div>
                        <div className="text-muted-foreground">Reach</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium ${getScoreColor(metric.aestheticScore)}`}>
                          {metric.aestheticScore.toFixed(1)}
                        </div>
                        <div className="text-muted-foreground">Aesthetic</div>
                      </div>
                      <div className="text-center">
                        <div className={`font-medium ${getScoreColor(metric.brandConsistencyScore)}`}>
                          {metric.brandConsistencyScore.toFixed(1)}
                        </div>
                        <div className="text-muted-foreground">Brand</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {analytics.recentMetrics.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent visual metrics available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}