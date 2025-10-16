'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArticleMetaBadges } from '@/components/help/recently-updated-badge'
import { PrintArticleView, usePrintArticle } from '@/components/help/print-article-view'
import { RichContentRenderer } from '@/components/help/rich-content-renderer'
// Note: Using state-based feedback instead of toast
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Clock,
  User,
  Calendar,
  Eye,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Share2,
  Bookmark,
  Flag,
  ExternalLink,
  Printer
} from 'lucide-react'

interface HelpArticle {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  categoryId: string
  tags: string[]
  status: string
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  readingTime?: number
  publishedAt?: string
  createdAt: string
  updatedAt: string
  category: {
    id: string
    name: string
    slug: string
    icon?: string
  }
  author?: {
    id: string
    name: string
    email: string
    image?: string
  }
  relatedArticles: Array<{
    id: string
    title: string
    slug: string
    excerpt?: string
    readingTime?: number
    category: {
      name: string
      slug: string
    }
  }>
}

interface ArticleNavigation {
  previous?: {
    title: string
    slug: string
  }
  next?: {
    title: string
    slug: string
  }
}

export default function ArticleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [article, setArticle] = useState<HelpArticle | null>(null)
  const [navigation, setNavigation] = useState<ArticleNavigation>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userVote, setUserVote] = useState<boolean | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showCommentDialog, setShowCommentDialog] = useState(false)
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [showPrintView, setShowPrintView] = useState(false)

  const slug = params.slug as string
  const { printArticle } = usePrintArticle()

  useEffect(() => {
    if (slug) {
      fetchArticle()
      fetchNavigation()
      fetchBookmarkStatus()
    }
  }, [slug])

  const fetchArticle = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/help/articles/${slug}`)
      if (response.ok) {
        const data = await response.json()
        setArticle(data)
      } else if (response.status === 404) {
        setError('Article not found')
      } else {
        setError('Failed to load article')
      }
    } catch (err) {
      console.error('Error fetching article:', err)
      setError('Failed to load article')
    } finally {
      setLoading(false)
    }
  }

  const fetchNavigation = async () => {
    try {
      const response = await fetch(`/api/help/articles/${slug}/navigation`)
      if (response.ok) {
        const data = await response.json()
        setNavigation(data)
      }
    } catch (err) {
      console.error('Error fetching navigation:', err)
    }
  }

  const fetchBookmarkStatus = async () => {
    try {
      const response = await fetch(`/api/help/articles/${slug}/bookmark`)
      if (response.ok) {
        const data = await response.json()
        setIsBookmarked(data.isBookmarked)
      }
    } catch (err) {
      // Don't show error for bookmark status, just assume not bookmarked
      console.error('Error fetching bookmark status:', err)
      setIsBookmarked(false)
    }
  }

  const handleBookmarkToggle = async () => {
    try {
      const method = isBookmarked ? 'DELETE' : 'POST'
      const response = await fetch(`/api/help/articles/${slug}/bookmark`, {
        method
      })

      if (response.ok) {
        const data = await response.json()
        setIsBookmarked(data.isBookmarked)
        setFeedbackMessage({
          type: 'success',
          message: data.isBookmarked ? 'Article bookmarked!' : 'Bookmark removed'
        })
        setTimeout(() => setFeedbackMessage(null), 3000)
      } else {
        setFeedbackMessage({
          type: 'error',
          message: 'Failed to update bookmark'
        })
        setTimeout(() => setFeedbackMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err)
      setFeedbackMessage({
        type: 'error',
        message: 'Failed to update bookmark'
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    }
  }

  const handleVote = async (helpful: boolean) => {
    if (userVote !== null) {
      setFeedbackMessage({
        type: 'error',
        message: 'You have already voted on this article'
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
      return
    }

    try {
      const response = await fetch(`/api/help/articles/${slug}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful })
      })

      if (response.ok) {
        const data = await response.json()
        setUserVote(helpful)

        // Update article vote counts
        if (article) {
          setArticle({
            ...article,
            helpfulVotes: data.helpfulVotes,
            notHelpfulVotes: data.notHelpfulVotes
          })
        }

        setFeedbackMessage({
          type: 'success',
          message: 'Thank you for your feedback!'
        })
        setTimeout(() => setFeedbackMessage(null), 5000)

        // Show comment dialog for negative feedback
        if (!helpful) {
          setShowCommentDialog(true)
        }
      } else {
        setFeedbackMessage({
          type: 'error',
          message: 'Failed to submit feedback'
        })
        setTimeout(() => setFeedbackMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error submitting vote:', err)
      setFeedbackMessage({
        type: 'error',
        message: 'Failed to submit feedback'
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    }
  }

  const handleCommentSubmit = async () => {
    if (!comment.trim()) {
      setFeedbackMessage({
        type: 'error',
        message: 'Please enter a comment'
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
      return
    }

    setSubmittingComment(true)
    try {
      const response = await fetch(`/api/help/articles/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: comment.trim(),
          type: 'feedback'
        })
      })

      if (response.ok) {
        setFeedbackMessage({
          type: 'success',
          message: 'Thank you for your detailed feedback!'
        })
        setTimeout(() => setFeedbackMessage(null), 5000)
        setComment('')
        setShowCommentDialog(false)
      } else {
        setFeedbackMessage({
          type: 'error',
          message: 'Failed to submit comment'
        })
        setTimeout(() => setFeedbackMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error submitting comment:', err)
      setFeedbackMessage({
        type: 'error',
        message: 'Failed to submit comment'
      })
      setTimeout(() => setFeedbackMessage(null), 5000)
    } finally {
      setSubmittingComment(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getHelpfulnessPercentage = () => {
    if (!article) return 0
    const total = article.helpfulVotes + article.notHelpfulVotes
    if (total === 0) return 0
    return Math.round((article.helpfulVotes / total) * 100)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/dashboard/help')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Help Center
          </Button>
        </div>
      </div>
    )
  }

  if (!article) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Feedback Message */}
      {feedbackMessage && (
        <div className={`mb-6 p-4 rounded-lg ${
          feedbackMessage.type === 'success'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <span>{feedbackMessage.message}</span>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="ml-2 text-current opacity-50 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/help')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Help Center
        </Button>
        <span className="text-gray-400">/</span>
        <Badge variant="secondary">{article.category.name}</Badge>
      </div>

      {/* Article Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">{article.title}</h1>

        {/* Article Metadata */}
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 mb-6">
          {article.author && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{article.author.name}</span>
            </div>
          )}

          {article.publishedAt && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(article.publishedAt)}</span>
            </div>
          )}

          {article.readingTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{article.readingTime} min read</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>{article.views.toLocaleString()} views</span>
          </div>
        </div>

        {/* Recently Updated and Reading Time Badges */}
        <div className="mb-6">
          <ArticleMetaBadges
            article={article}
            showViews={false}
            showHelpful={false}
          />
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {article.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBookmarkToggle}
          >
            <Bookmark className={`h-4 w-4 mr-2 ${isBookmarked ? 'fill-current text-blue-600' : ''}`} />
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowPrintView(true)
              printArticle()
            }}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Flag className="h-4 w-4 mr-2" />
            Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-8">
              {/* Article Content */}
              <RichContentRenderer
                content={article.content}
                showTableOfContents={true}
                className="mb-8"
              />

              <Separator className="my-8" />

              {/* Helpfulness Section */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Was this article helpful?</h3>

                {userVote === null ? (
                  <div className="flex gap-3 mb-4">
                    <Button
                      variant="outline"
                      onClick={() => handleVote(true)}
                      className="flex-1"
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Yes, this was helpful
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleVote(false)}
                      className="flex-1"
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      No, this needs improvement
                    </Button>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-green-600 font-medium">
                      Thank you for your feedback!
                    </p>
                  </div>
                )}

                {/* Voting Statistics */}
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    {getHelpfulnessPercentage()}% of users found this helpful
                    ({article.helpfulVotes} out of {article.helpfulVotes + article.notHelpfulVotes} votes)
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${getHelpfulnessPercentage()}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Article Navigation */}
          <div className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {navigation.previous && (
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent
                    className="p-4"
                    onClick={() => router.push(`/dashboard/help/article/${navigation.previous!.slug}`)}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <ChevronLeft className="h-4 w-4" />
                      Previous Article
                    </div>
                    <h4 className="font-medium line-clamp-2">{navigation.previous.title}</h4>
                  </CardContent>
                </Card>
              )}

              {navigation.next && (
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent
                    className="p-4 text-right"
                    onClick={() => router.push(`/dashboard/help/article/${navigation.next!.slug}`)}
                  >
                    <div className="flex items-center justify-end gap-2 text-sm text-gray-600 mb-2">
                      Next Article
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <h4 className="font-medium line-clamp-2">{navigation.next.title}</h4>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            {/* Table of Contents would go here */}

            {/* Related Articles */}
            {article.relatedArticles.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">Related Articles</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {article.relatedArticles.map((related) => (
                    <div
                      key={related.id}
                      className="cursor-pointer hover:bg-gray-50 p-3 rounded-md transition-colors"
                      onClick={() => router.push(`/dashboard/help/article/${related.slug}`)}
                    >
                      <h4 className="font-medium text-sm line-clamp-2 mb-1">
                        {related.title}
                      </h4>
                      {related.excerpt && (
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {related.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <Badge variant="outline" className="text-xs">
                          {related.category.name}
                        </Badge>
                        {related.readingTime && (
                          <span>{related.readingTime} min</span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold">Need More Help?</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Community Forum
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Help us improve this article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              We're sorry this article wasn't helpful. Could you tell us what was missing or unclear?
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What could we improve about this article?"
              rows={4}
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCommentDialog(false)}
              >
                Skip
              </Button>
              <Button
                onClick={handleCommentSubmit}
                disabled={submittingComment}
              >
                {submittingComment ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print View */}
      {showPrintView && article && (
        <PrintArticleView article={article} />
      )}
    </div>
  )
}