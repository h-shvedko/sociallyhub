'use client'

import { useState, useEffect } from 'react'
import {
  History,
  Eye,
  RotateCcw,
  Calendar,
  User,
  FileText,
  Clock,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  GitBranch,
  Activity,
  RefreshCw
} from 'lucide-react'

interface ArticleRevision {
  id: string
  articleId: string
  version: number
  title: string
  content: string
  excerpt?: string
  categoryId: string
  tags: string[]
  status: string
  seoTitle?: string
  seoDescription?: string
  changeSummary?: string
  authorId?: string
  createdAt: string
  author?: {
    id: string
    name: string
    email: string
    image?: string
  }
}

interface VersionControlProps {
  articleId: string
  onRestore?: (revision: ArticleRevision) => void
  className?: string
}

export default function VersionControl({ articleId, onRestore, className = '' }: VersionControlProps) {
  const [revisions, setRevisions] = useState<ArticleRevision[]>([])
  const [selectedRevisions, setSelectedRevisions] = useState<[ArticleRevision | null, ArticleRevision | null]>([null, null])
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRestoring, setIsRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    fetchRevisions()
  }, [articleId])

  const fetchRevisions = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/help/articles/${articleId}/revisions`)
      if (!response.ok) {
        throw new Error('Failed to fetch revisions')
      }

      const data = await response.json()
      setRevisions(data.revisions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch revisions')
      console.error('Error fetching revisions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (revision: ArticleRevision) => {
    if (!confirm(`Are you sure you want to restore to version ${revision.version}? This will create a new revision with the restored content.`)) {
      return
    }

    try {
      setIsRestoring(revision.id)
      setError(null)

      const response = await fetch(`/api/admin/help/articles/${articleId}/revisions/${revision.id}`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to restore revision')
      }

      const result = await response.json()

      // Refresh revisions list
      await fetchRevisions()

      if (onRestore) {
        onRestore(revision)
      }

      alert(`Successfully restored to version ${revision.version}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore revision')
      console.error('Error restoring revision:', err)
    } finally {
      setIsRestoring(null)
    }
  }

  const toggleRevisionSelection = (revision: ArticleRevision) => {
    setSelectedRevisions(prev => {
      if (prev[0]?.id === revision.id) {
        return [null, prev[1]]
      } else if (prev[1]?.id === revision.id) {
        return [prev[0], null]
      } else if (!prev[0]) {
        return [revision, prev[1]]
      } else if (!prev[1]) {
        return [prev[0], revision]
      } else {
        // Replace the first selection
        return [revision, prev[1]]
      }
    })
  }

  const clearSelection = () => {
    setSelectedRevisions([null, null])
    setShowDiff(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString()
  }

  const getTimeDifference = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / 60000)
    const diffHours = Math.round(diffMs / 3600000)
    const diffDays = Math.round(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    }
  }

  const createSimpleDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n')
    const newLines = newText.split('\n')
    const maxLines = Math.max(oldLines.length, newLines.length)

    const diff = []
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || ''
      const newLine = newLines[i] || ''

      if (oldLine !== newLine) {
        if (oldLine && newLine) {
          diff.push({ type: 'modified', old: oldLine, new: newLine, lineNum: i + 1 })
        } else if (oldLine) {
          diff.push({ type: 'removed', content: oldLine, lineNum: i + 1 })
        } else {
          diff.push({ type: 'added', content: newLine, lineNum: i + 1 })
        }
      } else if (oldLine) {
        diff.push({ type: 'unchanged', content: oldLine, lineNum: i + 1 })
      }
    }

    return diff
  }

  const renderDiffView = () => {
    if (!selectedRevisions[0] || !selectedRevisions[1]) return null

    const [older, newer] = selectedRevisions[0].version < selectedRevisions[1].version
      ? [selectedRevisions[0], selectedRevisions[1]]
      : [selectedRevisions[1], selectedRevisions[0]]

    const titleDiff = createSimpleDiff(older.title, newer.title)
    const contentDiff = createSimpleDiff(older.content, newer.content)

    return (
      <div className="border rounded-lg bg-white">
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Compare Versions {older.version} ↔ {newer.version}
            </h3>
            <button
              onClick={() => setShowDiff(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(older.createdAt)}
            </span>
            <span>→</span>
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {formatDate(newer.createdAt)}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Title Diff */}
          {older.title !== newer.title && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Title Changes</h4>
              <div className="space-y-1">
                <div className="flex items-center text-sm">
                  <span className="w-12 text-red-600 font-mono">-</span>
                  <span className="bg-red-50 text-red-800 px-2 py-1 rounded flex-1">{older.title}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="w-12 text-green-600 font-mono">+</span>
                  <span className="bg-green-50 text-green-800 px-2 py-1 rounded flex-1">{newer.title}</span>
                </div>
              </div>
            </div>
          )}

          {/* Content Diff */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Content Changes</h4>
            <div className="border rounded max-h-96 overflow-y-auto">
              {contentDiff.slice(0, 50).map((line, index) => (
                <div
                  key={index}
                  className={`flex text-sm font-mono ${
                    line.type === 'added' ? 'bg-green-50' :
                    line.type === 'removed' ? 'bg-red-50' :
                    line.type === 'modified' ? 'bg-yellow-50' :
                    'bg-white'
                  }`}
                >
                  <span className="w-12 px-2 py-1 text-gray-500 text-right border-r bg-gray-50">
                    {line.lineNum}
                  </span>
                  <span className={`w-8 px-2 py-1 text-center ${
                    line.type === 'added' ? 'text-green-600' :
                    line.type === 'removed' ? 'text-red-600' :
                    line.type === 'modified' ? 'text-yellow-600' :
                    'text-gray-400'
                  }`}>
                    {line.type === 'added' ? '+' :
                     line.type === 'removed' ? '-' :
                     line.type === 'modified' ? '~' : ' '}
                  </span>
                  <span className="flex-1 px-2 py-1">
                    {'content' in line ? line.content :
                     'old' in line ? (
                       <>
                         <span className="bg-red-200">{line.old}</span>
                         <span className="mx-1">→</span>
                         <span className="bg-green-200">{line.new}</span>
                       </>
                     ) : ''}
                  </span>
                </div>
              ))}
              {contentDiff.length > 50 && (
                <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 text-center">
                  ... and {contentDiff.length - 50} more changes
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
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
            <History className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Version History</h3>
            <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
              {revisions.length} revision{revisions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {selectedRevisions.filter(Boolean).length === 2 && (
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                {showDiff ? 'Hide Diff' : 'Compare'}
              </button>
            )}
            {selectedRevisions.some(Boolean) && (
              <button
                onClick={clearSelection}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Clear Selection
              </button>
            )}
            <button
              onClick={fetchRevisions}
              className="p-2 text-gray-400 hover:text-gray-600"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {selectedRevisions.filter(Boolean).length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            {selectedRevisions.filter(Boolean).length === 1 && 'Select another revision to compare'}
            {selectedRevisions.filter(Boolean).length === 2 && 'Two revisions selected for comparison'}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Diff View */}
      {showDiff && selectedRevisions.filter(Boolean).length === 2 && (
        <div className="p-4 border-b border-gray-200">
          {renderDiffView()}
        </div>
      )}

      {/* Revisions List */}
      <div className="divide-y divide-gray-200">
        {revisions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <History className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-gray-500">No revision history available</p>
          </div>
        ) : (
          revisions.map((revision, index) => {
            const isSelected = selectedRevisions.some(selected => selected?.id === revision.id)
            const isExpanded = expandedRevision === revision.id
            const isLatest = index === 0

            return (
              <div
                key={revision.id}
                className={`p-4 hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      {/* Selection Checkbox */}
                      <button
                        onClick={() => toggleRevisionSelection(revision)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>

                      {/* Version Info */}
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          Version {revision.version}
                        </span>
                        {isLatest && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Current
                          </span>
                        )}
                      </div>

                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => setExpandedRevision(isExpanded ? null : revision.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Basic Info */}
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                      {revision.author && (
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {revision.author.name}
                        </span>
                      )}
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {getTimeDifference(revision.createdAt)}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(revision.createdAt)}
                      </span>
                    </div>

                    {/* Change Summary */}
                    {revision.changeSummary && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                          <Activity className="h-3 w-3 mr-1" />
                          {revision.changeSummary}
                        </span>
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3 pl-7 border-l-2 border-gray-200">
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Title</h4>
                          <p className="text-sm text-gray-600 mt-1">{revision.title}</p>
                        </div>

                        {revision.excerpt && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Excerpt</h4>
                            <p className="text-sm text-gray-600 mt-1">{revision.excerpt}</p>
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Content Preview</h4>
                          <div className="text-sm text-gray-600 mt-1 max-h-32 overflow-y-auto bg-gray-50 p-2 rounded">
                            {revision.content.replace(/<[^>]*>/g, '').substring(0, 300)}
                            {revision.content.length > 300 && '...'}
                          </div>
                        </div>

                        {revision.tags && revision.tags.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Tags</h4>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {revision.tags.map((tag, tagIndex) => (
                                <span
                                  key={tagIndex}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center space-x-2 pt-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            revision.status === 'published'
                              ? 'bg-green-100 text-green-800'
                              : revision.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {revision.status.charAt(0).toUpperCase() + revision.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {!isLatest && (
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleRestore(revision)}
                        disabled={isRestoring === revision.id}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isRestoring === revision.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}