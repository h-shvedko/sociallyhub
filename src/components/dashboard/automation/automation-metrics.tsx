'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Bot,
  Clock,
  TrendingUp,
  Target,
  MessageCircle,
  Calendar,
  BarChart3,
  Activity,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

interface AutomationMetricsProps {
  metrics: {
    totalRules: number
    activeRules: number
    totalExecutions: number
    successfulExecutions: number
    averageResponseTime: number
    timeSaved: number
    engagementIncrease: number
    errorRate: number
    recentExecutions: Array<{
      id: string
      ruleName: string
      status: string
      executedAt: string
      duration: number
    }>
    topPerformingRules?: Array<{
      id: string
      name: string
      ruleType: string
      successRate: string
      executionCount: number
    }>
    recommendations?: Array<{
      type: 'success' | 'warning' | 'error' | 'info'
      title: string
      message: string
    }>
  }
}

export function AutomationMetrics({ metrics }: AutomationMetricsProps) {
  // Helper function to safely convert to number with extensive checks
  const safeNumber = (val: any): number => {
    if (val === undefined || val === null) return 0
    try {
      const num = Number(val)
      return isNaN(num) || !isFinite(num) ? 0 : num
    } catch {
      return 0
    }
  }

  // Helper function to safely format a number with toFixed
  const safeToFixed = (val: number, decimals: number = 1): string => {
    try {
      const num = safeNumber(val)
      return num.toFixed(decimals)
    } catch {
      return '0.0'
    }
  }

  // If metrics is not provided at all or is not an object, show loading state
  if (!metrics || typeof metrics !== 'object') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Ensure metrics exists and provide default values to prevent undefined errors
  const safeMetrics = {
    totalRules: safeNumber(metrics.totalRules),
    activeRules: safeNumber(metrics.activeRules),
    totalExecutions: safeNumber(metrics.totalExecutions),
    successfulExecutions: safeNumber(metrics.successfulExecutions),
    averageResponseTime: safeNumber(metrics.averageResponseTime),
    timeSaved: safeNumber(metrics.timeSaved),
    engagementIncrease: safeNumber(metrics.engagementIncrease),
    errorRate: safeNumber(metrics.errorRate),
    recentExecutions: Array.isArray(metrics.recentExecutions) ? metrics.recentExecutions : [],
    topPerformingRules: Array.isArray(metrics.topPerformingRules) ? metrics.topPerformingRules : [],
    recommendations: Array.isArray(metrics.recommendations) ? metrics.recommendations : []
  }

  const successRate = safeMetrics.totalExecutions > 0
    ? (safeMetrics.successfulExecutions / safeMetrics.totalExecutions) * 100
    : 0

  // Ensure successRate is a valid number
  const safeSuccessRate = safeNumber(successRate)

  const metricCards = [
    {
      title: 'Active Rules',
      value: `${safeMetrics.activeRules}/${safeMetrics.totalRules}`,
      change: '+12% from last week',
      icon: Bot,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Success Rate',
      value: `${safeToFixed(safeSuccessRate, 1)}%`,
      change: `${safeMetrics.successfulExecutions} successful`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Time Saved',
      value: `${safeMetrics.timeSaved}h`,
      change: 'This month',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Engagement Boost',
      value: `+${safeMetrics.engagementIncrease}%`,
      change: 'Average increase',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ]

  const performanceMetrics = [
    {
      label: 'Response Time',
      value: `${safeMetrics.averageResponseTime}ms`,
      progress: Math.min((safeMetrics.averageResponseTime / 1000) * 100, 100),
      target: '< 500ms',
      status: safeMetrics.averageResponseTime < 500 ? 'good' : 'warning'
    },
    {
      label: 'Success Rate',
      value: `${safeToFixed(safeSuccessRate, 1)}%`,
      progress: safeSuccessRate,
      target: '> 95%',
      status: safeSuccessRate > 95 ? 'good' : safeSuccessRate > 80 ? 'warning' : 'error'
    },
    {
      label: 'Error Rate',
      value: `${safeToFixed(safeMetrics.errorRate, 1)}%`,
      progress: 100 - (Number(safeMetrics.errorRate) || 0),
      target: '< 5%',
      status: safeMetrics.errorRate < 5 ? 'good' : safeMetrics.errorRate < 10 ? 'warning' : 'error'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                    <Icon className={`w-5 h-5 ${metric.color}`} />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{metric.value}</p>
                    <p className="text-xs text-gray-500">{metric.change}</p>
                  </div>
                </div>
                <p className="font-medium text-gray-700">{metric.title}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {performanceMetrics.map((metric, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="font-medium">{metric.label}</p>
                  <div className={`w-2 h-2 rounded-full ${
                    metric.status === 'good' ? 'bg-green-500' :
                    metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
                <div className="text-right">
                  <p className="font-semibold">{metric.value}</p>
                  <p className="text-xs text-gray-500">Target: {metric.target}</p>
                </div>
              </div>
              <Progress
                value={metric.progress}
                className={`h-2 ${
                  metric.status === 'good' ? '[&>div]:bg-green-500' :
                  metric.status === 'warning' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                }`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Recent Executions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {safeMetrics.recentExecutions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No recent executions</p>
              </div>
            ) : (
              safeMetrics.recentExecutions.map((execution) => (
                <div key={execution.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      execution.status === 'SUCCESS' ? 'bg-green-500' :
                      execution.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="font-medium">{execution.ruleName}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(execution.executedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      execution.status === 'SUCCESS' ? 'text-green-600' :
                      execution.status === 'FAILED' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {execution.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {execution.duration}ms
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Automation Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5" />
              Top Performing Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {safeMetrics.topPerformingRules.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No automation rules have been executed yet</p>
                </div>
              ) : (
                safeMetrics.topPerformingRules.map((rule, index) => (
                  <div key={rule.id} className="flex items-center justify-between">
                    <p className="text-sm">{rule.name}</p>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        parseFloat(rule.successRate) >= 95 ? 'text-green-600' :
                        parseFloat(rule.successRate) >= 80 ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>
                        {rule.successRate}%
                      </p>
                      <p className="text-xs text-gray-500">{rule.executionCount} executions</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {safeMetrics.recommendations.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-800">No recommendations at this time</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Your automation system is running smoothly
                  </p>
                </div>
              ) : (
                safeMetrics.recommendations.map((rec, index) => {
                  const colorMap = {
                    success: 'bg-green-50 border-green-200',
                    warning: 'bg-yellow-50 border-yellow-200',
                    error: 'bg-red-50 border-red-200',
                    info: 'bg-blue-50 border-blue-200'
                  }
                  const textColorMap = {
                    success: 'text-green-800',
                    warning: 'text-yellow-800',
                    error: 'text-red-800',
                    info: 'text-blue-800'
                  }
                  const subTextColorMap = {
                    success: 'text-green-600',
                    warning: 'text-yellow-600',
                    error: 'text-red-600',
                    info: 'text-blue-600'
                  }

                  return (
                    <div key={index} className={`p-3 ${colorMap[rec.type]} border rounded-lg`}>
                      <p className={`text-sm font-medium ${textColorMap[rec.type]}`}>
                        {rec.title}
                      </p>
                      <p className={`text-xs ${subTextColorMap[rec.type]} mt-1`}>
                        {rec.message}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
