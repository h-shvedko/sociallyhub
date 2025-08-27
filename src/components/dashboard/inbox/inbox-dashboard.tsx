'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  Inbox, 
  Filter, 
  Search, 
  MessageCircle, 
  UserCheck, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Users,
  TrendingUp,
  MessageSquare,
  AtSign,
  Mail,
  Star,
  Reply,
  Archive,
  Trash2,
  RefreshCw,
  Settings
} from 'lucide-react'
import { InboxItem } from './inbox-item'
import { InboxFilters } from './inbox-filters'
import { InboxStats } from './inbox-stats'
import { ConversationView } from './conversation-view'
import { QuickReply } from './quick-reply'
import { SentimentAnalysis } from './sentiment-analysis'
import { AutomatedResponses } from './automated-responses'

interface InboxMessage {
  id: string
  workspaceId: string
  socialAccountId: string
  type: 'COMMENT' | 'MENTION' | 'DIRECT_MESSAGE' | 'REVIEW' | 'REPLY'
  providerThreadId?: string
  providerItemId: string
  content: string
  authorName?: string
  authorHandle?: string
  authorAvatar?: string
  sentiment?: string
  status: 'OPEN' | 'ASSIGNED' | 'SNOOZED' | 'CLOSED'
  assigneeId?: string
  tags: string[]
  internalNotes?: string
  slaBreachedAt?: string
  createdAt: string
  updatedAt: string
  socialAccount: {
    id: string
    provider: string
    handle: string
    displayName: string
  }
  assignee?: {
    id: string
    name: string
    image?: string
  }
  conversation?: {
    threadData: any
  }
}

interface InboxStats {
  overview: {
    totalItems: number
    openItems: number
    assignedItems: number
    snoozedItems: number
    closedItems: number
    recentActivity: number
  }
  breakdowns: {
    status: Record<string, number>
    type: Record<string, number>
    sentiment: Record<string, number>
  }
  metrics: {
    responseRate: number
    avgResponseTime: number | null
  }
}

export function InboxDashboard({ workspaceId }: { workspaceId: string }) {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [stats, setStats] = useState<InboxStats | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    assigneeId: '',
    socialAccountId: '',
    sentiment: '',
    search: ''
  })
  
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const fetchMessages = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      const params = new URLSearchParams({
        workspaceId,
        page: (isRefresh ? 1 : page).toString(),
        limit: '25',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value)
        )
      })

      const response = await fetch(`/api/inbox?${params}`)
      if (!response.ok) throw new Error('Failed to fetch messages')

      const data = await response.json()
      
      if (isRefresh) {
        setMessages(data.items)
        setPage(1)
      } else {
        setMessages(prev => page === 1 ? data.items : [...prev, ...data.items])
      }
      
      setHasMore(data.pagination.page < data.pagination.totalPages)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [workspaceId, filters, page])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/inbox/stats?workspaceId=${workspaceId}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      
      const statsData = await response.json()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchMessages()
    fetchStats()
  }, [fetchMessages, fetchStats])

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    setPage(1)
  }

  const handleRefresh = () => {
    fetchMessages(true)
    fetchStats()
  }

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      setPage(prev => prev + 1)
    }
  }

  const handleMessageSelect = (message: InboxMessage) => {
    setSelectedMessage(message)
  }

  const handleMessageUpdate = (updatedMessage: InboxMessage) => {
    setMessages(prev => prev.map(msg => 
      msg.id === updatedMessage.id ? updatedMessage : msg
    ))
    
    if (selectedMessage?.id === updatedMessage.id) {
      setSelectedMessage(updatedMessage)
    }
    
    // Refresh stats after message update
    fetchStats()
  }

  const handleBulkAction = async (action: string, messageIds: string[]) => {
    try {
      // Implement bulk actions (assign, close, snooze, etc.)
      await Promise.all(
        messageIds.map(id => 
          fetch(`/api/inbox/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: action })
          })
        )
      )
      
      handleRefresh()
    } catch (error) {
      console.error('Error performing bulk action:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Inbox className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Social Media Inbox
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage messages, comments, and mentions across all platforms
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
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && <InboxStats stats={stats} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar with Filters */}
        <div className="lg:col-span-1 space-y-4">
          <InboxFilters 
            filters={filters} 
            onFiltersChange={handleFilterChange}
            workspaceId={workspaceId}
          />
          
          {/* Automated Responses */}
          <AutomatedResponses workspaceId={workspaceId} />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Quick Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={filters.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          {/* Messages List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Messages</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {stats?.overview.totalItems || 0} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No messages found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      No messages match your current filters
                    </p>
                    <Button variant="outline" onClick={() => setFilters({
                      status: '', type: '', assigneeId: '', socialAccountId: '', sentiment: '', search: ''
                    })}>
                      Clear Filters
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {messages.map((message, index) => (
                    <InboxItem
                      key={message.id}
                      message={message}
                      isSelected={selectedMessage?.id === message.id}
                      onClick={() => handleMessageSelect(message)}
                      onUpdate={handleMessageUpdate}
                    />
                  ))}
                  
                  {hasMore && (
                    <div className="p-4 text-center">
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
            </CardContent>
          </Card>
        </div>

        {/* Conversation View */}
        <div className="lg:col-span-1">
          {selectedMessage ? (
            <div className="space-y-4 sticky top-4">
              <ConversationView 
                message={selectedMessage}
                onUpdate={handleMessageUpdate}
              />
              <QuickReply 
                message={selectedMessage}
                onReply={(success) => {
                  if (success) {
                    handleMessageUpdate({
                      ...selectedMessage,
                      status: 'CLOSED' as const,
                      updatedAt: new Date().toISOString()
                    })
                  }
                }}
              />
              <SentimentAnalysis message={selectedMessage} />
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No message selected</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a message to view the conversation
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}