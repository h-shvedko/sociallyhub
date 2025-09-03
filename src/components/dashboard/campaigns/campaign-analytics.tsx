'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Eye, 
  MousePointer, 
  Heart,
  DollarSign,
  Target,
  RefreshCw,
  Download,
  Calendar
} from 'lucide-react'
import { Campaign } from '@/types/campaign'

interface CampaignAnalyticsProps {
  workspaceId: string
  campaigns: Campaign[]
}

export function CampaignAnalytics({ workspaceId, campaigns }: CampaignAnalyticsProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('30d')
  const [isLoading, setIsLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<any>(null)

  // Fetch real analytics data from API
  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        workspaceId,
        dateRange,
        ...(selectedCampaign !== 'all' && { campaignId: selectedCampaign })
      })

      const response = await fetch(`/api/campaigns/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')

      const data = await response.json()
      setAnalyticsData(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      // Fallback to empty data structure
      setAnalyticsData({
        overview: {
          totalReach: 0,
          totalImpressions: 0,
          totalEngagement: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalSpent: 0,
          averageROI: 0,
          averageCTR: 0,
          averageEngagementRate: 0
        },
        performance: [],
        demographics: { ageGroups: {}, genders: {}, locations: {}, platforms: [] },
        topPosts: [],
        campaignBreakdown: []
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [selectedCampaign, dateRange, workspaceId])

  const data = analyticsData || {
    overview: {
      totalReach: 0,
      totalImpressions: 0,
      totalEngagement: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalSpent: 0,
      averageROI: 0,
      averageCTR: 0,
      averageEngagementRate: 0
    },
    performance: [],
    demographics: { ageGroups: {}, genders: {}, locations: {}, platforms: [] },
    topPosts: []
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Campaign</label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="All campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Time Range</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={isLoading} onClick={fetchAnalyticsData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => console.log('Export analytics clicked')} disabled>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.totalReach.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.overview.totalReach > 0 ? `${dateRange.replace('d', ' days')} period` : 'No data available'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.totalEngagement.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.overview.totalEngagement > 0 ? `${data.overview.averageEngagementRate}% engagement rate` : 'No engagement data'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.overview.totalClicks.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.overview.totalClicks > 0 ? `${data.overview.averageCTR}% click-through rate` : 'No click data'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ROI</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.overview.averageROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.overview.averageROI}%
              </div>
              <p className="text-xs text-muted-foreground">
                ${data.overview.totalSpent.toLocaleString()} spent
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="content">Top Content</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : data.performance && data.performance.length > 0 ? (
                <div className="h-[300px] space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Showing data for the last {dateRange.replace('d', ' days')}
                  </div>
                  {/* Simple performance data display until we add a charting library */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Daily Reach</h4>
                      <div className="space-y-1">
                        {data.performance.slice(0, 7).map((day: any, index: number) => (
                          <div key={day.date} className="flex justify-between text-sm">
                            <span>{new Date(day.date).toLocaleDateString()}</span>
                            <span className="font-mono">{day.reach?.toLocaleString() || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium">Daily Engagement</h4>
                      <div className="space-y-1">
                        {data.performance.slice(0, 7).map((day: any, index: number) => (
                          <div key={day.date} className="flex justify-between text-sm">
                            <span>{new Date(day.date).toLocaleDateString()}</span>
                            <span className="font-mono">{day.engagement?.toLocaleString() || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4 p-3 bg-blue-50 rounded-lg">
                    <strong>💡 Future Enhancement:</strong> This section will be enhanced with interactive charts using Recharts or Chart.js for better visualization of performance trends, comparisons, and insights.
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No performance data available
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Performance metrics will appear here once campaigns have engagement data
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-5 w-20 bg-gray-200 rounded"></div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="flex items-center justify-between">
                        <div className="h-4 w-16 bg-gray-200 rounded"></div>
                        <div className="h-4 w-8 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.demographics.platforms && data.demographics.platforms.length > 0 ? (
                    data.demographics.platforms.map((platform: any) => (
                      <div key={platform.platform} className="flex items-center justify-between">
                        <span className="text-sm">{platform.platform}</span>
                        <Badge variant="outline">{platform.percentage}%</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No platform data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Age Groups</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(data.demographics.ageGroups).length > 0 ? (
                    Object.entries(data.demographics.ageGroups).map(([age, percentage]) => (
                      <div key={age} className="flex items-center justify-between">
                        <span className="text-sm">{age}</span>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No demographic data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gender</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(data.demographics.genders).length > 0 ? (
                    Object.entries(data.demographics.genders).map(([gender, percentage]) => (
                      <div key={gender} className="flex items-center justify-between">
                        <span className="text-sm">{gender}</span>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No gender data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Locations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.keys(data.demographics.locations).length > 0 ? (
                    Object.entries(data.demographics.locations).map(([location, percentage]) => (
                      <div key={location} className="flex items-center justify-between">
                        <span className="text-sm">{location}</span>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No location data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-gray-200 rounded"></div>
                        <div className="space-y-2">
                          <div className="h-4 w-48 bg-gray-200 rounded"></div>
                          <div className="h-3 w-32 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                      <div className="h-8 w-20 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : data.topPosts && data.topPosts.length > 0 ? (
                <div className="space-y-4">
                  {data.topPosts.map((post: any, index: number) => (
                    <div key={post.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium line-clamp-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {post.reach.toLocaleString()} reach
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {post.engagement.toLocaleString()} engagement
                            </div>
                            <div className="flex items-center gap-1">
                              <MousePointer className="h-3 w-3" />
                              {post.clicks.toLocaleString()} clicks
                            </div>
                          </div>
                          {post.campaignName && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Campaign: {post.campaignName}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No post performance data available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Posts with metrics will appear here once campaigns are active
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}