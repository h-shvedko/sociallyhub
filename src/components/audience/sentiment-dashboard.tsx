'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  Legend
} from 'recharts'
import { 
  TrendingUp, TrendingDown, AlertTriangle, MessageSquare, 
  Heart, Frown, Smile, Meh, RefreshCw, Calendar,
  Users, Volume2, Shield, Target
} from 'lucide-react'

interface SentimentData {
  totalCount: number
  avgSentiment: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  timeframe: string
}

interface SentimentTrend {
  date: string
  avgSentiment: number
  totalMentions: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  topPositiveTopics: string[]
  topNegativeTopics: string[]
}

interface MoodRecommendations {
  currentMood: 'positive' | 'negative' | 'neutral' | 'mixed'
  trend: 'improving' | 'declining' | 'stable'
  recommendations: string[]
  insights: string[]
}

const SENTIMENT_COLORS = {
  positive: '#10B981',
  negative: '#EF4444',
  neutral: '#6B7280'
}

export function SentimentDashboard() {
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null)
  const [trends, setTrends] = useState<SentimentTrend[]>([])
  const [moodRecommendations, setMoodRecommendations] = useState<MoodRecommendations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30d')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')

  useEffect(() => {
    fetchSentimentData()
    fetchSentimentTrends()
  }, [timeframe, selectedPlatform])

  const fetchSentimentData = async () => {
    try {
      const params = new URLSearchParams({ timeframe })
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform)
      }

      const response = await fetch(`/api/audience/sentiment/analyze?${params}`)
      if (!response.ok) throw new Error('Failed to fetch sentiment data')

      const data = await response.json()
      if (data.success) {
        setSentimentData(data.summary)
      }
    } catch (error) {
      console.error('Failed to fetch sentiment data:', error)
    }
  }

  const fetchSentimentTrends = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ timeframe })
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform)
      }

      const response = await fetch(`/api/audience/sentiment/trends?${params}`)
      if (!response.ok) throw new Error('Failed to fetch sentiment trends')

      const data = await response.json()
      if (data.success) {
        setTrends(data.trends)
        setMoodRecommendations(data.moodRecommendations)
      }
    } catch (error) {
      console.error('Failed to fetch sentiment trends:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    await fetchSentimentData()
    await fetchSentimentTrends()
  }

  const getSentimentColor = (score: number) => {
    if (score > 0.1) return 'text-green-600'
    if (score < -0.1) return 'text-red-600'
    return 'text-gray-600'
  }

  const getSentimentIcon = (score: number) => {
    if (score > 0.1) return <Smile className="h-4 w-4 text-green-600" />
    if (score < -0.1) return <Frown className="h-4 w-4 text-red-600" />
    return <Meh className="h-4 w-4 text-gray-600" />
  }

  const getMoodBadgeColor = (mood: string) => {
    switch (mood) {
      case 'positive': return 'bg-green-100 text-green-800'
      case 'negative': return 'bg-red-100 text-red-800'
      case 'mixed': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />
      default: return <Target className="h-4 w-4 text-gray-600" />
    }
  }

  const pieData = sentimentData ? [
    { name: 'Positive', value: sentimentData.positiveCount, color: SENTIMENT_COLORS.positive },
    { name: 'Negative', value: sentimentData.negativeCount, color: SENTIMENT_COLORS.negative },
    { name: 'Neutral', value: sentimentData.neutralCount, color: SENTIMENT_COLORS.neutral }
  ] : []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Sentiment Analysis</h2>
          <div className="animate-spin">
            <RefreshCw className="h-5 w-5" />
          </div>
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
          <h2 className="text-2xl font-bold tracking-tight">Sentiment Analysis</h2>
          <p className="text-muted-foreground">
            Monitor audience sentiment and mood across all platforms
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
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Current Mood Alert */}
      {moodRecommendations && (
        <Alert>
          <div className="flex items-center gap-2">
            {getTrendIcon(moodRecommendations.trend)}
            <AlertTriangle className="h-4 w-4" />
          </div>
          <AlertDescription>
            <div className="flex items-center gap-2 mb-2">
              <span>Current mood:</span>
              <Badge className={getMoodBadgeColor(moodRecommendations.currentMood)}>
                {moodRecommendations.currentMood}
              </Badge>
              <span>Trend:</span>
              <Badge variant="outline">{moodRecommendations.trend}</Badge>
            </div>
            <div className="text-sm">
              {moodRecommendations.insights.slice(0, 2).join(' • ')}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      {sentimentData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Mentions</p>
                  <p className="text-2xl font-bold">{sentimentData.totalCount.toLocaleString()}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Sentiment</p>
                  <div className="flex items-center gap-2">
                    <p className={`text-2xl font-bold ${getSentimentColor(sentimentData.avgSentiment)}`}>
                      {sentimentData.avgSentiment.toFixed(2)}
                    </p>
                    {getSentimentIcon(sentimentData.avgSentiment)}
                  </div>
                </div>
                <div className="text-right">
                  <Progress 
                    value={((sentimentData.avgSentiment + 1) / 2) * 100} 
                    className="w-12 h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Positive</p>
                  <p className="text-2xl font-bold text-green-600">{sentimentData.positiveCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((sentimentData.positiveCount / sentimentData.totalCount) * 100)}%
                  </p>
                </div>
                <Heart className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Negative</p>
                  <p className="text-2xl font-bold text-red-600">{sentimentData.negativeCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((sentimentData.negativeCount / sentimentData.totalCount) * 100)}%
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Analysis */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Sentiment Trends</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="topics">Top Topics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Over Time</CardTitle>
              <CardDescription>
                Track sentiment changes across the selected timeframe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[-1, 1]} />
                  <Tooltip 
                    formatter={(value: number) => [value.toFixed(3), 'Sentiment']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgSentiment" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volume Trends</CardTitle>
              <CardDescription>
                Mention volume and sentiment breakdown over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="positiveCount" 
                    stackId="1"
                    stroke={SENTIMENT_COLORS.positive}
                    fill={SENTIMENT_COLORS.positive}
                    name="Positive"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="neutralCount" 
                    stackId="1"
                    stroke={SENTIMENT_COLORS.neutral}
                    fill={SENTIMENT_COLORS.neutral}
                    name="Neutral"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="negativeCount" 
                    stackId="1"
                    stroke={SENTIMENT_COLORS.negative}
                    fill={SENTIMENT_COLORS.negative}
                    name="Negative"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="distribution">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Distribution</CardTitle>
              <CardDescription>
                Overall breakdown of sentiment across all mentions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-4">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{item.value}</div>
                        <div className="text-sm text-muted-foreground">
                          {sentimentData ? Math.round((item.value / sentimentData.totalCount) * 100) : 0}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="topics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5 text-green-600" />
                  Positive Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trends.length > 0 && trends[trends.length - 1].topPositiveTopics.length > 0 ? (
                  <div className="space-y-2">
                    {trends[trends.length - 1].topPositiveTopics.slice(0, 10).map((topic, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span className="text-sm">{topic}</span>
                        <Badge variant="secondary" className="text-green-700">#{index + 1}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No positive topics identified</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Frown className="h-5 w-5 text-red-600" />
                  Negative Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trends.length > 0 && trends[trends.length - 1].topNegativeTopics.length > 0 ? (
                  <div className="space-y-2">
                    {trends[trends.length - 1].topNegativeTopics.slice(0, 10).map((topic, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="text-sm">{topic}</span>
                        <Badge variant="destructive">#{index + 1}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No negative topics identified</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="recommendations">
          {moodRecommendations && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Content Strategy Recommendations</CardTitle>
                  <CardDescription>
                    AI-powered recommendations based on current audience sentiment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {moodRecommendations.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                        </div>
                        <p className="text-sm">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {moodRecommendations.insights.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Key Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {moodRecommendations.insights.map((insight, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Volume2 className="h-4 w-4 mt-1 text-blue-500 flex-shrink-0" />
                          <span className="text-sm">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}