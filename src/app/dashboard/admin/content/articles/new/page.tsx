'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ArticleEditor from '@/components/admin/help/ArticleEditor'

interface Category {
  id: string
  name: string
  slug: string
}

export default function NewArticlePage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/help/categories')
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories')
      console.error('Error fetching categories:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (articleData: any) => {
    try {
      const response = await fetch('/api/admin/help/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(articleData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create article')
      }

      const newArticle = await response.json()

      // Redirect to the articles list with success message
      router.push('/dashboard/admin/content/articles?created=true')
    } catch (error) {
      console.error('Error creating article:', error)
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-red-800">Error Loading Page</h3>
          <p className="text-red-600 mt-1">{error}</p>
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

  return (
    <div className="p-6">
      <ArticleEditor
        categories={categories}
        onSave={handleSave}
        onCancel={handleCancel}
        mode="create"
      />
    </div>
  )
}