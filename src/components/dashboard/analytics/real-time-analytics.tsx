"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  Zap, 
  Users, 
  Activity, 
  TrendingUp, 
  Eye,
  MessageSquare,
  Share2,
  Heart,
  BarChart3,
  Globe,
  Clock,
  RefreshCw,
  Pause,
  Play,
  WifiOff,
  Wifi
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface RealTimeMetrics {
  activeUsers: number
  pageViews: number
  postsPublished: number
  engagementRate: number
  newComments: number
  newShares: number
  newLikes: number
  platformActivity: {
    platform: string
    activity: number
    change: number
  }[]
  topPages: {
    page: string
    views: number
  }[]
  recentEvents: {
    id: string
    type: 'post' | 'comment' | 'like' | 'share' | 'user_join'
    message: string
    timestamp: Date
    platform?: string
  }[]
}

interface RealTimeAnalyticsProps {
  className?: string
}

export function RealTimeAnalytics({ className }: RealTimeAnalyticsProps) {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null)
  const [connected, setConnected] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch real-time data from API
  useEffect(() => {
    let interval: NodeJS.Timeout

    const fetchRealTimeData = async () => {
      if (!isActive) return

      try {
        setConnected(true)
        const response = await fetch('/api/analytics/realtime')
        
        if (response.ok) {
          const data = await response.json()
          setMetrics(data)
          setLastUpdate(new Date())
          setError(null)
        } else {
          throw new Error('Failed to fetch real-time data')
        }
      } catch (error) {
        console.error('Real-time data fetch error:', error)
        setError('Failed to connect to real-time data')
        setConnected(false)
        
        // Set empty metrics when API fails
        setMetrics({
          activeUsers: 0,
          pageViews: 0,
          postsPublished: 0,
          engagementRate: 0,
          newComments: 0,
          newShares: 0,
          newLikes: 0,
          platformActivity: [],
          topPages: [],
          recentEvents: []
        })
        setLastUpdate(new Date())
      } finally {
        setLoading(false)
      }
    }

    if (isActive) {
      // Initial load
      fetchRealTimeData()
      
      // Set up real-time updates
      interval = setInterval(fetchRealTimeData, 3000) // Update every 3 seconds
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive])


  const handleToggleActive = useCallback(() => {
    setIsActive(prev => !prev)
    if (!isActive) {
      setLoading(true)
    }
  }, [isActive])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'post': return <BarChart3 className="h-3 w-3" />
      case 'comment': return <MessageSquare className="h-3 w-3" />
      case 'like': return <Heart className="h-3 w-3" />
      case 'share': return <Share2 className="h-3 w-3" />
      case 'user_join': return <Users className="h-3 w-3" />
      default: return <Activity className="h-3 w-3" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'post': return 'bg-blue-500'
      case 'comment': return 'bg-green-500'
      case 'like': return 'bg-red-500'
      case 'share': return 'bg-purple-500'
      case 'user_join': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  if (loading && !metrics) {
    return (
      <div className={cn("space-y-6", className)}>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Connecting to real-time data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Real-time Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Real-time Analytics</span>
              </CardTitle>
              <Badge 
                variant={connected ? "default" : "destructive"}
                className="ml-2"
              >
                {connected ? (
                  <><Wifi className="h-3 w-3 mr-1" /> Connected</>
                ) : (
                  <><WifiOff className="h-3 w-3 mr-1" /> Disconnected</>
                )}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Updated {format(lastUpdate, 'HH:mm:ss')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm">Live Updates</span>
                <Switch 
                  checked={isActive} 
                  onCheckedChange={handleToggleActive}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                className="flex items-center space-x-1"
              >
                {isActive ? (
                  <><Pause className="h-4 w-4" /> Pause</>
                ) : (
                  <><Play className="h-4 w-4" /> Resume</>
                )}
              </Button>
            </div>
          </div>
          <CardDescription>
            Live analytics data updated every 3 seconds
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Active Users</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{metrics?.activeUsers || 0}</div>
              <div className="text-xs text-muted-foreground">Currently online</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Page Views</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{metrics?.pageViews || 0}</div>
              <div className="text-xs text-muted-foreground">Last hour</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Engagement</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{metrics?.engagementRate || 0}%</div>
              <div className="text-xs text-muted-foreground">Current rate</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">New Posts</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{metrics?.postsPublished || 0}</div>
              <div className="text-xs text-muted-foreground">Last hour</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Activity and Recent Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platform Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Platform Activity</span>
            </CardTitle>
            <CardDescription>Live engagement across platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics?.platformActivity.map((platform) => (
                <div key={platform.platform} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="font-medium">{platform.platform}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{platform.activity}</span>
                    <Badge 
                      variant={platform.change >= 0 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {platform.change >= 0 ? '+' : ''}{platform.change.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Live Activity Feed</span>
            </CardTitle>
            <CardDescription>Recent events across all platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {metrics?.recentEvents.map((event) => (
                <div key={event.id} className="flex items-start space-x-3">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white", getEventColor(event.type))}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{event.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(event.timestamp, 'HH:mm:ss')} • {event.platform}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Real-time Engagement Breakdown</CardTitle>
          <CardDescription>Live interaction metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-2">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <div className="text-2xl font-bold">{metrics?.newLikes || 0}</div>
              <div className="text-sm text-muted-foreground">New Likes</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-2">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold">{metrics?.newComments || 0}</div>
              <div className="text-sm text-muted-foreground">New Comments</div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mx-auto mb-2">
                <Share2 className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold">{metrics?.newShares || 0}</div>
              <div className="text-sm text-muted-foreground">New Shares</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              <Zap className="h-3 w-3" />
              <span>Real-time data simulation active</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>WebSocket connection: {connected ? 'Active' : 'Reconnecting...'}</span>
              <span>Update interval: 3s</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}