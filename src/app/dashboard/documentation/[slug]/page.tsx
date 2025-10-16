'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Share,
  Bookmark,
  User,
  Calendar,
  Tag,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDictionary } from '@/hooks/use-dictionary'

interface DocumentationPageData {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  tags: string[]
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  estimatedReadTime?: number
  publishedAt: string
  lastReviewed?: string
  section: {
    id: string
    title: string
    slug: string
    icon?: string
  }
  author?: {
    id: string
    name: string
    image?: string
  }
  seoTitle?: string
  seoDescription?: string
  keywords: string[]
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function DocumentationPageView({ params }: PageProps) {
  const { t, isLoading: dictLoading } = useDictionary()
  const [pageSlug, setPageSlug] = useState<string>('')
  const [page, setPage] = useState<DocumentationPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackType, setFeedbackType] = useState<'helpful' | 'not-helpful' | null>(null)

  // Extract slug from params
  useEffect(() => {
    params.then(({ slug }) => {
      setPageSlug(slug)
    })
  }, [params])

  // Fetch page data
  useEffect(() => {
    if (pageSlug) {
      fetchPage()
    }
  }, [pageSlug])

  const fetchPage = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/documentation/pages/${pageSlug}`)

      if (response.ok) {
        const data = await response.json()
        setPage(data)

        // Update document title and meta tags
        document.title = data.seoTitle || `${data.title} - Documentation`
        if (data.seoDescription) {
          updateMetaTag('description', data.seoDescription)
        }
        if (data.keywords.length > 0) {
          updateMetaTag('keywords', data.keywords.join(', '))
        }
      } else if (response.status === 404) {
        setError('Documentation page not found.')
      } else {
        setError('Failed to load documentation page.')
      }
    } catch (error) {
      console.error('Failed to fetch page:', error)
      setError('Failed to load page. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateMetaTag = (name: string, content: string) => {
    let meta = document.querySelector(`meta[name="${name}"]`)
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', name)
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', content)
  }

  const submitFeedback = async (helpful: boolean) => {
    if (!page || feedbackSubmitted) return

    try {
      const response = await fetch(`/api/documentation/pages/${page.slug}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ helpful })
      })

      if (response.ok) {
        const data = await response.json()
        setFeedbackSubmitted(true)
        setFeedbackType(helpful ? 'helpful' : 'not-helpful')

        // Update page data with new vote counts
        setPage(prev => prev ? {
          ...prev,
          helpfulVotes: data.helpfulVotes,
          notHelpfulVotes: data.notHelpfulVotes
        } : null)
      } else {
        console.error('Failed to submit feedback')
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const shareUrl = () => {
    if (navigator.share && page) {
      navigator.share({
        title: page.title,
        text: page.excerpt || page.title,
        url: window.location.href
      })
    } else {
      copyToClipboard(window.location.href)
    }
  }

  if (dictLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-12 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!page) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb and Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="pl-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <span>/</span>
          <span>{page.section.title}</span>
          <span>/</span>
          <span className="text-foreground">{page.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={shareUrl}>
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Page Header */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">{page.title}</h1>

        {page.excerpt && (
          <p className="text-xl text-muted-foreground">{page.excerpt}</p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {page.estimatedReadTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {page.estimatedReadTime} min read
            </div>
          )}
          <div className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {page.views} views
          </div>
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-4 w-4" />
            {page.helpfulVotes} helpful
          </div>
          {page.author && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {page.author.name}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(page.publishedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Tags */}
        {page.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {page.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Page Content */}
      <Card>
        <CardContent className="pt-6">
          <div
            className="prose prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </CardContent>
      </Card>

      {/* Feedback Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold">Was this page helpful?</h3>

            {feedbackSubmitted ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>
                  Thank you for your feedback! This helps us improve our documentation.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => submitFeedback(true)}
                  className="flex items-center gap-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Yes, helpful
                </Button>
                <Button
                  variant="outline"
                  onClick={() => submitFeedback(false)}
                  className="flex items-center gap-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                  No, not helpful
                </Button>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {page.helpfulVotes} out of {page.helpfulVotes + page.notHelpfulVotes} people found this helpful
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      {page.lastReviewed && (
        <div className="text-center text-sm text-muted-foreground">
          Last reviewed: {new Date(page.lastReviewed).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}