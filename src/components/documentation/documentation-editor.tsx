'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import {
  Save,
  Eye,
  FileText,
  Code,
  Settings,
  Plus,
  X,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  History,
  Share,
  Download,
  Upload,
  Tag,
  Search,
  Link,
  Trash2,
  Edit,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

interface DocumentationSection {
  id: string
  title: string
  slug: string
  icon?: string
}

interface DocumentationPage {
  id?: string
  title: string
  slug: string
  content: string
  excerpt?: string
  sectionId: string
  tags: string[]
  status: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED'
  visibility: 'PUBLIC' | 'INTERNAL' | 'PRIVATE'
  featuredImage?: string
  sortOrder: number
  seoTitle?: string
  seoDescription?: string
  keywords: string[]
  estimatedReadTime?: number
  metadata?: any
}

interface CodeExample {
  id?: string
  title: string
  description?: string
  language: string
  code: string
  isTestable: boolean
  testCommand?: string
  expectedOutput?: string
  testResults?: any
  sortOrder: number
  tags: string[]
}

interface Version {
  id: string
  version: string
  title: string
  changelog: string
  createdAt: string
  isActive: boolean
  author: { name: string }
}

interface DocumentationEditorProps {
  pageId?: string
  mode?: 'create' | 'edit'
  onSave?: (page: DocumentationPage) => void
  onCancel?: () => void
}

const PROGRAMMING_LANGUAGES = [
  'JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'JAVA', 'CSHARP', 'CPP', 'PHP', 'RUBY',
  'GO', 'RUST', 'KOTLIN', 'SWIFT', 'SHELL', 'SQL', 'HTML', 'CSS', 'JSON', 'YAML', 'MARKDOWN', 'OTHER'
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', color: 'bg-gray-500' },
  { value: 'REVIEW', label: 'Review', color: 'bg-yellow-500' },
  { value: 'PUBLISHED', label: 'Published', color: 'bg-green-500' },
  { value: 'ARCHIVED', label: 'Archived', color: 'bg-red-500' }
]

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public - Visible to everyone' },
  { value: 'INTERNAL', label: 'Internal - Team members only' },
  { value: 'PRIVATE', label: 'Private - Author only' }
]

