'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  TrendingUp,
  Tag,
  Calendar,
  RefreshCw,
  Filter,
  BookOpen,
  Star,
  Download,
  Upload
} from 'lucide-react'

interface FAQTemplate {
  id: string
  name: string
  description: string
  category: string
  template: string
  variables: string[]
  usageCount: number
  lastUsed: string
}

interface TemplateStats {
  total: number
  categories: number
  totalUsage: number
}

interface FAQTemplatesProps {
  onUseTemplate: (template: FAQTemplate) => void
}

export default function FAQTemplates({ onUseTemplate }: FAQTemplatesProps) {
  const [templates, setTemplates] = useState<FAQTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<FAQTemplate[]>([])
  const [stats, setStats] = useState<TemplateStats>({ total: 0, categories: 0, totalUsage: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'recent'>('usage')

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<FAQTemplate | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    template: '',
    variables: [] as string[]
  })
  const [saving, setSaving] = useState(false)

  // Load templates
  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/help/faqs/templates')

      if (!response.ok) {
        throw new Error('Failed to load templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
      setStats(data.stats || { total: 0, categories: 0, totalUsage: 0 })
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // Filter and sort templates
  useEffect(() => {
    let filtered = [...templates]

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.template.toLowerCase().includes(term) ||
        template.category.toLowerCase().includes(term)
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(template => template.category === selectedCategory)
    }

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'usage':
          return b.usageCount - a.usageCount
        case 'recent':
          return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        default:
          return 0
      }
    })

    setFilteredTemplates(filtered)
  }, [templates, searchTerm, selectedCategory, sortBy])

  const categories = [...new Set(templates.map(t => t.category))].sort()

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      template: '',
      variables: []
    })
  }

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{[^}]+\}\}/g)
    return matches ? [...new Set(matches)] : []
  }

  const handleTemplateChange = (text: string) => {
    setFormData(prev => ({
      ...prev,
      template: text,
      variables: extractVariables(text)
    }))
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.template.trim()) {
      alert('Name and template content are required')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/help/faqs/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create template')
      }

      await loadTemplates()
      setShowCreateDialog(false)
      resetForm()
    } catch (error) {
      console.error('Error creating template:', error)
      alert(error instanceof Error ? error.message : 'Failed to create template')
    } finally {
      setSaving(false)
    }
  }

  const handleEditTemplate = (template: FAQTemplate) => {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      template: template.template,
      variables: template.variables
    })
    setShowEditDialog(true)
  }

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate || !formData.name.trim() || !formData.template.trim()) {
      alert('Name and template content are required')
      return
    }

    setSaving(true)
    try {
      // For this demo, we'll simulate an update by recreating the template
      // In a real implementation, you'd have a PUT endpoint
      const updatedTemplates = templates.map(t =>
        t.id === selectedTemplate.id
          ? {
              ...t,
              ...formData,
              lastUsed: new Date().toISOString()
            }
          : t
      )

      setTemplates(updatedTemplates)
      setShowEditDialog(false)
      resetForm()
      setSelectedTemplate(null)
    } catch (error) {
      console.error('Error updating template:', error)
      alert('Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return

    try {
      // For this demo, we'll remove from local state
      // In a real implementation, you'd call a DELETE endpoint
      const updatedTemplates = templates.filter(t => t.id !== selectedTemplate.id)
      setTemplates(updatedTemplates)
      setShowDeleteDialog(false)
      setSelectedTemplate(null)
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  const handleUseTemplate = (template: FAQTemplate) => {
    // Increment usage count locally
    const updatedTemplates = templates.map(t =>
      t.id === template.id
        ? {
            ...t,
            usageCount: t.usageCount + 1,
            lastUsed: new Date().toISOString()
          }
        : t
    )
    setTemplates(updatedTemplates)

    // Call parent handler
    onUseTemplate(template)
  }

  const handleDuplicateTemplate = (template: FAQTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      template: template.template,
      variables: template.variables
    })
    setShowCreateDialog(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">FAQ Templates</h2>
          <p className="text-muted-foreground">
            Manage reusable templates for creating FAQs quickly
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.categories}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsage}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value: 'name' | 'usage' | 'recent') => setSortBy(value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="usage">Most used</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || selectedCategory
                ? "Try adjusting your filters or search terms"
                : "Create your first template to get started"}
            </p>
            {!searchTerm && !selectedCategory && (
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg line-clamp-2">{template.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {template.description || 'No description provided'}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedTemplate(template)
                          setShowViewDialog(true)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedTemplate(template)
                          setShowDeleteDialog(true)
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{template.category}</Badge>
                  {template.usageCount > 10 && (
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3" />
                      Popular
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {template.template}
                  </div>
                  {template.variables.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Variables:</Label>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((variable, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                        {template.variables.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.variables.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-muted-foreground">
                    Used {template.usageCount} times
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                    className="gap-2"
                  >
                    <Download className="h-3 w-3" />
                    Use Template
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false)
          setShowEditDialog(false)
          resetForm()
          setSelectedTemplate(null)
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showCreateDialog ? 'Create Template' : 'Edit Template'}
            </DialogTitle>
            <DialogDescription>
              Create a reusable template for FAQ creation. Use variables like {`{{variable_name}}`} for dynamic content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Login Issues"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Account"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the template"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template Content</Label>
              <Textarea
                id="template"
                value={formData.template}
                onChange={(e) => handleTemplateChange(e.target.value)}
                placeholder="Enter your template content here. Use {{variable_name}} for dynamic content."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {formData.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Detected Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.variables.map((variable, index) => (
                    <Badge key={index} variant="outline">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border p-4 bg-muted/50">
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <div className="text-sm whitespace-pre-wrap">
                {formData.template || 'Template content will appear here...'}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setShowEditDialog(false)
                resetForm()
                setSelectedTemplate(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={showCreateDialog ? handleCreateTemplate : handleUpdateTemplate}
              disabled={saving || !formData.name.trim() || !formData.template.trim()}
              className="gap-2"
            >
              {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
              {showCreateDialog ? 'Create Template' : 'Update Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Template Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <div className="mt-1">
                    <Badge variant="secondary">{selectedTemplate.category}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Usage Count</Label>
                  <div className="mt-1 text-sm">{selectedTemplate.usageCount} times</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Template Content</Label>
                <div className="rounded-lg border p-4 bg-muted/50 whitespace-pre-wrap text-sm">
                  {selectedTemplate.template}
                </div>
              </div>

              {selectedTemplate.variables.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable, index) => (
                      <Badge key={index} variant="outline">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">Last Used</Label>
                <div className="text-sm text-muted-foreground">
                  {new Date(selectedTemplate.lastUsed).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedTemplate) {
                  handleUseTemplate(selectedTemplate)
                  setShowViewDialog(false)
                }
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Use Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}