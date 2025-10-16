'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  FileText,
  Calendar,
  TrendingUp,
  Users,
  BarChart3,
  Settings,
  Download,
  Upload
} from 'lucide-react'

interface Article {
  id: string
  title: string
  slug: string
  excerpt?: string
  status: 'draft' | 'published' | 'archived'
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  publishedAt?: string
  updatedAt: string
  category: {
    id: string
    name: string
    slug: string
  }
  author?: {
    id: string
    name: string
    email: string
    image?: string
  }
  _count: {
    comments: number
    bookmarks: number
    revisions: number
    workflows: number
    media: number
  }
}

interface ArticleStats {
  published: number
  draft: number
  archived: number
}

interface FilterState {
  search: string
  category: string
  status: string
  author: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export default function ArticlesAdminPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<Article[]>([])
  const [stats, setStats] = useState<ArticleStats>({ published: 0, draft: 0, archived: 0 })
  const [categories, setCategories] = useState<any[]>([])
  const [authors, setAuthors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    status: '',
    author: '',
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  })

  // Fetch articles
  const fetchArticles = async (page = 1, resetList = false) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        limit: '20',
        offset: ((page - 1) * 20).toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      })

      if (filters.search) params.append('search', filters.search)
      if (filters.category) params.append('categoryId', filters.category)
      if (filters.status) params.append('status', filters.status)
      if (filters.author) params.append('authorId', filters.author)

      const response = await fetch(`/api/admin/help/articles?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch articles')
      }

      const data = await response.json()

      if (resetList || page === 1) {
        setArticles(data.articles)
      } else {
        setArticles(prev => [...prev, ...data.articles])
      }

      setStats(data.stats)
      setHasMore(data.hasMore)
      setTotalPages(Math.ceil(data.total / 20))
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch articles')
      console.error('Error fetching articles:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch categories and authors for filters
  const fetchFilterData = async () => {
    try {
      const [categoriesRes, authorsRes] = await Promise.all([
        fetch('/api/admin/help/categories'),
        fetch('/api/help/authors')
      ])

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json()
        setCategories(categoriesData.categories || [])
      }

      if (authorsRes.ok) {
        const authorsData = await authorsRes.json()
        setAuthors(authorsData.authors || [])
      }
    } catch (err) {
      console.error('Error fetching filter data:', err)
    }
  }

  useEffect(() => {
    fetchArticles(1, true)
  }, [filters])

  useEffect(() => {
    fetchFilterData()
  }, [])

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setSelectedArticles([])
  }

  // Handle article selection
  const handleArticleSelect = (articleId: string) => {
    setSelectedArticles(prev =>
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    )
  }

  const handleSelectAll = () => {
    if (selectedArticles.length === articles.length) {
      setSelectedArticles([])
    } else {
      setSelectedArticles(articles.map(article => article.id))
    }
  }

  // Bulk operations
  const handleBulkOperation = async (operation: string, updateData?: any) => {
    if (selectedArticles.length === 0) return

    try {
      const response = await fetch('/api/admin/help/articles/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation,
          articleIds: selectedArticles,
          updateData
        })
      })

      if (!response.ok) {
        throw new Error('Failed to perform bulk operation')
      }

      // Refresh articles
      await fetchArticles(1, true)
      setSelectedArticles([])
    } catch (err) {
      console.error('Error performing bulk operation:', err)
      setError(err instanceof Error ? err.message : 'Failed to perform bulk operation')
    }
  }

  // Navigate to article editor
  const handleCreateArticle = () => {
    router.push('/dashboard/admin/content/articles/new')
  }

  const handleEditArticle = (articleId: string) => {
    router.push(`/dashboard/admin/content/articles/edit/${articleId}`)
  }

  const handleViewArticle = (slug: string) => {
    window.open(`/dashboard/help/articles/${slug}`, '_blank')
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      published: 'bg-green-100 text-green-800',
      draft: 'bg-yellow-100 text-yellow-800',
      archived: 'bg-gray-100 text-gray-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading && articles.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Help Articles</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage help documentation and knowledge base articles
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            <button
              onClick={handleCreateArticle}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Articles</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.published + stats.draft + stats.archived}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Published</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.published}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <Edit className="h-8 w-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Drafts</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.draft}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Archived</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.archived}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search articles..."
                  className="pl-9 w-full border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <select
                value={filters.author}
                onChange={(e) => handleFilterChange('author', e.target.value)}
                className="w-full border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Authors</option>
                {authors.map(author => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <div className="flex space-x-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="updatedAt">Updated</option>
                  <option value="publishedAt">Published</option>
                  <option value="title">Title</option>
                  <option value="views">Views</option>
                </select>
                <button
                  onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  {filters.sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedArticles.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedArticles.length} article{selectedArticles.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkOperation('publish')}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Publish
              </button>
              <button
                onClick={() => handleBulkOperation('unpublish')}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              >
                Unpublish
              </button>
              <button
                onClick={() => handleBulkOperation('archive')}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Articles Table */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedArticles.length === articles.length && articles.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedArticles.includes(article.id)}
                      onChange={() => handleArticleSelect(article.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {article.title}
                        </p>
                        {article.excerpt && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {article.excerpt}
                          </p>
                        )}
                        <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                          {article.author && (
                            <span>By {article.author.name}</span>
                          )}
                          <span>{article._count.revisions} revision{article._count.revisions !== 1 ? 's' : ''}</span>
                          <span>{article._count.comments} comment{article._count.comments !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {article.category.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(article.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="space-y-1">
                      <div>{article.views.toLocaleString()} views</div>
                      <div>
                        {article.helpfulVotes + article.notHelpfulVotes > 0 && (
                          <span className="text-green-600">
                            {Math.round((article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100)}% helpful
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="space-y-1">
                      <div>{formatDate(article.updatedAt)}</div>
                      {article.publishedAt && (
                        <div className="text-xs">Published {formatDate(article.publishedAt)}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewArticle(article.slug)}
                        className="text-gray-400 hover:text-gray-600"
                        title="View Article"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditArticle(article.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit Article"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          // TODO: Add delete confirmation modal
                          console.log('Delete article:', article.id)
                        }}
                        className="text-red-600 hover:text-red-900"
                        title="Archive Article"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => fetchArticles(currentPage + 1)}
              disabled={loading}
              className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              {loading ? 'Loading...' : 'Load More Articles'}
            </button>
          </div>
        )}

        {articles.length === 0 && !loading && (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No articles found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first help article.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreateArticle}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}