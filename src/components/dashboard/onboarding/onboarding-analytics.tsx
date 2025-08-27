'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  OnboardingAnalytics,
  StepAnalytics,
  FunnelStep,
  BehaviorMetrics,
  ErrorEvent,
  OnboardingStep,
  OnboardingStepStatus
} from '@/types/onboarding'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts'
import {
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  Eye,
  MousePointer,
  Search,
  ArrowLeft,
  HelpCircle,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react'

interface OnboardingAnalyticsProps {
  analytics?: OnboardingAnalytics[]
  timeRange?: 'week' | 'month' | 'quarter' | 'year'
  onTimeRangeChange?: (range: 'week' | 'month' | 'quarter' | 'year') => void
  className?: string
}

interface AnalyticsOverviewProps {
  analytics: OnboardingAnalytics[]
  timeRange: string
}

interface ConversionFunnelProps {
  funnelData: FunnelStep[]
}

interface UserBehaviorProps {
  behaviorData: BehaviorMetrics[]
}

interface StepPerformanceProps {
  stepAnalytics: StepAnalytics[]
}

interface ErrorAnalysisProps {
  errors: ErrorEvent[]
}

// Mock analytics data
const mockAnalyticsData: OnboardingAnalytics[] = [
  {
    userId: 'user1',
    workspaceId: 'workspace1',
    flowId: 'default-onboarding',
    startedAt: new Date('2024-01-15T10:00:00Z'),
    completedAt: new Date('2024-01-15T10:45:00Z'),
    currentStep: 'social-connections',
    completionPercentage: 100,
    timeSpent: 45,
    stepAnalytics: [
      {
        stepId: 'welcome',
        startedAt: new Date('2024-01-15T10:00:00Z'),
        completedAt: new Date('2024-01-15T10:05:00Z'),
        timeSpent: 5,
        attempts: 1,
        skipped: false,
        helpContentViewed: []
      },
      {
        stepId: 'account-setup',
        startedAt: new Date('2024-01-15T10:05:00Z'),
        completedAt: new Date('2024-01-15T10:25:00Z'),
        timeSpent: 20,
        attempts: 1,
        skipped: false,
        helpContentViewed: ['account-setup-help']
      },
      {
        stepId: 'social-connections',
        startedAt: new Date('2024-01-15T10:25:00Z'),
        completedAt: new Date('2024-01-15T10:45:00Z'),
        timeSpent: 20,
        attempts: 2,
        skipped: false,
        helpContentViewed: ['social-connect-guide'],
        errors: [
          {
            timestamp: new Date('2024-01-15T10:30:00Z'),
            type: 'OAUTH_ERROR',
            message: 'Failed to connect Twitter account',
            step: 'social-connections',
            resolved: true
          }
        ]
      }
    ],
    dropoffPoint: undefined,
    conversionFunnel: [
      {
        stepId: 'welcome',
        entered: 1000,
        completed: 950,
        dropoffRate: 5,
        averageTime: 3
      },
      {
        stepId: 'account-setup',
        entered: 950,
        completed: 800,
        dropoffRate: 15.8,
        averageTime: 12
      },
      {
        stepId: 'social-connections',
        entered: 800,
        completed: 650,
        dropoffRate: 18.8,
        averageTime: 15
      }
    ],
    userBehavior: {
      clicks: 45,
      scrolls: 128,
      focusEvents: 23,
      idleTime: 180,
      backNavigation: 2,
      helpRequests: 3,
      searchQueries: ['how to connect twitter', 'oauth error']
    }
  }
]

// Analytics Overview Component
const AnalyticsOverview: React.FC<AnalyticsOverviewProps> = ({ analytics, timeRange }) => {
  const totalUsers = analytics.length
  const completedUsers = analytics.filter(a => a.completionPercentage === 100).length
  const averageCompletionTime = analytics.reduce((sum, a) => sum + a.timeSpent, 0) / totalUsers
  const averageCompletionRate = (completedUsers / totalUsers) * 100
  const dropoffUsers = analytics.filter(a => a.dropoffPoint).length

  const completionRateData = [
    { name: 'Completed', value: completedUsers, color: '#10b981' },
    { name: 'In Progress', value: totalUsers - completedUsers - dropoffUsers, color: '#3b82f6' },
    { name: 'Dropped Off', value: dropoffUsers, color: '#ef4444' }
  ]

  const timeSpentData = analytics.map((a, index) => ({
    user: `User ${index + 1}`,
    timeSpent: a.timeSpent,
    completionRate: a.completionPercentage
  }))

  const dailySignupsData = [
    { date: 'Mon', signups: 45, completions: 38 },
    { date: 'Tue', signups: 52, completions: 41 },
    { date: 'Wed', signups: 48, completions: 39 },
    { date: 'Thu', signups: 61, completions: 48 },
    { date: 'Fri', signups: 55, completions: 44 },
    { date: 'Sat', signups: 38, completions: 32 },
    { date: 'Sun', signups: 42, completions: 35 }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Overview Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
          <div className="flex items-center text-xs text-green-600 mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            +12.5% from last {timeRange}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageCompletionRate.toFixed(1)}%</div>
          <div className="flex items-center text-xs text-green-600 mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            +3.2% from last {timeRange}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageCompletionTime.toFixed(1)}min</div>
          <div className="flex items-center text-xs text-red-600 mt-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            +2.1min from last {timeRange}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dropoff Rate</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{((dropoffUsers / totalUsers) * 100).toFixed(1)}%</div>
          <div className="flex items-center text-xs text-green-600 mt-1">
            <TrendingDown className="h-3 w-3 mr-1" />
            -1.8% from last {timeRange}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Daily Signups vs Completions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailySignupsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="signups" fill="#3b82f6" name="Signups" />
              <Bar dataKey="completions" fill="#10b981" name="Completions" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Completion Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={completionRateData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {completionRateData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList dataKey="value" position="center" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// Conversion Funnel Component
const ConversionFunnel: React.FC<ConversionFunnelProps> = ({ funnelData }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Onboarding Conversion Funnel</CardTitle>
        <p className="text-sm text-muted-foreground">
          Track user progression through onboarding steps
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={300}>
            <FunnelChart>
              <Funnel
                dataKey="entered"
                data={funnelData}
                isAnimationActive
                fill="#3b82f6"
              >
                <LabelList dataKey="stepId" position="center" />
              </Funnel>
              <Tooltip />
            </FunnelChart>
          </ResponsiveContainer>

          <div className="space-y-3">
            {funnelData.map((step, index) => (
              <div key={step.stepId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium capitalize">{step.stepId.replace('-', ' ')}</h4>
                    <p className="text-sm text-muted-foreground">
                      Avg. time: {step.averageTime}min
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {step.completed}/{step.entered} users
                  </div>
                  <div className="flex items-center text-xs">
                    <span className={`mr-2 ${step.dropoffRate > 20 ? 'text-red-600' : 'text-green-600'}`}>
                      {step.dropoffRate.toFixed(1)}% dropoff
                    </span>
                    {step.dropoffRate > 20 ? (
                      <AlertTriangle className="h-3 w-3 text-red-600" />
                    ) : (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// User Behavior Component
const UserBehavior: React.FC<UserBehaviorProps> = ({ behaviorData }) => {
  const averageBehavior = behaviorData.reduce((acc, behavior) => ({
    clicks: acc.clicks + behavior.clicks,
    scrolls: acc.scrolls + behavior.scrolls,
    focusEvents: acc.focusEvents + behavior.focusEvents,
    idleTime: acc.idleTime + behavior.idleTime,
    backNavigation: acc.backNavigation + behavior.backNavigation,
    helpRequests: acc.helpRequests + behavior.helpRequests,
    searchQueries: [...acc.searchQueries, ...behavior.searchQueries]
  }), {
    clicks: 0,
    scrolls: 0,
    focusEvents: 0,
    idleTime: 0,
    backNavigation: 0,
    helpRequests: 0,
    searchQueries: [] as string[]
  })

  // Average out the values
  const userCount = behaviorData.length
  Object.keys(averageBehavior).forEach(key => {
    if (key !== 'searchQueries') {
      (averageBehavior as any)[key] = Math.round((averageBehavior as any)[key] / userCount)
    }
  })

  const behaviorMetrics = [
    { name: 'Clicks', value: averageBehavior.clicks, icon: MousePointer, color: 'text-blue-600' },
    { name: 'Scrolls', value: averageBehavior.scrolls, icon: Eye, color: 'text-green-600' },
    { name: 'Focus Events', value: averageBehavior.focusEvents, icon: Target, color: 'text-purple-600' },
    { name: 'Back Navigation', value: averageBehavior.backNavigation, icon: ArrowLeft, color: 'text-orange-600' },
    { name: 'Help Requests', value: averageBehavior.helpRequests, icon: HelpCircle, color: 'text-red-600' }
  ]

  const topSearchQueries = averageBehavior.searchQueries
    .reduce((acc: { [key: string]: number }, query) => {
      acc[query] = (acc[query] || 0) + 1
      return acc
    }, {})

  const topQueries = Object.entries(topSearchQueries)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Engagement Metrics</CardTitle>
          <p className="text-sm text-muted-foreground">
            Average user behavior during onboarding
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {behaviorMetrics.map(({ name, value, icon: Icon, color }) => (
              <div key={name} className="text-center p-4 bg-muted/50 rounded-lg">
                <Icon className={`h-8 w-8 mx-auto mb-2 ${color}`} />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-sm text-muted-foreground">{name}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Idle Time Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Average Idle Time</span>
                <Badge variant="outline">{averageBehavior.idleTime}s</Badge>
              </div>
              <Progress value={(averageBehavior.idleTime / 300) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Lower idle time indicates better user engagement
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Search Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topQueries.map(([query, count], index) => (
                <div key={query} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="text-sm truncate max-w-48">{query}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {topQueries.length === 0 && (
                <p className="text-sm text-muted-foreground">No search queries recorded</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Step Performance Component
const StepPerformance: React.FC<StepPerformanceProps> = ({ stepAnalytics }) => {
  const stepPerformanceData = stepAnalytics.map(step => ({
    stepId: step.stepId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    timeSpent: step.timeSpent,
    attempts: step.attempts,
    helpViewed: step.helpContentViewed.length,
    hasErrors: step.errors ? step.errors.length > 0 : false
  }))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stepPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="stepId" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="timeSpent" fill="#3b82f6" name="Time Spent (min)" />
              <Bar dataKey="attempts" fill="#10b981" name="Attempts" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Help Content Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stepAnalytics.map(step => (
                <div key={step.stepId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm capitalize font-medium">
                    {step.stepId.replace('-', ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Badge variant={step.helpContentViewed.length > 0 ? "default" : "secondary"}>
                      {step.helpContentViewed.length} help views
                    </Badge>
                    {step.helpContentViewed.length > 2 && (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" title="High help usage may indicate UX issues" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attempt Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stepAnalytics.map(step => (
                <div key={step.stepId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm capitalize font-medium">
                    {step.stepId.replace('-', ' ')}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Badge variant={step.attempts > 1 ? "destructive" : "default"}>
                      {step.attempts} attempt{step.attempts > 1 ? 's' : ''}
                    </Badge>
                    {step.attempts > 2 && (
                      <XCircle className="h-4 w-4 text-red-600" title="High attempts indicate difficulty" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Error Analysis Component
const ErrorAnalysis: React.FC<ErrorAnalysisProps> = ({ errors }) => {
  const errorsByType = errors.reduce((acc: { [key: string]: number }, error) => {
    acc[error.type] = (acc[error.type] || 0) + 1
    return acc
  }, {})

  const errorsByStep = errors.reduce((acc: { [key: string]: number }, error) => {
    acc[error.step] = (acc[error.step] || 0) + 1
    return acc
  }, {})

  const resolvedErrors = errors.filter(e => e.resolved).length
  const resolutionRate = errors.length > 0 ? (resolvedErrors / errors.length) * 100 : 0

  const errorTypeData = Object.entries(errorsByType).map(([type, count]) => ({
    type: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    count,
    percentage: (count / errors.length) * 100
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errors.length}</div>
            <p className="text-xs text-muted-foreground">Across all steps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolutionRate.toFixed(1)}%</div>
            <Progress value={resolutionRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Problematic Step</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">
              {Object.entries(errorsByStep).sort(([,a], [,b]) => b - a)[0]?.[0]?.replace('-', ' ') || 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.entries(errorsByStep).sort(([,a], [,b]) => b - a)[0]?.[1] || 0} errors
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Errors by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errorTypeData.map(({ type, count, percentage }) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{type}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <Badge variant="destructive">{count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {errors.slice(0, 10).map((error, index) => (
                <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                      <div className="font-medium text-sm text-red-900 dark:text-red-100">
                        {error.type.replace(/_/g, ' ')}
                      </div>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        {error.message}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {error.step.replace('-', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {error.resolved ? (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-1" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Main Onboarding Analytics Component
export function OnboardingAnalytics({
  analytics = mockAnalyticsData,
  timeRange = 'month',
  onTimeRangeChange,
  className = ''
}: OnboardingAnalyticsProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setRefreshing(false)
  }

  const allErrors = analytics.flatMap(a => 
    a.stepAnalytics.flatMap(s => s.errors || [])
  )

  const allBehaviorData = analytics.map(a => a.userBehavior)
  const allStepAnalytics = analytics.flatMap(a => a.stepAnalytics)
  const funnelData = analytics[0]?.conversionFunnel || []

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Onboarding Analytics</h1>
          <p className="text-muted-foreground">
            Track user progress and identify optimization opportunities
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
          <TabsTrigger value="performance">Step Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AnalyticsOverview analytics={analytics} timeRange={timeRange} />
        </TabsContent>

        <TabsContent value="funnel">
          <ConversionFunnel funnelData={funnelData} />
        </TabsContent>

        <TabsContent value="behavior">
          <UserBehavior behaviorData={allBehaviorData} />
        </TabsContent>

        <TabsContent value="performance">
          <StepPerformance stepAnalytics={allStepAnalytics} />
        </TabsContent>

        <TabsContent value="errors">
          <ErrorAnalysis errors={allErrors} />
        </TabsContent>
      </Tabs>
    </div>
  )
}