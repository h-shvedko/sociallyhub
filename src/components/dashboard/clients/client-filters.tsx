'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  X,
  Calendar,
  Building,
  Tag,
  User,
  DollarSign,
  Filter
} from 'lucide-react'
import { 
  ClientStatus, 
  OnboardingStatus, 
  ClientFilters as ClientFiltersType 
} from '@/types/client'

interface ClientFiltersProps {
  onFiltersChange: (filters: ClientFiltersType) => void
  onClose: () => void
}

export function ClientFilters({ onFiltersChange, onClose }: ClientFiltersProps) {
  const [filters, setFilters] = useState<ClientFiltersType>({})
  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Retail',
    'Education',
    'Manufacturing',
    'Marketing',
    'Consulting',
    'Real Estate',
    'Other'
  ]

  const tags = [
    'Enterprise',
    'Priority',
    'Startup',
    'Large Client',
    'High Value',
    'New Client',
    'Renewal Due',
    'At Risk',
    'VIP',
    'Compliance'
  ]

  const assignedUsers = [
    { id: 'user1', name: 'John Smith' },
    { id: 'user2', name: 'Sarah Johnson' },
    { id: 'user3', name: 'Mike Davis' },
    { id: 'user4', name: 'Emily Brown' },
    { id: 'user5', name: 'David Wilson' }
  ]

  const handleStatusChange = (status: ClientStatus, checked: boolean) => {
    const currentStatuses = filters.status || []
    const newStatuses = checked 
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status)
    
    setFilters({ ...filters, status: newStatuses.length > 0 ? newStatuses : undefined })
    updateActiveFilters('status', newStatuses.length > 0)
  }

  const handleOnboardingStatusChange = (status: OnboardingStatus, checked: boolean) => {
    const currentStatuses = filters.onboardingStatus || []
    const newStatuses = checked 
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status)
    
    setFilters({ ...filters, onboardingStatus: newStatuses.length > 0 ? newStatuses : undefined })
    updateActiveFilters('onboarding', newStatuses.length > 0)
  }

  const handleIndustryChange = (industry: string, checked: boolean) => {
    const currentIndustries = filters.industry || []
    const newIndustries = checked 
      ? [...currentIndustries, industry]
      : currentIndustries.filter(i => i !== industry)
    
    setFilters({ ...filters, industry: newIndustries.length > 0 ? newIndustries : undefined })
    updateActiveFilters('industry', newIndustries.length > 0)
  }

  const handleTagChange = (tag: string, checked: boolean) => {
    const currentTags = filters.tags || []
    const newTags = checked 
      ? [...currentTags, tag]
      : currentTags.filter(t => t !== tag)
    
    setFilters({ ...filters, tags: newTags.length > 0 ? newTags : undefined })
    updateActiveFilters('tags', newTags.length > 0)
  }

  const handleAssignedUserChange = (userId: string, checked: boolean) => {
    const currentUsers = filters.assignedUserId || []
    const newUsers = checked 
      ? [...currentUsers, userId]
      : currentUsers.filter(u => u !== userId)
    
    setFilters({ ...filters, assignedUserId: newUsers.length > 0 ? newUsers : undefined })
    updateActiveFilters('assignedUser', newUsers.length > 0)
  }

  const updateActiveFilters = (filterType: string, isActive: boolean) => {
    setActiveFilters(prev => 
      isActive 
        ? [...prev.filter(f => f !== filterType), filterType]
        : prev.filter(f => f !== filterType)
    )
  }

  const handleDateRangeChange = (type: 'start' | 'end', date: string) => {
    const dateRange = filters.dateRange || { startDate: new Date(), endDate: new Date() }
    const newDateRange = {
      ...dateRange,
      [type === 'start' ? 'startDate' : 'endDate']: new Date(date)
    }
    
    setFilters({ ...filters, dateRange: newDateRange })
    updateActiveFilters('dateRange', true)
  }

  const handleSearchChange = (search: string) => {
    setFilters({ ...filters, search: search || undefined })
    updateActiveFilters('search', search.length > 0)
  }

  const clearFilters = () => {
    setFilters({})
    setActiveFilters([])
  }

  const applyFilters = () => {
    onFiltersChange(filters)
    onClose()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Advanced Filters
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label>Search</Label>
          <Input 
            placeholder="Search by name, company, email..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Client Status */}
        <div className="space-y-3">
          <Label>Client Status</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(ClientStatus).map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox 
                  id={`status-${status}`}
                  checked={filters.status?.includes(status) || false}
                  onCheckedChange={(checked) => handleStatusChange(status, checked as boolean)}
                />
                <Label htmlFor={`status-${status}`} className="text-sm">
                  {status.toLowerCase().replace('_', ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding Status */}
        <div className="space-y-3">
          <Label>Onboarding Status</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(OnboardingStatus).map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox 
                  id={`onboarding-${status}`}
                  checked={filters.onboardingStatus?.includes(status) || false}
                  onCheckedChange={(checked) => handleOnboardingStatusChange(status, checked as boolean)}
                />
                <Label htmlFor={`onboarding-${status}`} className="text-sm">
                  {status.toLowerCase().replace('_', ' ')}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Industry */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Industry
          </Label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {industries.map((industry) => (
              <div key={industry} className="flex items-center space-x-2">
                <Checkbox 
                  id={`industry-${industry}`}
                  checked={filters.industry?.includes(industry) || false}
                  onCheckedChange={(checked) => handleIndustryChange(industry, checked as boolean)}
                />
                <Label htmlFor={`industry-${industry}`} className="text-sm">
                  {industry}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </Label>
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {tags.map((tag) => (
              <div key={tag} className="flex items-center space-x-2">
                <Checkbox 
                  id={`tag-${tag}`}
                  checked={filters.tags?.includes(tag) || false}
                  onCheckedChange={(checked) => handleTagChange(tag, checked as boolean)}
                />
                <Label htmlFor={`tag-${tag}`} className="text-sm">
                  {tag}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned User */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Assigned To
          </Label>
          <div className="space-y-2">
            {assignedUsers.map((user) => (
              <div key={user.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`user-${user.id}`}
                  checked={filters.assignedUserId?.includes(user.id) || false}
                  onCheckedChange={(checked) => handleAssignedUserChange(user.id, checked as boolean)}
                />
                <Label htmlFor={`user-${user.id}`} className="text-sm">
                  {user.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="start-date" className="text-xs">From</Label>
              <Input 
                id="start-date"
                type="date" 
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs">To</Label>
              <Input 
                id="end-date"
                type="date" 
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="space-y-2">
            <Label>Active Filters</Label>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge key={filter} variant="secondary">
                  {filter}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={clearFilters}>
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}