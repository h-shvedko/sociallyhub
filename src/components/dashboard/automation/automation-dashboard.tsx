'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bot, 
  Clock, 
  TrendingUp, 
  Target, 
  MessageCircle,
  Calendar,
  BarChart3,
  Settings,
  Play,
  Pause,
  Plus,
  Eye,
  Edit
} from 'lucide-react'
import { AutomationRuleList } from './automation-rule-list'
import { AutomationMetrics } from './automation-metrics'
import { AutomationRuleForm } from './automation-rule-form'
import { SmartResponses } from './smart-responses'

interface AutomationDashboardProps {
  workspaceId: string
}

export function AutomationDashboard({ workspaceId }: AutomationDashboardProps) {
  const [automationRules, setAutomationRules] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedRule, setSelectedRule] = useState<any>(null)

  useEffect(() => {
    fetchAutomationData()
  }, [workspaceId])

  const fetchAutomationData = async () => {
    try {
      setLoading(true)
      const [rulesResponse, metricsResponse] = await Promise.all([
        fetch(`/api/automation/rules?workspaceId=${workspaceId}`),
        fetch(`/api/automation/metrics?workspaceId=${workspaceId}`)
      ])
      
      const rules = await rulesResponse.json()
      const metricsData = await metricsResponse.json()
      
      setAutomationRules(Array.isArray(rules) ? rules : [])
      setMetrics(metricsData)
    } catch (error) {
      console.error('Error fetching automation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      await fetch(`/api/automation/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })
      
      setAutomationRules(rules => 
        rules.map(rule => 
          rule.id === ruleId ? { ...rule, isActive } : rule
        )
      )
    } catch (error) {
      console.error('Error updating rule status:', error)
    }
  }

  const automationTypes = [
    {
      id: 'CONTENT_SUGGESTION',
      name: 'Content Suggestions',
      icon: TrendingUp,
      description: 'AI-powered content recommendations based on trends',
      color: 'bg-blue-100 text-blue-800'
    },
    {
      id: 'SMART_RESPONSE',
      name: 'Smart Responses',
      icon: MessageCircle,
      description: 'Automated responses to comments and messages',
      color: 'bg-green-100 text-green-800'
    },
    {
      id: 'CRISIS_MANAGEMENT',
      name: 'Crisis Management',
      icon: Target,
      description: 'Automatic detection and response to negative sentiment',
      color: 'bg-red-100 text-red-800'
    },
    {
      id: 'SCHEDULING_OPTIMIZATION',
      name: 'Schedule Optimization',
      icon: Calendar,
      description: 'Optimize posting times based on audience activity',
      color: 'bg-purple-100 text-purple-800'
    },
    {
      id: 'TREND_MONITORING',
      name: 'Trend Monitoring',
      icon: BarChart3,
      description: 'Monitor industry trends and suggest relevant content',
      color: 'bg-orange-100 text-orange-800'
    },
    {
      id: 'ENGAGEMENT_FOLLOW_UP',
      name: 'Engagement Follow-up',
      icon: Bot,
      description: 'Automated follow-ups for high-engagement posts',
      color: 'bg-indigo-100 text-indigo-800'
    }
  ]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Automation Center</h1>
          <p className="text-gray-600 mt-2">
            Automate your social media workflows with intelligent rules and AI-powered features
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Rule
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          <TabsTrigger value="content">Content Intelligence</TabsTrigger>
          <TabsTrigger value="responses">Smart Responses</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Automation Metrics Overview */}
          {metrics && <AutomationMetrics metrics={metrics} />}

          {/* Automation Types Grid */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Automation Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {automationTypes.map(type => {
                const Icon = type.icon
                const activeRules = automationRules.filter(
                  rule => rule.ruleType === type.id && rule.isActive
                ).length
                const totalRules = automationRules.filter(
                  rule => rule.ruleType === type.id
                ).length

                return (
                  <Card key={type.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-2 rounded-lg ${type.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <Badge variant="outline">
                          {activeRules}/{totalRules} active
                        </Badge>
                      </div>
                      <h3 className="font-semibold mb-2">{type.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">{type.description}</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedRule({ ruleType: type.id })
                          setShowCreateForm(true)
                        }}
                      >
                        Create Rule
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Automation Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {automationRules.slice(0, 5).map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-gray-600">
                          {rule.executionCount} executions • {rule.successCount} successful
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => toggleRuleStatus(rule.id, checked)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <AutomationRuleList
            rules={automationRules}
            onToggleStatus={toggleRuleStatus}
            onEdit={setSelectedRule}
            onRefresh={fetchAutomationData}
          />
        </TabsContent>

        <TabsContent value="content">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Intelligence</CardTitle>
                <p className="text-sm text-gray-600">
                  AI-powered content suggestions and trend analysis
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Content Intelligence dashboard coming soon</p>
                  <Button variant="outline" className="mt-4">
                    Enable Content Intelligence
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="responses">
          <SmartResponses workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Automation Analytics</CardTitle>
                <p className="text-sm text-gray-600">
                  Performance metrics and insights for your automation rules
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Automation Analytics dashboard coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Rule Modal */}
      {showCreateForm && (
        <AutomationRuleForm
          rule={selectedRule}
          workspaceId={workspaceId}
          onSave={() => {
            setShowCreateForm(false)
            setSelectedRule(null)
            fetchAutomationData()
          }}
          onCancel={() => {
            setShowCreateForm(false)
            setSelectedRule(null)
          }}
        />
      )}
    </div>
  )
}