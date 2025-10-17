'use client'

import { useState, useEffect, useRef } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Eye,
  Code,
  Save,
  X,
  Tag,
  Pin,
  Link,
  Lightbulb,
  Plus,
  Settings,
  ChevronDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface FAQ {
  id: string
  question: string
  answer: string
  category: {
    id: string
    name: string
    slug: string
  }
  tags: string[]
  sortOrder: number
  isActive: boolean
  isPinned: boolean
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface FAQEditorProps {
  faq: FAQ | null
  categories: Category[]
  isOpen: boolean
  onClose: () => void
  onSave: (faqData: any) => Promise<void>
}

type EditorMode = 'rich' | 'markdown' | 'preview'

export default function FAQEditor({
  faq,
  categories,
  isOpen,
  onClose,
  onSave
}: FAQEditorProps) {
  const editorRef = useRef<any>(null)
  const [mode, setMode] = useState<EditorMode>('rich')
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    categoryId: '',
    tags: [] as string[],
    isActive: true,
    isPinned: false,
    sortOrder: 0,
    relatedArticles: [] as string[]
  })

  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (faq) {
      setFormData({
        question: faq.question || '',
        answer: faq.answer || '',
        categoryId: faq.category.id || '',
        tags: faq.tags || [],
        isActive: faq.isActive ?? true,
        isPinned: faq.isPinned ?? false,
        sortOrder: faq.sortOrder || 0,
        relatedArticles: []
      })
    } else {
      setFormData({
        question: '',
        answer: '',
        categoryId: categories[0]?.id || '',
        tags: [],
        isActive: true,
        isPinned: false,
        sortOrder: 0,
        relatedArticles: []
      })
    }
    setErrors({})
  }, [faq, categories])

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.question.trim()) {
      newErrors.question = 'Question is required'
    }

    if (!formData.answer.trim()) {
      newErrors.answer = 'Answer is required'
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Category is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error('Error saving FAQ:', error)
      alert(error instanceof Error ? error.message : 'Failed to save FAQ')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      updateFormData('tags', [...formData.tags, tag])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    updateFormData('tags', formData.tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  // Common FAQ templates for quick insertion
  const quickTemplates = [
    {
      name: 'How-to Guide',
      template: 'To accomplish this task:\n\n1. First step\n2. Second step\n3. Final step\n\nIf you need additional help, please contact support.'
    },
    {
      name: 'Troubleshooting',
      template: 'If you\'re experiencing this issue, try these solutions:\n\n**Solution 1:**\n- Check your settings\n- Verify permissions\n\n**Solution 2:**\n- Clear your cache\n- Restart the application\n\nIf the problem persists, contact our support team.'
    },
    {
      name: 'Feature Explanation',
      template: 'This feature allows you to:\n\n- Benefit 1\n- Benefit 2\n- Benefit 3\n\n**To use this feature:**\n1. Navigate to [location]\n2. Click [button]\n3. Configure your settings\n\nFor more information, see our detailed guide.'
    }
  ]

  const insertTemplate = (template: string) => {
    if (mode === 'rich' && editorRef.current) {
      editorRef.current.insertContent(template.replace(/\n/g, '<br>'))
    } else {
      updateFormData('answer', formData.answer + '\n\n' + template)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {faq ? 'Edit FAQ' : 'Create New FAQ'}
          </DialogTitle>
          <DialogDescription>
            {faq
              ? 'Update the FAQ question and answer below.'
              : 'Create a new frequently asked question for your knowledge base.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Question */}
            <div>
              <Label htmlFor="question" className="text-sm font-medium text-gray-700">
                Question *
              </Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) => updateFormData('question', e.target.value)}
                placeholder="What is your question?"
                className={`mt-1 ${errors.question ? 'border-red-500' : ''}`}
              />
              {errors.question && (
                <p className="mt-1 text-sm text-red-600">{errors.question}</p>
              )}
            </div>

            {/* Answer Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">
                  Answer *
                </Label>
                <div className="flex items-center gap-2">
                  {/* Quick Templates */}
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const template = quickTemplates.find(t => t.name === e.target.value)
                          if (template) {
                            insertTemplate(template.template)
                          }
                          e.target.value = ''
                        }
                      }}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      <option value="">Quick Templates</option>
                      {quickTemplates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Editor Mode Tabs */}
                  <div className="flex border rounded-md">
                    <button
                      type="button"
                      onClick={() => setMode('rich')}
                      className={`px-3 py-1 text-xs font-medium ${
                        mode === 'rich'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      } border-r`}
                    >
                      <Eye className="h-3 w-3 mr-1 inline" />
                      Rich
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('markdown')}
                      className={`px-3 py-1 text-xs font-medium ${
                        mode === 'markdown'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      } border-r`}
                    >
                      <Code className="h-3 w-3 mr-1 inline" />
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('preview')}
                      className={`px-3 py-1 text-xs font-medium ${
                        mode === 'preview'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Eye className="h-3 w-3 mr-1 inline" />
                      Preview
                    </button>
                  </div>
                </div>
              </div>

              {mode === 'rich' && (
                <Editor
                  apiKey="your-tinymce-api-key" // Replace with your TinyMCE API key
                  onInit={(evt, editor) => (editorRef.current = editor)}
                  value={formData.answer}
                  onEditorChange={(content) => updateFormData('answer', content)}
                  init={{
                    height: 300,
                    menubar: false,
                    plugins: [
                      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
                      'preview', 'anchor', 'searchreplace', 'visualblocks', 'code',
                      'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount'
                    ],
                    toolbar: 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
                    content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
                  }}
                />
              )}

              {mode === 'markdown' && (
                <Textarea
                  value={formData.answer}
                  onChange={(e) => updateFormData('answer', e.target.value)}
                  placeholder="Write your answer in Markdown..."
                  className="min-h-[300px] font-mono text-sm"
                />
              )}

              {mode === 'preview' && (
                <div className="min-h-[300px] p-4 border rounded-md bg-gray-50">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className="prose prose-sm max-w-none"
                  >
                    {formData.answer || '*Preview will appear here...*'}
                  </ReactMarkdown>
                </div>
              )}

              {errors.answer && (
                <p className="mt-1 text-sm text-red-600">{errors.answer}</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Settings</h3>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1">
                    Category *
                  </Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => updateFormData('categoryId', value)}
                  >
                    <SelectTrigger className={errors.categoryId ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>
                  )}
                </div>

                {/* Status Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-700">
                      Active
                    </Label>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(checked) => updateFormData('isActive', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-700">
                      Pinned
                    </Label>
                    <Switch
                      checked={formData.isPinned}
                      onCheckedChange={(checked) => updateFormData('isPinned', checked)}
                    />
                  </div>
                </div>

                {/* Sort Order */}
                <div>
                  <Label className="text-xs font-medium text-gray-700 mb-1">
                    Sort Order
                  </Label>
                  <Input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => updateFormData('sortOrder', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Higher numbers appear first
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>

              <div className="space-y-3">
                <div className="flex">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Add tag..."
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddTag}
                    className="ml-2"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="bg-gray-50 rounded-lg p-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-3"
              >
                <span className="flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Advanced
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1">
                      Related Articles
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        // Would open article selector dialog
                        alert('Article selector would open here')
                      }}
                    >
                      <Link className="h-3 w-3 mr-2" />
                      Link Articles
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1">
                      A/B Testing
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        // Would open A/B testing setup
                        alert('A/B testing setup would open here')
                      }}
                    >
                      <Lightbulb className="h-3 w-3 mr-2" />
                      Setup Test
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {faq ? 'Update FAQ' : 'Create FAQ'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}