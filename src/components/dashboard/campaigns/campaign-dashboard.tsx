'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { 
  Megaphone, 
  Plus, 
  Filter, 
  Search, 
  RefreshCw,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Target,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  Calendar,
  Settings
} from 'lucide-react'
import { CampaignFilters } from './campaign-filters'
import { CampaignStats } from './campaign-stats'
import { CampaignCard } from './campaign-card'
import { CreateCampaignDialog } from './create-campaign-dialog'
import { CampaignAnalytics } from './campaign-analytics'
import { ABTestingDashboard } from './ab-testing-dashboard'
import { BudgetManagement } from './budget-management'
import { CampaignReporting } from './campaign-reporting'
import { CampaignTemplates } from './campaign-templates'
import { Campaign, CampaignStatus, CampaignType, CampaignStatsResponse } from '@/types/campaign'

export interface CampaignDashboardProps {
  workspaceId: string
}

export function CampaignDashboard({ workspaceId }: CampaignDashboardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<CampaignStatsResponse | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState({
    status: [] as CampaignStatus[],
    type: [] as CampaignType[],
    search: '',
    clientId: '',
    dateRange: undefined as { startDate: Date; endDate: Date } | undefined
  })
  
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchCampaigns = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const params = new URLSearchParams({
        workspaceId,
        page: (isRefresh ? 1 : page).toString(),
        limit: '12',
        ...(filters.status.length > 0 && { status: filters.status.join(',') }),
        ...(filters.type.length > 0 && { type: filters.type.join(',') }),
        ...(filters.search && { search: filters.search }),
        ...(filters.clientId && { clientId: filters.clientId })
      })

      const response = await fetch(`/api/campaigns?${params}`)
      if (!response.ok) throw new Error('Failed to fetch campaigns')

      const data = await response.json()
      
      if (isRefresh) {
        setCampaigns(data.campaigns)
        setPage(1)
      } else {
        setCampaigns(prev => page === 1 ? data.campaigns : [...prev, ...data.campaigns])
      }
      
      setHasMore(data.pagination.page < data.pagination.totalPages)
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [workspaceId, filters, page])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/stats?workspaceId=${workspaceId}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      
      const statsData = await response.json()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchCampaigns()
    fetchStats()
  }, [fetchCampaigns, fetchStats])

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handleRefresh = () => {
    fetchCampaigns(true)
    fetchStats()
  }

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      setPage(prev => prev + 1)
    }
  }

  const handleCreateCampaign = async (campaignData: any) => {
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campaignData, workspaceId })
      })

      if (response.ok) {
        setIsCreateOpen(false)
        handleRefresh()
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
    }
  }

  const handleEditCampaign = async (campaign: Campaign, updates: any) => {
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        const updatedCampaign = await response.json()
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? updatedCampaign : c))
      }
    } catch (error) {
      console.error('Error updating campaign:', error)
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId))
        if (selectedCampaign?.id === campaignId) {
          setSelectedCampaign(null)
        }
        fetchStats()
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
    }
  }

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    const duplicateData = {
      ...campaign,
      name: `${campaign.name} (Copy)`,
      status: CampaignStatus.DRAFT,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined
    }

    await handleCreateCampaign(duplicateData)
  }

  const handleToggleStatus = async (campaignId: string, status: CampaignStatus) => {
    const campaign = campaigns.find(c => c.id === campaignId)
    if (campaign) {
      await handleEditCampaign(campaign, { status })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED': return 'bg-purple-100 text-purple-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Campaign Management
            </h1>
            <p className="text-sm text-muted-foreground">
              Create, manage, and track your marketing campaigns
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <CreateCampaignDialog
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            onCreate={handleCreateCampaign}
            workspaceId={workspaceId}
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </CreateCampaignDialog>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && <CampaignStats stats={stats} />}

      {/* Main Content */}
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="abtesting">A/B Testing</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar with Filters */}
            <div className="lg:col-span-1">
              <CampaignFilters 
                filters={filters}
                onFiltersChange={handleFilterChange}
                workspaceId={workspaceId}
              />
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-4">
              {/* Search and Quick Actions */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campaigns..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
                    className="pl-9"
                  />
                </div>
                <Select 
                  value={filters.status.length === 1 ? filters.status[0] : ''} 
                  onValueChange={(value) => handleFilterChange({ 
                    ...filters, 
                    status: value ? [value as CampaignStatus] : [] 
                  })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campaigns Grid */}
              {isLoading && campaigns.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading campaigns...</p>
                  </div>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first campaign to get started
                    </p>
                    <Button onClick={() => setIsCreateOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Campaign
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {campaigns.map((campaign) => (
                      <CampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        onEdit={(campaign) => handleEditCampaign(campaign, {})}
                        onDelete={handleDeleteCampaign}
                        onDuplicate={handleDuplicateCampaign}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))}
                  </div>
                  
                  {hasMore && (
                    <div className="text-center">
                      <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Other Tabs */}
        <TabsContent value="analytics">
          <CampaignAnalytics workspaceId={workspaceId} campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="abtesting">
          <ABTestingDashboard workspaceId={workspaceId} campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetManagement workspaceId={workspaceId} campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="reporting">
          <CampaignReporting workspaceId={workspaceId} campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="templates">
          <CampaignTemplates workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}