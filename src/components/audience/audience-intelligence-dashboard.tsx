'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SentimentDashboard } from './sentiment-dashboard'
import { AudienceSegmentationDashboard } from './audience-segmentation-dashboard'
import { PostingTimeDashboard } from './posting-time-dashboard'
import { 
  Brain, Users, Clock, TrendingUp, Heart, 
  MessageSquare, Target, Sparkles, AlertTriangle,
  BarChart3, Calendar, Zap, RefreshCw
} from 'lucide-react'

interface QuickStats {
  totalAudienceSize: number
  avgSentiment: number
  activeSegments: number
  topPostingTime: string
  engagementTrend: number
  criticalAlerts: number
}

export function AudienceIntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalAudienceSize: 0,
    avgSentiment: 0,
    activeSegments: 0,
    topPostingTime: '',
    engagementTrend: 0,
    criticalAlerts: 0
  })

  const getSentimentColor = (score: number) => {
    if (score > 0.1) return 'text-green-600'
    if (score < -0.1) return 'text-red-600'
    return 'text-gray-600'
  }

  const getSentimentIcon = (score: number) => {
    if (score > 0.1) return '😊'
    if (score < -0.1) return '😟'
    return '😐'
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audience Intelligence</h1>
          <p className="text-muted-foreground">
            AI-powered insights into your audience behavior, sentiment, and engagement patterns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh All
          </Button>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment Analysis</TabsTrigger>
          <TabsTrigger value="segments">Audience Segments</TabsTrigger>
          <TabsTrigger value="timing">Optimal Timing</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Audience</p>
                    <p className="text-2xl font-bold">125.4K</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Sentiment</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-green-600">+0.34</p>
                      <span className="text-lg">😊</span>
                    </div>
                  </div>
                  <Heart className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Segments</p>
                    <p className="text-2xl font-bold">6</p>
                  </div>
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Best Time</p>
                    <p className="text-lg font-bold">Tue 2PM</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Engagement</p>
                    <div className="flex items-center gap-1">
                      <p className="text-2xl font-bold">4.7%</p>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                  <Zap className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alerts</p>
                    <p className="text-2xl font-bold text-orange-600">2</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI-Powered Insights
                </CardTitle>
                <CardDescription>
                  Latest intelligence about your audience behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Sentiment Improving</p>
                      <p className="text-sm text-green-600">
                        Overall audience sentiment has improved by 15% this week, driven by positive response to educational content.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">New Segment Identified</p>
                      <p className="text-sm text-blue-600">
                        "Tech Enthusiasts" segment shows 23% higher engagement rates with video content during 9-11 AM.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Timing Opportunity</p>
                      <p className="text-sm text-yellow-600">
                        LinkedIn posts at 8 AM on Tuesdays show 34% higher engagement than current schedule.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Recommended Actions
                </CardTitle>
                <CardDescription>
                  AI-generated recommendations to improve performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Optimize Posting Schedule</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Shift 3 weekly posts to Tuesday-Thursday 8-10 AM for 28% engagement boost.
                      </p>
                      <Button size="sm" variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        Apply Schedule
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-green-600">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Create Segment-Specific Content</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Develop video tutorials for "Tech Enthusiasts" segment (12.3K audience).
                      </p>
                      <Button size="sm" variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        View Segment
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-purple-600">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Address Sentiment Concerns</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Monitor customer service mentions showing negative trend.
                      </p>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Review Mentions
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Performance Summary</CardTitle>
              <CardDescription>
                Quick overview of audience engagement across platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { platform: 'Twitter', audience: '45.2K', engagement: '5.2%', sentiment: '+0.4', color: 'bg-blue-500' },
                  { platform: 'LinkedIn', audience: '32.1K', engagement: '3.8%', sentiment: '+0.6', color: 'bg-blue-700' },
                  { platform: 'Instagram', audience: '28.7K', engagement: '6.1%', sentiment: '+0.2', color: 'bg-pink-500' },
                  { platform: 'Facebook', audience: '19.4K', engagement: '2.9%', sentiment: '+0.1', color: 'bg-blue-600' },
                  { platform: 'YouTube', audience: '8.3K', engagement: '4.7%', sentiment: '+0.3', color: 'bg-red-500' },
                  { platform: 'TikTok', audience: '12.8K', engagement: '7.8%', sentiment: '+0.5', color: 'bg-black' },
                ].map((platform) => (
                  <div key={platform.platform} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-3 h-3 rounded-full ${platform.color}`} />
                      <h4 className="font-medium text-sm">{platform.platform}</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Audience:</span>
                        <span className="font-medium">{platform.audience}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Engagement:</span>
                        <span className="font-medium text-green-600">{platform.engagement}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sentiment:</span>
                        <span className={`font-medium ${getSentimentColor(parseFloat(platform.sentiment))}`}>
                          {platform.sentiment}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sentiment">
          <SentimentDashboard />
        </TabsContent>
        
        <TabsContent value="segments">
          <AudienceSegmentationDashboard />
        </TabsContent>
        
        <TabsContent value="timing">
          <PostingTimeDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}