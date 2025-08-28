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
  }
}

export function AutomationMetrics({ metrics }: AutomationMetricsProps) {
  const successRate = metrics.totalExecutions > 0 
    ? (metrics.successfulExecutions / metrics.totalExecutions) * 100 
    : 0

  const metricCards = [
    {
      title: 'Active Rules',
      value: `${metrics.activeRules}/${metrics.totalRules}`,
      change: '+12% from last week',
      icon: Bot,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      change: `${metrics.successfulExecutions} successful`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Time Saved',
      value: `${metrics.timeSaved}h`,
      change: 'This month',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Engagement Boost',
      value: `+${metrics.engagementIncrease}%`,
      change: 'Average increase',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ]

  const performanceMetrics = [
    {
      label: 'Response Time',
      value: `${metrics.averageResponseTime}ms`,
      progress: Math.min((metrics.averageResponseTime / 1000) * 100, 100),
      target: '< 500ms',
      status: metrics.averageResponseTime < 500 ? 'good' : 'warning'
    },
    {
      label: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      progress: successRate,
      target: '> 95%',
      status: successRate > 95 ? 'good' : successRate > 80 ? 'warning' : 'error'
    },
    {
      label: 'Error Rate',
      value: `${metrics.errorRate.toFixed(1)}%`,
      progress: 100 - metrics.errorRate,
      target: '< 5%',
      status: metrics.errorRate < 5 ? 'good' : metrics.errorRate < 10 ? 'warning' : 'error'
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
            {metrics.recentExecutions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No recent executions</p>
              </div>
            ) : (
              metrics.recentExecutions.map((execution) => (
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
              <div className="flex items-center justify-between">
                <p className="text-sm">Smart Response - Customer Support</p>
                <div className="text-right">
                  <p className="font-semibold text-green-600">98.5%</p>
                  <p className="text-xs text-gray-500">156 executions</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">Content Suggestion - Trending Topics</p>
                <div className="text-right">
                  <p className="font-semibold text-green-600">94.2%</p>
                  <p className="text-xs text-gray-500">73 executions</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">Schedule Optimization - Peak Hours</p>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">91.7%</p>
                  <p className="text-xs text-gray-500">24 executions</p>
                </div>
              </div>
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
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Optimize Response Times</p>
                <p className="text-xs text-blue-600 mt-1">
                  Consider reducing trigger frequency for better performance
                </p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Great Performance!</p>
                <p className="text-xs text-green-600 mt-1">
                  Your automation rules are performing excellently
                </p>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Review Error Logs</p>
                <p className="text-xs text-yellow-600 mt-1">
                  2 rules have recurring errors that need attention
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}