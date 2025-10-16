'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Book,
  MessageCircle,
  HelpCircle,
  Video,
  FileText,
  ExternalLink,
  ChevronRight,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  Lightbulb,
  Zap,
  Users,
  BarChart3,
  Calendar,
  Settings,
  Rocket,
  Edit,
  TrendingUp,
  Link,
  CreditCard,
  Shield,
  Cpu
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useDictionary } from '@/hooks/use-dictionary'
import { Skeleton } from '@/components/ui/skeleton'
import { AdvancedSearch } from './advanced-search'
import { LiveChatInterface } from '@/components/support/live-chat-interface'
import { VideoTutorialLibrary } from '@/components/video-tutorials/video-tutorial-library'
import { ArticleMetaBadges } from '@/components/help/recently-updated-badge'
import { EnhancedFAQSection } from '@/components/help/enhanced-faq-section'
import { CreateTicketDialog } from '@/components/support/create-ticket-dialog'

interface HelpCategory {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  articleCount?: number
  faqCount?: number
}

interface HelpArticle {
  id: string
  title: string
  slug: string
  excerpt?: string
  categoryId: string
  views: number
  helpfulVotes: number
  publishedAt: string
  category?: {
    name: string
    slug: string
  }
  author?: {
    name: string
  }
}


// Icon mapping for categories
const iconMap: Record<string, any> = {
  Rocket,
  Edit,
  TrendingUp,
  Users,
  Cpu,
  Link,
  CreditCard,
  Shield,
  Book
}

