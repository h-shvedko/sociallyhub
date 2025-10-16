'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Book,
  Code,
  Plug,
  Zap,
  ChevronRight,
  Clock,
  Eye,
  ThumbsUp,
  FileText,
  ExternalLink,
  ArrowLeft,
  Share,
  Bookmark,
  MoreHorizontal
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDictionary } from '@/hooks/use-dictionary'

interface DocumentationSection {
  id: string
  title: string
  slug: string
  description?: string
  icon?: string
  sortOrder: number
  isActive: boolean
  pageCount?: number
}

interface DocumentationPage {
  id: string
  title: string
  slug: string
  excerpt?: string
  tags: string[]
  views: number
  helpfulVotes: number
  estimatedReadTime?: number
  publishedAt: string
  section: {
    title: string
    slug: string
    icon?: string
  }
  author?: {
    id: string
    name: string
  }
  highlightedTitle?: string
  highlightedExcerpt?: string
  snippet?: string
}

// Icon mapping for sections
const iconMap: Record<string, any> = {
  Book,
  Code,
  Plug,
  Zap,
  FileText
}

export default function DocumentationPage() {
  const { t, isLoading: dictLoading } = useDictionary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState('all')
  const [sections, setSections] = useState<DocumentationSection[]>([])
  const [pages, setPages] = useState<DocumentationPage[]>([])
  const [loading, setLoading] = useState(true)
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Fetch sections
  useEffect(() => {
    fetchSections()
  }, [])

  // Fetch pages when section changes
  useEffect(() => {
    fetchPages()
  }, [selectedSection])

  // Handle search with debouncing
  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        performSearch()
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSearchResults(null)
      setSearchError(null)
      setSearchLoading(false)
    }
  }, [searchQuery, selectedSection])

  const fetchSections = async () => {
    setSectionsLoading(true)
    setSectionError(null)
    try {
      const response = await fetch('/api/documentation/sections?includeStats=true')
      if (response.ok) {
        const data = await response.json()
        setSections(data)
      } else {
        throw new Error(`Failed to fetch sections: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error)
      setSectionError('Failed to load sections. Please try again.')
    } finally {
      setSectionsLoading(false)
    }
  }

  const fetchPages = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = selectedSection !== 'all'
        ? `?sectionSlug=${selectedSection}&limit=50`
        : '?limit=50'

      const response = await fetch(`/api/documentation/pages${params}`)

      if (response.ok) {
        const data = await response.json()
        setPages(data.pages || [])
      } else {
        console.error('Failed to fetch pages:', response.status)
        setError('Failed to load documentation pages.')
      }

      // Clear search results when section changes
      if (searchResults) {
        setSearchResults(null)
      }

    } catch (error) {
      console.error('Failed to fetch pages:', error)
      setError('Failed to load pages. Please check your connection and try again.')
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
      if (selectedSection !== 'all') {
        params.append('sectionSlug', selectedSection)
      }

      const response = await fetch(`/api/documentation/search?${params}`)
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

  // Build display sections with icons
  const displaySections = [
    { id: 'all', slug: 'all', title: t('docs.allSections', 'All Sections'), icon: Book, pageCount: sections.reduce((acc, s) => acc + (s.pageCount || 0), 0) },
    ...sections.map(section => ({
      ...section,
      icon: iconMap[section.icon || 'Book'] || Book
    }))
  ]

  // Use search results if searching, otherwise use fetched pages
  const displayPages = searchResults?.results || pages

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
        <h1 className="text-4xl font-bold">{t('docs.title', 'Documentation')}</h1>
        <p className="text-xl text-muted-foreground">
          {t('docs.description', 'Comprehensive guides, API documentation, and integration resources')}
        </p>

        {/* Search */}
        <div className="max-w-2xl mx-auto relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('docs.searchPlaceholder', 'Search documentation, guides, and API references...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-10 h-12 text-lg ${searchError ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
          {searchError && (
            <p className="text-sm text-red-600 mt-2 text-center">{searchError}</p>
          )}
          {searchResults && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Found {searchResults.totalCount || 0} results for "{searchResults.query}"
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sections Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{t('docs.sections', 'Sections')}</CardTitle>
            </CardHeader>
            <CardContent>
              {sectionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : sectionError ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-600 mb-2">{sectionError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSections}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {displaySections.map((section) => {
                    const Icon = section.icon
                    return (
                      <Button
                        key={section.slug}
                        variant={selectedSection === section.slug ? 'default' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setSelectedSection(section.slug)}
                        disabled={loading}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        <span className="flex-1 text-left">{section.title}</span>
                        {section.pageCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {section.pageCount}
                          </span>
                        )}
                        {loading && selectedSection === section.slug && (
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
          {/* Documentation Pages */}
          <Card>
            <CardHeader>
              <CardTitle>{t('docs.pages', 'Documentation Pages')}</CardTitle>
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
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{error}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={fetchPages}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              ) : displayPages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery
                        ? t('docs.noSearchResults', `No pages found matching "${searchQuery}"`)
                        : selectedSection !== 'all'
                          ? t('docs.noSectionPages', 'No pages available in this section')
                          : t('docs.noPages', 'No documentation pages available')}
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
                  {displayPages.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/dashboard/documentation/${page.slug}`}
                    >
                      <div className="flex-1">
                        <h3
                          className="font-semibold text-lg mb-1"
                          dangerouslySetInnerHTML={{
                            __html: page.highlightedTitle || page.title
                          }}
                        />
                        <div className="text-muted-foreground text-sm mb-2">
                          {page.snippet ? (
                            <div dangerouslySetInnerHTML={{ __html: page.snippet }} />
                          ) : (
                            <div dangerouslySetInnerHTML={{
                              __html: page.highlightedExcerpt || page.excerpt || 'Click to read more...'
                            }} />
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {page.views} views
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {page.helpfulVotes} helpful
                          </span>
                          {page.estimatedReadTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {page.estimatedReadTime} min read
                            </span>
                          )}
                          {page.publishedAt && (
                            <span>Updated {new Date(page.publishedAt).toLocaleDateString()}</span>
                          )}
                          <Badge variant="secondary">{page.section.title}</Badge>
                        </div>
                        {page.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {page.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {page.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{page.tags.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}