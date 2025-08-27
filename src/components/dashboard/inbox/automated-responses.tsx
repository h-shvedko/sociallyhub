'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Bot, 
  Plus, 
  Settings, 
  Zap, 
  Clock, 
  Hash, 
  MessageCircle,
  Edit,
  Trash2,
  Play,
  Pause,
  AlertTriangle
} from 'lucide-react'

interface AutomatedResponse {
  id: string
  name: string
  isEnabled: boolean
  triggerType: 'keyword' | 'sentiment' | 'platform' | 'time_based'
  triggerValue: string
  responseTemplate: string
  priority: number
  delayMinutes?: number
  conditions: {
    platforms?: string[]
    messageTypes?: string[]
    sentiments?: string[]
    keywords?: string[]
    timeRanges?: Array<{ start: string; end: string }>
  }
  createdAt: string
  lastUsed?: string
  usageCount: number
}

interface AutomatedResponsesProps {
  workspaceId: string
}

export function AutomatedResponses({ workspaceId }: AutomatedResponsesProps) {
  const [responses, setResponses] = useState<AutomatedResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingResponse, setEditingResponse] = useState<AutomatedResponse | null>(null)
  
  // Form state for creating/editing
  const [formData, setFormData] = useState({
    name: '',
    isEnabled: true,
    triggerType: 'keyword' as const,
    triggerValue: '',
    responseTemplate: '',
    priority: 1,
    delayMinutes: 0,
    conditions: {
      platforms: [] as string[],
      messageTypes: [] as string[],
      sentiments: [] as string[],
      keywords: [] as string[],
      timeRanges: [] as Array<{ start: string; end: string }>
    }
  })

  useEffect(() => {
    fetchAutomatedResponses()
  }, [workspaceId])

  const fetchAutomatedResponses = async () => {
    try {
      setIsLoading(true)
      
      // Mock data for demonstration
      // In a real app, this would fetch from /api/inbox/automated-responses
      const mockResponses: AutomatedResponse[] = [
        {
          id: '1',
          name: 'Thank You for Positive Feedback',
          isEnabled: true,
          triggerType: 'sentiment',
          triggerValue: 'positive',
          responseTemplate: 'Thank you so much for your kind words! We really appreciate your feedback and are glad you had a great experience. 😊',
          priority: 1,
          delayMinutes: 5,
          conditions: {
            sentiments: ['positive'],
            platforms: ['TWITTER', 'FACEBOOK'],
            messageTypes: ['COMMENT', 'REVIEW']
          },
          createdAt: '2024-01-15T10:00:00Z',
          lastUsed: '2024-01-20T14:30:00Z',
          usageCount: 23
        },
        {
          id: '2',
          name: 'Support for Negative Issues',
          isEnabled: true,
          triggerType: 'sentiment',
          triggerValue: 'negative',
          responseTemplate: 'We sincerely apologize for the issue you\'ve experienced. We take all feedback seriously and would like to make this right. Please DM us with more details so we can assist you personally.',
          priority: 2,
          delayMinutes: 0, // Immediate response for negative sentiment
          conditions: {
            sentiments: ['negative'],
            platforms: ['TWITTER', 'FACEBOOK', 'INSTAGRAM'],
            messageTypes: ['COMMENT', 'MENTION', 'REVIEW']
          },
          createdAt: '2024-01-15T10:00:00Z',
          lastUsed: '2024-01-21T09:15:00Z',
          usageCount: 8
        },
        {
          id: '3',
          name: 'Weekend Out of Office',
          isEnabled: false,
          triggerType: 'time_based',
          triggerValue: 'weekend',
          responseTemplate: 'Thanks for reaching out! Our team is currently offline for the weekend, but we\'ll get back to you first thing Monday morning. For urgent matters, please email support@company.com.',
          priority: 3,
          delayMinutes: 30,
          conditions: {
            timeRanges: [{ start: '18:00', end: '09:00' }],
            platforms: ['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN'],
            messageTypes: ['DIRECT_MESSAGE', 'MENTION']
          },
          createdAt: '2024-01-16T15:00:00Z',
          usageCount: 0
        }
      ]
      
      setResponses(mockResponses)
    } catch (error) {
      console.error('Error fetching automated responses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleResponse = async (responseId: string, enabled: boolean) => {
    try {
      // Update locally for immediate feedback
      setResponses(prev => prev.map(response => 
        response.id === responseId 
          ? { ...response, isEnabled: enabled }
          : response
      ))
      
      // In a real app, this would make an API call
      // await fetch(`/api/inbox/automated-responses/${responseId}`, {
      //   method: 'PATCH',
      //   body: JSON.stringify({ isEnabled: enabled })
      // })
    } catch (error) {
      console.error('Error toggling response:', error)
    }
  }

  const handleDeleteResponse = async (responseId: string) => {
    try {
      setResponses(prev => prev.filter(response => response.id !== responseId))
      
      // In a real app, this would make an API call
      // await fetch(`/api/inbox/automated-responses/${responseId}`, {
      //   method: 'DELETE'
      // })
    } catch (error) {
      console.error('Error deleting response:', error)
    }
  }

  const handleCreateResponse = async () => {
    try {
      const newResponse: AutomatedResponse = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date().toISOString(),
        usageCount: 0
      }
      
      setResponses(prev => [...prev, newResponse])
      setIsCreating(false)
      resetForm()
    } catch (error) {
      console.error('Error creating response:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      isEnabled: true,
      triggerType: 'keyword',
      triggerValue: '',
      responseTemplate: '',
      priority: 1,
      delayMinutes: 0,
      conditions: {
        platforms: [],
        messageTypes: [],
        sentiments: [],
        keywords: [],
        timeRanges: []
      }
    })
  }

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'keyword': return Hash
      case 'sentiment': return MessageCircle
      case 'platform': return Settings
      case 'time_based': return Clock
      default: return Bot
    }
  }

  const getTriggerLabel = (triggerType: string, triggerValue: string) => {
    switch (triggerType) {
      case 'sentiment':
        return `${triggerValue} sentiment`
      case 'keyword':
        return `contains "${triggerValue}"`
      case 'platform':
        return `from ${triggerValue}`
      case 'time_based':
        return `during ${triggerValue}`
      default:
        return triggerValue
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Auto-Responses
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Automated Response</DialogTitle>
                <DialogDescription>
                  Set up automated responses to handle common inquiries
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="space-y-2">
                  <Label>Response Name</Label>
                  <Input
                    placeholder="e.g., Thank you for positive feedback"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                {/* Trigger Type */}
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select 
                    value={formData.triggerType} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, triggerType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">Keyword Match</SelectItem>
                      <SelectItem value="sentiment">Sentiment</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                      <SelectItem value="time_based">Time Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Trigger Value */}
                <div className="space-y-2">
                  <Label>Trigger Value</Label>
                  {formData.triggerType === 'sentiment' ? (
                    <Select 
                      value={formData.triggerValue} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, triggerValue: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder={
                        formData.triggerType === 'keyword' ? 'Enter keywords (comma separated)' :
                        formData.triggerType === 'platform' ? 'Select platforms' :
                        'Configure time settings'
                      }
                      value={formData.triggerValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, triggerValue: e.target.value }))}
                    />
                  )}
                </div>

                {/* Response Template */}
                <div className="space-y-2">
                  <Label>Response Template</Label>
                  <Textarea
                    placeholder="Enter your automated response message..."
                    value={formData.responseTemplate}
                    onChange={(e) => setFormData(prev => ({ ...prev, responseTemplate: e.target.value }))}
                    className="min-h-[100px]"
                  />
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Delay (minutes)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.delayMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, delayMinutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isEnabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
                  />
                  <Label>Enable this automated response</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateResponse} disabled={!formData.name || !formData.responseTemplate}>
                    Create Response
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center py-6">
            <div className="text-sm text-muted-foreground">Loading responses...</div>
          </div>
        ) : responses.length === 0 ? (
          <div className="text-center py-6">
            <Bot className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <div className="text-sm text-muted-foreground mb-2">No automated responses</div>
            <Button variant="outline" size="sm" onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create First Response
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((response) => {
              const TriggerIcon = getTriggerIcon(response.triggerType)
              
              return (
                <div key={response.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{response.name}</h4>
                        <Badge 
                          variant={response.isEnabled ? 'default' : 'secondary'} 
                          className="text-xs"
                        >
                          {response.isEnabled ? (
                            <><Play className="h-2 w-2 mr-1" />Active</>
                          ) : (
                            <><Pause className="h-2 w-2 mr-1" />Paused</>
                          )}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <TriggerIcon className="h-3 w-3" />
                        <span>{getTriggerLabel(response.triggerType, response.triggerValue)}</span>
                        {response.delayMinutes > 0 && (
                          <>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{response.delayMinutes}min delay</span>
                          </>
                        )}
                      </div>
                      
                      <p className="text-xs text-foreground line-clamp-2 bg-muted/30 p-2 rounded">
                        {response.responseTemplate}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Used {response.usageCount} times</span>
                        {response.lastUsed && (
                          <>
                            <span>•</span>
                            <span>Last: {new Date(response.lastUsed).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-3">
                      <Switch
                        checked={response.isEnabled}
                        onCheckedChange={(checked) => handleToggleResponse(response.id, checked)}
                        size="sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingResponse(response)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteResponse(response.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {responses.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>
                Automated responses are processed in priority order with higher priority (lower number) first.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}