'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, 
  DialogTitle, DialogTrigger 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts'
import { 
  Users, Target, TrendingUp, Lightbulb, Play, 
  RefreshCw, Plus, Eye, Clock, Heart, Share2,
  Brain, Sparkles, Calendar, ArrowRight
} from 'lucide-react'

interface AudienceSegment {
  id: string
  name: string
  description: string
  estimatedSize: number
  actualSize: number
  avgEngagementRate: number
  preferredPlatforms: string[]
  topContentTypes: string[]
  interests: string[]
  demographicProfile: {
    ageRange: string
    location: string
  }
  performanceMetrics: {
    avgActualPerformance: number
    implementedRecommendations: number
    pendingRecommendations: number
  }
  contentRecommendations: Array<{
    id: string
    title: string
    status: string
  }>
}

interface SegmentationSettings {
  timeframe: string
  minSegmentSize: number
  maxSegments: number
}

const PLATFORM_COLORS = {
  TWITTER: '#1DA1F2',
  FACEBOOK: '#1877F2', 
  INSTAGRAM: '#E4405F',
  LINKEDIN: '#0077B5',
  YOUTUBE: '#FF0000',
  TIKTOK: '#000000'
}

export function AudienceSegmentationDashboard() {
  const [segments, setSegments] = useState<AudienceSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedSegment, setSelectedSegment] = useState<AudienceSegment | null>(null)
  const [settings, setSettings] = useState<SegmentationSettings>({
    timeframe: '90d',
    minSegmentSize: 50,
    maxSegments: 6
  })

  useEffect(() => {
    fetchSegments()
  }, [])

  const fetchSegments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/audience/segments')
      if (!response.ok) throw new Error('Failed to fetch segments')

      const data = await response.json()
      if (data.success) {
        setSegments(data.segments)
      }
    } catch (error) {
      console.error('Failed to fetch segments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateSegments = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/audience/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await response.json()
      
      if (data.success) {
        setSegments(data.segments)
        setShowCreateDialog(false)
      } else {
        console.error('Segmentation failed:', data.message)
      }
    } catch (error) {
      console.error('Failed to generate segments:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpdateSegments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/audience/segments', {
        method: 'PUT'
      })

      if (response.ok) {
        await fetchSegments()
      }
    } catch (error) {
      console.error('Failed to update segments:', error)
    }
  }

  const getEngagementColor = (rate: number) => {
    if (rate > 0.05) return 'text-green-600'
    if (rate > 0.03) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSegmentSizeColor = (size: number) => {
    if (size > 1000) return 'bg-green-100 text-green-800'
    if (size > 500) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  // Prepare data for charts
  const segmentSizeData = segments.map(segment => ({
    name: segment.name.length > 15 ? segment.name.substring(0, 15) + '...' : segment.name,
    size: segment.actualSize || segment.estimatedSize,
    engagement: (segment.avgEngagementRate * 100).toFixed(1)
  }))

  const platformDistribution = segments.reduce((acc: any, segment) => {
    segment.preferredPlatforms.forEach(platform => {
      acc[platform] = (acc[platform] || 0) + (segment.actualSize || segment.estimatedSize)
    })
    return acc
  }, {})

  const platformChartData = Object.entries(platformDistribution).map(([platform, size]) => ({
    platform,
    size: size as number,
    color: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#6B7280'
  }))

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Audience Segmentation</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-8 bg-muted rounded w-3/4 mb-4" />
                <div className="h-16 bg-muted rounded" />
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
          <h2 className="text-2xl font-bold tracking-tight">Audience Segmentation</h2>
          <p className="text-muted-foreground">
            AI-powered audience clustering and personalized insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleUpdateSegments} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Update Data
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Brain className="h-4 w-4 mr-2" />
                Generate Segments
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate AI Audience Segments</DialogTitle>
                <DialogDescription>
                  Configure the parameters for AI-powered audience clustering
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="timeframe">Analysis Timeframe</Label>
                  <select 
                    id="timeframe"
                    className="w-full p-2 border rounded"
                    value={settings.timeframe}
                    onChange={(e) => setSettings({...settings, timeframe: e.target.value})}
                  >
                    <option value="30d">30 Days</option>
                    <option value="60d">60 Days</option>
                    <option value="90d">90 Days</option>
                    <option value="180d">180 Days</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="minSize">Minimum Segment Size</Label>
                  <Input
                    id="minSize"
                    type="number"
                    min="10"
                    max="1000"
                    value={settings.minSegmentSize}
                    onChange={(e) => setSettings({...settings, minSegmentSize: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="maxSegments">Maximum Segments</Label>
                  <Input
                    id="maxSegments"
                    type="number"
                    min="2"
                    max="10"
                    value={settings.maxSegments}
                    onChange={(e) => setSettings({...settings, maxSegments: parseInt(e.target.value)})}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleGenerateSegments}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Segments
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Segments</p>
                <p className="text-2xl font-bold">{segments.length}</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Audience</p>
                <p className="text-2xl font-bold">
                  {segments.reduce((sum, s) => sum + (s.actualSize || s.estimatedSize), 0).toLocaleString()}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Engagement</p>
                <p className="text-2xl font-bold">
                  {segments.length > 0 
                    ? ((segments.reduce((sum, s) => sum + s.avgEngagementRate, 0) / segments.length) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recommendations</p>
                <p className="text-2xl font-bold">
                  {segments.reduce((sum, s) => sum + s.performanceMetrics.pendingRecommendations, 0)}
                </p>
              </div>
              <Lightbulb className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {segments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Audience Segments Found</h3>
            <p className="text-muted-foreground mb-4">
              Generate AI-powered audience segments to understand your audience better and create personalized content strategies.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Segments
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="segments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="segments">Segments Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="segments" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {segments.map((segment) => (
                <Card 
                  key={segment.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedSegment(segment)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{segment.name}</CardTitle>
                      <Badge className={getSegmentSizeColor(segment.actualSize || segment.estimatedSize)}>
                        {(segment.actualSize || segment.estimatedSize).toLocaleString()}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm">
                      {segment.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Engagement Rate */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Engagement Rate</span>
                        <span className={`font-medium ${getEngagementColor(segment.avgEngagementRate)}`}>
                          {(segment.avgEngagementRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={segment.avgEngagementRate * 100} className="h-1" />
                    </div>

                    {/* Preferred Platforms */}
                    <div>
                      <p className="text-sm font-medium mb-2">Preferred Platforms</p>
                      <div className="flex flex-wrap gap-1">
                        {segment.preferredPlatforms.slice(0, 3).map((platform) => (
                          <Badge key={platform} variant="outline" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                        {segment.preferredPlatforms.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{segment.preferredPlatforms.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Top Interests */}
                    <div>
                      <p className="text-sm font-medium mb-2">Interests</p>
                      <div className="flex flex-wrap gap-1">
                        {segment.interests.slice(0, 3).map((interest) => (
                          <Badge key={interest} variant="secondary" className="text-xs">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>{segment.performanceMetrics.implementedRecommendations} implemented</span>
                      <span>{segment.performanceMetrics.pendingRecommendations} pending</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Segment View Dialog */}
            {selectedSegment && (
              <Dialog open={!!selectedSegment} onOpenChange={() => setSelectedSegment(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {selectedSegment.name}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedSegment.description}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Audience Size</Label>
                        <div className="text-2xl font-bold">
                          {(selectedSegment.actualSize || selectedSegment.estimatedSize).toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Engagement Rate</Label>
                        <div className={`text-2xl font-bold ${getEngagementColor(selectedSegment.avgEngagementRate)}`}>
                          {(selectedSegment.avgEngagementRate * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Platform Preferences</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {selectedSegment.preferredPlatforms.map((platform) => (
                          <Badge key={platform} variant="outline" className="justify-center py-2">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Content Type Preferences</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedSegment.topContentTypes.map((type) => (
                          <Badge key={type} className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Demographics</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-sm font-medium">Age Range</div>
                          <div>{selectedSegment.demographicProfile.ageRange || 'Not specified'}</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-sm font-medium">Location</div>
                          <div>{selectedSegment.demographicProfile.location || 'Global'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Recent Recommendations</Label>
                      {selectedSegment.contentRecommendations.length > 0 ? (
                        <div className="space-y-2">
                          {selectedSegment.contentRecommendations.map((rec) => (
                            <div key={rec.id} className="flex items-center justify-between p-3 border rounded">
                              <span className="font-medium">{rec.title}</span>
                              <Badge variant={rec.status === 'IMPLEMENTED' ? 'default' : 'secondary'}>
                                {rec.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No recommendations available</p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Segment Size Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={segmentSizeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="size" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={platformChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="size"
                        nameKey="platform"
                        label={({ platform, percent }) => `${platform} ${(percent * 100).toFixed(0)}%`}
                      >
                        {platformChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Engagement vs Size Analysis</CardTitle>
                <CardDescription>
                  Comparison of segment size and engagement rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={segmentSizeData} layout="bar">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="size" orientation="left" />
                    <YAxis yAxisId="engagement" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="size" dataKey="size" fill="#3B82F6" name="Audience Size" />
                    <Bar yAxisId="engagement" dataKey="engagement" fill="#10B981" name="Engagement %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="recommendations">
            <div className="space-y-4">
              {segments.map((segment) => (
                <Card key={segment.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{segment.name}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          {segment.performanceMetrics.pendingRecommendations} pending
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          View All
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Personalized content recommendations for this audience segment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {segment.contentRecommendations.length > 0 ? (
                      <div className="space-y-3">
                        {segment.contentRecommendations.map((rec) => (
                          <div key={rec.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <h4 className="font-medium">{rec.title}</h4>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={rec.status === 'IMPLEMENTED' ? 'default' : 'secondary'}>
                                {rec.status}
                              </Badge>
                              <Button variant="ghost" size="sm">
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Lightbulb className="h-8 w-8 mx-auto mb-2" />
                        <p>No recommendations yet. Generate new recommendations for this segment.</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          <Plus className="h-4 w-4 mr-2" />
                          Generate Recommendations
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}