'use client'

import React from 'react'
import { Calendar, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { NotificationCategory, NotificationPriority } from '@/lib/notifications/types'
import { format } from 'date-fns'

interface NotificationFiltersProps {
  filters: {
    categories: NotificationCategory[]
    priorities: NotificationPriority[]
    read: 'all' | 'unread' | 'read'
    dateRange: { start: Date; end: Date } | null
  }
  onFiltersChange: (filters: any) => void
  notificationCounts: {
    all: number
    unread: number
    social: number
    team: number
    content: number
    system: number
  }
}

export function NotificationFilters({ filters, onFiltersChange, notificationCounts }: NotificationFiltersProps) {
  const handleCategoryChange = (category: NotificationCategory, checked: boolean) => {
    const updatedCategories = checked
      ? [...filters.categories, category]
      : filters.categories.filter(c => c !== category)
    
    onFiltersChange({ ...filters, categories: updatedCategories })
  }

  const handlePriorityChange = (priority: NotificationPriority, checked: boolean) => {
    const updatedPriorities = checked
      ? [...filters.priorities, priority]
      : filters.priorities.filter(p => p !== priority)
    
    onFiltersChange({ ...filters, priorities: updatedPriorities })
  }

  const handleReadStatusChange = (value: 'all' | 'unread' | 'read') => {
    onFiltersChange({ ...filters, read: value })
  }

  const handleDateRangeChange = (range: { start: Date; end: Date } | null) => {
    onFiltersChange({ ...filters, dateRange: range })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      categories: [],
      priorities: [],
      read: 'all',
      dateRange: null
    })
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.categories.length > 0) count++
    if (filters.priorities.length > 0) count++
    if (filters.read !== 'all') count++
    if (filters.dateRange) count++
    return count
  }

  const categories = [
    { 
      value: NotificationCategory.SOCIAL_MEDIA, 
      label: 'Social Media',
      count: notificationCounts.social,
      color: 'bg-blue-500'
    },
    { 
      value: NotificationCategory.TEAM, 
      label: 'Team',
      count: notificationCounts.team,
      color: 'bg-green-500'
    },
    { 
      value: NotificationCategory.CONTENT, 
      label: 'Content',
      count: notificationCounts.content,
      color: 'bg-orange-500'
    },
    { 
      value: NotificationCategory.ANALYTICS, 
      label: 'Analytics',
      count: 0, // Will be calculated from actual notifications
      color: 'bg-purple-500'
    },
    { 
      value: NotificationCategory.SYSTEM, 
      label: 'System',
      count: notificationCounts.system,
      color: 'bg-gray-500'
    },
    { 
      value: NotificationCategory.SECURITY, 
      label: 'Security',
      count: 0, // Will be calculated from actual notifications
      color: 'bg-red-500'
    }
  ]

  const priorities = [
    { 
      value: NotificationPriority.CRITICAL, 
      label: 'Critical',
      color: 'bg-red-500'
    },
    { 
      value: NotificationPriority.HIGH, 
      label: 'High',
      color: 'bg-orange-500'
    },
    { 
      value: NotificationPriority.MEDIUM, 
      label: 'Medium',
      color: 'bg-blue-500'
    },
    { 
      value: NotificationPriority.LOW, 
      label: 'Low',
      color: 'bg-gray-500'
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="text-sm font-medium">Filters</span>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary" className="text-xs">
              {getActiveFilterCount()}
            </Badge>
          )}
        </div>
        
        {getActiveFilterCount() > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs h-7"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Categories</Label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map(category => (
            <div key={category.value} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category.value}`}
                checked={filters.categories.includes(category.value)}
                onCheckedChange={(checked) => 
                  handleCategoryChange(category.value, checked as boolean)
                }
              />
              <Label 
                htmlFor={`category-${category.value}`}
                className="text-xs flex items-center gap-2 cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${category.color}`} />
                {category.label}
                {category.count > 0 && (
                  <span className="text-muted-foreground">({category.count})</span>
                )}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Priorities */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Priority</Label>
        <div className="grid grid-cols-2 gap-2">
          {priorities.map(priority => (
            <div key={priority.value} className="flex items-center space-x-2">
              <Checkbox
                id={`priority-${priority.value}`}
                checked={filters.priorities.includes(priority.value)}
                onCheckedChange={(checked) => 
                  handlePriorityChange(priority.value, checked as boolean)
                }
              />
              <Label 
                htmlFor={`priority-${priority.value}`}
                className="text-xs flex items-center gap-2 cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${priority.color}`} />
                {priority.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Read Status */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Status</Label>
        <Select value={filters.read} onValueChange={handleReadStatusChange}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notifications</SelectItem>
            <SelectItem value="unread">
              Unread only {notificationCounts.unread > 0 && `(${notificationCounts.unread})`}
            </SelectItem>
            <SelectItem value="read">Read only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Date Range</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal h-8 text-xs"
            >
              <Calendar className="mr-2 h-3 w-3" />
              {filters.dateRange ? (
                <>
                  {format(filters.dateRange.start, 'MMM dd')} - {format(filters.dateRange.end, 'MMM dd')}
                </>
              ) : (
                'Select date range'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={filters.dateRange?.start}
              selected={filters.dateRange ? {
                from: filters.dateRange.start,
                to: filters.dateRange.end
              } : undefined}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  handleDateRangeChange({ start: range.from, end: range.to })
                } else {
                  handleDateRangeChange(null)
                }
              }}
              numberOfMonths={2}
            />
            {filters.dateRange && (
              <div className="p-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleDateRangeChange(null)}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear date range
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Applied Filters Summary */}
      {getActiveFilterCount() > 0 && (
        <div className="pt-2 border-t">
          <div className="flex flex-wrap gap-1">
            {filters.categories.map(category => (
              <Badge key={category} variant="secondary" className="text-xs">
                {categories.find(c => c.value === category)?.label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-3 w-3 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleCategoryChange(category, false)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ))}
            
            {filters.priorities.map(priority => (
              <Badge key={priority} variant="secondary" className="text-xs">
                {priorities.find(p => p.value === priority)?.label}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-3 w-3 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handlePriorityChange(priority, false)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ))}
            
            {filters.read !== 'all' && (
              <Badge variant="secondary" className="text-xs">
                {filters.read === 'unread' ? 'Unread' : 'Read'}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-3 w-3 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleReadStatusChange('all')}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
            
            {filters.dateRange && (
              <Badge variant="secondary" className="text-xs">
                {format(filters.dateRange.start, 'MMM dd')} - {format(filters.dateRange.end, 'MMM dd')}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-3 w-3 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleDateRangeChange(null)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}