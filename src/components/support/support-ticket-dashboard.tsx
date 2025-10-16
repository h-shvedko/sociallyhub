'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { CreateTicketDialog } from './create-ticket-dialog'
import {
  Ticket,
  Plus,
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  MessageCircle,
  Paperclip,
  Calendar,
  Tag,
  Building,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal
} from 'lucide-react'

interface SupportTicket {
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
  assignedAgent?: {
    id: string
    displayName: string
    title: string
    department: string
    isOnline: boolean
  }
  user?: {
    id: string
    name: string
    email: string
    image?: string
  }
  workspace?: {
    id: string
    name: string
  }
  tags: string[]
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  firstResponseAt?: string
  expectedResponseBy?: string
  slaBreached: boolean
  _count: {
    updates: number
    attachments: number
  }
}

interface SupportTicketDashboardProps {
  workspaceId?: string
}

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-yellow-100 text-yellow-700',
  URGENT: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700'
}

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  PENDING_USER: 'bg-orange-100 text-orange-700',
  PENDING_AGENT: 'bg-orange-100 text-orange-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700'
}

const STATUS_ICONS = {
  OPEN: AlertCircle,
  ASSIGNED: User,
  IN_PROGRESS: Clock,
  PENDING_USER: AlertCircle,
  PENDING_AGENT: AlertCircle,
  RESOLVED: CheckCircle,
  CLOSED: XCircle,
  CANCELLED: XCircle
}

export function SupportTicketDashboard({ workspaceId }: SupportTicketDashboardProps) {
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)

  const fetchTickets = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)

      const response = await fetch(`/api/support/tickets?${params}`)

      if (response.ok) {
        const data = await response.json()
        setTickets(data.tickets || [])
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, priorityFilter, categoryFilter])

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !searchTerm ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const handleTicketCreated = () => {
    fetchTickets()
    setIsCreateDialogOpen(false)
  }

  const openTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setIsDetailsDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const ticketCounts = {
    total: tickets.length,
    open: tickets.filter(t => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)).length,
    pending: tickets.filter(t => ['PENDING_USER', 'PENDING_AGENT'].includes(t.status)).length,
    resolved: tickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Support Tickets</h2>
          <p className="text-gray-600">Manage and track support requests</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ticketCounts.total}</p>
                <p className="text-sm text-gray-600">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ticketCounts.open}</p>
                <p className="text-sm text-gray-600">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ticketCounts.pending}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ticketCounts.resolved}</p>
                <p className="text-sm text-gray-600">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="PENDING_USER">Pending User</SelectItem>
                  <SelectItem value="PENDING_AGENT">Pending Agent</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="TECHNICAL">Technical</SelectItem>
                  <SelectItem value="BILLING">Billing</SelectItem>
                  <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                  <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
                  <SelectItem value="ACCOUNT">Account</SelectItem>
                  <SelectItem value="INTEGRATION">Integration</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                  <SelectItem value="SECURITY">Security</SelectItem>
                  <SelectItem value="PERFORMANCE">Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tickets found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No tickets match your current filters.'
                  : 'Create your first support ticket to get started.'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && priorityFilter === 'all' && categoryFilter === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Ticket
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => {
            const StatusIcon = STATUS_ICONS[ticket.status as keyof typeof STATUS_ICONS]

            return (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openTicketDetails(ticket)}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {ticket.ticketNumber}
                        </Badge>
                        <Badge className={PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}>
                          {ticket.priority}
                        </Badge>
                        <Badge className={STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                        {ticket.slaBreached && (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            SLA Breached
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold mb-2">{ticket.title}</h3>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{ticket.description}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Created {getTimeAgo(ticket.createdAt)}
                        </div>

                        {ticket.user ? (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {ticket.user.name}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {ticket.guestName}
                          </div>
                        )}

                        {ticket.assignedAgent && (
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${ticket.assignedAgent.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                            Assigned to {ticket.assignedAgent.displayName}
                          </div>
                        )}

                        {ticket._count.updates > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {ticket._count.updates} updates
                          </div>
                        )}

                        {ticket._count.attachments > 0 && (
                          <div className="flex items-center gap-1">
                            <Paperclip className="h-4 w-4" />
                            {ticket._count.attachments} files
                          </div>
                        )}
                      </div>

                      {ticket.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {ticket.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onTicketCreated={handleTicketCreated}
        workspaceId={workspaceId}
      />

      {/* Ticket Details Dialog */}
      {selectedTicket && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                {selectedTicket.ticketNumber} - {selectedTicket.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge className={STATUS_COLORS[selectedTicket.status as keyof typeof STATUS_COLORS]}>
                    {selectedTicket.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Priority</p>
                  <Badge className={PRIORITY_COLORS[selectedTicket.priority as keyof typeof PRIORITY_COLORS]}>
                    {selectedTicket.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Category</p>
                  <p className="text-sm">{selectedTicket.category}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Type</p>
                  <p className="text-sm">{selectedTicket.type}</p>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="font-medium mb-2">Contact Information</h4>
                {selectedTicket.user ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{selectedTicket.user.name}</p>
                      <p className="text-xs text-gray-600">{selectedTicket.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm"><span className="font-medium">Name:</span> {selectedTicket.guestName}</p>
                    <p className="text-sm"><span className="font-medium">Email:</span> {selectedTicket.guestEmail}</p>
                  </div>
                )}
              </div>

              {/* Assignment */}
              {selectedTicket.assignedAgent && (
                <div>
                  <h4 className="font-medium mb-2">Assigned Agent</h4>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${selectedTicket.assignedAgent.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{selectedTicket.assignedAgent.displayName}</p>
                      <p className="text-xs text-gray-600">{selectedTicket.assignedAgent.title} - {selectedTicket.assignedAgent.department}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedTicket.tags.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedTicket.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-600">Created</p>
                  <p>{formatDate(selectedTicket.createdAt)}</p>
                </div>
                {selectedTicket.resolvedAt && (
                  <div>
                    <p className="font-medium text-gray-600">Resolved</p>
                    <p>{formatDate(selectedTicket.resolvedAt)}</p>
                  </div>
                )}
                {selectedTicket.firstResponseAt && (
                  <div>
                    <p className="font-medium text-gray-600">First Response</p>
                    <p>{formatDate(selectedTicket.firstResponseAt)}</p>
                  </div>
                )}
                {selectedTicket.expectedResponseBy && (
                  <div>
                    <p className="font-medium text-gray-600">Expected Response By</p>
                    <p className={new Date(selectedTicket.expectedResponseBy) < new Date() ? 'text-red-600' : ''}>
                      {formatDate(selectedTicket.expectedResponseBy)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}