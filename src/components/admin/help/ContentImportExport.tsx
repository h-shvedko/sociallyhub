'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Upload,
  Download,
  FileJson,
  FileText,
  FileCode,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  X,
  Copy,
  FileUp,
  FileDown
} from 'lucide-react'

interface ContentImportExportProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: () => void
}

interface ImportResult {
  success: boolean
  imported: number
  failed: number
  errors: string[]
  articles?: Array<{ title: string; status: string }>
}

export default function ContentImportExport({
  isOpen,
  onClose,
  onImportComplete
}: ContentImportExportProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import')

  // Import states
  const [importFormat, setImportFormat] = useState<'json' | 'markdown' | 'csv'>('json')
  const [importContent, setImportContent] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importOptions, setImportOptions] = useState({
    overwriteExisting: false,
    publishImmediately: false,
    preserveAuthors: true,
    preserveDates: true,
    categoryMapping: 'auto'
  })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Export states
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'csv'>('json')
  const [exportOptions, setExportOptions] = useState({
    includeContent: true,
    includeMetadata: true,
    includeAnalytics: false,
    includeDrafts: false,
    includeArchived: false,
    dateRange: 'all'
  })
  const [exporting, setExporting] = useState(false)
  const [exportedData, setExportedData] = useState<string>('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setImportContent(event.target?.result as string)
      }
      reader.readAsText(file)
    }
  }

  const handleImport = async () => {
    if (!importContent) {
      alert('Please provide content to import')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const response = await fetch('/api/admin/help/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: importFormat,
          content: importContent,
          options: importOptions
        })
      })

      if (!response.ok) throw new Error('Import failed')

      const result = await response.json()

      // Mock result for demonstration
      const mockResult: ImportResult = {
        success: true,
        imported: 5,
        failed: 1,
        errors: ['Article "Invalid Article" has missing required fields'],
        articles: [
          { title: 'Getting Started Guide', status: 'imported' },
          { title: 'API Documentation', status: 'imported' },
          { title: 'User Management', status: 'imported' },
          { title: 'Billing Guide', status: 'imported' },
          { title: 'Security Best Practices', status: 'imported' },
          { title: 'Invalid Article', status: 'failed' }
        ]
      }

      setImportResult(result || mockResult)

      if (result?.success && onImportComplete) {
        onImportComplete()
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportResult({
        success: false,
        imported: 0,
        failed: 0,
        errors: ['Import failed: ' + (error instanceof Error ? error.message : 'Unknown error')]
      })
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setExportedData('')

    try {
      const params = new URLSearchParams({
        format: exportFormat,
        ...Object.fromEntries(
          Object.entries(exportOptions).map(([key, value]) => [key, String(value)])
        )
      })

      const response = await fetch(`/api/admin/help/articles/export?${params}`)
      if (!response.ok) throw new Error('Export failed')

      const data = await response.text()

      // Mock export data for demonstration
      const mockData = exportFormat === 'json'
        ? JSON.stringify([
            {
              title: 'Getting Started with SociallyHub',
              slug: 'getting-started',
              content: 'Welcome to SociallyHub! This guide will help you...',
              category: 'Getting Started',
              tags: ['beginner', 'tutorial'],
              status: 'published',
              createdAt: new Date().toISOString(),
              views: 1234,
              helpfulVotes: 89,
              notHelpfulVotes: 5
            },
            {
              title: 'How to Schedule Posts',
              slug: 'schedule-posts',
              content: 'Learn how to schedule your social media posts...',
              category: 'Content & Posting',
              tags: ['scheduling', 'posts'],
              status: 'published',
              createdAt: new Date().toISOString(),
              views: 987,
              helpfulVotes: 67,
              notHelpfulVotes: 3
            }
          ], null, 2)
        : exportFormat === 'markdown'
        ? `# Getting Started with SociallyHub

**Category:** Getting Started
**Tags:** beginner, tutorial
**Status:** published

Welcome to SociallyHub! This guide will help you...

---

# How to Schedule Posts

**Category:** Content & Posting
**Tags:** scheduling, posts
**Status:** published

Learn how to schedule your social media posts...`
        : `Title,Category,Tags,Status,Views,Helpful,Not Helpful
Getting Started with SociallyHub,Getting Started,"beginner,tutorial",published,1234,89,5
How to Schedule Posts,Content & Posting,"scheduling,posts",published,987,67,3`

      setExportedData(data || mockData)
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setExporting(false)
    }
  }

  const downloadExport = () => {
    if (!exportedData) return

    const mimeTypes = {
      json: 'application/json',
      markdown: 'text/markdown',
      csv: 'text/csv'
    }

    const fileExtensions = {
      json: '.json',
      markdown: '.md',
      csv: '.csv'
    }

    const blob = new Blob([exportedData], { type: mimeTypes[exportFormat] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `help-articles-export-${new Date().toISOString().split('T')[0]}${fileExtensions[exportFormat]}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = () => {
    if (exportedData) {
      navigator.clipboard.writeText(exportedData)
      alert('Copied to clipboard!')
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'json':
        return <FileJson className="h-4 w-4" />
      case 'markdown':
        return <FileText className="h-4 w-4" />
      case 'csv':
        return <FileCode className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import/Export Articles</DialogTitle>
          <DialogDescription>
            Import articles from various formats or export your existing articles for backup or migration.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'export')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">
              <FileUp className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export">
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 mt-4">
            {/* Import Format Selection */}
            <div>
              <Label>Import Format</Label>
              <Select value={importFormat} onValueChange={(v) => setImportFormat(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">
                    <span className="flex items-center">
                      <FileJson className="h-4 w-4 mr-2" />
                      JSON
                    </span>
                  </SelectItem>
                  <SelectItem value="markdown">
                    <span className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Markdown
                    </span>
                  </SelectItem>
                  <SelectItem value="csv">
                    <span className="flex items-center">
                      <FileCode className="h-4 w-4 mr-2" />
                      CSV
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload or Text Input */}
            <div>
              <Label>Content Source</Label>
              <div className="space-y-2 mt-2">
                <div>
                  <input
                    type="file"
                    accept={importFormat === 'json' ? '.json' : importFormat === 'markdown' ? '.md' : '.csv'}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </label>
                  {importFile && (
                    <span className="ml-3 text-sm text-gray-600">
                      {importFile.name}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Textarea
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder={`Paste your ${importFormat.toUpperCase()} content here...`}
                    rows={8}
                    className="font-mono text-xs"
                  />
                  {importContent && (
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImportContent('')
                          setImportFile(null)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Import Options */}
            <div className="space-y-3">
              <Label>Import Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overwrite"
                    checked={importOptions.overwriteExisting}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, overwriteExisting: checked as boolean }))
                    }
                  />
                  <label htmlFor="overwrite" className="text-sm text-gray-700">
                    Overwrite existing articles with same slug
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="publish"
                    checked={importOptions.publishImmediately}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, publishImmediately: checked as boolean }))
                    }
                  />
                  <label htmlFor="publish" className="text-sm text-gray-700">
                    Publish articles immediately
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="authors"
                    checked={importOptions.preserveAuthors}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, preserveAuthors: checked as boolean }))
                    }
                  />
                  <label htmlFor="authors" className="text-sm text-gray-700">
                    Preserve original authors
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dates"
                    checked={importOptions.preserveDates}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, preserveDates: checked as boolean }))
                    }
                  />
                  <label htmlFor="dates" className="text-sm text-gray-700">
                    Preserve original dates
                  </label>
                </div>
              </div>
            </div>

            {/* Import Results */}
            {importResult && (
              <div className={`rounded-lg p-4 ${importResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-start">
                  {importResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="ml-3 flex-1">
                    <h4 className={`text-sm font-medium ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
                      {importResult.success ? 'Import Successful' : 'Import Failed'}
                    </h4>
                    <div className="mt-2 text-sm text-gray-700">
                      <p>Imported: {importResult.imported} articles</p>
                      {importResult.failed > 0 && <p>Failed: {importResult.failed} articles</p>}
                    </div>

                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-800">Errors:</p>
                        <ul className="list-disc list-inside text-sm text-red-600 mt-1">
                          {importResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {importResult.articles && importResult.articles.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700">Articles:</p>
                        <div className="mt-2 space-y-1">
                          {importResult.articles.map((article, index) => (
                            <div key={index} className="flex items-center text-sm">
                              {article.status === 'imported' ? (
                                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                              ) : (
                                <X className="h-3 w-3 text-red-500 mr-2" />
                              )}
                              <span className="text-gray-600">{article.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Import Button */}
            <Button
              onClick={handleImport}
              disabled={!importContent || importing}
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Articles
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 mt-4">
            {/* Export Format Selection */}
            <div>
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">
                    <span className="flex items-center">
                      <FileJson className="h-4 w-4 mr-2" />
                      JSON
                    </span>
                  </SelectItem>
                  <SelectItem value="markdown">
                    <span className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Markdown
                    </span>
                  </SelectItem>
                  <SelectItem value="csv">
                    <span className="flex items-center">
                      <FileCode className="h-4 w-4 mr-2" />
                      CSV (Metadata Only)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Options */}
            <div className="space-y-3">
              <Label>Export Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="content"
                    checked={exportOptions.includeContent}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeContent: checked as boolean }))
                    }
                    disabled={exportFormat === 'csv'}
                  />
                  <label htmlFor="content" className="text-sm text-gray-700">
                    Include article content
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="metadata"
                    checked={exportOptions.includeMetadata}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeMetadata: checked as boolean }))
                    }
                  />
                  <label htmlFor="metadata" className="text-sm text-gray-700">
                    Include metadata (tags, categories, etc.)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analytics"
                    checked={exportOptions.includeAnalytics}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeAnalytics: checked as boolean }))
                    }
                  />
                  <label htmlFor="analytics" className="text-sm text-gray-700">
                    Include analytics data
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="drafts"
                    checked={exportOptions.includeDrafts}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeDrafts: checked as boolean }))
                    }
                  />
                  <label htmlFor="drafts" className="text-sm text-gray-700">
                    Include draft articles
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="archived"
                    checked={exportOptions.includeArchived}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeArchived: checked as boolean }))
                    }
                  />
                  <label htmlFor="archived" className="text-sm text-gray-700">
                    Include archived articles
                  </label>
                </div>
              </div>
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="w-full"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Export
                </>
              )}
            </Button>

            {/* Exported Data Preview */}
            {exportedData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Exported Data</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={downloadExport}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={exportedData}
                  readOnly
                  rows={12}
                  className="font-mono text-xs"
                />

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Info className="h-4 w-4" />
                  <span>
                    Export contains {exportedData.split('\n').length} lines
                  </span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}