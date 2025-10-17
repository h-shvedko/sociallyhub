'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  X,
  Check,
  Info
} from 'lucide-react'

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
}

interface Category {
  id: string
  name: string
  slug: string
}

interface ImportResult {
  question: string
  status: 'imported' | 'failed'
  error?: string
}

interface ImportResponse {
  success: boolean
  message: string
  imported: number
  failed: number
  errors: string[]
  faqs: ImportResult[]
}

interface ExportOptions {
  format: 'json' | 'csv'
  includeMetadata: boolean
  activeOnly: boolean
  selectedCategories: string[]
}

interface FAQImportExportProps {
  faqs: FAQ[]
  categories: Category[]
  onImportComplete: () => void
}

export default function FAQImportExport({ faqs, categories, onImportComplete }: FAQImportExportProps) {
  const [activeTab, setActiveTab] = useState('import')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)

  // Import state
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json')
  const [importContent, setImportContent] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importOptions, setImportOptions] = useState({
    overwriteExisting: false,
    createMissingCategories: true,
    validateData: true
  })
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResponse | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])

  // Export state
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeMetadata: true,
    activeOnly: false,
    selectedCategories: []
  })
  const [exportLoading, setExportLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewFileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isPreview = false) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isPreview) {
      setImportFile(file)
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (!isPreview) {
        setImportContent(content)
        // Auto-detect format based on file extension
        const extension = file.name.split('.').pop()?.toLowerCase()
        if (extension === 'csv') {
          setImportFormat('csv')
        } else if (extension === 'json') {
          setImportFormat('json')
        }
      } else {
        handlePreviewData(content, file.name.split('.').pop()?.toLowerCase() as 'json' | 'csv')
      }
    }
    reader.readAsText(file)
  }

  const handlePreviewData = (content: string, format: 'json' | 'csv') => {
    try {
      let parsedData: any[] = []

      if (format === 'json') {
        const parsed = JSON.parse(content)
        parsedData = Array.isArray(parsed) ? parsed : [parsed]
      } else if (format === 'csv') {
        const lines = content.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

        for (let i = 1; i < Math.min(lines.length, 6); i++) { // Preview first 5 rows
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
          const row: any = {}

          headers.forEach((header, index) => {
            if (values[index]) {
              if (header === 'tags') {
                row[header] = values[index].split(';').map(t => t.trim())
              } else if (header === 'isActive' || header === 'isPinned') {
                row[header] = values[index].toLowerCase() === 'true'
              } else if (header === 'sortOrder') {
                row[header] = parseInt(values[index]) || 0
              } else {
                row[header] = values[index]
              }
            }
          })

          if (row.question && row.answer) {
            parsedData.push(row)
          }
        }
      }

      setPreviewData(parsedData.slice(0, 5))
      setShowPreviewDialog(true)
    } catch (error) {
      console.error('Error parsing preview data:', error)
      alert('Error parsing file content. Please check the format.')
    }
  }

  const handleImport = async () => {
    if (!importContent) {
      alert('Please provide content to import')
      return
    }

    setImportLoading(true)
    setImportResult(null)

    try {
      const response = await fetch('/api/admin/help/faqs/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: importFormat,
          content: importContent,
          options: importOptions
        }),
      })

      const result = await response.json()
      setImportResult(result)

      if (result.success && result.imported > 0) {
        onImportComplete()
        // Clear form after successful import
        setTimeout(() => {
          setImportContent('')
          setImportFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }, 3000)
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportResult({
        success: false,
        message: 'Import failed due to network error',
        imported: 0,
        failed: 0,
        errors: ['Network error occurred'],
        faqs: []
      })
    } finally {
      setImportLoading(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)

    try {
      const params = new URLSearchParams({
        format: exportOptions.format,
        includeMetadata: exportOptions.includeMetadata.toString(),
        activeOnly: exportOptions.activeOnly.toString(),
      })

      if (exportOptions.selectedCategories.length > 0) {
        params.append('categories', exportOptions.selectedCategories.join(','))
      }

      const response = await fetch(`/api/admin/help/faqs/export?${params}`)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `faqs-export-${timestamp}.${exportOptions.format}`
      a.download = filename

      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setShowExportDialog(false)
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  const getSampleData = (format: 'json' | 'csv') => {
    if (format === 'json') {
      return JSON.stringify([
        {
          question: "How do I reset my password?",
          answer: "To reset your password, go to the login page and click 'Forgot Password'.",
          category: "Account",
          tags: ["password", "account", "login"],
          isActive: true,
          isPinned: false,
          sortOrder: 1
        },
        {
          question: "How do I contact support?",
          answer: "You can contact support through our help center or email support@example.com",
          category: "General",
          tags: ["support", "contact", "help"],
          isActive: true,
          isPinned: true,
          sortOrder: 2
        }
      ], null, 2)
    } else {
      return `question,answer,category,tags,isActive,isPinned,sortOrder
"How do I reset my password?","To reset your password, go to the login page and click 'Forgot Password'.","Account","password;account;login",true,false,1
"How do I contact support?","You can contact support through our help center or email support@example.com","General","support;contact;help",true,true,2`
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import & Export</h2>
          <p className="text-muted-foreground">
            Bulk import FAQs from files or export existing FAQs
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowImportDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Import FAQs
          </Button>
          <Button variant="outline" onClick={() => setShowExportDialog(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Export FAQs
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Quick Import */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Quick Import</h3>
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (previewFileInputRef.current) {
                        previewFileInputRef.current.click()
                      }
                    }}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview File
                  </Button>
                  <input
                    type="file"
                    ref={previewFileInputRef}
                    onChange={(e) => handleFileUpload(e, true)}
                    accept=".json,.csv"
                    className="hidden"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a file to preview its contents before importing
                </p>
              </div>
            </div>

            {/* Import Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Import Statistics</h3>
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{faqs.length}</div>
                    <div className="text-sm text-muted-foreground">Current FAQs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{categories.length}</div>
                    <div className="text-sm text-muted-foreground">Categories</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Format */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Sample Format</h3>
            <Tabs defaultValue="json" className="w-full">
              <TabsList>
                <TabsTrigger value="json" className="gap-2">
                  <FileText className="h-4 w-4" />
                  JSON
                </TabsTrigger>
                <TabsTrigger value="csv" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </TabsTrigger>
              </TabsList>
              <TabsContent value="json" className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>JSON Format Example</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(getSampleData('json'))}
                  >
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={getSampleData('json')}
                  readOnly
                  className="font-mono text-sm"
                  rows={10}
                />
              </TabsContent>
              <TabsContent value="csv" className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>CSV Format Example</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(getSampleData('csv'))}
                  >
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={getSampleData('csv')}
                  readOnly
                  className="font-mono text-sm"
                  rows={10}
                />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Export Options Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Export Preview</h3>
              <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total FAQs:</span>
                    <span className="font-medium">{faqs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Active FAQs:</span>
                    <span className="font-medium">{faqs.filter(f => f.isActive).length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Categories:</span>
                    <span className="font-medium">{categories.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Exports */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Recent Exports</h3>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="text-sm text-muted-foreground text-center py-4">
                  No recent exports found
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import FAQs
            </DialogTitle>
            <DialogDescription>
              Import FAQs from JSON or CSV files. You can upload a file or paste content directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Import Format</Label>
              <div className="flex gap-2">
                <Button
                  variant={importFormat === 'json' ? 'default' : 'outline'}
                  onClick={() => setImportFormat('json')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  JSON
                </Button>
                <Button
                  variant={importFormat === 'csv' ? 'default' : 'outline'}
                  onClick={() => setImportFormat('csv')}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Upload File</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose File
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e)}
                  accept={importFormat === 'json' ? '.json' : '.csv'}
                  className="hidden"
                />
                {importFile && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    {importFile.name}
                  </span>
                )}
              </div>
            </div>

            {/* Content Input */}
            <div className="space-y-2">
              <Label>Or paste content directly</Label>
              <Textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder={`Paste your ${importFormat.toUpperCase()} content here...`}
                className="font-mono text-sm"
                rows={8}
              />
            </div>

            {/* Import Options */}
            <div className="space-y-4">
              <Label>Import Options</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Overwrite existing FAQs</Label>
                    <p className="text-xs text-muted-foreground">
                      Update FAQs that already exist with the same question
                    </p>
                  </div>
                  <Switch
                    checked={importOptions.overwriteExisting}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, overwriteExisting: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Create missing categories</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create categories that don't exist
                    </p>
                  </div>
                  <Switch
                    checked={importOptions.createMissingCategories}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, createMissingCategories: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Validate data</Label>
                    <p className="text-xs text-muted-foreground">
                      Perform data validation before importing
                    </p>
                  </div>
                  <Switch
                    checked={importOptions.validateData}
                    onCheckedChange={(checked) =>
                      setImportOptions(prev => ({ ...prev, validateData: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className="space-y-4">
                <div className={`rounded-lg border p-4 ${
                  importResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {importResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{importResult.message}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-green-600 font-medium">{importResult.imported}</span> imported
                    </div>
                    <div>
                      <span className="text-red-600 font-medium">{importResult.failed}</span> failed
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <Label className="text-sm font-medium">Errors:</Label>
                      <div className="max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, index) => (
                          <div key={index} className="text-xs text-red-600 bg-white rounded px-2 py-1">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importResult.faqs.length > 0 && (
                    <div className="mt-3">
                      <Label className="text-sm font-medium">Import Details:</Label>
                      <div className="max-h-32 overflow-y-auto mt-1">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8">Question</TableHead>
                              <TableHead className="h-8">Status</TableHead>
                              <TableHead className="h-8">Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importResult.faqs.map((faq, index) => (
                              <TableRow key={index}>
                                <TableCell className="text-xs">{faq.question}</TableCell>
                                <TableCell>
                                  <Badge variant={faq.status === 'imported' ? 'default' : 'destructive'}>
                                    {faq.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-red-600">{faq.error || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importContent || importLoading}
              className="gap-2"
            >
              {importLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
              Import FAQs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export FAQs
            </DialogTitle>
            <DialogDescription>
              Configure export options and download your FAQ data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Export Format */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="flex gap-2">
                <Button
                  variant={exportOptions.format === 'json' ? 'default' : 'outline'}
                  onClick={() => setExportOptions(prev => ({ ...prev, format: 'json' }))}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  JSON
                </Button>
                <Button
                  variant={exportOptions.format === 'csv' ? 'default' : 'outline'}
                  onClick={() => setExportOptions(prev => ({ ...prev, format: 'csv' }))}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Export Options */}
            <div className="space-y-4">
              <Label>Export Options</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Include metadata</Label>
                    <p className="text-xs text-muted-foreground">
                      Include views, votes, and timestamps
                    </p>
                  </div>
                  <Switch
                    checked={exportOptions.includeMetadata}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, includeMetadata: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-normal">Active FAQs only</Label>
                    <p className="text-xs text-muted-foreground">
                      Export only active/published FAQs
                    </p>
                  </div>
                  <Switch
                    checked={exportOptions.activeOnly}
                    onCheckedChange={(checked) =>
                      setExportOptions(prev => ({ ...prev, activeOnly: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Categories (optional)</Label>
              <Select
                value={exportOptions.selectedCategories.join(',')}
                onValueChange={(value) => {
                  const categories = value ? value.split(',') : []
                  setExportOptions(prev => ({ ...prev, selectedCategories: categories }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Preview */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Export Summary</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Format: {exportOptions.format.toUpperCase()}</div>
                <div>
                  FAQs to export: {
                    exportOptions.activeOnly
                      ? faqs.filter(f => f.isActive).length
                      : faqs.length
                  }
                </div>
                <div>Categories: {exportOptions.selectedCategories.length || 'All'}</div>
                <div>Metadata: {exportOptions.includeMetadata ? 'Included' : 'Excluded'}</div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exportLoading}
              className="gap-2"
            >
              {exportLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
              Export FAQs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview Import Data
            </DialogTitle>
            <DialogDescription>
              Preview of the first 5 rows from your file. Check the data before importing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {previewData.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="max-w-xs truncate">{item.question}</TableCell>
                        <TableCell>{item.category || item.categoryId || 'N/A'}</TableCell>
                        <TableCell>
                          {Array.isArray(item.tags) ? (
                            <div className="flex flex-wrap gap-1">
                              {item.tags.slice(0, 2).map((tag: string, tagIndex: number) => (
                                <Badge key={tagIndex} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {item.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{item.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isActive ? 'default' : 'secondary'}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No valid data found in the preview
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}