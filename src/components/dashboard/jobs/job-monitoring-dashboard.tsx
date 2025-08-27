'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCw, Play, Pause, Trash2, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface JobStats {
  queueName: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}

export interface JobDetails {
  id: string
  name: string
  queueName: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
  progress: number
  data: any
  createdAt: string
  processedAt?: string
  failedReason?: string
  finishedAt?: string
  attempts: number
  maxAttempts: number
  delay?: number
  priority: number
  duration?: number
  returnValue?: any
}

export interface QueueHealth {
  queueName: string
  isHealthy: boolean
  issues: string[]
  recommendations: string[]
  metrics: {
    throughput: number // jobs per minute
    errorRate: number // percentage
    avgDuration: number // milliseconds
    backlogSize: number
  }
}

interface JobMonitoringDashboardProps {
  className?: string
}

export function JobMonitoringDashboard({ className }: JobMonitoringDashboardProps) {
  const [jobStats, setJobStats] = useState<JobStats[]>([])
  const [jobDetails, setJobDetails] = useState<JobDetails[]>([])
  const [queueHealth, setQueueHealth] = useState<QueueHealth[]>([])
  const [selectedQueue, setSelectedQueue] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { toast } = useToast()

  // Fetch job statistics
  const fetchJobStats = async () => {
    try {
      const response = await fetch('/api/jobs/stats')
      if (response.ok) {
        const stats = await response.json()
        setJobStats(stats)
      }
    } catch (error) {
      console.error('Failed to fetch job stats:', error)
    }
  }

  // Fetch job details
  const fetchJobDetails = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedQueue !== 'all') params.set('queue', selectedQueue)
      if (selectedStatus !== 'all') params.set('status', selectedStatus)
      if (searchTerm) params.set('search', searchTerm)

      const response = await fetch(`/api/jobs/details?${params.toString()}`)
      if (response.ok) {
        const details = await response.json()
        setJobDetails(details)
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error)
    }
  }

  // Fetch queue health
  const fetchQueueHealth = async () => {
    try {
      const response = await fetch('/api/jobs/health')
      if (response.ok) {
        const health = await response.json()
        setQueueHealth(health)
      }
    } catch (error) {
      console.error('Failed to fetch queue health:', error)
    }
  }

  // Refresh all data
  const refreshData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        fetchJobStats(),
        fetchJobDetails(),
        fetchQueueHealth()
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    refreshData()
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [selectedQueue, selectedStatus, searchTerm, autoRefresh])

  // Queue operations
  const pauseQueue = async (queueName: string) => {
    try {
      const response = await fetch(`/api/jobs/queues/${queueName}/pause`, {
        method: 'POST'
      })
      if (response.ok) {
        toast({
          title: 'Queue Paused',
          description: `Queue "${queueName}" has been paused`
        })
        await refreshData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pause queue',
        variant: 'destructive'
      })
    }
  }

  const resumeQueue = async (queueName: string) => {
    try {
      const response = await fetch(`/api/jobs/queues/${queueName}/resume`, {
        method: 'POST'
      })
      if (response.ok) {
        toast({
          title: 'Queue Resumed',
          description: `Queue "${queueName}" has been resumed`
        })
        await refreshData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resume queue',
        variant: 'destructive'
      })
    }
  }

  const cleanQueue = async (queueName: string, status: string) => {
    try {
      const response = await fetch(`/api/jobs/queues/${queueName}/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, grace: 0 })
      })
      if (response.ok) {
        const result = await response.json()
        toast({
          title: 'Queue Cleaned',
          description: `Removed ${result.cleaned} ${status} jobs from "${queueName}"`
        })
        await refreshData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clean queue',
        variant: 'destructive'
      })
    }
  }

  // Job operations
  const retryJob = async (jobId: string, queueName: string) => {
    try {
      const response = await fetch(`/api/jobs/${queueName}/${jobId}/retry`, {
        method: 'POST'
      })
      if (response.ok) {
        toast({
          title: 'Job Retried',
          description: `Job ${jobId} has been queued for retry`
        })
        await refreshData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry job',
        variant: 'destructive'
      })
    }
  }

  const removeJob = async (jobId: string, queueName: string) => {
    try {
      const response = await fetch(`/api/jobs/${queueName}/${jobId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        toast({
          title: 'Job Removed',
          description: `Job ${jobId} has been removed`
        })
        await refreshData()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove job',
        variant: 'destructive'
      })
    }
  }

  // Computed values
  const totalStats = useMemo(() => {
    return jobStats.reduce(
      (acc, stats) => ({
        waiting: acc.waiting + stats.waiting,
        active: acc.active + stats.active,
        completed: acc.completed + stats.completed,
        failed: acc.failed + stats.failed,
        delayed: acc.delayed + stats.delayed,
        paused: acc.paused + stats.paused
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 }
    )
  }, [jobStats])

  const filteredJobs = useMemo(() => {
    return jobDetails.filter(job => {
      if (selectedQueue !== 'all' && job.queueName !== selectedQueue) return false
      if (selectedStatus !== 'all' && job.status !== selectedStatus) return false
      if (searchTerm && !job.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !job.id.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [jobDetails, selectedQueue, selectedStatus, searchTerm])

  const queueNames = useMemo(() => {
    return Array.from(new Set(jobStats.map(stats => stats.queueName)))
  }, [jobStats])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default'
      case 'active': return 'secondary'
      case 'failed': return 'destructive'
      case 'waiting': return 'outline'
      case 'delayed': return 'outline'
      case 'paused': return 'outline'
      default: return 'outline'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />
      case 'active': return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'failed': return <XCircle className="h-4 w-4" />
      case 'waiting': return <Clock className="h-4 w-4" />
      case 'delayed': return <Clock className="h-4 w-4" />
      case 'paused': return <Pause className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Job Monitoring Dashboard</h2>
          <p className="text-muted-foreground">Monitor and manage background job queues</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
          </Button>
          
          <Button
            onClick={refreshData}
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Waiting</p>
                <p className="text-2xl font-bold">{totalStats.waiting}</p>
              </div>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{totalStats.active}</p>
              </div>
              <RefreshCw className="h-5 w-5 text-blue-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{totalStats.completed}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-600">{totalStats.failed}</p>
              </div>
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delayed</p>
                <p className="text-2xl font-bold">{totalStats.delayed}</p>
              </div>
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold">{totalStats.paused}</p>
              </div>
              <Pause className="h-5 w-5 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Select value={selectedQueue} onValueChange={setSelectedQueue}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Queues</SelectItem>
                {queueNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {/* Jobs List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredJobs.map(job => (
                <Card key={job.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(job.status)}
                          <span className="font-medium">{job.name}</span>
                          <Badge variant={getStatusBadgeVariant(job.status)}>
                            {job.status}
                          </Badge>
                          <Badge variant="outline">{job.queueName}</Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>ID: {job.id}</p>
                          <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
                          {job.processedAt && (
                            <p>Processed: {new Date(job.processedAt).toLocaleString()}</p>
                          )}
                          {job.duration && (
                            <p>Duration: {job.duration}ms</p>
                          )}
                          <p>Attempts: {job.attempts}/{job.maxAttempts}</p>
                          {job.priority > 0 && <p>Priority: {job.priority}</p>}
                        </div>

                        {job.progress > 0 && job.status === 'active' && (
                          <div className="mt-2">
                            <Progress value={job.progress} className="w-full" />
                            <p className="text-xs text-muted-foreground mt-1">
                              Progress: {job.progress}%
                            </p>
                          </div>
                        )}

                        {job.failedReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-600">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              {job.failedReason}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {job.status === 'failed' && job.attempts < job.maxAttempts && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryJob(job.id, job.queueName)}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeJob(job.id, job.queueName)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredJobs.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No jobs found matching your filters</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="queues" className="space-y-4">
          <div className="grid gap-4">
            {jobStats.map(stats => (
              <Card key={stats.queueName}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{stats.queueName}</CardTitle>
                      <CardDescription>
                        Queue statistics and management
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {stats.paused > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resumeQueue(stats.queueName)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Resume
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseQueue(stats.queueName)}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cleanQueue(stats.queueName, 'completed')}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clean
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{stats.waiting}</p>
                      <p className="text-sm text-muted-foreground">Waiting</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
                      <p className="text-sm text-muted-foreground">Active</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{stats.delayed}</p>
                      <p className="text-sm text-muted-foreground">Delayed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-600">{stats.paused}</p>
                      <p className="text-sm text-muted-foreground">Paused</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4">
            {queueHealth.map(health => (
              <Card key={health.queueName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{health.queueName}</CardTitle>
                    <Badge variant={health.isHealthy ? 'default' : 'destructive'}>
                      {health.isHealthy ? 'Healthy' : 'Issues Detected'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Throughput</p>
                      <p className="text-xl font-bold">{health.metrics.throughput}/min</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                      <p className="text-xl font-bold">{health.metrics.errorRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Duration</p>
                      <p className="text-xl font-bold">{health.metrics.avgDuration}ms</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Backlog</p>
                      <p className="text-xl font-bold">{health.metrics.backlogSize}</p>
                    </div>
                  </div>

                  {health.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-red-600">Issues:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {health.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {health.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 text-blue-600">Recommendations:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {health.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-blue-600">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}