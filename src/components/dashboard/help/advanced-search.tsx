'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Search,
  Filter,
  Calendar,
  User,
  TrendingUp,
  Clock,
  X,
  ChevronDown
} from 'lucide-react'
import { useDictionary } from '@/hooks/use-dictionary'

interface SearchFilters {
  type: 'all' | 'articles' | 'faqs'
  categoryId?: string
  sortBy: 'relevance' | 'date' | 'popularity'
  dateFrom?: string
  dateTo?: string
  authorId?: string
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void
  categories: Array<{ id: string; name: string; slug: string }>
  authors: Array<{ id: string; name: string }>
  loading?: boolean
  searchError?: string | null
}

export function AdvancedSearch({
  onSearch,
  categories,
  authors,
  loading = false,
  searchError = null
}: AdvancedSearchProps) {
  const { t } = useDictionary()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    sortBy: 'relevance'
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Fetch search suggestions
  const fetchSuggestions = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    try {
      const response = await fetch(`/api/help/search/suggestions?q=${encodeURIComponent(searchQuery)}&limit=8`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    }
  }

  // Debounced suggestion fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuggestions(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim(), filters)
      setShowSuggestions(false)
    }
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    onSearch(suggestion, filters)
  }

  // Handle filter changes
  const updateFilter = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)

    // If there's an active search, re-search with new filters
    if (query.trim()) {
      onSearch(query.trim(), newFilters)
    }
  }

  // Clear all filters
  const clearFilters = () => {
    const clearedFilters: SearchFilters = {
      type: 'all',
      sortBy: 'relevance'
    }
    setFilters(clearedFilters)

    if (query.trim()) {
      onSearch(query.trim(), clearedFilters)
    }
  }

  // Check if any filters are active
  const hasActiveFilters = filters.type !== 'all' ||
                           filters.categoryId ||
                           filters.dateFrom ||
                           filters.dateTo ||
                           filters.authorId ||
                           filters.sortBy !== 'relevance'

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="pt-6">
        {/* Search Input with Suggestions */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={t('help.advancedSearchPlaceholder', 'Search help articles, guides, and FAQs...')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              className={`pl-10 pr-20 h-12 text-lg ${searchError ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              )}
              <Button
                onClick={handleSearch}
                disabled={!query.trim() || loading}
                size="sm"
                className="h-8"
              >
                Search
              </Button>
            </div>
          </div>

          {/* Search Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="w-full text-left px-4 py-2 hover:bg-muted text-sm border-b last:border-b-0 flex items-center gap-2"
                >
                  <Search className="h-3 w-3 text-muted-foreground" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Search Error */}
          {searchError && (
            <p className="text-sm text-red-600 mt-2">{searchError}</p>
          )}
        </div>

        {/* Filters Toggle */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 text-xs">
                {Object.values(filters).filter(Boolean).length}
              </Badge>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              Clear all filters
            </Button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Content Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <Select
                  value={filters.type}
                  onValueChange={(value: any) => updateFilter('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Content</SelectItem>
                    <SelectItem value="articles">Articles Only</SelectItem>
                    <SelectItem value="faqs">FAQs Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={filters.categoryId || 'all'}
                  onValueChange={(value) => updateFilter('categoryId', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(value: any) => updateFilter('sortBy', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Relevance
                      </div>
                    </SelectItem>
                    <SelectItem value="date">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Newest First
                      </div>
                    </SelectItem>
                    <SelectItem value="popularity">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Most Popular
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Author Filter */}
              {authors.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Author</label>
                  <Select
                    value={filters.authorId || 'all'}
                    onValueChange={(value) => updateFilter('authorId', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Authors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Authors</SelectItem>
                      {authors.map((author) => (
                        <SelectItem key={author.id} value={author.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {author.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date From Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
                />
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
                />
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                {filters.type !== 'all' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {filters.type}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter('type', 'all')}
                    />
                  </Badge>
                )}
                {filters.categoryId && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {categories.find(c => c.id === filters.categoryId)?.name || 'Category'}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter('categoryId', undefined)}
                    />
                  </Badge>
                )}
                {filters.sortBy !== 'relevance' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Sort: {filters.sortBy}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter('sortBy', 'relevance')}
                    />
                  </Badge>
                )}
                {filters.authorId && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {authors.find(a => a.id === filters.authorId)?.name || 'Author'}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => updateFilter('authorId', undefined)}
                    />
                  </Badge>
                )}
                {(filters.dateFrom || filters.dateTo) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Date range
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => {
                        updateFilter('dateFrom', undefined)
                        updateFilter('dateTo', undefined)
                      }}
                    />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}