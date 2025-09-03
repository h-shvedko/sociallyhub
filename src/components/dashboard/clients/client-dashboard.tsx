'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Search,
  Filter,
  Download,
  BarChart3,
  TrendingUp,
  DollarSign,
  Clock,
  Star,
  Building,
  Mail,
  Phone,
  RefreshCw,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserPlus
} from 'lucide-react'
import { 
  Client, 
  ClientStatus, 
  OnboardingStatus, 
  ClientStats,
  ServiceLevel
} from '@/types/client'
import { ClientCard } from './client-card'
import { ClientStats as ClientStatsComponent } from './client-stats'
import { ClientFilters } from './client-filters'
import { ClientOnboardingFlow } from './client-onboarding-flow'

interface ClientDashboardProps {
  workspaceId: string
}

export function ClientDashboard({ workspaceId }: ClientDashboardProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState<ClientStats | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Load data from API endpoints

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        
        // Load clients and stats in parallel
        const [clientsResponse, statsResponse] = await Promise.all([
          fetch(`/api/clients?workspaceId=${encodeURIComponent(workspaceId)}`),
          fetch(`/api/clients/stats?workspaceId=${encodeURIComponent(workspaceId)}`)
        ])

        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json()
          setClients(clientsData.clients || [])
        }

        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }
      } catch (error) {
        console.error('Error loading client data:', error)
        // Set empty data on error
        setClients([])
        setStats(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [workspaceId])

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case ClientStatus.ACTIVE:
        return 'bg-green-100 text-green-800'
      case ClientStatus.PROSPECT:
        return 'bg-blue-100 text-blue-800'
      case ClientStatus.ON_HOLD:
        return 'bg-yellow-100 text-yellow-800'
      case ClientStatus.CHURNED:
        return 'bg-red-100 text-red-800'
      case ClientStatus.ARCHIVED:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getOnboardingColor = (status: OnboardingStatus) => {
    switch (status) {
      case OnboardingStatus.COMPLETED:
        return 'bg-green-100 text-green-800'
      case OnboardingStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800'
      case OnboardingStatus.STALLED:
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (showOnboarding) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setShowOnboarding(false)}
          >
            ← Back to Clients
          </Button>
        </div>
        <ClientOnboardingFlow 
          onComplete={(client) => {
            setShowOnboarding(false)
            // Refresh data to show the new client
            window.location.reload()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">
            Manage your clients, track progress, and monitor relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowOnboarding(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && <ClientStatsComponent stats={stats} />}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="prospects">Prospects</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients by name, company, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value={ClientStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={ClientStatus.PROSPECT}>Prospect</SelectItem>
                    <SelectItem value={ClientStatus.ON_HOLD}>On Hold</SelectItem>
                    <SelectItem value={ClientStatus.CHURNED}>Churned</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {showFilters && (
            <ClientFilters 
              onFiltersChange={() => {}} 
              onClose={() => setShowFilters(false)}
            />
          )}

          {/* Client List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                        <div className="flex justify-between">
                          <div className="h-3 bg-muted rounded w-1/6"></div>
                          <div className="h-3 bg-muted rounded w-1/6"></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredClients.map((client) => (
                  <ClientCard 
                    key={client.id} 
                    client={client} 
                    onView={(client) => setSelectedClient(client)}
                    onEdit={(client) => console.log('Edit:', client)}
                    onDelete={(client) => console.log('Delete:', client)}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No clients found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Try adjusting your search or filters'
                        : 'Get started by adding your first client'
                      }
                    </p>
                    <Button onClick={() => setShowOnboarding(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add First Client
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {filteredClients
              .filter(client => client.status === ClientStatus.ACTIVE)
              .map((client) => (
                <ClientCard 
                  key={client.id} 
                  client={client}
                  onView={(client) => setSelectedClient(client)}
                  onEdit={(client) => console.log('Edit:', client)}
                  onDelete={(client) => console.log('Delete:', client)}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="prospects" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {filteredClients
              .filter(client => client.status === ClientStatus.PROSPECT)
              .map((client) => (
                <ClientCard 
                  key={client.id} 
                  client={client}
                  onView={(client) => setSelectedClient(client)}
                  onEdit={(client) => console.log('Edit:', client)}
                  onDelete={(client) => console.log('Delete:', client)}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {filteredClients
              .filter(client => 
                client.onboardingStatus === OnboardingStatus.IN_PROGRESS ||
                client.onboardingStatus === OnboardingStatus.STALLED ||
                client.onboardingStatus === OnboardingStatus.NOT_STARTED
              )
              .map((client) => (
                <ClientCard 
                  key={client.id} 
                  client={client}
                  showOnboardingStatus={true}
                  onView={(client) => setSelectedClient(client)}
                  onEdit={(client) => console.log('Edit:', client)}
                  onDelete={(client) => console.log('Delete:', client)}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-2" />
                <p>Billing management interface would be implemented here</p>
                <p className="text-xs">Integration with payment processors and invoice generation</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                <p>Client reporting dashboard would be implemented here</p>
                <p className="text-xs">Performance reports, satisfaction surveys, and analytics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}