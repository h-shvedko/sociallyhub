'use client'

import { useState, useRef } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Upload,
  Download,
  FileText,
  File,
  FileCode,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  RefreshCw
} from 'lucide-react'

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

interface Category {
  id: string
  name: string
}

interface Article {
  id: string
  title: string
  status: string
  category: {
    name: string
  }
}

export default function ImportExport() {
  const [categories, setCategories] = useState<Category[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importFormat, setImportFormat] = useState<string>('')
  const [importCategory, setImportCategory] = useState<string>('')
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // Export state
  const [exportFormat, setExportFormat] = useState<string>('json')
  const [exportStatus, setExportStatus] = useState<string>('')
  const [exportCategory, setExportCategory] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load categories and articles on mount
  useState(() => {
    fetchCategories()
    fetchArticles()
  })

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/help/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchArticles = async () => {
    try {
      const response = await fetch('/api/admin/help/articles')
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || [])
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImportFile(file)

      // Auto-detect format based on file extension
      const extension = file.name.toLowerCase().split('.').pop()
      switch (extension) {
        case 'json':
          setImportFormat('json')
          break
        case 'md':
        case 'markdown':
          setImportFormat('markdown')
          break
        case 'html':
        case 'htm':
          setImportFormat('html')
          break
        case 'csv':
          setImportFormat('csv')
          break
        default:
          setImportFormat('')
      }
    }
  }

  const handleImport = async () => {
    if (!importFile || !importFormat) {
      alert('Please select a file and format')
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('format', importFormat)
      if (importCategory) {
        formData.append('categoryId', importCategory)
      }
      formData.append('overwriteExisting', overwriteExisting.toString())

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const response = await fetch('/api/admin/help/import', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setImportProgress(100)

      if (response.ok) {
        const result = await response.json()
        setImportResult(result.results)
        await fetchArticles() // Refresh articles list
      } else {
        const error = await response.json()
        setImportResult({
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [error.error || 'Import failed']
        })
      }
    } catch (error) {
      setImportResult({
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: ['Network error: ' + (error as Error).message]
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const params = new URLSearchParams({
        format: exportFormat
      })

      if (exportStatus) {
        params.append('status', exportStatus)
      }

      if (exportCategory) {
        params.append('categoryId', exportCategory)
      }

      if (selectedArticles.length > 0) {
        params.append('articleIds', selectedArticles.join(','))
      }

      const response = await fetch(`/api/admin/help/export?${params}`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url

        // Get filename from Content-Disposition header or generate one
        const contentDisposition = response.headers.get('Content-Disposition')
        const filenameMatch = contentDisposition?.match(/filename="([^"]*)"/)
        const filename = filenameMatch?.[1] || `help-articles-export.${exportFormat}`

        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const error = await response.json()
        alert('Export failed: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      alert('Export failed: ' + (error as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  const resetImport = () => {
    setImportFile(null)
    setImportFormat('')
    setImportCategory('')
    setOverwriteExisting(false)
    setImportProgress(0)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json':
        return <FileCode className="h-4 w-4" />
      case 'markdown':
        return <FileText className="h-4 w-4" />
      case 'html':
        return <File className="h-4 w-4" />
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4" />
      default:
        return <File className="h-4 w-4" />
    }
  }

  const toggleArticleSelection = (articleId: string) => {
    setSelectedArticles(prev =>
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    )
  }

  const selectAllArticles = () => {
    setSelectedArticles(articles.map(article => article.id))
  }

  const clearSelection = () => {
    setSelectedArticles([])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import & Export</h1>
        <p className="text-gray-600">Bulk import and export help articles in various formats</p>
      </div>

      <Tabs defaultValue="import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="import">Import Articles</TabsTrigger>
          <TabsTrigger value="export">Export Articles</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Articles
              </CardTitle>
              <CardDescription>
                Import articles from JSON, Markdown, HTML, or CSV files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* File Selection */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-upload">Select File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    ref={fileInputRef}
                    accept=".json,.md,.markdown,.html,.htm,.csv"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                  {importFile && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <File className="h-4 w-4" />
                      <span>{importFile.name}</span>
                      <span>({(importFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="format-select">Format</Label>
                  <Select value={importFormat} onValueChange={setImportFormat}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4" />
                          JSON
                        </div>
                      </SelectItem>
                      <SelectItem value="markdown">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Markdown
                        </div>
                      </SelectItem>
                      <SelectItem value="html">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          HTML
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          CSV
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="category-select">Default Category (Optional)</Label>
                  <Select value={importCategory} onValueChange={setImportCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No default category</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overwrite"
                    checked={overwriteExisting}
                    onCheckedChange={(checked) => setOverwriteExisting(checked as boolean)}
                  />
                  <Label htmlFor="overwrite">
                    Overwrite existing articles with same title or slug
                  </Label>
                </div>
              </div>

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Importing articles...</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}

              {/* Import Results */}
              {importResult && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Import Results</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-semibold">{importResult.imported}</div>
                        <div className="text-sm text-gray-600">Imported</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <Info className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-semibold">{importResult.updated}</div>
                        <div className="text-sm text-gray-600">Updated</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <div className="font-semibold">{importResult.skipped}</div>
                        <div className="text-sm text-gray-600">Skipped</div>
                      </div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Errors:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="text-sm text-red-600 p-2 bg-red-50 rounded">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!importFile || !importFormat || isImporting}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? 'Importing...' : 'Import Articles'}
                </Button>
                <Button variant="outline" onClick={resetImport}>
                  Reset
                </Button>
              </div>

              {/* Format Help */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Supported Formats:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {getFormatIcon('json')}
                    <span><strong>JSON:</strong> Array of article objects or single article</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getFormatIcon('markdown')}
                    <span><strong>Markdown:</strong> Articles with YAML frontmatter separated by ---</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getFormatIcon('html')}
                    <span><strong>HTML:</strong> Single HTML document with title and body content</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getFormatIcon('csv')}
                    <span><strong>CSV:</strong> Comma-separated values with headers</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Articles
              </CardTitle>
              <CardDescription>
                Export articles in various formats for backup or migration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="export-format">Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4" />
                          JSON
                        </div>
                      </SelectItem>
                      <SelectItem value="markdown">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Markdown
                        </div>
                      </SelectItem>
                      <SelectItem value="html">
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          HTML
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          CSV
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-status">Status Filter</Label>
                  <Select value={exportStatus} onValueChange={setExportStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-category">Category Filter</Label>
                  <Select value={exportCategory} onValueChange={setExportCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Article Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Select Articles (Optional)</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllArticles}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear Selection
                    </Button>
                  </div>
                </div>

                <div className="max-h-40 overflow-y-auto border rounded-lg p-4 space-y-2">
                  {articles.map(article => (
                    <div key={article.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`article-${article.id}`}
                        checked={selectedArticles.includes(article.id)}
                        onCheckedChange={() => toggleArticleSelection(article.id)}
                      />
                      <Label htmlFor={`article-${article.id}`} className="flex-1 text-sm">
                        {article.title}
                      </Label>
                      <Badge variant={article.status === 'published' ? 'default' : 'secondary'}>
                        {article.status}
                      </Badge>
                      <span className="text-xs text-gray-500">{article.category.name}</span>
                    </div>
                  ))}
                </div>

                {selectedArticles.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {selectedArticles.length} article(s) selected for export
                  </p>
                )}
              </div>

              {/* Export Action */}
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export Articles'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}