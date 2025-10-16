'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  User,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  CheckCircle,
  Edit,
  Send,
  Eye,
  EyeOff,
  Save,
  MoreHorizontal,
  Calendar,
  Tag,
  Mail,
  Phone,
  Building
} from 'lucide-react'

interface TicketDetail {
  ticket: {
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
    guestPhone?: string
    assignedAgentId?: string
    assignedAt?: string
    firstResponseAt?: string
    expectedResponseBy?: string
    slaBreached: boolean
    tags: string[]
    resolution?: string
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
      user: {
        image?: string
      }
    }
    workspace?: {
      id: string
      name: string
    }
    updates: Array<{
      id: string
      updateType: string
      message?: string
      oldStatus?: string
      newStatus?: string
      oldPriority?: string
      newPriority?: string
      oldAssignee?: string
      newAssignee?: string
      authorId?: string
      authorType: string
      authorName?: string
      isPublic: boolean
      isResolution: boolean
      createdAt: string
    }>
    attachments: Array<{
      id: string
      filename: string
      originalName: string
      fileSize: number
      mimeType: string
      fileUrl: string
      uploadedBy?: string
      uploadedByType: string
      uploadedByName?: string
      createdAt: string
    }>
    notes: Array<{
      id: string
      content: string
      isInternal: boolean
      tags: string[]
      createdAt: string
      agent: {
        id: string
        displayName: string
        title: string
        department: string
        user: {
          image?: string
        }
      }
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

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<TicketDetail['ticket'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('updates')

  // Edit states
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    priority: '',
    status: '',
    assignedAgentId: '',
    tags: [] as string[],
    resolution: ''
  })

  // Reply state
  const [replyData, setReplyData] = useState({
    message: '',
    isPublic: true,
    isResolution: false,
    updateStatus: '',
    updatePriority: ''
  })

  // Note state
  const [noteData, setNoteData] = useState({
    content: '',
    tags: [] as string[],
    isInternal: true
  })

  const [submitting, setSubmitting] = useState(false)

  // Fetch ticket details
  const fetchTicket = async () => {
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`)
      if (!response.ok) throw new Error('Failed to fetch ticket')

      const data: TicketDetail = await response.json()
      setTicket(data.ticket)

      // Initialize edit data
      setEditData({
        title: data.ticket.title,
        description: data.ticket.description,
        priority: data.ticket.priority,
        status: data.ticket.status,
        assignedAgentId: data.ticket.assignedAgentId || '',
        tags: data.ticket.tags,
        resolution: data.ticket.resolution || ''
      })
    } catch (error) {
      console.error('Error fetching ticket:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update ticket
  const handleUpdate = async () => {
    if (!ticket) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      if (!response.ok) throw new Error('Failed to update ticket')

      await fetchTicket()
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating ticket:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Add reply
  const handleReply = async () => {
    if (!replyData.message.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyData)
      })

      if (!response.ok) throw new Error('Failed to add reply')

      await fetchTicket()
      setReplyData({
        message: '',
        isPublic: true,
        isResolution: false,
        updateStatus: '',
        updatePriority: ''
      })
    } catch (error) {
      console.error('Error adding reply:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Add note
  const handleNote = async () => {
    if (!noteData.content.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      })

      if (!response.ok) throw new Error('Failed to add note')

      await fetchTicket()
      setNoteData({
        content: '',
        tags: [],
        isInternal: true
      })
    } catch (error) {
      console.error('Error adding note:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Format dates
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  useEffect(() => {
    fetchTicket()
  }, [ticketId])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h1>
          <p className="text-gray-600 mb-4">The ticket you're looking for doesn't exist.</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 mr-4">
                {ticket.ticketNumber}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]}`}>
                {ticket.priority}
              </span>
              {ticket.slaBreached && (
                <div className="ml-2 flex items-center text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">SLA Breached</span>
                </div>
              )}
            </div>
            <p className="text-gray-600 mt-1">{ticket.title}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Edit className="w-4 h-4 mr-2" />
            {isEditing ? 'Cancel' : 'Edit'}
          </button>

