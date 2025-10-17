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
  HelpCircle,
  TrendingUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Search,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  Users,
  MessageSquare,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FAQAnalytics {
  overview: {
    totalFaqs: number
    activeFaqs: number
    totalViews: number
    averageHelpfulnessRate: number
    totalVotes: number
  }
  trends: {
    viewsTrend: Array<{
      date: string
      views: number
      interactions: number
    }>
    categoryDistribution: Array<{
      categoryId: string
      categoryName: string
      count: number
      views: number
      helpfulVotes: number
      notHelpfulVotes: number
    }>
    helpfulnessDistribution: {
      helpful: number
      neutral: number
      notHelpful: number
      noRating: number
    }
  }
  topPerforming: Array<{
    id: string
    question: string
    category: string
    views: number
    helpfulVotes: number
    notHelpfulVotes: number
    helpfulnessRate: string
    isPinned: boolean
  }>
  searchFrequency: Array<{
    query: string
    frequency: number
    faqMatches: number
  }>
  insights: {
    mostViewedCategory: string
    avgViewsPerFaq: number
    engagementRate: string
  }
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function FAQAnalytics() {
  const [analytics, setAnalytics] = useState<FAQAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState('30d')
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

      const response = await fetch(`/api/admin/help/faqs/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')

      const data = await response.json()
      setAnalytics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      console.error('Error fetching FAQ analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const exportAnalytics = () => {
    if (!analytics) return

    const csvContent = [
      ['Metric', 'Value'],
      ['Total FAQs', analytics.overview.totalFaqs],
      ['Active FAQs', analytics.overview.activeFaqs],
      ['Total Views', analytics.overview.totalViews],
      ['Average Helpfulness Rate (%)', analytics.overview.averageHelpfulnessRate],
      ['Total Votes', analytics.overview.totalVotes],
      '',
      ['Top Performing FAQs'],
      ['Question', 'Category', 'Views', 'Helpful Votes', 'Not Helpful Votes', 'Helpfulness Rate'],
      ...analytics.topPerforming.map(faq => [
        faq.question,
        faq.category,
        faq.views,
        faq.helpfulVotes,
        faq.notHelpfulVotes,
        faq.helpfulnessRate + '%'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faq-analytics-${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error || 'Failed to load analytics'}</p>
        <Button onClick={fetchAnalytics} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const helpfulnessData = [
    { name: 'Helpful', value: analytics.trends.helpfulnessDistribution.helpful, color: '#10B981' },
    { name: 'Neutral', value: analytics.trends.helpfulnessDistribution.neutral, color: '#F59E0B' },
    { name: 'Not Helpful', value: analytics.trends.helpfulnessDistribution.notHelpful, color: '#EF4444' },
    { name: 'No Rating', value: analytics.trends.helpfulnessDistribution.noRating, color: '#6B7280' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">FAQ Analytics</h2>
          <p className="text-sm text-gray-600">Insights into FAQ performance and user engagement</p>
        </div>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <span className="text-xs text-green-600 font-medium">+5%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{analytics.overview.totalFaqs}</div>
          <div className="text-sm text-gray-600">Total FAQs</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <Eye className="h-5 w-5 text-green-600" />
            <span className="text-xs text-green-600 font-medium">+12%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {analytics.overview.totalViews.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Views</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <ThumbsUp className="h-5 w-5 text-purple-600" />
            <span className="text-xs text-green-600 font-medium">+3%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {analytics.overview.averageHelpfulnessRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Helpfulness</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-orange-600" />
            <span className="text-xs text-green-600 font-medium">+8%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {analytics.insights.avgViewsPerFaq}
          </div>
          <div className="text-sm text-gray-600">Avg Views/FAQ</div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-5 w-5 text-red-600" />
            <span className="text-xs text-green-600 font-medium">+15%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {analytics.insights.engagementRate}%
          </div>
          <div className="text-sm text-gray-600">Engagement</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Trend */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Views & Interactions Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analytics.trends.viewsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#3B82F6"
                strokeWidth={2}
                name="Views"
              />
              <Line
                type="monotone"
                dataKey="interactions"
                stroke="#10B981"
                strokeWidth={2}
                name="Interactions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Views by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.trends.categoryDistribution.slice(0, 6)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoryName" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="views" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Helpfulness Distribution */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Helpfulness Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={helpfulnessData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {helpfulnessData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* FAQ Count by Category */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">FAQ Count by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.trends.categoryDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoryName" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performing FAQs */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-sm font-medium text-gray-900">Top Performing FAQs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Question
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Helpful
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Not Helpful
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.topPerforming.map((faq) => (
                <tr key={faq.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center">
                      {faq.isPinned && (
                        <div className="h-2 w-2 bg-yellow-400 rounded-full mr-2"></div>
                      )}
                      <span className="font-medium text-gray-900 truncate max-w-xs">
                        {faq.question}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {faq.category}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-center font-medium">
                    {faq.views.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="flex items-center justify-center text-green-600">
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      {faq.helpfulVotes}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="flex items-center justify-center text-red-600">
                      <ThumbsDown className="h-3 w-3 mr-1" />
                      {faq.notHelpfulVotes}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className={`font-medium ${
                      parseFloat(faq.helpfulnessRate) >= 70 ? 'text-green-600' :
                      parseFloat(faq.helpfulnessRate) >= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {faq.helpfulnessRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Search Frequency & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Frequency */}
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-medium text-gray-900">Popular Search Queries</h3>
          </div>
          <div className="p-6 space-y-3">
            {analytics.searchFrequency.map((query, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Search className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-sm font-medium text-gray-900">{query.query}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{query.frequency} searches</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {query.faqMatches} FAQs
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-medium text-gray-900">Key Insights</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start">
              <TrendingUp className="h-5 w-5 text-green-500 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Most Popular Category</p>
                <p className="text-sm text-gray-600">{analytics.insights.mostViewedCategory} generates the most engagement</p>
              </div>
            </div>

            <div className="flex items-start">
              <BarChart3 className="h-5 w-5 text-blue-500 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Average Performance</p>
                <p className="text-sm text-gray-600">
                  Each FAQ averages {analytics.insights.avgViewsPerFaq} views with {analytics.insights.engagementRate}% engagement
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-purple-500 mt-0.5 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Optimization Opportunity</p>
                <p className="text-sm text-gray-600">
                  {analytics.trends.helpfulnessDistribution.notHelpful} FAQs need content improvement
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800 font-medium">💡 Recommendation</p>
              <p className="text-xs text-blue-700 mt-1">
                Focus on improving FAQs with low helpfulness ratings and consider creating new FAQs for high-frequency search queries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}