export function HelpCenter() {
  const { t, isLoading: dictLoading } = useDictionary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categories, setCategories] = useState<HelpCategory[]>([])
  const [authors, setAuthors] = useState<Array<{ id: string; name: string }>>([])
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [liveChatOpen, setLiveChatOpen] = useState(false)
  const [videoLibraryOpen, setVideoLibraryOpen] = useState(false)
  const [createTicketOpen, setCreateTicketOpen] = useState(false)
  const [supportStatus, setSupportStatus] = useState<{
    isAvailable: boolean
    onlineAgents: number
    averageResponseTime: string
  } | null>(null)

  // Fetch categories and authors
  useEffect(() => {
    fetchCategories()
    fetchAuthors()
    fetchSupportStatus()
  }, [])

  // Fetch articles and FAQs when category changes
  useEffect(() => {
    fetchContent()
  }, [selectedCategory])

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        performSearch()
      }, 500) // Increased debounce time for better UX
      return () => clearTimeout(timer)
    } else {
      setSearchResults(null)
      setSearchError(null)
      setSearchLoading(false)
    }
  }, [searchQuery, selectedCategory]) // Include selectedCategory to re-search when category changes

  const fetchCategories = async () => {
    setCategoriesLoading(true)
    setCategoryError(null)
    try {
      const response = await fetch('/api/help/categories?includeStats=true')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      } else {
        throw new Error(`Failed to fetch categories: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      setCategoryError('Failed to load categories. Please try again.')
    } finally {
      setCategoriesLoading(false)
    }
  }

  const fetchAuthors = async () => {
    try {
      const response = await fetch('/api/help/authors')
      if (response.ok) {
        const data = await response.json()
        setAuthors(data.authors || [])
      }
    } catch (error) {
      console.error('Failed to fetch authors:', error)
    }
  }

  const fetchSupportStatus = async () => {
    try {
      const response = await fetch('/api/support/agents/status')
      if (response.ok) {
        const data = await response.json()
        setSupportStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch support status:', error)
      // Set default offline status on error
      setSupportStatus({
        isAvailable: false,
        onlineAgents: 0,
        averageResponseTime: 'N/A'
      })
    }
  }

  const fetchContent = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch articles - FAQs are now handled by the EnhancedFAQSection component
      const articleParams = selectedCategory !== 'all'
        ? `?categorySlug=${selectedCategory}&limit=20`
        : '?limit=20'

      const articleResponse = await fetch(`/api/help/articles${articleParams}`)

      if (articleResponse.ok) {
        const data = await articleResponse.json()
        setArticles(data.articles || [])
      } else {
        console.error('Failed to fetch articles:', articleResponse.status)
        setError('Failed to load articles. Please try again.')
      }

      // Clear search results when category changes
      if (searchResults) {
        setSearchResults(null)
      }

    } catch (error) {
      console.error('Failed to fetch content:', error)
      setError('Failed to load content. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const performSearch = async () => {
    if (!searchQuery.trim()) return

    setSearchLoading(true)
    setSearchError(null)

    try {
      const params = new URLSearchParams({ q: searchQuery.trim() })
      if (selectedCategory !== 'all') {
        const category = categories.find(c => c.slug === selectedCategory)
        if (category) params.append('categoryId', category.id)
      }

      const response = await fetch(`/api/help/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        throw new Error(`Search failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchError('Search failed. Please try again.')
      setSearchResults(null)
    } finally {
      setSearchLoading(false)
    }
  }

  // Advanced search handler
  const handleAdvancedSearch = async (query: string, filters: any) => {
    setSearchLoading(true)
    setSearchError(null)
    setSearchQuery(query)

    try {
      const params = new URLSearchParams({ q: query.trim() })

      // Apply filters
      if (filters.type && filters.type !== 'all') {
        params.append('type', filters.type)
      }
      if (filters.categoryId) {
        params.append('categoryId', filters.categoryId)
      }
      if (filters.sortBy && filters.sortBy !== 'relevance') {
        params.append('sortBy', filters.sortBy)
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom)
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo)
      }
      if (filters.authorId) {
        params.append('authorId', filters.authorId)
      }

      const response = await fetch(`/api/help/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        throw new Error(`Search failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Advanced search failed:', error)
      setSearchError('Search failed. Please try again.')
      setSearchResults(null)
    } finally {
      setSearchLoading(false)
    }
  }

  // Build display categories with icons
  const displayCategories = [
    { id: 'all', slug: 'all', name: t('help.allTopics', 'All Topics'), icon: Book },
    ...categories.map(cat => ({
      ...cat,
      icon: iconMap[cat.icon || 'Book'] || Book
    }))
  ]

  // Use search results if searching, otherwise use fetched content
  const displayArticles = searchResults?.results?.articles || articles

  if (dictLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">{t('help.title', 'Help Center')}</h1>
        <p className="text-xl text-muted-foreground">
          {t('help.description', 'Get help, tutorials, and support for using SociallyHub effectively')}
        </p>
        
        {/* Advanced Search */}
        <div className="max-w-5xl mx-auto">
          <AdvancedSearch
            onSearch={handleAdvancedSearch}
            categories={categories}
            authors={authors}
            loading={searchLoading}
            searchError={searchError}
          />
          {searchResults && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Found {searchResults.counts?.total || 0} results for "{searchResults.query}"
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => window.location.href = '/dashboard/documentation'}
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Book className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold">{t('help.documentation', 'Documentation')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('help.documentationDescription', 'Comprehensive guides and API documentation')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setLiveChatOpen(true)}
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto relative ${
                supportStatus?.isAvailable ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <MessageCircle className={`h-6 w-6 ${
                  supportStatus?.isAvailable ? 'text-green-600' : 'text-gray-500'
                }`} />
                {supportStatus?.isAvailable && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
              <h3 className="font-semibold">{t('help.liveChat', 'Live Chat')}</h3>
              <p className="text-sm text-muted-foreground">
                {supportStatus?.isAvailable
                  ? `${supportStatus.onlineAgents} agents online • Avg. ${supportStatus.averageResponseTime}`
                  : 'Support team is currently offline'
                }
              </p>
              <div className="flex justify-center">
                <Badge
                  variant={supportStatus?.isAvailable ? 'default' : 'secondary'}
                  className={supportStatus?.isAvailable ? 'bg-green-500' : ''}
                >
                  {supportStatus?.isAvailable ? 'Available' : 'Offline'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setVideoLibraryOpen(true)}
        >
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Video className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold">{t('help.videoTutorials', 'Video Tutorials')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('help.videoTutorialsDescription', 'Watch step-by-step video guides')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{t('help.categories', 'Categories')}</CardTitle>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : categoryError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-600 mb-2">{categoryError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCategories}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {displayCategories.map((category) => {
                    const Icon = category.icon
                    return (
                      <Button
                        key={category.slug}
                        variant={selectedCategory === category.slug ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setSelectedCategory(category.slug)}
                        disabled={loading}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">{category.name}</span>
                        {category.articleCount !== undefined && category.faqCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {category.articleCount + category.faqCount}
                          </span>
                        )}
                        {loading && selectedCategory === category.slug && (
                          <div className="ml-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                          </div>
                        )}
                      </Button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Help Articles */}
          <Card>
            <CardHeader>
              <CardTitle>{t('help.helpArticles', 'Help Articles')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-4">
                    <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{error}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={fetchContent}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              ) : displayArticles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery
                        ? t('help.noSearchResults', `No articles found matching "${searchQuery}"`)
                        : selectedCategory !== 'all'
                          ? t('help.noCategoryArticles', 'No articles available in this category')
                          : t('help.noArticles', 'No articles available')}
                    </p>
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        onClick={() => setSearchQuery('')}
                        className="mt-2 text-sm"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayArticles.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/dashboard/help/article/${article.slug}`}
                    >
                      <div className="flex-1">
                        <h3
                          className="font-semibold text-lg mb-1"
                          dangerouslySetInnerHTML={{
                            __html: (article as any).highlightedTitle || article.title
                          }}
                        />
                        <div className="text-muted-foreground text-sm mb-2">
                          {(article as any).snippet ? (
                            <div dangerouslySetInnerHTML={{ __html: (article as any).snippet }} />
                          ) : (
                            <div dangerouslySetInnerHTML={{
                              __html: (article as any).highlightedExcerpt || article.excerpt || 'Click to read more...'
                            }} />
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{article.views} views</span>
                            <span>{article.helpfulVotes} found helpful</span>
                            {article.publishedAt && (
                              <span>Updated {new Date(article.publishedAt).toLocaleDateString()}</span>
                            )}
                            {article.category && (
                              <Badge variant="secondary">{article.category.name}</Badge>
                            )}
                          </div>
                          <ArticleMetaBadges
                            article={article}
                            showViews={false}
                            showHelpful={false}
                            className="ml-4"
                          />
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced FAQs Section */}
          <EnhancedFAQSection
            selectedCategory={selectedCategory}
            searchQuery={searchQuery}
          />

          {/* Contact Support */}
          <Card>
            <CardHeader>
              <CardTitle>Still Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold">Contact Support</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>support@sociallyhub.com</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Live chat available 24/7</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Average response time: 2 hours</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => setLiveChatOpen(true)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Start Live Chat
                      {supportStatus?.isAvailable && (
                        <div className="ml-2 w-2 h-2 bg-green-400 rounded-full"></div>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setCreateTicketOpen(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Create Support Ticket
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold">Community</h3>
                  <p className="text-sm text-muted-foreground">
                    Join our community to get help from other users and share tips
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Community Forum
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Discord Server
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Feature Requests
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Live Chat Interface */}
      <LiveChatInterface
        isOpen={liveChatOpen}
        onClose={() => setLiveChatOpen(false)}
      />

      {/* Video Tutorial Library */}
      <VideoTutorialLibrary
        isOpen={videoLibraryOpen}
        onClose={() => setVideoLibraryOpen(false)}
      />

      {/* Create Support Ticket Dialog */}
      <CreateTicketDialog
        isOpen={createTicketOpen}
        onClose={() => setCreateTicketOpen(false)}
        onTicketCreated={() => {
          setCreateTicketOpen(false)
          // Optionally show success message or redirect to ticket tracking
        }}
      />
    </div>
  )
}