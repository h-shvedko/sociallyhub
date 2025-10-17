'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  Filter,
  FileText,
  Edit,
  Eye,
  Trash2,
  MoreHorizontal,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  Archive,
  Download,
  Share,
  Code,
  History,
  MessageSquare,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'
import DocumentationEditor from '@/components/documentation/documentation-editor'

interface DocumentationPage {
  id: string
  title: string
  slug: string
  excerpt?: string
  tags: string[]
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'
  visibility: 'PUBLIC' | 'INTERNAL' | 'PRIVATE'
  views: number
  helpfulVotes: number
  estimatedReadTime?: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
  section: {
    id: string
    title: string
    slug: string
    icon?: string
  }
  author: {
    id: string
    name: string
    email: string
  }
  _count: {
    versions: number
    comments: number
    collaborators: number
  }
}

interface DocumentationSection {
  id: string
  title: string
  slug: string
  icon?: string
}

interface PageStats {
  total: number
  byStatus: Record<string, number>
}

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', color: 'bg-gray-500', icon: Edit },
  REVIEW: { label: 'Review', color: 'bg-yellow-500', icon: AlertCircle },
  PUBLISHED: { label: 'Published', color: 'bg-green-500', icon: CheckCircle },
  ARCHIVED: { label: 'Archived', color: 'bg-red-500', icon: Archive }
}

const VISIBILITY_CONFIG = {
  PUBLIC: { label: 'Public', color: 'bg-blue-500' },
  INTERNAL: { label: 'Internal', color: 'bg-purple-500' },
  PRIVATE: { label: 'Private', color: 'bg-gray-500' }
}

export default function DocumentationManagePage() {
  const router = useRouter()

  // State
  const [pages, setPages] = useState<DocumentationPage[]>([])
  const [sections, setSections] = useState<DocumentationSection[]>([])
  const [stats, setStats] = useState<PageStats>({ total: 0, byStatus: {} })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [showEditor, setShowEditor] = useState(false)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null)

  // Load data
  useEffect(() => {
    loadPages()
    loadSections()
  }, [statusFilter, sectionFilter, searchQuery])

  const loadPages = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (sectionFilter !== 'all') params.append('sectionSlug', sectionFilter)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())

      const response = await fetch(`/api/documentation/manage?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPages(data.pages || [])
        setStats(data.stats || { total: 0, byStatus: {} })
      } else {
        throw new Error('Failed to load pages')
      }
    } catch (error) {
      console.error('Failed to load pages:', error)
      toast.error('Failed to load documentation pages')
    } finally {
      setLoading(false)
    }
  }

  const loadSections = async () => {
    try {
      const response = await fetch('/api/documentation/sections')
      if (response.ok) {
        const data = await response.json()
        setSections(data)
      }
    } catch (error) {
      console.error('Failed to load sections:', error)
    }
  }

  // Actions
  const handleCreatePage = () => {
    setEditingPageId(null)
    setShowEditor(true)
  }

  const handleEditPage = (pageId: string) => {
    setEditingPageId(pageId)
    setShowEditor(true)
  }

  const handleDeletePage = async (pageId: string) => {
    try {
      const response = await fetch(`/api/documentation/manage/${pageId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Page deleted successfully')
        loadPages()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete page')
      }
    } catch (error) {
      console.error('Failed to delete page:', error)
      toast.error('Failed to delete page')
    }
    setDeletingPageId(null)
  }

  const handleViewPage = (slug: string) => {
    window.open(`/dashboard/documentation/${slug}`, '_blank')
  }

  const handlePublishPage = async (pageId: string) => {
    try {
      const response = await fetch(`/api/documentation/manage/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' })
      })

      if (response.ok) {
        toast.success('Page published successfully')
        loadPages()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to publish page')
      }
    } catch (error) {
      console.error('Failed to publish page:', error)
      toast.error('Failed to publish page')
    }
  }

  const handleEditorSave = () => {
    setShowEditor(false)
    setEditingPageId(null)
    loadPages()
  }

  const handleEditorCancel = () => {
    setShowEditor(false)
    setEditingPageId(null)
  }

  if (showEditor) {
    return (
      <DocumentationEditor
        pageId={editingPageId || undefined}
        mode={editingPageId ? 'edit' : 'create'}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documentation Management</h1>
          <p className="text-muted-foreground">
            Create, edit, and manage your documentation pages
          </p>
        </div>
        <Button onClick={handleCreatePage}>
          <Plus className="h-4 w-4 mr-2" />
          Create Page
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pages</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <Card key={status}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
                  <p className="text-2xl font-bold">{stats.byStatus[status.toLowerCase()] || 0}</p>
                </div>
                <div className={`h-8 w-8 rounded-full ${config.color} flex items-center justify-center`}>
                  <config.icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pages by title, content, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <SelectItem key={status} value={status.toLowerCase()}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.slug}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pages List */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pages found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || sectionFilter !== 'all'
                  ? 'No pages match your current filters'
                  : 'Get started by creating your first documentation page'
                }
              </p>
              {(!searchQuery && statusFilter === 'all' && sectionFilter === 'all') && (
                <Button onClick={handleCreatePage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Page
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => {
                const statusConfig = STATUS_CONFIG[page.status]
                const visibilityConfig = VISIBILITY_CONFIG[page.visibility]

                return (
                  <div key={page.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg truncate">{page.title}</h3>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${visibilityConfig.color}`} />
                            {visibilityConfig.label}
                          </Badge>
                        </div>

                        {page.excerpt && (
                          <p className="text-muted-foreground mb-2 line-clamp-2">{page.excerpt}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {page.section.title}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {page.views} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {page.estimatedReadTime || 1} min read
                          </span>
                          <span className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            {page._count.versions} versions
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {page._count.comments} comments
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {page._count.collaborators} collaborators
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>By {page.author.name}</span>
                          <span>•</span>
                          <span>Updated {new Date(page.updatedAt).toLocaleDateString()}</span>
                          {page.publishedAt && (
                            <>
                              <span>•</span>
                              <span>Published {new Date(page.publishedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>

                        {page.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {page.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {page.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{page.tags.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button size="sm" variant="outline" onClick={() => handleViewPage(page.slug)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditPage(page.id)}>
                          <Edit className="h-3 w-3" />
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {page.status !== 'PUBLISHED' && (
                              <DropdownMenuItem onClick={() => handlePublishPage(page.id)}>
                                <CheckCircle className="h-3 w-3 mr-2" />
                                Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleViewPage(page.slug)}>
                              <Eye className="h-3 w-3 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/dashboard/documentation/${page.slug}`)}>
                              <Share className="h-3 w-3 mr-2" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeletingPageId(page.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPageId} onOpenChange={() => setDeletingPageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Documentation Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this documentation page? This action cannot be undone.
              All versions, comments, and related data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPageId && handleDeletePage(deletingPageId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}