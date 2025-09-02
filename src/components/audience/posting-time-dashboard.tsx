'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts'
import { 
  Clock, Calendar, TrendingUp, Target, Sparkles, 
  RefreshCw, Users, Zap, Globe, ChevronRight
} from 'lucide-react'

interface PostingTimeRecommendation {
  id: string
  platform: string
  dayOfWeek: number
  hour: number
  dayName: string
  timeString: string
  expectedEngagement: number
  confidenceScore: number
  audienceSize: number
  segment: {
    id: string
    name: string
    estimatedSize: number
  }
}

interface PlatformInsight {
  platform: string
  avgExpectedEngagement: number
  bestTime: {
    dayName: string
    hour: number
    expectedEngagement: number
  }
  totalRecommendations: number
}

const PLATFORM_COLORS = {
  TWITTER: '#1DA1F2',
  FACEBOOK: '#1877F2',
  INSTAGRAM: '#E4405F',
  LINKEDIN: '#0077B5',
  YOUTUBE: '#FF0000',
  TIKTOK: '#000000'
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i
  const ampm = i < 12 ? 'AM' : 'PM'
  return `${hour12}${ampm}`
})

export function PostingTimeDashboard() {
  const [recommendations, setRecommendations] = useState<PostingTimeRecommendation[]>([])
  const [platformInsights, setPlatformInsights] = useState<PlatformInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedSegment, setSelectedSegment] = useState<string>('all')
  const [timezone, setTimezone] = useState('UTC')

  useEffect(() => {
    fetchPostingTimes()
  }, [selectedPlatform, selectedSegment, timezone])

  const fetchPostingTimes = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ timezone })
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform)
      }
      if (selectedSegment !== 'all') {
        params.append('segmentId', selectedSegment)
      }

      const response = await fetch(`/api/audience/posting-times?${params}`)
      if (!response.ok) throw new Error('Failed to fetch posting times')

      const data = await response.json()
      if (data.success) {
        setRecommendations(data.topRecommendations)
        setPlatformInsights(data.platformInsights)
      }
    } catch (error) {
      console.error('Failed to fetch posting times:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateNewRecommendations = async () => {
    try {
      const response = await fetch('/api/audience/posting-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: selectedSegment !== 'all' ? selectedSegment : undefined,
          platform: selectedPlatform !== 'all' ? selectedPlatform : undefined
        })
      })

      if (response.ok) {
        await fetchPostingTimes()
      }
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
    }
  }

  // Prepare heatmap data
  const heatmapData = Array.from({ length: 7 }, (_, dayIndex) => {
    const dayRecommendations = recommendations.filter(r => r.dayOfWeek === dayIndex)
    const hourData = Array.from({ length: 24 }, (_, hourIndex) => {
      const hourRec = dayRecommendations.find(r => r.hour === hourIndex)
      return {
        hour: hourIndex,
        engagement: hourRec ? hourRec.expectedEngagement * 100 : 0,
        confidence: hourRec ? hourRec.confidenceScore : 0,
        audienceSize: hourRec ? hourRec.audienceSize : 0
      }
    })
    
    return {
      day: DAY_NAMES[dayIndex],
      dayIndex,
      hours: hourData,
      avgEngagement: hourData.reduce((sum, h) => sum + h.engagement, 0) / 24
    }
  })

  // Prepare radar chart data for platform comparison
  const radarData = platformInsights.map(insight => ({
    platform: insight.platform,
    engagement: insight.avgExpectedEngagement,
    bestTimeScore: insight.bestTime.expectedEngagement * 100,
    recommendations: (insight.totalRecommendations / 10) * 100 // Normalize to 0-100
  }))

  const getEngagementColor = (engagement: number) => {
    if (engagement > 5) return 'bg-green-500'
    if (engagement > 3) return 'bg-yellow-500'
    if (engagement > 1) return 'bg-orange-500'
    return 'bg-gray-200'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-green-600'
    if (confidence > 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Optimal Posting Times</h2>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Optimal Posting Times</h2>
          <p className="text-muted-foreground">
            AI-powered recommendations for maximum engagement
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
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">EST</SelectItem>
              <SelectItem value="America/Los_Angeles">PST</SelectItem>
              <SelectItem value="Europe/London">GMT</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={generateNewRecommendations}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate
          </Button>
          <Button variant="outline" onClick={fetchPostingTimes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Top Recommendation</p>
                {recommendations.length > 0 && (
                  <>
                    <p className="text-lg font-bold">{recommendations[0].dayName}</p>
                    <p className="text-sm text-muted-foreground">{recommendations[0].timeString}</p>
                  </>
                )}
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Engagement</p>
                <p className="text-2xl font-bold text-green-600">
                  {recommendations.length > 0 
                    ? (recommendations.reduce((sum, r) => sum + r.expectedEngagement, 0) / recommendations.length * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Slots</p>
                <p className="text-2xl font-bold">{recommendations.length}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Audience Size</p>
                <p className="text-2xl font-bold">
                  {recommendations.length > 0 
                    ? Math.round(recommendations.reduce((sum, r) => sum + r.audienceSize, 0) / recommendations.length).toLocaleString()
                    : 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="heatmap" className="space-y-4">
        <TabsList>
          <TabsTrigger value="heatmap">Weekly Heatmap</TabsTrigger>
          <TabsTrigger value="recommendations">Top Times</TabsTrigger>
          <TabsTrigger value="platforms">Platform Analysis</TabsTrigger>
          <TabsTrigger value="schedule">Schedule Planner</TabsTrigger>
        </TabsList>
        
        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Engagement Heatmap</CardTitle>
              <CardDescription>
                Visual representation of optimal posting times throughout the week ({timezone})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {heatmapData.map((dayData) => (
                  <div key={dayData.day} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm w-20">{dayData.day}</h4>
                      <div className="text-xs text-muted-foreground">
                        Avg: {dayData.avgEngagement.toFixed(1)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-24 gap-1">
                      {dayData.hours.map((hourData, hourIndex) => (
                        <div
                          key={hourIndex}
                          className={`h-8 rounded-sm cursor-pointer transition-all hover:scale-110 ${getEngagementColor(hourData.engagement)}`}
                          title={`${HOUR_LABELS[hourIndex]} - ${hourData.engagement.toFixed(1)}% expected engagement`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-24 gap-1 text-xs text-muted-foreground">
                      {HOUR_LABELS.map((label, index) => (
                        <div key={index} className="text-center">
                          {index % 4 === 0 ? label : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Legend */}
                <div className="flex items-center gap-4 pt-4 border-t">
                  <span className="text-sm font-medium">Engagement Rate:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded-sm" />
                    <span className="text-xs">0-1%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 rounded-sm" />
                    <span className="text-xs">1-3%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-500 rounded-sm" />
                    <span className="text-xs">3-5%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-sm" />
                    <span className="text-xs">5%+</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Posting Time Recommendations</CardTitle>
              <CardDescription>
                Best times to post based on audience behavior analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.slice(0, 10).map((rec, index) => (
                  <div key={rec.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium">{rec.dayName} at {rec.timeString}</div>
                        <div className="text-sm text-muted-foreground">
                          Platform: {rec.platform} • Audience: {rec.audienceSize.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-green-600">
                          {(rec.expectedEngagement * 100).toFixed(1)}%
                        </div>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                      <div className={`text-xs ${getConfidenceColor(rec.confidenceScore)}`}>
                        {Math.round(rec.confidenceScore * 100)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="platform" />
                    <PolarRadiusAxis />
                    <Radar 
                      name="Avg Engagement" 
                      dataKey="engagement" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.2}
                    />
                    <Radar 
                      name="Best Time Score" 
                      dataKey="bestTimeScore" 
                      stroke="#10B981" 
                      fill="#10B981" 
                      fillOpacity={0.2}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Platform Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {platformInsights.map((insight) => (
                    <div key={insight.platform} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{insight.platform}</h4>
                        <Badge style={{ backgroundColor: PLATFORM_COLORS[insight.platform as keyof typeof PLATFORM_COLORS] }}>
                          {insight.avgExpectedEngagement.toFixed(1)}% avg
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Best Time:</span>
                          <span className="font-medium">
                            {insight.bestTime.dayName} at {insight.bestTime.hour}:00
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Peak Engagement:</span>
                          <span className="font-medium text-green-600">
                            {insight.bestTime.expectedEngagement.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={insight.avgExpectedEngagement} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Smart Schedule Planner</CardTitle>
              <CardDescription>
                Plan your content schedule using AI recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {DAY_NAMES.map((dayName, dayIndex) => {
                  const dayRecommendations = recommendations
                    .filter(r => r.dayOfWeek === dayIndex)
                    .sort((a, b) => b.expectedEngagement - a.expectedEngagement)
                    .slice(0, 3)
                  
                  return (
                    <div key={dayName} className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {dayName}
                      </h4>
                      {dayRecommendations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {dayRecommendations.map((rec, index) => (
                            <div key={rec.id} className="p-3 border rounded-lg bg-card">
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium">{rec.timeString}</div>
                                <Badge variant="outline">{rec.platform}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {(rec.expectedEngagement * 100).toFixed(1)}% expected engagement
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Audience: {rec.audienceSize.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic p-4 border-2 border-dashed rounded-lg">
                          No specific recommendations for {dayName}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}