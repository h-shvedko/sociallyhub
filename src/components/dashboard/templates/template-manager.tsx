'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Edit, 
  Trash2, 
  Copy,
  Eye,
  Hash,
  MessageSquare,
  AtSign,
  Video,
  Image,
  Star
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  description?: string
  content: string
  type: 'SOCIAL_POST' | 'EMAIL' | 'BLOG' | 'NEWSLETTER'
  category?: string
  tags: string[]
  platforms: string[]
  variables: string[]
  usage_count: number
  created_at: string
  updated_at: string
  created_by: {
    name: string
    email: string
  }
}

interface TemplateManagerProps {
  workspaceId: string
}

export function TemplateManager({ workspaceId }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    type: 'SOCIAL_POST' as Template['type'],
    category: '',
    tags: '',
    platforms: [] as string[]
  })

  const availablePlatforms = [
    { id: 'twitter', label: 'Twitter', color: 'bg-blue-100 text-blue-800' },
    { id: 'facebook', label: 'Facebook', color: 'bg-blue-100 text-blue-800' },
    { id: 'instagram', label: 'Instagram', color: 'bg-pink-100 text-pink-800' },
    { id: 'linkedin', label: 'LinkedIn', color: 'bg-blue-100 text-blue-800' },
    { id: 'youtube', label: 'YouTube', color: 'bg-red-100 text-red-800' },
    { id: 'tiktok', label: 'TikTok', color: 'bg-gray-100 text-gray-800' }
  ]

  useEffect(() => {
    fetchTemplates()
  }, [workspaceId])

  useEffect(() => {
    filterTemplates()
  }, [templates, searchQuery, selectedType, selectedCategory])

  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/templates?workspaceId=${workspaceId}`)
      
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        console.error('Failed to fetch templates')
        setTemplates([])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterTemplates = () => {
    let filtered = templates

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(template => template.type === selectedType)
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory)
    }

    setFilteredTemplates(filtered)
  }

  const handleCreateTemplate = async () => {
    try {
      const templateData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        platforms: formData.platforms,
        workspaceId
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      if (response.ok) {
        const newTemplate = await response.json()
        setTemplates(prev => [newTemplate, ...prev])
        setIsCreateDialogOpen(false)
        resetForm()
      }
    } catch (error) {
      console.error('Create template error:', error)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return

    try {
      const templateData = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        platforms: formData.platforms
      }

      const response = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      })

      if (response.ok) {
        const updatedTemplate = await response.json()
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updatedTemplate : t))
        setEditingTemplate(null)
        resetForm()
      }
    } catch (error) {
      console.error('Update template error:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateId))
      }
    } catch (error) {
      console.error('Delete template error:', error)
    }
  }

  const handleDuplicateTemplate = (template: Template) => {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      content: template.content,
      type: template.type,
      category: template.category || '',
      tags: template.tags.join(', '),
      platforms: template.platforms
    })
    setIsCreateDialogOpen(true)
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      type: template.type,
      category: template.category || '',
      tags: template.tags.join(', '),
      platforms: template.platforms
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      content: '',
      type: 'SOCIAL_POST',
      category: '',
      tags: '',
      platforms: []
    })
  }

  const insertVariable = (variableName: string) => {
    const variable = `{{${variableName}}}`
    setFormData(prev => ({
      ...prev,
      content: prev.content + variable
    }))
  }

  const togglePlatform = (platformId: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId]
    }))
  }

  const getTypeIcon = (type: Template['type']) => {
    switch (type) {
      case 'SOCIAL_POST': return <MessageSquare className="h-4 w-4" />
      case 'EMAIL': return <AtSign className="h-4 w-4" />
      case 'BLOG': return <FileText className="h-4 w-4" />
      case 'NEWSLETTER': return <Star className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: Template['type']) => {
    switch (type) {
      case 'SOCIAL_POST': return 'bg-blue-100 text-blue-800'
      case 'EMAIL': return 'bg-green-100 text-green-800'
      case 'BLOG': return 'bg-purple-100 text-purple-800'
      case 'NEWSLETTER': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground">
            Create and manage reusable content templates
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Types</option>
                <option value="SOCIAL_POST">Social Posts</option>
                <option value="EMAIL">Emails</option>
                <option value="BLOG">Blog Posts</option>
                <option value="NEWSLETTER">Newsletters</option>
              </select>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Categories</option>
                <option value="Marketing">Marketing</option>
                <option value="Newsletter">Newsletter</option>
                <option value="Announcement">Announcement</option>
                <option value="Promotion">Promotion</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(template.type)}
                    <Badge className={cn("text-xs", getTypeColor(template.type))}>
                      {template.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.description && (
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-mono line-clamp-4">
                      {template.content}
                    </p>
                  </div>
                  
                  {template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Used {template.usage_count} times</span>
                    <span>{new Date(template.updated_at).toLocaleDateString()}</span>
                  </div>
                  
                  {template.platforms.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">Platforms:</span>
                      <div className="flex space-x-1">
                        {template.platforms.map(platform => (
                          <Badge key={platform} variant="secondary" className="text-xs capitalize">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredTemplates.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedType !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Create your first template to get started'
            }
          </p>
          {!searchQuery && selectedType === 'all' && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          )}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={isCreateDialogOpen || editingTemplate !== null} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false)
          setEditingTemplate(null)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the template"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Template['type'] }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="SOCIAL_POST">Social Post</option>
                  <option value="EMAIL">Email</option>
                  <option value="BLOG">Blog Post</option>
                  <option value="NEWSLETTER">Newsletter</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category (Optional)</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Marketing, Promotion"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Template Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter your template content. Use {{variable_name}} for dynamic content."
                rows={8}
                className="font-mono text-sm"
              />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Use {`{{variable_name}}`} syntax for dynamic content that can be replaced when using the template.
                </p>
                <div className="bg-muted p-3 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Common Variables:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">User Info:</div>
                      <div className="space-x-2">
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('user_name')}>
                          {`{{user_name}}`}
                        </Badge>
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('user_email')}>
                          {`{{user_email}}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Business:</div>
                      <div className="space-x-2">
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('company_name')}>
                          {`{{company_name}}`}
                        </Badge>
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('brand_name')}>
                          {`{{brand_name}}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Content:</div>
                      <div className="space-x-2">
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('post_title')}>
                          {`{{post_title}}`}
                        </Badge>
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('description')}>
                          {`{{description}}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Platform:</div>
                      <div className="space-x-2">
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('platform_name')}>
                          {`{{platform_name}}`}
                        </Badge>
                        <Badge variant="outline" className="cursor-pointer" onClick={() => insertVariable('campaign_name')}>
                          {`{{campaign_name}}`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Enter tags separated by commas"
              />
            </div>

            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="grid grid-cols-2 gap-3">
                {availablePlatforms.map((platform) => (
                  <div key={platform.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={platform.id}
                      checked={formData.platforms.includes(platform.id)}
                      onCheckedChange={() => togglePlatform(platform.id)}
                    />
                    <Label 
                      htmlFor={platform.id} 
                      className="text-sm font-normal cursor-pointer flex items-center space-x-2"
                    >
                      <Badge className={cn("text-xs", platform.color)}>
                        {platform.label}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select which social media platforms this template is designed for.
              </p>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setIsCreateDialogOpen(false)
                setEditingTemplate(null)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}>
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}