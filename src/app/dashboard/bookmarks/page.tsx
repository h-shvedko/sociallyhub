'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArticleMetaBadges } from '@/components/help/recently-updated-badge'
import {
  Search,
  Bookmark,
  ChevronRight,
  Trash2,
  ExternalLink,
  BookOpen,
  Clock,
  Calendar
} from 'lucide-react'

interface BookmarkedArticle {
  id: string
  title: string
  slug: string
  excerpt?: string
  readingTime?: number
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
  bookmarkedAt: string
  category: {
    name: string
    slug: string
    icon?: string
  }
  author?: {
    name: string
    image?: string
  }
}

export default function BookmarksPage() {
  const router = useRouter()
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBookmarks()
  }, [])

  const fetchBookmarks = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user/bookmarks')
      if (response.ok) {
        const data = await response.json()
        setBookmarks(data.articles || [])
      } else if (response.status === 401) {
        setError('Please log in to view your bookmarks')
      } else {
        setError('Failed to load bookmarks')
      }
    } catch (err) {
      console.error('Error fetching bookmarks:', err)
      setError('Failed to load bookmarks')
    } finally {
      setLoading(false)
    }
  }

  const removeBookmark = async (slug: string) => {
    try {
      const response = await fetch(`/api/help/articles/${slug}/bookmark`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setBookmarks(prev => prev.filter(bookmark => bookmark.slug !== slug))
      }
    } catch (err) {
      console.error('Error removing bookmark:', err)
    }
  }

  const filteredBookmarks = bookmarks.filter(bookmark =>
    searchQuery === '' ||
    bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bookmark.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bookmark.category.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Bookmarks</h1>
        </div>

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Bookmarks</h1>
          <p className="text-gray-600 mt-2">
            {bookmarks.length === 0
              ? 'No bookmarked articles yet'
              : `${bookmarks.length} bookmarked article${bookmarks.length === 1 ? '' : 's'}`
            }
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/help')}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Browse Help Center
        </Button>
      </div>

      {/* Search */}
      {bookmarks.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search your bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-red-600 mb-4">
              <Bookmark className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
            </div>
            <Button onClick={fetchBookmarks}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!error && !loading && bookmarks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <Bookmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No bookmarks yet</h3>
              <p className="mb-4">
                Start bookmarking articles to create your personal help library
              </p>
              <Button onClick={() => router.push('/dashboard/help')}>
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Help Center
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookmarks List */}
      {filteredBookmarks.length > 0 && (
        <div className="space-y-4">
          {filteredBookmarks.map((bookmark) => (
            <Card
              key={bookmark.id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => router.push(`/dashboard/help/article/${bookmark.slug}`)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                        {bookmark.title}
                      </h3>
                      <ArticleMetaBadges
                        article={bookmark}
                        showViews={false}
                        showHelpful={false}
                      />
                    </div>

                    {bookmark.excerpt && (
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {bookmark.excerpt}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <Badge variant="outline">{bookmark.category.name}</Badge>

                      {bookmark.readingTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {bookmark.readingTime} min read
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Bookmarked {formatDate(bookmark.bookmarkedAt)}
                      </span>

                      {bookmark.author && (
                        <span>By {bookmark.author.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/help/article/${bookmark.slug}`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBookmark(bookmark.slug)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Search Results */}
      {searchQuery && filteredBookmarks.length === 0 && bookmarks.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="mb-4">
                No bookmarks match your search for "{searchQuery}"
              </p>
              <Button
                variant="outline"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}