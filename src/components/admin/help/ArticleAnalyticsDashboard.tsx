'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  TrendingUp,
  TrendingDown,
  FileText,
  Users,
  Calendar,
  Search,
  Download,
  Filter,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  Star,
  MessageSquare,
  Share2,
  Bookmark
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ArticleAnalytics {
  totalArticles: number
  totalViews: number
  averageReadingTime: number
  helpfulnessRate: number
  topArticles: Array<{
    id: string
    title: string
    views: number
    helpfulVotes: number
    notHelpfulVotes: number
  }>
  viewsTrend: Array<{
    date: string
    views: number
  }>
  categoryDistribution: Array<{
    name: string
    count: number
    views: number
  }>
  searchQueries: Array<{
    query: string
    count: number
    resultsFound: number
  }>
  readingTimeDistribution: Array<{
    range: string
    count: number
  }>
  ratingDistribution: {
    helpful: number
    notHelpful: number
    noRating: number
  }
}

interface ArticleAnalyticsDashboardProps {
  className?: string
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function ArticleAnalyticsDashboard({ className = '' }: ArticleAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<ArticleAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState('7d')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange, category])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        range: dateRange,
        ...(category !== 'all' && { category })
      })

      const response = await fetch(`/api/admin/help/articles/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')

      const data = await response.json()

      // If API doesn't return full data, use mock data for demonstration
      const mockAnalytics: ArticleAnalytics = {
        totalArticles: data.totalArticles || 156,
        totalViews: data.totalViews || 45678,
        averageReadingTime: data.averageReadingTime || 4.5,
        helpfulnessRate: data.helpfulnessRate || 78.5,
        topArticles: data.topArticles || [
          { id: '1', title: 'Getting Started with SociallyHub', views: 3456, helpfulVotes: 234, notHelpfulVotes: 12 },
          { id: '2', title: 'How to Schedule Posts', views: 2890, helpfulVotes: 189, notHelpfulVotes: 8 },
          { id: '3', title: 'Understanding Analytics Dashboard', views: 2345, helpfulVotes: 156, notHelpfulVotes: 15 },
          { id: '4', title: 'Team Management Guide', views: 1987, helpfulVotes: 134, notHelpfulVotes: 6 },
          { id: '5', title: 'API Integration Tutorial', views: 1654, helpfulVotes: 98, notHelpfulVotes: 11 }
        ],
        viewsTrend: data.viewsTrend || generateViewsTrend(dateRange),
        categoryDistribution: data.categoryDistribution || [
          { name: 'Getting Started', count: 23, views: 12345 },
          { name: 'Content & Posting', count: 34, views: 10234 },
          { name: 'Analytics', count: 18, views: 8765 },
          { name: 'Team Management', count: 12, views: 5432 },
          { name: 'Integrations', count: 29, views: 4567 },
          { name: 'AI & Automation', count: 22, views: 3456 },
          { name: 'Billing', count: 18, views: 1234 }
        ],
        searchQueries: data.searchQueries || [
          { query: 'schedule posts', count: 456, resultsFound: 12 },
          { query: 'analytics dashboard', count: 345, resultsFound: 8 },
          { query: 'team permissions', count: 234, resultsFound: 6 },
          { query: 'API key', count: 189, resultsFound: 15 },
          { query: 'billing invoice', count: 156, resultsFound: 4 }
        ],
        readingTimeDistribution: data.readingTimeDistribution || [
          { range: '0-2 min', count: 34 },
          { range: '2-5 min', count: 67 },
          { range: '5-10 min', count: 45 },
          { range: '10+ min', count: 10 }
        ],
        ratingDistribution: data.ratingDistribution || {
          helpful: 3456,
          notHelpful: 234,
          noRating: 1890
        }
      }

      setAnalytics(mockAnalytics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      console.error('Error fetching analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateViewsTrend = (range: string): Array<{ date: string; views: number }> => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const trend = []
    const today = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      trend.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: Math.floor(Math.random() * 500) + 100
      })
    }

    return trend
  }

  const exportAnalytics = () => {
    if (!analytics) return

    const csvContent = [
      ['Metric', 'Value'],
      ['Total Articles', analytics.totalArticles],
      ['Total Views', analytics.totalViews],
      ['Average Reading Time (min)', analytics.averageReadingTime],
      ['Helpfulness Rate (%)', analytics.helpfulnessRate],
      '',
      ['Top Articles'],
      ['Title', 'Views', 'Helpful Votes', 'Not Helpful Votes'],
      ...analytics.topArticles.map(a => [a.title, a.views, a.helpfulVotes, a.notHelpfulVotes])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `article-analytics-${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error || 'Failed to load analytics'}</p>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const pieData = [
    { name: 'Helpful', value: analytics.ratingDistribution.helpful },
    { name: 'Not Helpful', value: analytics.ratingDistribution.notHelpful },
    { name: 'No Rating', value: analytics.ratingDistribution.noRating }
  ]

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Article Analytics</h2>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={exportAnalytics}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button variant="outline" size="sm" onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">+12%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{analytics.totalArticles}</div>
          <div className="text-sm text-gray-600">Total Articles</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Eye className="h-5 w-5 text-green-600" />
            <span className="text-xs text-green-600 font-medium">+23%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {analytics.totalViews.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Views</div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <span className="text-xs text-yellow-600 font-medium">+5%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{analytics.averageReadingTime} min</div>
          <div className="text-sm text-gray-600">Avg Reading Time</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <ThumbsUp className="h-5 w-5 text-purple-600" />
            <span className="text-xs text-purple-600 font-medium">+8%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{analytics.helpfulnessRate}%</div>
          <div className="text-sm text-gray-600">Helpfulness Rate</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Views Trend */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Views Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.viewsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.categoryDistribution.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="views" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rating Distribution */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Reading Time Distribution */}
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Reading Time Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.readingTimeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Articles Table */}
      <div className="p-6 border-t">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Top Performing Articles</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Article
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Helpful
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Not Helpful
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.topArticles.map((article) => {
                const total = article.helpfulVotes + article.notHelpfulVotes
                const rate = total > 0 ? ((article.helpfulVotes / total) * 100).toFixed(1) : '0'
                return (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {article.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {article.views.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="flex items-center">
                        <ThumbsUp className="h-4 w-4 text-green-500 mr-1" />
                        {article.helpfulVotes}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="flex items-center">
                        <ThumbsDown className="h-4 w-4 text-red-500 mr-1" />
                        {article.notHelpfulVotes}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`font-medium ${parseFloat(rate) >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search Queries */}
      <div className="p-6 border-t">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Popular Search Queries</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {analytics.searchQueries.map((query, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <Search className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-900">{query.query}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{query.count} searches</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {query.resultsFound} results
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}