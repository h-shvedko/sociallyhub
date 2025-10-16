'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  Tag,
  Loader2,
  RefreshCw,
  Download,
  Archive
} from 'lucide-react'

interface Ticket {
  id: string
  ticketNumber: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  type: string
  guestName?: string
  guestEmail?: string
  assignedAgentId?: string
  assignedAt?: string
  firstResponseAt?: string
  expectedResponseBy?: string
  slaBreached: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  user?: {
    id: string
    name: string
    email: string
    image?: string
  }
  assignedAgent?: {
    id: string
    displayName: string
    title: string
    department: string
    isOnline: boolean
  }
  workspace?: {
    id: string
    name: string
  }
  _count: {
    updates: number
    attachments: number
    notes: number
  }
}

interface TicketResponse {
  tickets: Ticket[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  statistics: {
    byStatus: Array<{ status: string; _count: { status: number } }>
    byPriority: Array<{ priority: string; _count: { priority: number } }>
    byCategory: Array<{ category: string; _count: { category: number } }>
    agents: Array<{
      id: string
      displayName: string
      department: string
      isOnline: boolean
      currentChatCount: number
      _count: { assignedTickets: number }
    }>
  }
}

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-100 text-red-800'
}

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800'
}

export default function AdminTicketsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [statistics, setStatistics] = useState<TicketResponse['statistics'] | null>(null)
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  })
  const [loading, setLoading] = useState(true)
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Filter and sort state
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    assignedAgentId: searchParams.get('assignedAgentId') || '',
    department: searchParams.get('department') || '',
    timeRange: searchParams.get('timeRange') || '30d',
    sort: searchParams.get('sort') || 'createdAt',
    order: searchParams.get('order') || 'desc'
  })

  // Update URL when filters change
  const updateURL = useCallback((newFilters: typeof filters) => {
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      }
    })
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname])

  // Fetch tickets
  const fetchTickets = useCallback(async (offset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...filters,
        limit: pagination.limit.toString(),
        offset: offset.toString()
      })

      const response = await fetch(`/api/admin/support/tickets?${params}`)
      if (!response.ok) throw new Error('Failed to fetch tickets')

      const data: TicketResponse = await response.json()

      if (offset === 0) {
        setTickets(data.tickets)
      } else {
        setTickets(prev => [...prev, ...data.tickets])
      }

      setPagination(data.pagination)
      setStatistics(data.statistics)
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.limit])

  // Load more tickets
  const loadMore = () => {
    if (pagination.hasMore && !loading) {
      fetchTickets(pagination.offset + pagination.limit)
    }
  }

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    updateURL(newFilters)
  }

  // Handle bulk selection
  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedTickets(
      selectedTickets.length === tickets.length ? [] : tickets.map(t => t.id)
    )
  }

  // Format dates
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate time ago
  const timeAgo = (date: string) => {
    const now = new Date()
    const past = new Date(date)
    const diffInHours = (now.getTime() - past.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    return `${Math.floor(diffInDays / 7)}w ago`
  }

  // Initial load
  useEffect(() => {
    fetchTickets(0)
  }, [fetchTickets])

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-600 mt-1">
            Manage and respond to support requests
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchTickets(0)}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                <p className="text-lg font-semibold text-gray-900">
                  {statistics.byStatus.find(s => s.status === 'OPEN')?._count.status || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-lg font-semibold text-gray-900">
                  {statistics.byStatus.find(s => s.status === 'IN_PROGRESS')?._count.status || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-lg font-semibold text-gray-900">
                  {statistics.byStatus.find(s => s.status === 'RESOLVED')?._count.status || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Online Agents</p>
                <p className="text-lg font-semibold text-gray-900">
                  {statistics.agents.filter(a => a.isOnline).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Quick Filters */}
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>

              {/* Sort */}
              <div className="flex items-center">
                <select
                  value={`${filters.sort}-${filters.order}`}
                  onChange={(e) => {
                    const [sort, order] = e.target.value.split('-')
                    handleFilterChange('sort', sort)
                    handleFilterChange('order', order)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="updatedAt-desc">Recently Updated</option>
                  <option value="priority-desc">High Priority</option>
                  <option value="status-asc">Status</option>
                  <option value="ticketNumber-asc">Ticket Number</option>
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Categories</option>
                    <option value="GENERAL">General</option>
                    <option value="TECHNICAL">Technical</option>
                    <option value="BILLING">Billing</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="BUG_REPORT">Bug Report</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned Agent
                  </label>
                  <select
                    value={filters.assignedAgentId}
                    onChange={(e) => handleFilterChange('assignedAgentId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Agents</option>
                    <option value="unassigned">Unassigned</option>
                    {statistics?.agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.displayName} ({agent._count.assignedTickets})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <select
                    value={filters.department}
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Departments</option>
                    <option value="support">Support</option>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="sales">Sales</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Range
                  </label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1d">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedTickets.length > 0 && (
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-gray-700">
                  {selectedTickets.length} ticket{selectedTickets.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  Assign Agent
                </button>
                <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  Update Status
                </button>
                <button className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  Update Priority
                </button>
                <button className="px-3 py-1 text-sm font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && tickets.length === 0 ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No tickets found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTickets.length === tickets.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SLA
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/dashboard/admin/support/tickets/${ticket.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTickets.includes(ticket.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleTicketSelection(ticket.id)
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-blue-600 truncate">
                                {ticket.ticketNumber}
                              </p>
                              {ticket.slaBreached && (
                                <AlertTriangle className="ml-2 w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-900 font-medium mt-1 line-clamp-2">
                              {ticket.title}
                            </p>
                            <div className="flex items-center mt-2 text-xs text-gray-500">
                              <span>{ticket.category}</span>
                              {ticket.user ? (
                                <span className="ml-2">• {ticket.user.name}</span>
                              ) : ticket.guestName ? (
                                <span className="ml-2">• {ticket.guestName} (Guest)</span>
                              ) : null}
                              {ticket._count.updates > 0 && (
                                <span className="ml-2 flex items-center">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  {ticket._count.updates}
                                </span>
                              )}
                            </div>
                            {ticket.tags.length > 0 && (
                              <div className="flex items-center mt-2 space-x-1">
                                {ticket.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                  >
                                    <Tag className="w-3 h-3 mr-1" />
                                    {tag}
                                  </span>
                                ))}
                                {ticket.tags.length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{ticket.tags.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {ticket.assignedAgent ? (
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${ticket.assignedAgent.isOnline ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {ticket.assignedAgent.displayName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {ticket.assignedAgent.department}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          <div>
                            <p>{formatDate(ticket.createdAt)}</p>
                            <p className="text-xs text-gray-400">{timeAgo(ticket.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {ticket.slaBreached ? (
                          <div className="flex items-center text-red-600">
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">Breached</span>
                          </div>
                        ) : ticket.expectedResponseBy ? (
                          <div className="text-sm text-gray-500">
                            <Clock className="w-4 h-4 inline mr-1" />
                            {formatDate(ticket.expectedResponseBy)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No SLA</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/dashboard/admin/support/tickets/${ticket.id}`}
                            className="text-blue-600 hover:text-blue-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More */}
            {pagination.hasMore && (
              <div className="px-6 py-4 border-t border-gray-200">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Load More Tickets ({pagination.total - (pagination.offset + tickets.length)} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}