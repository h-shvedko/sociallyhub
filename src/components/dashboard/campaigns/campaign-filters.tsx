'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range'
import { 
  Filter, 
  X, 
  Play, 
  Pause, 
  CheckCircle, 
  Edit, 
  Calendar,
  AlertCircle,
  Clock,
  Megaphone,
  Target,
  TrendingUp,
  Users,
  ShoppingCart,
  Rocket,
  PartyPopper,
  BookOpen,
  Zap
} from 'lucide-react'
import { CampaignStatus, CampaignType } from '@/types/campaign'
import { cn } from '@/lib/utils'

interface CampaignFiltersProps {
  filters: {
    status: CampaignStatus[]
    type: CampaignType[]
    dateRange?: {
      startDate: Date
      endDate: Date
    }
    search: string
    clientId?: string
  }
  onFiltersChange: (filters: any) => void
  workspaceId: string
}

export function CampaignFilters({ filters, onFiltersChange, workspaceId }: CampaignFiltersProps) {
  const [clients, setClients] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchClients()
  }, [workspaceId])

  const fetchClients = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/clients?workspaceId=${workspaceId}`)
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients || [])
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statusOptions = [
    { 
      value: CampaignStatus.DRAFT, 
      label: 'Draft', 
      icon: Edit, 
      color: 'text-gray-600' 
    },
    { 
      value: CampaignStatus.SCHEDULED, 
      label: 'Scheduled', 
      icon: Calendar, 
      color: 'text-blue-600' 
    },
    { 
      value: CampaignStatus.ACTIVE, 
      label: 'Active', 
      icon: Play, 
      color: 'text-green-600' 
    },
    { 
      value: CampaignStatus.PAUSED, 
      label: 'Paused', 
      icon: Pause, 
      color: 'text-yellow-600' 
    },
    { 
      value: CampaignStatus.COMPLETED, 
      label: 'Completed', 
      icon: CheckCircle, 
      color: 'text-purple-600' 
    },
    { 
      value: CampaignStatus.CANCELLED, 
      label: 'Cancelled', 
      icon: AlertCircle, 
      color: 'text-red-600' 
    }
  ]

  const typeOptions = [
    { 
      value: CampaignType.BRAND_AWARENESS, 
      label: 'Brand Awareness', 
      icon: Megaphone,
      description: 'Increase brand visibility and recognition'
    },
    { 
      value: CampaignType.LEAD_GENERATION, 
      label: 'Lead Generation', 
      icon: Target,
      description: 'Generate qualified leads and prospects'
    },
    { 
      value: CampaignType.ENGAGEMENT, 
      label: 'Engagement', 
      icon: TrendingUp,
      description: 'Boost audience interaction and engagement'
    },
    { 
      value: CampaignType.SALES, 
      label: 'Sales', 
      icon: ShoppingCart,
      description: 'Drive direct sales and conversions'
    },
    { 
      value: CampaignType.PRODUCT_LAUNCH, 
      label: 'Product Launch', 
      icon: Rocket,
      description: 'Launch new products or features'
    },
    { 
      value: CampaignType.EVENT_PROMOTION, 
      label: 'Event Promotion', 
      icon: PartyPopper,
      description: 'Promote events and webinars'
    },
    { 
      value: CampaignType.CONTENT_SERIES, 
      label: 'Content Series', 
      icon: BookOpen,
      description: 'Educational content campaigns'
    },
    { 
      value: CampaignType.CUSTOM, 
      label: 'Custom', 
      icon: Zap,
      description: 'Custom campaign objectives'
    }
  ]

  const activeFiltersCount = 
    filters.status.length + 
    filters.type.length + 
    (filters.clientId ? 1 : 0) + 
    (filters.dateRange ? 1 : 0)

  const clearAllFilters = () => {
    onFiltersChange({
      status: [],
      type: [],
      clientId: '',
      search: filters.search, // Keep search
      dateRange: undefined
    })
  }

  const handleStatusChange = (status: CampaignStatus, checked: boolean) => {
    const newStatus = checked
      ? [...filters.status, status]
      : filters.status.filter(s => s !== status)
    
    onFiltersChange({ ...filters, status: newStatus })
  }

  const handleTypeChange = (type: CampaignType, checked: boolean) => {
    const newType = checked
      ? [...filters.type, type]
      : filters.type.filter(t => t !== type)
    
    onFiltersChange({ ...filters, type: newType })
  }

  const handleDateRangeChange = (dateRange: { startDate: Date; endDate: Date } | undefined) => {
    onFiltersChange({ ...filters, dateRange })
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
      <CardContent className="space-y-6">
        {/* Status Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Status</Label>
          <div className="space-y-2">
            {statusOptions.map((option) => {
              const Icon = option.icon
              const isChecked = filters.status.includes(option.value)
              
              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleStatusChange(option.value, !!checked)}
                  />
                  <label
                    htmlFor={`status-${option.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                  >
                    <Icon className={cn("h-3 w-3", option.color)} />
                    {option.label}
                  </label>
                </div>
              )
            })}
          </div>
          
          {filters.status.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filters.status.map((status) => {
                const option = statusOptions.find(opt => opt.value === status)
                const Icon = option?.icon || Clock
                
                return (
                  <Badge key={status} variant="outline" className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {option?.label || status}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(status, false)}
                      className="h-3 w-3 p-0 ml-1 hover:bg-transparent"
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        {/* Campaign Type Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Campaign Type</Label>
          <div className="space-y-2">
            {typeOptions.map((option) => {
              const Icon = option.icon
              const isChecked = filters.type.includes(option.value)
              
              return (
                <div key={option.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`type-${option.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleTypeChange(option.value, !!checked)}
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={`type-${option.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
                    >
                      <Icon className="h-3 w-3" />
                      {option.label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          
          {filters.type.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filters.type.map((type) => {
                const option = typeOptions.find(opt => opt.value === type)
                const Icon = option?.icon || Zap
                
                return (
                  <Badge key={type} variant="outline" className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {option?.label || type.replace('_', ' ')}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTypeChange(type, false)}
                      className="h-3 w-3 p-0 ml-1 hover:bg-transparent"
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        {/* Client Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Client</Label>
          <Select 
            value={filters.clientId || ''} 
            onValueChange={(value) => onFiltersChange({ ...filters, clientId: value || undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{client.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {filters.clientId && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {clients.find(c => c.id === filters.clientId)?.name || 'Unknown Client'}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, clientId: undefined })}
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Date Range</Label>
          <DatePickerWithRange
            date={filters.dateRange}
            onDateChange={handleDateRangeChange}
            placeholder="Select date range"
          />
          
          {filters.dateRange && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {filters.dateRange.startDate.toLocaleDateString()} - {filters.dateRange.endDate.toLocaleDateString()}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDateRangeChange(undefined)}
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
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.status.includes(CampaignStatus.ACTIVE) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange(
                CampaignStatus.ACTIVE, 
                !filters.status.includes(CampaignStatus.ACTIVE)
              )}
              className="text-xs h-7"
            >
              <Play className="h-3 w-3 mr-1" />
              Active Only
            </Button>
            <Button
              variant={filters.status.includes(CampaignStatus.DRAFT) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange(
                CampaignStatus.DRAFT, 
                !filters.status.includes(CampaignStatus.DRAFT)
              )}
              className="text-xs h-7"
            >
              <Edit className="h-3 w-3 mr-1" />
              Drafts
            </Button>
            <Button
              variant={filters.type.includes(CampaignType.SALES) ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTypeChange(
                CampaignType.SALES, 
                !filters.type.includes(CampaignType.SALES)
              )}
              className="text-xs h-7"
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              Sales
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}