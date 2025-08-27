'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Filter, 
  X, 
  MessageCircle, 
  UserCheck, 
  Clock, 
  CheckCircle,
  AlertCircle,
  MessageSquare,
  AtSign,
  Mail,
  Star,
  Smile,
  Frown,
  Meh,
  Users,
  Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterState {
  status: string
  type: string
  assigneeId: string
  socialAccountId: string
  sentiment: string
  search: string
}

interface InboxFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: Partial<FilterState>) => void
  workspaceId: string
}

interface FilterOption {
  value: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}

export function InboxFilters({ filters, onFiltersChange, workspaceId }: InboxFiltersProps) {
  const [socialAccounts, setSocialAccounts] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFilterData()
  }, [workspaceId])

  const fetchFilterData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch social accounts, team members, and available tags
      const [accountsRes, membersRes] = await Promise.all([
        fetch(`/api/accounts?workspaceId=${workspaceId}`),
        fetch(`/api/team?workspaceId=${workspaceId}`)
      ])

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json()
        setSocialAccounts(accountsData)
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json()
        setTeamMembers(membersData.members || [])
      }

      // Get available tags from inbox items
      const tagsRes = await fetch(`/api/inbox/tags?workspaceId=${workspaceId}`)
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json()
        setAvailableTags(tagsData.tags || [])
      }
    } catch (error) {
      console.error('Error fetching filter data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statusOptions: FilterOption[] = [
    { value: '', label: 'All Status', icon: Filter },
    { value: 'OPEN', label: 'Open', icon: AlertCircle, color: 'text-red-600' },
    { value: 'ASSIGNED', label: 'Assigned', icon: UserCheck, color: 'text-yellow-600' },
    { value: 'SNOOZED', label: 'Snoozed', icon: Clock, color: 'text-blue-600' },
    { value: 'CLOSED', label: 'Closed', icon: CheckCircle, color: 'text-green-600' }
  ]

  const typeOptions: FilterOption[] = [
    { value: '', label: 'All Types', icon: Filter },
    { value: 'COMMENT', label: 'Comments', icon: MessageSquare },
    { value: 'MENTION', label: 'Mentions', icon: AtSign },
    { value: 'DIRECT_MESSAGE', label: 'Direct Messages', icon: Mail },
    { value: 'REVIEW', label: 'Reviews', icon: Star },
    { value: 'REPLY', label: 'Replies', icon: MessageCircle }
  ]

  const sentimentOptions: FilterOption[] = [
    { value: '', label: 'All Sentiment', icon: Filter },
    { value: 'positive', label: 'Positive', icon: Smile, color: 'text-green-600' },
    { value: 'negative', label: 'Negative', icon: Frown, color: 'text-red-600' },
    { value: 'neutral', label: 'Neutral', icon: Meh, color: 'text-gray-600' }
  ]

  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length

  const clearAllFilters = () => {
    onFiltersChange({
      status: '',
      type: '',
      assigneeId: '',
      socialAccountId: '',
      sentiment: '',
      search: ''
    })
  }

  const clearFilter = (filterKey: keyof FilterState) => {
    onFiltersChange({ [filterKey]: '' })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {activeFiltersCount} active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <Select value={filters.status} onValueChange={(value) => onFiltersChange({ status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => {
                const Icon = option.icon
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className={cn("h-4 w-4", option.color)} />}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {filters.status && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {statusOptions.find(opt => opt.value === filters.status)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter('status')}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Message Type</Label>
          <Select value={filters.type} onValueChange={(value) => onFiltersChange({ type: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => {
                const Icon = option.icon
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-4 w-4" />}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {filters.type && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {typeOptions.find(opt => opt.value === filters.type)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter('type')}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Assignee Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Assignee</Label>
          <Select value={filters.assigneeId} onValueChange={(value) => onFiltersChange({ assigneeId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{member.user?.name || member.user?.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.assigneeId && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {filters.assigneeId === 'unassigned' 
                  ? 'Unassigned' 
                  : teamMembers.find(m => m.userId === filters.assigneeId)?.user?.name || 'Unknown'
                }
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter('assigneeId')}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Social Account Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Social Account</Label>
          <Select value={filters.socialAccountId} onValueChange={(value) => onFiltersChange({ socialAccountId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Accounts</SelectItem>
              {socialAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-xs bg-muted px-1.5 py-0.5 rounded">
                      {account.provider?.toLowerCase()}
                    </span>
                    <span>{account.displayName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filters.socialAccountId && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {socialAccounts.find(a => a.id === filters.socialAccountId)?.displayName || 'Unknown Account'}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter('socialAccountId')}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Sentiment Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sentiment</Label>
          <Select value={filters.sentiment} onValueChange={(value) => onFiltersChange({ sentiment: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by sentiment" />
            </SelectTrigger>
            <SelectContent>
              {sentimentOptions.map((option) => {
                const Icon = option.icon
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className={cn("h-4 w-4", option.color)} />}
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {filters.sentiment && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {sentimentOptions.find(opt => opt.value === filters.sentiment)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter('sentiment')}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Quick Filter Buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Filters</Label>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={filters.status === 'OPEN' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFiltersChange({ status: filters.status === 'OPEN' ? '' : 'OPEN' })}
              className="text-xs h-7"
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Open Only
            </Button>
            <Button
              variant={filters.assigneeId === 'unassigned' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFiltersChange({ assigneeId: filters.assigneeId === 'unassigned' ? '' : 'unassigned' })}
              className="text-xs h-7"
            >
              <Users className="h-3 w-3 mr-1" />
              Unassigned
            </Button>
            <Button
              variant={filters.sentiment === 'negative' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFiltersChange({ sentiment: filters.sentiment === 'negative' ? '' : 'negative' })}
              className="text-xs h-7"
            >
              <Frown className="h-3 w-3 mr-1" />
              Negative
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Search</Label>
          <Input
            placeholder="Search messages..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="text-sm"
          />
          {filters.search && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                "{filters.search}"
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter('search')}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}