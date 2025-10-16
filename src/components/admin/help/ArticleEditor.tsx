'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import {
  Eye,
  Code,
  Monitor,
  Save,
  Upload,
  X,
  FileText,
  Image,
  Link,
  Bold,
  Italic,
  List,
  Hash,
  Quote,
  Table,
  Zap,
  Settings,
  ChevronDown,
  Tag,
  Calendar,
  Globe,
  Search
} from 'lucide-react'

interface ArticleData {
  id?: string
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
}

interface Category {
  id: string
  name: string
  slug: string
}

interface ArticleEditorProps {
  initialData?: Partial<ArticleData>
  categories: Category[]
  onSave: (data: ArticleData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  mode: 'create' | 'edit'
}

type EditorMode = 'rich' | 'markdown' | 'preview'

export default function ArticleEditor({
  initialData,
  categories,
  onSave,
  onCancel,
  isLoading = false,
  mode
}: ArticleEditorProps) {
  const editorRef = useRef<any>(null)
  const [editorMode, setEditorMode] = useState<EditorMode>('rich')
  const [showSeoSettings, setShowSeoSettings] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState<ArticleData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    categoryId: '',
    tags: [],
    status: 'draft',
    featuredImage: '',
    readingTime: 0,
    relatedArticles: [],
    seoTitle: '',
    seoDescription: '',
    ...initialData
  })

  const [tagInput, setTagInput] = useState('')
  const [markdownContent, setMarkdownContent] = useState(formData.content)

  // Auto-generate slug from title
  const generateSlug = useCallback((title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }, [])

  // Calculate reading time (average 200 words per minute)
  const calculateReadingTime = useCallback((content: string) => {
    const text = content.replace(/<[^>]*>/g, '') // Remove HTML tags
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
    return Math.ceil(wordCount / 200)
  }, [])

  // Update form data
  const updateFormData = (field: keyof ArticleData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }

      // Auto-generate slug when title changes (only for new articles)
      if (field === 'title' && !initialData?.id) {
        updated.slug = generateSlug(value)
      }

      // Auto-generate SEO title if not manually set
      if (field === 'title' && !prev.seoTitle) {
        updated.seoTitle = value
      }

      // Calculate reading time when content changes
      if (field === 'content') {
        updated.readingTime = calculateReadingTime(value)
      }

      return updated
    })

    // Clear field-specific errors
    if (errors[field]) {
      setErrors(prev => {
        const { [field]: _, ...rest } = prev
        return rest
      })
    }
  }

  // Handle TinyMCE content change
  const handleRichTextChange = (content: string) => {
    updateFormData('content', content)
    setMarkdownContent(content)
  }

  // Handle Markdown content change
  const handleMarkdownChange = (content: string) => {
    setMarkdownContent(content)
    updateFormData('content', content)
  }

  // Add tag
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag)) {
      updateFormData('tags', [...formData.tags, tag])
      setTagInput('')
    }
  }

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    updateFormData('tags', formData.tags.filter(tag => tag !== tagToRemove))
  }

  // Handle tag input keypress
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required'
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required'
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required'
    }

    if (!formData.excerpt.trim()) {
      newErrors.excerpt = 'Excerpt is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle save
  const handleSave = async (status?: 'draft' | 'published') => {
    if (!validateForm()) return

    try {
      setIsSaving(true)
      const dataToSave = {
        ...formData,
        status: status || formData.status,
        publishNow: status === 'published'
      }
      await onSave(dataToSave)
    } catch (error) {
      console.error('Error saving article:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // TinyMCE configuration
  const tinyMCEConfig = {
    height: 500,
    menubar: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
    ],
    toolbar: 'undo redo | blocks | ' +
      'bold italic forecolor | alignleft aligncenter ' +
      'alignright alignjustify | bullist numlist outdent indent | ' +
      'removeformat | help | link image media | code preview',
    content_style: `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.6;
      }
      .mce-content-body { padding: 20px; }
    `,
    setup: (editor: any) => {
      editorRef.current = editor
    }
  }

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'create' ? 'Create New Article' : 'Edit Article'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Write and manage help documentation with rich text editing and live preview
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {/* Editor Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setEditorMode('rich')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  editorMode === 'rich'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Monitor className="h-4 w-4 inline mr-1" />
                Rich Text
              </button>
              <button
                onClick={() => setEditorMode('markdown')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  editorMode === 'markdown'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="h-4 w-4 inline mr-1" />
                Markdown
              </button>
              <button
                onClick={() => setEditorMode('preview')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  editorMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="h-4 w-4 inline mr-1" />
                Preview
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave('draft')}
                disabled={isSaving || isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => handleSave('published')}
                disabled={isSaving || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Content Area */}
        <div className="flex-1 p-6">
          {/* Basic Information */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Article Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                placeholder="Enter article title..."
                className={`w-full px-3 py-2 border rounded-lg text-lg font-medium ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL Slug *
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-500">
                  /help/articles/
                </span>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => updateFormData('slug', e.target.value)}
                  placeholder="article-url-slug"
                  className={`flex-1 px-3 py-2 border rounded-r-lg ${
                    errors.slug ? 'border-red-300' : 'border-gray-300'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
              </div>
              {errors.slug && (
                <p className="text-red-600 text-sm mt-1">{errors.slug}</p>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excerpt *
              </label>
              <textarea
                value={formData.excerpt}
                onChange={(e) => updateFormData('excerpt', e.target.value)}
                placeholder="Brief summary of the article..."
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg ${
                  errors.excerpt ? 'border-red-300' : 'border-gray-300'
                } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              />
              {errors.excerpt && (
                <p className="text-red-600 text-sm mt-1">{errors.excerpt}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                {formData.excerpt.length}/300 characters recommended
              </p>
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content *
              </label>

              {/* Rich Text Editor */}
              {editorMode === 'rich' && (
                <div className={`border rounded-lg ${errors.content ? 'border-red-300' : 'border-gray-300'}`}>
                  <Editor
                    apiKey="no-api-key" // You'll need to get a TinyMCE API key for production
                    value={formData.content}
                    onEditorChange={handleRichTextChange}
                    init={tinyMCEConfig}
                  />
                </div>
              )}

              {/* Markdown Editor */}
              {editorMode === 'markdown' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Markdown</div>
                    <textarea
                      value={markdownContent}
                      onChange={(e) => handleMarkdownChange(e.target.value)}
                      placeholder="Write your content in Markdown..."
                      className={`w-full h-96 px-3 py-2 border rounded-lg font-mono text-sm ${
                        errors.content ? 'border-red-300' : 'border-gray-300'
                      } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
                    <div className="h-96 p-4 border border-gray-300 rounded-lg bg-gray-50 overflow-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        rehypePlugins={[rehypeHighlight, rehypeRaw]}
                        className="prose prose-sm max-w-none"
                      >
                        {markdownContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Mode */}
              {editorMode === 'preview' && (
                <div className="border border-gray-300 rounded-lg p-6 bg-gray-50 min-h-96">
                  <div className="prose max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeHighlight, rehypeRaw]}
                    >
                      {formData.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {errors.content && (
                <p className="text-red-600 text-sm mt-1">{errors.content}</p>
              )}

              {formData.readingTime > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Estimated reading time: {formData.readingTime} minute{formData.readingTime !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-200 p-6 bg-gray-50">
          <div className="space-y-6">
            {/* Publish Settings */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Publish Settings</h3>
              <div className="space-y-3">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => updateFormData('categoryId', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      errors.categoryId ? 'border-red-300' : 'border-gray-300'
                    } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  >
                    <option value="">Select category...</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.categoryId && (
                    <p className="text-red-600 text-sm mt-1">{errors.categoryId}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => updateFormData('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                {/* Featured Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Featured Image
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={formData.featuredImage || ''}
                      onChange={(e) => updateFormData('featuredImage', e.target.value)}
                      placeholder="Image URL..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>
              <div className="space-y-2">
                {/* Tag Input */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    placeholder="Add tag..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>

                {/* Tags List */}
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* SEO Settings */}
            <div>
              <button
                onClick={() => setShowSeoSettings(!showSeoSettings)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
              >
                <span className="flex items-center">
                  <Search className="h-4 w-4 mr-2" />
                  SEO Settings
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showSeoSettings ? 'rotate-180' : ''}`} />
              </button>

              {showSeoSettings && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      SEO Title
                    </label>
                    <input
                      type="text"
                      value={formData.seoTitle || ''}
                      onChange={(e) => updateFormData('seoTitle', e.target.value)}
                      placeholder="SEO optimized title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(formData.seoTitle || '').length}/60 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      SEO Description
                    </label>
                    <textarea
                      value={formData.seoDescription || ''}
                      onChange={(e) => updateFormData('seoDescription', e.target.value)}
                      placeholder="Brief description for search engines..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(formData.seoDescription || '').length}/160 characters
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <div>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
              >
                <span className="flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Advanced
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
              </button>

              {showAdvancedSettings && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Related Articles
                    </label>
                    <p className="text-xs text-gray-500">
                      Coming soon: Select related articles
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reading Time Override
                    </label>
                    <input
                      type="number"
                      value={formData.readingTime || ''}
                      onChange={(e) => updateFormData('readingTime', parseInt(e.target.value) || 0)}
                      placeholder="Auto-calculated"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty for auto-calculation
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}