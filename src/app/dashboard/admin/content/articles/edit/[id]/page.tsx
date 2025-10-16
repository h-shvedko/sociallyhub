'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import ArticleEditor from '@/components/admin/help/ArticleEditor'

interface Category {
  id: string
  name: string
  slug: string
}

interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  categoryId: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  featuredImage?: string
  readingTime?: number
  relatedArticles: string[]
  seoTitle?: string
  seoDescription?: string
  publishedAt?: string
  updatedAt: string
  category: Category
  author?: {
    id: string
    name: string
    email: string
  }
}

export default function EditArticlePage() {
  const router = useRouter()
  const params = useParams()
  const articleId = params.id as string

  const [article, setArticle] = useState<Article | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (articleId) {
      Promise.all([
        fetchArticle(),
        fetchCategories()
      ])
    }
  }, [articleId])

  const fetchArticle = async () => {
    try {
      const response = await fetch(`/api/admin/help/articles/${articleId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Article not found')
        }
        throw new Error('Failed to fetch article')
      }
      const data = await response.json()
      setArticle(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch article')
      console.error('Error fetching article:', err)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/help/categories')
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
      // Don't set error here as article is more important
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (articleData: any) => {
    try {
      const { publishNow, ...updateData } = articleData

      const response = await fetch(`/api/admin/help/articles/${articleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...updateData,
          changeSummary: 'Article updated via admin interface'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update article')
      }

      const updatedArticle = await response.json()
      setArticle(updatedArticle)

      // Redirect to the articles list with success message
      router.push('/dashboard/admin/content/articles?updated=true')
    } catch (error) {
      console.error('Error updating article:', error)
      throw error // Re-throw to let ArticleEditor handle the error display
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/admin/content/articles')
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800">Error Loading Article</h3>
          <p className="text-red-600 mt-1">{error || 'Article not found'}</p>
          <button
            onClick={() => router.push('/dashboard/admin/content/articles')}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Articles
          </button>
        </div>
      </div>
    )
  }

  const initialData = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    categoryId: article.categoryId,
    tags: article.tags,
    status: article.status,
    featuredImage: article.featuredImage,
    readingTime: article.readingTime,
    relatedArticles: article.relatedArticles,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    publishedAt: article.publishedAt
  }

  return (
    <div className="p-6">
      <ArticleEditor
        initialData={initialData}
        categories={categories}
        onSave={handleSave}
        onCancel={handleCancel}
        mode="edit"
      />
    </div>
  )
}