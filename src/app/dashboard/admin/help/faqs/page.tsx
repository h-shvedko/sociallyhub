'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  HelpCircle,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  BarChart3,
  Wand2,
  RefreshCw,
  Settings,
  FileText,
  Lightbulb
} from 'lucide-react'
import FAQList from '@/components/admin/help/faq/FAQList'
import FAQEditor from '@/components/admin/help/faq/FAQEditor'
import FAQAnalytics from '@/components/admin/help/faq/FAQAnalytics'
import FAQImportExport from '@/components/admin/help/faq/FAQImportExport'
import FAQTemplates from '@/components/admin/help/faq/FAQTemplates'
import FAQAutoGeneration from '@/components/admin/help/faq/FAQAutoGeneration'

interface FAQ {
  id: string
  question: string
  answer: string
  category: {
    id: string
    name: string
    slug: string
  }
  tags: string[]
  sortOrder: number
  isActive: boolean
  isPinned: boolean
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  helpfulnessRate?: string
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Stats {
  total: number
  active: number
  inactive: number
  categories: number
}

export default function FAQManagementPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, categories: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [sortBy, setSortBy] = useState('sortOrder')
  const [sortOrder, setSortOrder] = useState('asc')

  // UI states
  const [activeTab, setActiveTab] = useState('faqs')
  const [showEditor, setShowEditor] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [showImportExport, setShowImportExport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAutoGeneration, setShowAutoGeneration] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 25

  useEffect(() => {
    fetchFAQs()
    fetchCategories()
  }, [currentPage, searchQuery, selectedCategory, selectedStatus, sortBy, sortOrder])

  const fetchFAQs = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedStatus && { status: selectedStatus }),
        sortBy,
        sortOrder
      })

      const response = await fetch(`/api/admin/help/faqs?${params}`)
      if (!response.ok) throw new Error('Failed to fetch FAQs')

      const data = await response.json()
      setFaqs(data.faqs || [])
      setStats(data.stats || { total: 0, active: 0, inactive: 0, categories: 0 })
      setTotalPages(data.pagination?.pages || 1)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch FAQs')
      console.error('Error fetching FAQs:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/help/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')

      const data = await response.json()
      setCategories(data.categories || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const handleCreateFAQ = () => {
    setEditingFaq(null)
    setShowEditor(true)
  }

  const handleEditFAQ = (faq: FAQ) => {
    setEditingFaq(faq)
    setShowEditor(true)
  }

  const handleSaveFAQ = async (faqData: any) => {
    try {
      const url = editingFaq
        ? `/api/admin/help/faqs/${editingFaq.id}`
        : '/api/admin/help/faqs'

      const response = await fetch(url, {
        method: editingFaq ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(faqData)
      })

      if (!response.ok) throw new Error('Failed to save FAQ')

      await fetchFAQs()
      setShowEditor(false)
      setEditingFaq(null)

    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to save FAQ')
    }
  }

  const handleDeleteFAQ = async (faqId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return

    try {
      const response = await fetch(`/api/admin/help/faqs/${faqId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete FAQ')

      await fetchFAQs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete FAQ')
    }
  }

  const handleBulkAction = async (action: string, faqIds: string[], data?: any) => {
    try {
      const response = await fetch('/api/admin/help/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_update',
          faqIds,
          data
        })
      })

      if (!response.ok) throw new Error('Failed to perform bulk action')

      await fetchFAQs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to perform bulk action')
    }
  }

  const handleReorder = async (updates: Array<{ id: string; sortOrder: number }>) => {
    try {
      const response = await fetch('/api/admin/help/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          data: { updates }
        })
      })

      if (!response.ok) throw new Error('Failed to reorder FAQs')

      await fetchFAQs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reorder FAQs')
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedStatus('')
    setSortBy('sortOrder')
    setSortOrder('asc')
    setCurrentPage(1)
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FAQ Management</h1>
            <p className="text-gray-600">Manage frequently asked questions and knowledge base</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAutoGeneration(true)}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-Generate
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowTemplates(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowImportExport(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import/Export
          </Button>

          <Button onClick={handleCreateFAQ}>
            <Plus className="h-4 w-4 mr-2" />
            New FAQ
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total FAQs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <HelpCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inactive</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <p className="text-2xl font-bold text-purple-600">{stats.categories}</p>
            </div>
            <Settings className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg border">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-6 py-4">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
              <TabsTrigger value="faqs">
                <HelpCircle className="h-4 w-4 mr-2" />
                FAQs
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="faqs" className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [field, order] = value.split('-')
                setSortBy(field)
                setSortOrder(order)
              }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sortOrder-asc">Order (A-Z)</SelectItem>
                  <SelectItem value="sortOrder-desc">Order (Z-A)</SelectItem>
                  <SelectItem value="views-desc">Most Viewed</SelectItem>
                  <SelectItem value="helpfulVotes-desc">Most Helpful</SelectItem>
                  <SelectItem value="updatedAt-desc">Recently Updated</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Clear
              </Button>

              <Button variant="outline" onClick={fetchFAQs}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* FAQ List */}
            <FAQList
              faqs={faqs}
              categories={categories}
              loading={loading}
              error={error}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              onEdit={handleEditFAQ}
              onDelete={handleDeleteFAQ}
              onBulkAction={handleBulkAction}
              onReorder={handleReorder}
            />
          </TabsContent>

          <TabsContent value="analytics" className="p-6">
            <FAQAnalytics />
          </TabsContent>

          <TabsContent value="settings" className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">FAQ Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Auto-approve FAQ updates</h4>
                      <p className="text-sm text-gray-600">Automatically approve FAQ changes from trusted editors</p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Enable FAQ analytics</h4>
                      <p className="text-sm text-gray-600">Track views, votes, and engagement for optimization</p>
                    </div>
                    <input type="checkbox" className="rounded" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Allow guest feedback</h4>
                      <p className="text-sm text-gray-600">Let non-authenticated users vote on FAQ helpfulness</p>
                    </div>
                    <input type="checkbox" className="rounded" defaultChecked />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {showEditor && (
        <FAQEditor
          faq={editingFaq}
          categories={categories}
          isOpen={showEditor}
          onClose={() => setShowEditor(false)}
          onSave={handleSaveFAQ}
        />
      )}

      {showImportExport && (
        <FAQImportExport
          isOpen={showImportExport}
          onClose={() => setShowImportExport(false)}
          onImportComplete={fetchFAQs}
        />
      )}

      {showTemplates && (
        <FAQTemplates
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          onUseTemplate={(template) => {
            setEditingFaq({
              id: '',
              question: '',
              answer: template.template,
              category: { id: '', name: '', slug: '' },
              tags: [],
              sortOrder: 0,
              isActive: true,
              isPinned: false,
              views: 0,
              helpfulVotes: 0,
              notHelpfulVotes: 0,
              createdAt: '',
              updatedAt: ''
            } as FAQ)
            setShowTemplates(false)
            setShowEditor(true)
          }}
        />
      )}

      {showAutoGeneration && (
        <FAQAutoGeneration
          isOpen={showAutoGeneration}
          onClose={() => setShowAutoGeneration(false)}
          categories={categories}
          onAcceptSuggestions={fetchFAQs}
        />
      )}
    </div>
  )
}