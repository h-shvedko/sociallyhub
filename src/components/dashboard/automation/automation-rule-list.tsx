'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  MoreVertical,
  Search,
  Filter,
  Bot,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AutomationRule {
  id: string
  name: string
  description?: string
  ruleType: string
  isActive: boolean
  executionCount: number
  successCount: number
  lastExecutedAt?: string
  lastError?: string
  priority: number
  createdAt: string
  updatedAt: string
}

interface AutomationRuleListProps {
  rules: AutomationRule[]
  onToggleStatus: (ruleId: string, isActive: boolean) => void
  onEdit: (rule: AutomationRule) => void
  onRefresh: () => void
}

export function AutomationRuleList({ rules, onToggleStatus, onEdit, onRefresh }: AutomationRuleListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || rule.ruleType === filterType
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && rule.isActive) ||
                         (filterStatus === 'inactive' && !rule.isActive)
    
    return matchesSearch && matchesType && matchesStatus
  })

  const getRuleTypeIcon = (ruleType: string) => {
    switch (ruleType) {
      case 'CONTENT_SUGGESTION':
        return TrendingUp
      case 'SMART_RESPONSE':
        return Bot
      case 'CRISIS_MANAGEMENT':
        return AlertTriangle
      case 'SCHEDULING_OPTIMIZATION':
        return Clock
      default:
        return Bot
    }
  }

  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'CONTENT_SUGGESTION':
        return 'bg-blue-100 text-blue-800'
      case 'SMART_RESPONSE':
        return 'bg-green-100 text-green-800'
      case 'CRISIS_MANAGEMENT':
        return 'bg-red-100 text-red-800'
      case 'SCHEDULING_OPTIMIZATION':
        return 'bg-purple-100 text-purple-800'
      case 'TREND_MONITORING':
        return 'bg-orange-100 text-orange-800'
      case 'ENGAGEMENT_FOLLOW_UP':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatRuleType = (ruleType: string) => {
    return ruleType.split('_').map(word => 
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const calculateSuccessRate = (rule: AutomationRule) => {
    if (rule.executionCount === 0) return 0
    return Math.round((rule.successCount / rule.executionCount) * 100)
  }

  const deleteRule = async (ruleId: string) => {
    try {
      await fetch(`/api/automation/rules/${ruleId}`, {
        method: 'DELETE'
      })
      onRefresh()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Automation Rules</h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredRules.length} rules • {filteredRules.filter(r => r.isActive).length} active
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="CONTENT_SUGGESTION">Content</SelectItem>
              <SelectItem value="SMART_RESPONSE">Responses</SelectItem>
              <SelectItem value="CRISIS_MANAGEMENT">Crisis</SelectItem>
              <SelectItem value="SCHEDULING_OPTIMIZATION">Scheduling</SelectItem>
              <SelectItem value="TREND_MONITORING">Trends</SelectItem>
              <SelectItem value="ENGAGEMENT_FOLLOW_UP">Engagement</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No automation rules found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
                  ? "Try adjusting your filters or search terms"
                  : "Create your first automation rule to get started"
                }
              </p>
              {searchTerm || filterType !== 'all' || filterStatus !== 'all' ? (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('')
                    setFilterType('all')
                    setFilterStatus('all')
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button onClick={() => onEdit(null)}>
                  Create First Rule
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredRules.map(rule => {
            const Icon = getRuleTypeIcon(rule.ruleType)
            const successRate = calculateSuccessRate(rule)
            
            return (
              <Card key={rule.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${getRuleTypeColor(rule.ruleType)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold truncate">{rule.name}</h3>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">
                            {formatRuleType(rule.ruleType)}
                          </Badge>
                        </div>
                        
                        {rule.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {rule.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {rule.executionCount} executions
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {successRate}% success rate
                          </div>
                          {rule.lastExecutedAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last run: {new Date(rule.lastExecutedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        
                        {rule.lastError && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800 truncate">
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              Last error: {rule.lastError}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => onToggleStatus(rule.id, checked)}
                      />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(rule)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Rule
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onToggleStatus(rule.id, !rule.isActive)}
                          >
                            {rule.isActive ? (
                              <>
                                <Pause className="w-4 h-4 mr-2" />
                                Pause Rule
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Start Rule
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteRule(rule.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Rule
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}