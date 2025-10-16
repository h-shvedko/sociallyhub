'use client'

import { useState, useEffect } from 'react'
import {
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  MessageSquare,
  Eye,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  Send,
  RefreshCw,
  Filter,
  ChevronDown,
  FileText,
  Edit,
  Trash2,
  Archive
} from 'lucide-react'

interface Workflow {
  id: string
  articleId: string
  workflowType: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  requestedById: string
  assignedToId?: string
  reviewedById?: string
  proposedTitle?: string
  proposedContent?: string
  proposedExcerpt?: string
  proposedCategoryId?: string
  proposedTags?: string[]
  proposedSeoTitle?: string
  proposedSeoDescription?: string
  reviewComments?: string
  reviewedAt?: string
  approvedAt?: string
  rejectedAt?: string
  createdAt: string
  updatedAt: string
  article: {
    id: string
    title: string
    slug: string
    status: string
  }
  requestedBy: {
    id: string
    name: string
    email: string
    image?: string
  }
  assignedTo?: {
    id: string
    name: string
    email: string
    image?: string
  }
  reviewedBy?: {
    id: string
    name: string
    email: string
    image?: string
  }
}

interface PublishingWorkflowProps {
  className?: string
  onWorkflowUpdate?: () => void
}

export default function PublishingWorkflow({ className = '', onWorkflowUpdate }: PublishingWorkflowProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [reviewComments, setReviewComments] = useState('')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)

  const [filters, setFilters] = useState({
    status: '',
    workflowType: '',
    assignedToId: ''
  })

  useEffect(() => {
    fetchWorkflows()
  }, [filters])

  const fetchWorkflows = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.workflowType) params.append('workflowType', filters.workflowType)
      if (filters.assignedToId) params.append('assignedToId', filters.assignedToId)

      const response = await fetch(`/api/admin/help/workflows?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch workflows')
      }

      const data = await response.json()
      setWorkflows(data.workflows || [])
      setStats(data.stats || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflows')
      console.error('Error fetching workflows:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWorkflowAction = async (workflowId: string, action: 'assign' | 'approve' | 'reject', data?: any) => {
    try {
      setIsProcessing(workflowId)
      setError(null)

      const response = await fetch(`/api/admin/help/workflows/${workflowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          ...data
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${action} workflow`)
      }

      const result = await response.json()

      // Refresh workflows
      await fetchWorkflows()

      if (onWorkflowUpdate) {
        onWorkflowUpdate()
      }

      // Close modals
      setShowReviewModal(false)
      setSelectedWorkflow(null)
      setReviewComments('')
      setReviewAction(null)

      alert(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} workflow`)
      console.error(`Error ${action}ing workflow:`, err)
    } finally {
      setIsProcessing(null)
    }
  }

  const openReviewModal = (workflow: Workflow, action: 'approve' | 'reject') => {
    setSelectedWorkflow(workflow)
    setReviewAction(action)
    setShowReviewModal(true)
    setReviewComments('')
  }

  const submitReview = () => {
    if (!selectedWorkflow || !reviewAction) return

    handleWorkflowAction(selectedWorkflow.id, reviewAction, {
      reviewComments: reviewComments.trim() || undefined
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getWorkflowTypeIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <FileText className="h-4 w-4 text-blue-500" />
      case 'update':
        return <Edit className="h-4 w-4 text-orange-500" />
      case 'publish':
        return <Send className="h-4 w-4 text-green-500" />
      case 'archive':
        return <Archive className="h-4 w-4 text-gray-500" />
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-500" />
      default:
        return <GitBranch className="h-4 w-4 text-gray-500" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' at ' + new Date(dateString).toLocaleTimeString()
  }

  const getTimeDifference = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.round(diffMs / 3600000)
    const diffDays = Math.round(diffMs / 86400000)

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    }
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <GitBranch className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Publishing Workflow</h3>
          </div>
          <button
            onClick={fetchWorkflows}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-yellow-600">{stats.pending || 0}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">{stats.approved || 0}</div>
            <div className="text-sm text-gray-600">Approved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-600">{stats.rejected || 0}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">{stats.completed || 0}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={filters.workflowType}
            onChange={(e) => setFilters(prev => ({ ...prev, workflowType: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Types</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="publish">Publish</option>
            <option value="archive">Archive</option>
            <option value="delete">Delete</option>
          </select>

          <button
            onClick={() => setFilters({ status: '', workflowType: '', assignedToId: '' })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Workflows List */}
      <div className="divide-y divide-gray-200">
        {workflows.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <GitBranch className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-500">No workflows found</p>
          </div>
        ) : (
          workflows.map((workflow) => (
            <div key={workflow.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center space-x-3 mb-2">
                    {getWorkflowTypeIcon(workflow.workflowType)}
                    <h4 className="font-medium text-gray-900">
                      {workflow.workflowType.charAt(0).toUpperCase() + workflow.workflowType.slice(1)} Request
                    </h4>
                    {getStatusBadge(workflow.status)}
                  </div>

                  {/* Article Info */}
                  <div className="mb-2">
                    <p className="text-sm text-gray-600">
                      Article: <span className="font-medium text-gray-900">{workflow.article.title}</span>
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <span className="flex items-center">
                      <User className="h-4 w-4 mr-1" />
                      Requested by {workflow.requestedBy.name}
                    </span>
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {getTimeDifference(workflow.createdAt)}
                    </span>
                    {workflow.assignedTo && (
                      <span className="flex items-center">
                        <UserCheck className="h-4 w-4 mr-1" />
                        Assigned to {workflow.assignedTo.name}
                      </span>
                    )}
                  </div>

                  {/* Review Comments */}
                  {workflow.reviewComments && (
                    <div className="mb-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center mb-1">
                          <MessageSquare className="h-4 w-4 text-gray-500 mr-1" />
                          <span className="text-sm font-medium text-gray-700">Review Comments</span>
                          {workflow.reviewedBy && (
                            <span className="text-xs text-gray-500 ml-2">
                              by {workflow.reviewedBy.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{workflow.reviewComments}</p>
                      </div>
                    </div>
                  )}

                  {/* Proposed Changes Preview */}
                  {workflow.workflowType === 'update' && workflow.proposedTitle && (
                    <div className="mb-3">
                      <details className="group">
                        <summary className="flex items-center cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          <ChevronDown className="h-4 w-4 mr-1 group-open:rotate-180 transition-transform" />
                          View proposed changes
                        </summary>
                        <div className="mt-2 pl-5 space-y-2 text-sm">
                          {workflow.proposedTitle && (
                            <div>
                              <span className="font-medium text-gray-700">Title:</span>
                              <span className="ml-2 text-gray-600">{workflow.proposedTitle}</span>
                            </div>
                          )}
                          {workflow.proposedExcerpt && (
                            <div>
                              <span className="font-medium text-gray-700">Excerpt:</span>
                              <span className="ml-2 text-gray-600">{workflow.proposedExcerpt}</span>
                            </div>
                          )}
                          {workflow.proposedTags && workflow.proposedTags.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700">Tags:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {workflow.proposedTags.map((tag, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {workflow.status === 'pending' && (
                    <>
                      <button
                        onClick={() => openReviewModal(workflow, 'approve')}
                        disabled={isProcessing === workflow.id}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        <ThumbsUp className="h-3 w-3 mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => openReviewModal(workflow, 'reject')}
                        disabled={isProcessing === workflow.id}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        Reject
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setSelectedWorkflow(workflow)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedWorkflow && reviewAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Workflow
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Article: <span className="font-medium">{selectedWorkflow.article.title}</span>
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Type: <span className="font-medium">{selectedWorkflow.workflowType}</span>
              </p>
              <p className="text-sm text-gray-600">
                Requested by: <span className="font-medium">{selectedWorkflow.requestedBy.name}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Comments {reviewAction === 'reject' ? '(Required)' : '(Optional)'}
              </label>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder={`Explain why you are ${reviewAction === 'approve' ? 'approving' : 'rejecting'} this workflow...`}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setSelectedWorkflow(null)
                  setReviewComments('')
                  setReviewAction(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={reviewAction === 'reject' && !reviewComments.trim()}
                className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md disabled:opacity-50 ${
                  reviewAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Details Modal */}
      {selectedWorkflow && !showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Workflow Details</h3>
              <button
                onClick={() => setSelectedWorkflow(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Type</h4>
                  <p className="text-sm text-gray-900 capitalize">{selectedWorkflow.workflowType}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Status</h4>
                  <div className="mt-1">{getStatusBadge(selectedWorkflow.status)}</div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Requested By</h4>
                  <p className="text-sm text-gray-900">{selectedWorkflow.requestedBy.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Created</h4>
                  <p className="text-sm text-gray-900">{formatDate(selectedWorkflow.createdAt)}</p>
                </div>
              </div>

              {/* Article Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Article</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{selectedWorkflow.article.title}</p>
                  <p className="text-sm text-gray-600">Status: {selectedWorkflow.article.status}</p>
                </div>
              </div>

              {/* Proposed Changes */}
              {selectedWorkflow.workflowType === 'update' && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Proposed Changes</h4>
                  <div className="space-y-3">
                    {selectedWorkflow.proposedTitle && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Title:</span>
                        <p className="text-sm text-gray-900 mt-1">{selectedWorkflow.proposedTitle}</p>
                      </div>
                    )}
                    {selectedWorkflow.proposedContent && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Content:</span>
                        <div className="text-sm text-gray-900 mt-1 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                          {selectedWorkflow.proposedContent.replace(/<[^>]*>/g, '').substring(0, 500)}
                          {selectedWorkflow.proposedContent.length > 500 && '...'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Review Info */}
              {selectedWorkflow.reviewComments && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Review</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900">{selectedWorkflow.reviewComments}</p>
                    {selectedWorkflow.reviewedBy && (
                      <p className="text-xs text-gray-500 mt-2">
                        Reviewed by {selectedWorkflow.reviewedBy.name} on{' '}
                        {selectedWorkflow.reviewedAt && formatDate(selectedWorkflow.reviewedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}