export default function DocumentationEditor({ pageId, mode = 'create', onSave, onCancel }: DocumentationEditorProps) {
  const router = useRouter()

  // Page state
  const [page, setPage] = useState<DocumentationPage>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    sectionId: '',
    tags: [],
    status: 'DRAFT',
    visibility: 'INTERNAL',
    sortOrder: 0,
    keywords: []
  })

  // UI state
  const [sections, setSections] = useState<DocumentationSection[]>([])
  const [codeExamples, setCodeExamples] = useState<CodeExample[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeTab, setActiveTab] = useState('content')
  const [tagInput, setTagInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [newCodeExample, setNewCodeExample] = useState<CodeExample>({
    title: '',
    description: '',
    language: 'JAVASCRIPT',
    code: '',
    isTestable: false,
    testCommand: '',
    expectedOutput: '',
    sortOrder: 0,
    tags: []
  })
  const [editingCodeExample, setEditingCodeExample] = useState<string | null>(null)
  const [versionComment, setVersionComment] = useState('')
  const [majorVersion, setMajorVersion] = useState(false)

  // Load data
  useEffect(() => {
    loadSections()
    if (mode === 'edit' && pageId) {
      loadPage()
    }
  }, [pageId, mode])

  const loadSections = async () => {
    try {
      const response = await fetch('/api/documentation/sections')
      if (response.ok) {
        const data = await response.json()
        setSections(data)
      }
    } catch (error) {
      console.error('Failed to load sections:', error)
      toast.error('Failed to load sections')
    }
  }

  const loadPage = async () => {
    if (!pageId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/documentation/manage/${pageId}`)
      if (response.ok) {
        const data = await response.json()
        setPage({
          id: data.id,
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt || '',
          sectionId: data.sectionId,
          tags: data.tags || [],
          status: data.status,
          visibility: data.visibility,
          featuredImage: data.featuredImage,
          sortOrder: data.sortOrder,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          keywords: data.keywords || [],
          estimatedReadTime: data.estimatedReadTime,
          metadata: data.metadata
        })
        setCodeExamples(data.codeExamples || [])
        setVersions(data.versions || [])
      } else {
        throw new Error('Failed to load page')
      }
    } catch (error) {
      console.error('Failed to load page:', error)
      toast.error('Failed to load page')
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate slug from title
  const generateSlug = useCallback((title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }, [])

  // Estimate read time (rough calculation: 200 words per minute)
  const estimateReadTime = useCallback((content: string) => {
    const wordCount = content.split(/\s+/).length
    return Math.max(1, Math.ceil(wordCount / 200))
  }, [])

  // Handle page changes
  const handlePageChange = (field: keyof DocumentationPage, value: any) => {
    setPage(prev => {
      const updated = { ...prev, [field]: value }

      // Auto-generate slug when title changes
      if (field === 'title' && mode === 'create') {
        updated.slug = generateSlug(value)
      }

      // Auto-estimate read time when content changes
      if (field === 'content') {
        updated.estimatedReadTime = estimateReadTime(value)
      }

      return updated
    })
  }

  // Tag management
  const addTag = () => {
    if (tagInput.trim() && !page.tags.includes(tagInput.trim())) {
      handlePageChange('tags', [...page.tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    handlePageChange('tags', page.tags.filter(t => t !== tag))
  }

  // Keyword management
  const addKeyword = () => {
    if (keywordInput.trim() && !page.keywords.includes(keywordInput.trim())) {
      handlePageChange('keywords', [...page.keywords, keywordInput.trim()])
      setKeywordInput('')
    }
  }

  const removeKeyword = (keyword: string) => {
    handlePageChange('keywords', page.keywords.filter(k => k !== keyword))
  }

  // Code example management
  const addCodeExample = async () => {
    if (!newCodeExample.title || !newCodeExample.code) {
      toast.error('Title and code are required')
      return
    }

    try {
      const response = await fetch('/api/documentation/code-examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCodeExample,
          pageId: page.id,
          sortOrder: codeExamples.length
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCodeExamples(prev => [...prev, data])
        setNewCodeExample({
          title: '',
          description: '',
          language: 'JAVASCRIPT',
          code: '',
          isTestable: false,
          testCommand: '',
          expectedOutput: '',
          sortOrder: 0,
          tags: []
        })
        toast.success('Code example added')
      }
    } catch (error) {
      console.error('Failed to add code example:', error)
      toast.error('Failed to add code example')
    }
  }

  const runCodeTest = async (exampleId: string) => {
    try {
      const response = await fetch('/api/documentation/code-examples', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runTests: true })
      })

      if (response.ok) {
        const data = await response.json()
        setCodeExamples(prev => prev.map(ex => ex.id === exampleId ? data : ex))
        toast.success('Test completed')
      }
    } catch (error) {
      console.error('Failed to run test:', error)
      toast.error('Failed to run test')
    }
  }

  // Save page
  const handleSave = async () => {
    if (!page.title || !page.content || !page.sectionId) {
      toast.error('Title, content, and section are required')
      return
    }

    setSaving(true)
    try {
      const url = mode === 'edit' && pageId
        ? `/api/documentation/manage/${pageId}`
        : '/api/documentation/manage'

      const method = mode === 'edit' ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...page,
          versionComment,
          majorVersion
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Page ${mode === 'edit' ? 'updated' : 'created'} successfully`)

        if (onSave) {
          onSave(data)
        } else {
          router.push('/dashboard/documentation/manage')
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save page')
      }
    } catch (error) {
      console.error('Failed to save page:', error)
      toast.error('Failed to save page')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {mode === 'edit' ? 'Edit Documentation Page' : 'Create Documentation Page'}
          </h1>
          <p className="text-muted-foreground">
            {mode === 'edit'
              ? 'Update your documentation page with rich content, code examples, and metadata'
              : 'Create a new documentation page with rich content and code examples'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" onClick={onCancel || (() => router.back())}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {previewMode ? (
        // Preview Mode
        <Card>
          <CardContent className="p-8">
            <div className="prose max-w-none">
              <h1>{page.title}</h1>
              {page.excerpt && <p className="lead">{page.excerpt}</p>}
              <div dangerouslySetInnerHTML={{ __html: page.content.replace(/\n/g, '<br>') }} />

              {codeExamples.length > 0 && (
                <div className="mt-8">
                  <h2>Code Examples</h2>
                  {codeExamples.map((example) => (
                    <div key={example.id} className="mb-6">
                      <h3>{example.title}</h3>
                      {example.description && <p>{example.description}</p>}
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                        <code>{example.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        // Edit Mode
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="content">
              <FileText className="h-4 w-4 mr-2" />
              Content
            </TabsTrigger>
            <TabsTrigger value="examples">
              <Code className="h-4 w-4 mr-2" />
              Code Examples
            </TabsTrigger>
            <TabsTrigger value="metadata">
              <Settings className="h-4 w-4 mr-2" />
              Metadata
            </TabsTrigger>
            <TabsTrigger value="versions">
              <History className="h-4 w-4 mr-2" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="collaboration">
              <Users className="h-4 w-4 mr-2" />
              Collaboration
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={page.title}
                      onChange={(e) => handlePageChange('title', e.target.value)}
                      placeholder="Enter page title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      value={page.slug}
                      onChange={(e) => handlePageChange('slug', e.target.value)}
                      placeholder="page-slug"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="section">Section *</Label>
                    <Select value={page.sectionId} onValueChange={(value) => handlePageChange('sectionId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={page.status} onValueChange={(value) => handlePageChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${status.color}`} />
                              {status.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visibility">Visibility</Label>
                    <Select value={page.visibility} onValueChange={(value) => handlePageChange('visibility', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_OPTIONS.map((visibility) => (
                          <SelectItem key={visibility.value} value={visibility.value}>
                            {visibility.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea
                    id="excerpt"
                    value={page.excerpt}
                    onChange={(e) => handlePageChange('excerpt', e.target.value)}
                    placeholder="Brief description of the page content"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    value={page.content}
                    onChange={(e) => handlePageChange('content', e.target.value)}
                    placeholder="Write your documentation content here..."
                    rows={20}
                    className="font-mono"
                  />
                  <div className="text-sm text-muted-foreground">
                    Estimated read time: {page.estimatedReadTime || 1} minute{(page.estimatedReadTime || 1) !== 1 ? 's' : ''}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {page.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add tag"
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    />
                    <Button type="button" onClick={addTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Code Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Existing Code Examples */}
                {codeExamples.map((example, index) => (
                  <div key={example.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{example.title}</h3>
                        <Badge variant="outline">{example.language}</Badge>
                        {example.isTestable && (
                          <Badge variant="secondary">
                            <Play className="h-3 w-3 mr-1" />
                            Testable
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {example.isTestable && (
                          <Button size="sm" variant="outline" onClick={() => runCodeTest(example.id!)}>
                            <Play className="h-3 w-3 mr-1" />
                            Run Test
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {example.description && (
                      <p className="text-sm text-muted-foreground">{example.description}</p>
                    )}

                    <pre className="bg-muted p-3 rounded-md overflow-x-auto text-sm">
                      <code>{example.code}</code>
                    </pre>

                    {example.testResults && (
                      <div className={`flex items-center gap-2 text-sm ${
                        example.testResults.passed ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {example.testResults.passed ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {example.testResults.passed ? 'Test passed' : 'Test failed'}
                        {example.testResults.duration && (
                          <span className="text-muted-foreground">
                            ({example.testResults.duration}ms)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add New Code Example */}
                <div className="border-2 border-dashed border-muted rounded-lg p-6 space-y-4">
                  <h3 className="font-semibold">Add New Code Example</h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={newCodeExample.title}
                        onChange={(e) => setNewCodeExample(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Example title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={newCodeExample.language}
                        onValueChange={(value) => setNewCodeExample(prev => ({ ...prev, language: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROGRAMMING_LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang.charAt(0) + lang.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={newCodeExample.description}
                      onChange={(e) => setNewCodeExample(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the code example"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Code</Label>
                    <Textarea
                      value={newCodeExample.code}
                      onChange={(e) => setNewCodeExample(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="Enter your code here..."
                      rows={8}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newCodeExample.isTestable}
                      onCheckedChange={(checked) => setNewCodeExample(prev => ({ ...prev, isTestable: checked }))}
                    />
                    <Label>Make this code example testable</Label>
                  </div>

                  {newCodeExample.isTestable && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Test Command</Label>
                        <Input
                          value={newCodeExample.testCommand}
                          onChange={(e) => setNewCodeExample(prev => ({ ...prev, testCommand: e.target.value }))}
                          placeholder="npm test, python test.py, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Output</Label>
                        <Input
                          value={newCodeExample.expectedOutput}
                          onChange={(e) => setNewCodeExample(prev => ({ ...prev, expectedOutput: e.target.value }))}
                          placeholder="Expected output or success message"
                        />
                      </div>
                    </div>
                  )}

                  <Button onClick={addCodeExample} disabled={!newCodeExample.title || !newCodeExample.code}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Code Example
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SEO & Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="seoTitle">SEO Title</Label>
                    <Input
                      id="seoTitle"
                      value={page.seoTitle || ''}
                      onChange={(e) => handlePageChange('seoTitle', e.target.value)}
                      placeholder="Custom title for search engines"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sortOrder">Sort Order</Label>
                    <Input
                      id="sortOrder"
                      type="number"
                      value={page.sortOrder}
                      onChange={(e) => handlePageChange('sortOrder', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seoDescription">SEO Description</Label>
                  <Textarea
                    id="seoDescription"
                    value={page.seoDescription || ''}
                    onChange={(e) => handlePageChange('seoDescription', e.target.value)}
                    placeholder="Meta description for search engines"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Keywords</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {page.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                        {keyword}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeKeyword(keyword)} />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      placeholder="Add keyword"
                      onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    />
                    <Button type="button" onClick={addKeyword}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="featuredImage">Featured Image URL</Label>
                  <Input
                    id="featuredImage"
                    value={page.featuredImage || ''}
                    onChange={(e) => handlePageChange('featuredImage', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mode === 'edit' && (
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Create New Version</h3>
                    <div className="space-y-2">
                      <Label>Version Comment</Label>
                      <Input
                        value={versionComment}
                        onChange={(e) => setVersionComment(e.target.value)}
                        placeholder="Describe the changes made in this version"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={majorVersion}
                        onCheckedChange={setMajorVersion}
                      />
                      <Label>Major version (increment first number)</Label>
                    </div>
                  </div>
                )}

                {versions.length > 0 ? (
                  <div className="space-y-3">
                    {versions.map((version) => (
                      <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant={version.isActive ? 'default' : 'secondary'}>
                            v{version.version}
                          </Badge>
                          <div>
                            <p className="font-medium">{version.title}</p>
                            <p className="text-sm text-muted-foreground">{version.changelog}</p>
                            <p className="text-xs text-muted-foreground">
                              by {version.author.name} on {new Date(version.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {version.isActive && (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No versions available yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collaboration Tab */}
          <TabsContent value="collaboration" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Collaboration & Review</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Collaboration features will be available in the next update.
                  This will include reviewer assignments, comments, and approval workflows.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Export functionality will be available in the next update.
                  This will include PDF generation, offline documentation packages, and more.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}