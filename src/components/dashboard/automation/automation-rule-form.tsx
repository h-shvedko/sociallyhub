'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Bot, 
  TrendingUp, 
  MessageCircle, 
  AlertTriangle, 
  Clock,
  Plus,
  X,
  Settings,
  Zap
} from 'lucide-react'

interface AutomationRuleFormProps {
  rule?: any
  workspaceId: string
  onSave: () => void
  onCancel: () => void
}

export function AutomationRuleForm({ rule, workspaceId, onSave, onCancel }: AutomationRuleFormProps) {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    ruleType: rule?.ruleType || 'CONTENT_SUGGESTION',
    isActive: rule?.isActive ?? true,
    priority: rule?.priority || 3,
    maxExecutionsPerHour: rule?.maxExecutionsPerHour || 10,
    maxExecutionsPerDay: rule?.maxExecutionsPerDay || 100,
    triggers: rule?.triggers || {},
    conditions: rule?.conditions || {},
    actions: rule?.actions || {}
  })

  const [loading, setLoading] = useState(false)
  const [currentTab, setCurrentTab] = useState('basic')

  const automationTypes = [
    {
      id: 'CONTENT_SUGGESTION',
      name: 'Content Suggestion',
      icon: TrendingUp,
      description: 'Generate AI-powered content recommendations based on trends and performance data'
    },
    {
      id: 'SMART_RESPONSE',
      name: 'Smart Response',
      icon: MessageCircle,
      description: 'Automatically respond to comments, mentions, and messages'
    },
    {
      id: 'CRISIS_MANAGEMENT',
      name: 'Crisis Management',
      icon: AlertTriangle,
      description: 'Monitor sentiment and automatically escalate negative situations'
    },
    {
      id: 'SCHEDULING_OPTIMIZATION',
      name: 'Schedule Optimization',
      icon: Clock,
      description: 'Optimize posting times based on audience engagement patterns'
    },
    {
      id: 'TREND_MONITORING',
      name: 'Trend Monitoring',
      icon: TrendingUp,
      description: 'Monitor industry trends and suggest timely content opportunities'
    },
    {
      id: 'ENGAGEMENT_FOLLOW_UP',
      name: 'Engagement Follow-up',
      icon: Bot,
      description: 'Automatically follow up on high-engagement posts and comments'
    }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const method = rule?.id ? 'PUT' : 'POST'
      const url = rule?.id 
        ? `/api/automation/rules/${rule.id}` 
        : '/api/automation/rules'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          workspaceId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save rule')
      }

      onSave()
    } catch (error) {
      console.error('Error saving rule:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedType = automationTypes.find(type => type.id === formData.ruleType)

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {rule?.id ? 'Edit Automation Rule' : 'Create Automation Rule'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="triggers">Triggers</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rule Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Rule Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter a descriptive name for this rule"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this rule does and when it should trigger"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Automation Type *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {automationTypes.map(type => {
                        const Icon = type.icon
                        const isSelected = formData.ruleType === type.id
                        
                        return (
                          <div
                            key={type.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setFormData({ ...formData, ruleType: type.id })}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {type.name}
                                </h4>
                                <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                  {type.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Rule Status</Label>
                      <p className="text-sm text-gray-600">
                        {formData.isActive ? 'Rule is active and will execute automatically' : 'Rule is paused and will not execute'}
                      </p>
                    </div>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="triggers" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trigger Conditions</CardTitle>
                  <p className="text-sm text-gray-600">
                    Define when this rule should be triggered
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Zap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Trigger Configuration</h3>
                    <p className="text-gray-600 mb-4">
                      Advanced trigger configuration will be available in the next update
                    </p>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Actions to Perform</CardTitle>
                  <p className="text-sm text-gray-600">
                    Define what actions should be taken when this rule is triggered
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Action Configuration</h3>
                    <p className="text-gray-600 mb-4">
                      Advanced action configuration will be available in the next update
                    </p>
                    <Badge variant="outline">Coming Soon</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Execution Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority Level</Label>
                      <Select 
                        value={formData.priority.toString()} 
                        onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 - Lowest</SelectItem>
                          <SelectItem value="2">2 - Low</SelectItem>
                          <SelectItem value="3">3 - Medium</SelectItem>
                          <SelectItem value="4">4 - High</SelectItem>
                          <SelectItem value="5">5 - Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxPerHour">Max Executions per Hour</Label>
                      <Input
                        id="maxPerHour"
                        type="number"
                        min="1"
                        max="100"
                        value={formData.maxExecutionsPerHour}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          maxExecutionsPerHour: parseInt(e.target.value) || 10 
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPerDay">Max Executions per Day</Label>
                    <Input
                      id="maxPerDay"
                      type="number"
                      min="1"
                      max="1000"
                      value={formData.maxExecutionsPerDay}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        maxExecutionsPerDay: parseInt(e.target.value) || 100 
                      })}
                    />
                    <p className="text-sm text-gray-500">
                      Prevents excessive execution and helps control costs
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between pt-6 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentTab !== 'basic' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    const tabs = ['basic', 'triggers', 'actions', 'settings']
                    const currentIndex = tabs.indexOf(currentTab)
                    if (currentIndex > 0) {
                      setCurrentTab(tabs[currentIndex - 1])
                    }
                  }}
                >
                  Previous
                </Button>
              )}
              {currentTab !== 'settings' ? (
                <Button 
                  type="button" 
                  onClick={() => {
                    const tabs = ['basic', 'triggers', 'actions', 'settings']
                    const currentIndex = tabs.indexOf(currentTab)
                    if (currentIndex < tabs.length - 1) {
                      setCurrentTab(tabs[currentIndex + 1])
                    }
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : (rule?.id ? 'Update Rule' : 'Create Rule')}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}