          {isEditing && (
            <button
              onClick={handleUpdate}
              disabled={submitting}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Ticket Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Details */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Ticket Details</h3>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={editData.priority}
                        onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="PENDING">Pending</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="prose max-w-none">
                  <p className="text-gray-700">{ticket.description}</p>

                  {ticket.resolution && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                      <h4 className="text-sm font-medium text-green-800 mb-2">Resolution</h4>
                      <p className="text-sm text-green-700">{ticket.resolution}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              {ticket.tags.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {ticket.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'updates', label: 'Updates', count: ticket.updates.length },
                    { id: 'notes', label: 'Internal Notes', count: ticket.notes.length },
                    { id: 'attachments', label: 'Attachments', count: ticket.attachments.length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className="ml-2 bg-gray-100 text-gray-900 rounded-full px-2.5 py-0.5 text-xs">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Updates Tab */}
              {activeTab === 'updates' && (
                <div className="space-y-6">
                  {/* Add Reply */}
                  <div className="border-b border-gray-200 pb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Add Response</h4>
                    <div className="space-y-3">
                      <textarea
                        value={replyData.message}
                        onChange={(e) => setReplyData({ ...replyData, message: e.target.value })}
                        placeholder="Type your response..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={replyData.isPublic}
                              onChange={(e) => setReplyData({ ...replyData, isPublic: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              {replyData.isPublic ? <Eye className="inline w-4 h-4 mr-1" /> : <EyeOff className="inline w-4 h-4 mr-1" />}
                              {replyData.isPublic ? 'Public (visible to user)' : 'Internal only'}
                            </span>
                          </label>

                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={replyData.isResolution}
                              onChange={(e) => setReplyData({ ...replyData, isResolution: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Mark as resolution</span>
                          </label>
                        </div>

                        <button
                          onClick={handleReply}
                          disabled={submitting || !replyData.message.trim()}
                          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {submitting ? 'Sending...' : 'Send Response'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Updates List */}
                  <div className="space-y-4">
                    {ticket.updates.map((update) => (
                      <div key={update.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            {update.updateType === 'REPLY' ? (
                              <MessageSquare className="w-4 h-4 text-gray-600" />
                            ) : update.updateType === 'RESOLUTION' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900">
                                {update.authorName || 'System'}
                              </p>
                              <span className="text-xs text-gray-500">
                                {update.authorType}
                              </span>
                              {!update.isPublic && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Internal
                                </span>
                              )}
                              {update.isResolution && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Resolution
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {formatDate(update.createdAt)}
                            </p>
                          </div>
                          {update.message && (
                            <div className="mt-1 text-sm text-gray-700">
                              {update.message}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === 'notes' && (
                <div className="space-y-6">
                  {/* Add Note */}
                  <div className="border-b border-gray-200 pb-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Add Internal Note</h4>
                    <div className="space-y-3">
                      <textarea
                        value={noteData.content}
                        onChange={(e) => setNoteData({ ...noteData, content: e.target.value })}
                        placeholder="Add internal note..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />

                      <div className="flex justify-end">
                        <button
                          onClick={handleNote}
                          disabled={submitting || !noteData.content.trim()}
                          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {submitting ? 'Adding...' : 'Add Note'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-4">
                    {ticket.notes.map((note) => (
                      <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900">
                              {note.agent.displayName}
                            </p>
                            <span className="text-xs text-gray-500">
                              {note.agent.department}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatDate(note.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700">{note.content}</p>
                        {note.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {note.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments Tab */}
              {activeTab === 'attachments' && (
                <div className="space-y-4">
                  {ticket.attachments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No attachments</p>
                  ) : (
                    ticket.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Paperclip className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {attachment.originalName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(attachment.fileSize)} • {formatDate(attachment.createdAt)}
                            </p>
                          </div>
                        </div>
                        <a
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Download
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>

              {ticket.user ? (
                <div className="space-y-3">
                  <div className="flex items-center">
                    {ticket.user.image ? (
                      <img src={ticket.user.image} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{ticket.user.name}</p>
                      <p className="text-sm text-gray-500">Registered User</p>
                    </div>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    <a href={`mailto:${ticket.user.email}`} className="hover:text-blue-600">
                      {ticket.user.email}
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {ticket.guestName || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-500">Guest User</p>
                    </div>
                  </div>

                  {ticket.guestEmail && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="w-4 h-4 mr-2" />
                      <a href={`mailto:${ticket.guestEmail}`} className="hover:text-blue-600">
                        {ticket.guestEmail}
                      </a>
                    </div>
                  )}

                  {ticket.guestPhone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      <a href={`tel:${ticket.guestPhone}`} className="hover:text-blue-600">
                        {ticket.guestPhone}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {ticket.workspace && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center text-sm text-gray-600">
                    <Building className="w-4 h-4 mr-2" />
                    <span>{ticket.workspace.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment</h3>

              {ticket.assignedAgent ? (
                <div className="space-y-3">
                  <div className="flex items-center">
                    {ticket.assignedAgent.user.image ? (
                      <img src={ticket.assignedAgent.user.image} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">
                          {ticket.assignedAgent.displayName}
                        </p>
                        <div className={`ml-2 w-2 h-2 rounded-full ${ticket.assignedAgent.isOnline ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                      </div>
                      <p className="text-sm text-gray-500">{ticket.assignedAgent.title}</p>
                      <p className="text-xs text-gray-400">{ticket.assignedAgent.department}</p>
                    </div>
                  </div>

                  {ticket.assignedAt && (
                    <div className="text-xs text-gray-500">
                      Assigned {formatDate(ticket.assignedAt)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No agent assigned</p>
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Assign Agent
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category:</span>
                  <span className="text-gray-900">{ticket.category}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="text-gray-900">{ticket.type}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-gray-900">{formatDate(ticket.createdAt)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Last Updated:</span>
                  <span className="text-gray-900">{formatDate(ticket.updatedAt)}</span>
                </div>

                {ticket.firstResponseAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">First Response:</span>
                    <span className="text-gray-900">{formatDate(ticket.firstResponseAt)}</span>
                  </div>
                )}

                {ticket.resolvedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Resolved:</span>
                    <span className="text-gray-900">{formatDate(ticket.resolvedAt)}</span>
                  </div>
                )}

                {ticket.expectedResponseBy && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">SLA Deadline:</span>
                    <span className={`${ticket.slaBreached ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatDate(ticket.expectedResponseBy)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}