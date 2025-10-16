'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  ThumbsUp,
  ThumbsDown,
  Share2,
  ExternalLink,
  Filter,
  SortAsc,
  Clock,
  TrendingUp,
  Eye,
  MessageCircle,
  Star,
  Link,
  Copy,
  Check,
  ChevronDown,
  X
} from 'lucide-react'
import { RichContentRenderer } from './rich-content-renderer'

interface FAQ {
  id: string
  question: string
  answer: string
  categoryId: string
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  isPinned: boolean
  relatedArticles: string[]
  createdAt: string
  updatedAt: string
  category?: {
    id: string
    name: string
    slug: string
  }
  // Enhanced search properties
  highlightedQuestion?: string
  highlightedAnswer?: string
}

interface HelpCategory {
  id: string
  name: string
  slug: string
  faqCount?: number
}

interface HelpArticle {
  id: string
  title: string
  slug: string
  excerpt?: string
  readingTime?: number
  category: {
    name: string
    slug: string
  }
}

interface EnhancedFAQSectionProps {
  selectedCategory?: string
  searchQuery?: string
  className?: string
}

type SortOption = 'relevance' | 'popular' | 'recent' | 'alphabetical'

export function EnhancedFAQSection({
  selectedCategory = 'all',
  searchQuery = '',
  className = ''
}: EnhancedFAQSectionProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [categories, setCategories] = useState<HelpCategory[]>([])
  const [relatedArticles, setRelatedArticles] = useState<Record<string, HelpArticle[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Enhanced state management
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('relevance')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({})
  const [copiedFAQ, setCopiedFAQ] = useState<string | null>(null)
  const [expandedFAQs, setExpandedFAQs] = useState<Record<string, boolean>>({})

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchFAQs()
    fetchCategories()
  }, [selectedCategory, searchQuery, sortBy, selectedCategoryFilter])

  // Handle local search with debouncing
  useEffect(() => {
    if (localSearchQuery.trim()) {
      const timer = setTimeout(() => {
        fetchFAQs()
      }, 300)
      return () => clearTimeout(timer)
    } else if (localSearchQuery === '') {
      fetchFAQs()
    }
  }, [localSearchQuery])

  const fetchFAQs = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      // Use external search query or local search query
      const activeSearchQuery = searchQuery || localSearchQuery
      if (activeSearchQuery.trim()) {
        params.append('search', activeSearchQuery)
      }

      // Category filtering
      const activeCategoryFilter = selectedCategory !== 'all' ? selectedCategory : selectedCategoryFilter
      if (activeCategoryFilter !== 'all') {
        params.append('categorySlug', activeCategoryFilter)
      }

      // Sorting
      if (sortBy === 'popular') {
        params.append('sortBy', 'popularity')
      } else if (sortBy === 'recent') {
        params.append('sortBy', 'recent')
      } else if (sortBy === 'alphabetical') {
        params.append('sortBy', 'alphabetical')
      }

      const response = await fetch(`/api/help/faqs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setFaqs(data.faqs || [])

        // Fetch related articles for FAQs that have them
        data.faqs?.forEach((faq: FAQ) => {
          if (faq.relatedArticles && faq.relatedArticles.length > 0) {
            fetchRelatedArticles(faq.id, faq.relatedArticles)
          }
        })
      } else {
        throw new Error('Failed to fetch FAQs')
      }
    } catch (err) {
      console.error('Error fetching FAQs:', err)
      setError('Failed to load FAQs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/help/categories?includeStats=true')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const fetchRelatedArticles = async (faqId: string, articleIds: string[]) => {
    try {
      const promises = articleIds.map(id =>
        fetch(`/api/help/articles/${id}`).then(res => res.ok ? res.json() : null)
      )
      const articles = (await Promise.all(promises)).filter(Boolean)
      setRelatedArticles(prev => ({
        ...prev,
        [faqId]: articles
      }))
    } catch (err) {
      console.error('Error fetching related articles:', err)
    }
  }

  const handleFAQVote = async (faqId: string, helpful: boolean) => {
    // Prevent multiple votes
    if (userVotes[faqId] !== undefined) {
      return
    }

    try {
      const response = await fetch(`/api/help/faqs/${faqId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful })
      })

      if (response.ok) {
        const data = await response.json()

        // Update local state
        setUserVotes(prev => ({ ...prev, [faqId]: helpful }))
        setFaqs(prev => prev.map(faq =>
          faq.id === faqId
            ? {
                ...faq,
                helpfulVotes: data.helpfulVotes,
                notHelpfulVotes: data.notHelpfulVotes
              }
            : faq
        ))
      }
    } catch (err) {
      console.error('Error submitting FAQ vote:', err)
    }
  }

  const handleFAQView = async (faqId: string) => {
    // Track view when FAQ is expanded
    if (!expandedFAQs[faqId]) {
      try {
        await fetch(`/api/help/faqs/${faqId}/view`, { method: 'POST' })
        setExpandedFAQs(prev => ({ ...prev, [faqId]: true }))
      } catch (err) {
        console.error('Error tracking FAQ view:', err)
      }
    }
  }

  const handleShareFAQ = async (faq: FAQ) => {
    const shareData = {
      title: faq.question,
      text: `${faq.question}\n\n${faq.answer.replace(/<[^>]*>/g, '')}`,
      url: `${window.location.origin}/dashboard/help?faq=${faq.id}`
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.error('Error sharing FAQ:', err)
        fallbackCopyToClipboard(shareData.url)
      }
    } else {
      fallbackCopyToClipboard(shareData.url)
    }
  }

  const fallbackCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFAQ(text)
      setTimeout(() => setCopiedFAQ(null), 2000)
    }).catch(err => {
      console.error('Error copying to clipboard:', err)
    })
  }

  const getHelpfulnessPercentage = (faq: FAQ) => {
    const total = faq.helpfulVotes + faq.notHelpfulVotes
    if (total === 0) return 0
    return Math.round((faq.helpfulVotes / total) * 100)
  }

  const clearFilters = () => {
    setLocalSearchQuery('')
    setSelectedCategoryFilter('all')
    setSortBy('relevance')
  }

  const displayFaqs = faqs || []
  const hasActiveFilters = localSearchQuery.trim() || selectedCategoryFilter !== 'all' || sortBy !== 'relevance'

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-gray-200 rounded mb-2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Frequently Asked Questions
            {displayFaqs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {displayFaqs.length}
              </Badge>
            )}
          </CardTitle>

          {/* Filter and Sort Controls */}
          <div className="flex items-center gap-2">
            {/* FAQ Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search FAQs..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="pl-10 w-48"
              />
            </div>

            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Category
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={selectedCategoryFilter === 'all' ? 'bg-accent' : ''}
                >
                  All Categories
                </DropdownMenuItem>
                {categories.map((category) => (
                  <DropdownMenuItem
                    key={category.id}
                    onClick={() => setSelectedCategoryFilter(category.slug)}
                    className={selectedCategoryFilter === category.slug ? 'bg-accent' : ''}
                  >
                    {category.name}
                    {category.faqCount !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {category.faqCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SortAsc className="h-4 w-4 mr-2" />
                  Sort
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Sort FAQs by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSortBy('relevance')}
                  className={sortBy === 'relevance' ? 'bg-accent' : ''}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Relevance
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy('popular')}
                  className={sortBy === 'popular' ? 'bg-accent' : ''}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Most Popular
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy('recent')}
                  className={sortBy === 'recent' ? 'bg-accent' : ''}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Recently Added
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortBy('alphabetical')}
                  className={sortBy === 'alphabetical' ? 'bg-accent' : ''}
                >
                  <SortAsc className="h-4 w-4 mr-2" />
                  Alphabetical
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {localSearchQuery.trim() && (
              <Badge variant="secondary" className="gap-1">
                Search: "{localSearchQuery}"
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setLocalSearchQuery('')}
                />
              </Badge>
            )}
            {selectedCategoryFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Category: {categories.find(c => c.slug === selectedCategoryFilter)?.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setSelectedCategoryFilter('all')}
                />
              </Badge>
            )}
            {sortBy !== 'relevance' && (
              <Badge variant="secondary" className="gap-1">
                Sort: {sortBy}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => setSortBy('relevance')}
                />
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchFAQs}>
              Try Again
            </Button>
          </div>
        ) : displayFaqs.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {localSearchQuery.trim() || searchQuery.trim()
                  ? `No FAQs found matching your search`
                  : selectedCategoryFilter !== 'all' || selectedCategory !== 'all'
                    ? 'No FAQs available in this category'
                    : 'No FAQs available'}
              </p>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {displayFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                onValueChange={() => handleFAQView(faq.id)}
              >
                <AccordionTrigger className="text-left hover:no-underline group">
                  <div className="flex items-start justify-between w-full pr-4">
                    <div className="flex items-center gap-3 flex-1">
                      {faq.isPinned && (
                        <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          Pinned
                        </Badge>
                      )}
                      <div
                        className="text-left group-hover:text-primary transition-colors"
                        dangerouslySetInnerHTML={{
                          __html: faq.highlightedQuestion || faq.question
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {faq.views}
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {faq.helpfulVotes}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-4">
                  <div className="space-y-4">
                    {/* FAQ Answer with Rich Content */}
                    <RichContentRenderer
                      content={faq.highlightedAnswer || faq.answer}
                      showTableOfContents={false}
                      className="prose-sm"
                    />

                    {/* Related Articles */}
                    {relatedArticles[faq.id] && relatedArticles[faq.id].length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Related Articles
                        </h4>
                        <div className="space-y-2">
                          {relatedArticles[faq.id].map((article) => (
                            <div
                              key={article.id}
                              className="flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                              onClick={() => window.location.href = `/dashboard/help/article/${article.slug}`}
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">{article.title}</p>
                                {article.excerpt && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {article.excerpt}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {article.category.name}
                                  </Badge>
                                  {article.readingTime && (
                                    <span className="text-xs text-muted-foreground">
                                      {article.readingTime} min read
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    {/* FAQ Actions and Analytics */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      {/* Helpfulness Voting */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Was this helpful?</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={userVotes[faq.id] === true ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleFAQVote(faq.id, true)}
                            disabled={userVotes[faq.id] !== undefined}
                            className="gap-1"
                          >
                            <ThumbsUp className="h-4 w-4" />
                            Yes ({faq.helpfulVotes})
                          </Button>
                          <Button
                            variant={userVotes[faq.id] === false ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleFAQVote(faq.id, false)}
                            disabled={userVotes[faq.id] !== undefined}
                            className="gap-1"
                          >
                            <ThumbsDown className="h-4 w-4" />
                            No ({faq.notHelpfulVotes})
                          </Button>
                        </div>
                      </div>

                      {/* Share and Analytics */}
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground">
                          {getHelpfulnessPercentage(faq)}% found helpful
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShareFAQ(faq)}
                          className="gap-1"
                        >
                          {copiedFAQ === `${window.location.origin}/dashboard/help?faq=${faq.id}` ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Share2 className="h-4 w-4" />
                          )}
                          Share
                        </Button>
                        {faq.category && (
                          <Badge variant="outline" className="text-xs">
                            {faq.category.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}