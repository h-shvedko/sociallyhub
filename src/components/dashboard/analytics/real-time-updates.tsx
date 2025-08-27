"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  Zap,
  Pause,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Activity,
  TrendingUp,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface RealTimeData {
  timestamp: Date
  activeUsers: number
  newSessions: number
  pageViews: number
  engagements: number
  errors: number
  responseTime: number
}

interface ConnectionStatus {
  connected: boolean
  lastUpdate: Date
  updateCount: number
  errors: number
}

interface RealTimeUpdatesProps {
  updateInterval?: number
  autoRefresh?: boolean
  onDataUpdate?: (data: RealTimeData) => void
}

export function RealTimeUpdates({ 
  updateInterval = 5000,
  autoRefresh = true,
  onDataUpdate 
}: RealTimeUpdatesProps) {
  const [data, setData] = useState<RealTimeData[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    lastUpdate: new Date(),
    updateCount: 0,
    errors: 0
  })
  
  const intervalRef = useRef<NodeJS.Timeout>()
  const wsRef = useRef<WebSocket>()

  // Initialize real-time connection
  useEffect(() => {
    if (autoRefresh && !isPaused) {
      startRealTimeUpdates()
    } else {
      stopRealTimeUpdates()
    }

    return () => stopRealTimeUpdates()
  }, [autoRefresh, isPaused, updateInterval])

  const startRealTimeUpdates = useCallback(() => {
    // Try WebSocket connection first (if available)
    if (typeof window !== 'undefined' && 'WebSocket' in window) {
      connectWebSocket()
    } else {
      // Fallback to polling
      startPolling()
    }
  }, [updateInterval])

  const connectWebSocket = () => {
    try {
      // Mock WebSocket connection - would connect to actual WebSocket server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/analytics/realtime`
      
      // For demo, we'll simulate WebSocket behavior with polling
      startPolling()
      setIsConnected(true)
      
      setConnectionStatus(prev => ({
        ...prev,
        connected: true,
        lastUpdate: new Date(),
        errors: 0
      }))
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      startPolling() // Fallback to polling
    }
  }

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(async () => {
      try {
        const newData = await fetchRealTimeData()
        updateData(newData)
        
        setConnectionStatus(prev => ({
          connected: true,
          lastUpdate: new Date(),
          updateCount: prev.updateCount + 1,
          errors: 0
        }))
        
        setIsConnected(true)
      } catch (error) {
        console.error('Failed to fetch real-time data:', error)
        handleConnectionError()
      }
    }, updateInterval)
  }

  const stopRealTimeUpdates = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = undefined
    }
    
    setIsConnected(false)
    setConnectionStatus(prev => ({ ...prev, connected: false }))
  }

  const fetchRealTimeData = async (): Promise<RealTimeData> => {
    // Mock API call - replace with actual endpoint
    // const response = await fetch('/api/analytics/realtime')
    // return response.json()
    
    // Generate mock real-time data
    const now = new Date()
    const baseUsers = 1200
    const variation = Math.random() * 200 - 100
    
    return {
      timestamp: now,
      activeUsers: Math.max(0, Math.floor(baseUsers + variation)),
      newSessions: Math.floor(Math.random() * 50 + 10),
      pageViews: Math.floor(Math.random() * 200 + 50),
      engagements: Math.floor(Math.random() * 100 + 20),
      errors: Math.floor(Math.random() * 5),
      responseTime: Math.floor(Math.random() * 300 + 150)
    }
  }

  const updateData = (newData: RealTimeData) => {
    setData(prev => {
      const updated = [...prev, newData]
      // Keep only last 50 data points for performance
      return updated.slice(-50)
    })
    
    onDataUpdate?.(newData)
  }

  const handleConnectionError = () => {
    setConnectionStatus(prev => ({
      ...prev,
      connected: false,
      errors: prev.errors + 1,
      lastUpdate: prev.lastUpdate
    }))
    
    if (connectionStatus.errors < 3) {
      // Retry connection
      setTimeout(() => {
        if (!isPaused) {
          startRealTimeUpdates()
        }
      }, 5000)
    } else {
      setIsConnected(false)
    }
  }

  const togglePause = () => {
    setIsPaused(prev => {
      const newPaused = !prev
      if (newPaused) {
        stopRealTimeUpdates()
      } else {
        startRealTimeUpdates()
      }
      return newPaused
    })
  }

  const forceRefresh = async () => {
    try {
      const newData = await fetchRealTimeData()
      updateData(newData)
    } catch (error) {
      console.error('Manual refresh failed:', error)
    }
  }

  const latestData = data[data.length - 1]
  const previousData = data[data.length - 2]

  const getChange = (current: number, previous: number) => {
    if (!previous) return { value: 0, trend: 'neutral' as const }
    const change = current - previous
    return {
      value: change,
      trend: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'neutral' as const
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection Status & Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Real-Time Analytics</span>
              </CardTitle>
              <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center space-x-1">
                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span>{isConnected ? 'Live' : 'Disconnected'}</span>
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh && !isPaused}
                  onCheckedChange={togglePause}
                />
                <Label htmlFor="auto-refresh" className="text-sm">
                  Auto-refresh
                </Label>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={forceRefresh}
                disabled={!isConnected}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={togglePause}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <CardDescription className="flex items-center space-x-4">
            <span>Last update: {format(connectionStatus.lastUpdate, 'HH:mm:ss')}</span>
            <span>Updates: {connectionStatus.updateCount}</span>
            {connectionStatus.errors > 0 && (
              <span className="text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>Errors: {connectionStatus.errors}</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Real-Time Metrics */}
      {latestData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              label: 'Active Users',
              value: latestData.activeUsers,
              previous: previousData?.activeUsers || 0,
              icon: <Activity className="h-4 w-4" />,
              color: 'text-blue-600'
            },
            {
              label: 'New Sessions',
              value: latestData.newSessions,
              previous: previousData?.newSessions || 0,
              icon: <TrendingUp className="h-4 w-4" />,
              color: 'text-green-600'
            },
            {
              label: 'Page Views',
              value: latestData.pageViews,
              previous: previousData?.pageViews || 0,
              icon: <Activity className="h-4 w-4" />,
              color: 'text-purple-600'
            },
            {
              label: 'Engagements',
              value: latestData.engagements,
              previous: previousData?.engagements || 0,
              icon: <Zap className="h-4 w-4" />,
              color: 'text-orange-600'
            },
            {
              label: 'Response Time',
              value: latestData.responseTime,
              previous: previousData?.responseTime || 0,
              icon: <Clock className="h-4 w-4" />,
              color: 'text-indigo-600',
              unit: 'ms'
            },
            {
              label: 'Errors',
              value: latestData.errors,
              previous: previousData?.errors || 0,
              icon: <AlertCircle className="h-4 w-4" />,
              color: 'text-red-600'
            }
          ].map((metric, index) => {
            const change = getChange(metric.value, metric.previous)
            return (
              <Card key={index} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-1 rounded", metric.color)}>
                      {metric.icon}
                    </div>
                    {isConnected && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">
                      {metric.value.toLocaleString()}
                      {metric.unit && (
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          {metric.unit}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {metric.label}
                    </div>
                    {change.value !== 0 && (
                      <div className={cn(
                        "text-xs flex items-center",
                        change.trend === 'up' ? 'text-green-600' :
                        change.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                      )}>
                        <TrendingUp className={cn(
                          "h-3 w-3 mr-1",
                          change.trend === 'down' && "rotate-180"
                        )} />
                        {change.value > 0 ? '+' : ''}{change.value}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Real-Time Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Live Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.slice(-10).reverse().map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm">
                    {item.activeUsers} users active, {item.newSessions} new sessions
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(item.timestamp, 'HH:mm:ss')}
                </div>
              </div>
            ))}
            {data.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2" />
                <p>Waiting for real-time data...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Quality */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Connection Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Stability</span>
                <span>{Math.max(0, 100 - connectionStatus.errors * 10)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={cn(
                    "h-2 rounded-full transition-all",
                    connectionStatus.errors === 0 ? "bg-green-500" :
                    connectionStatus.errors < 3 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ 
                    width: `${Math.max(0, 100 - connectionStatus.errors * 10)}%` 
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {updateInterval / 1000}s interval
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}