'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Layout, Plus, Copy, Star, Clock, Eye } from 'lucide-react'
import { CreateTemplateDialog } from './create-template-dialog'

interface CampaignTemplatesProps {
  workspaceId: string
}

export function CampaignTemplates({ workspaceId }: CampaignTemplatesProps) {
  const [templates, setTemplates] = useState<any[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Load templates from database
  useEffect(() => {
    loadTemplates()
  }, [workspaceId])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/templates?workspaceId=${workspaceId}&type=POST`)
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      } else {
        console.error('Failed to load templates')
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async (templateData: any) => {
    try {
      // Refresh the templates list after successful creation
      await loadTemplates()
      setIsCreateOpen(false)
    } catch (error) {
      console.error('Error after creating template:', error)
    }
  }

  const handleUseTemplate = (template: any) => {
    // Navigate to posts page with template data
    const templateParams = new URLSearchParams({
      compose: 'true',
      template: template.id,
      templateContent: template.content || '',
      templateName: template.name
    })
    
    window.location.href = `/dashboard/posts?${templateParams.toString()}`
  }

  const handlePreviewTemplate = (template: any) => {
    setSelectedTemplate(template)
    setIsPreviewOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaign Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable campaign templates to speed up campaign creation
          </p>
        </div>
        <CreateTemplateDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onCreate={handleCreateTemplate}
        >
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </CreateTemplateDialog>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Layout className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No campaign templates found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first template to speed up campaign creation
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          templates.map((template, index) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.description || 'No description provided'}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {template.type?.replace('_', ' ') || 'Post'}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {/* Show platforms */}
                  {template.platforms && template.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.platforms.map((platform: string) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Show tags */}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      {template.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1" 
                    onClick={() => handleUseTemplate(template)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handlePreviewTemplate(template)}
                  >
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Template Preview
            </DialogTitle>
            <DialogDescription>
              Preview template content and configuration
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{selectedTemplate.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedTemplate.description || 'No description provided'}</p>
              </div>

              {selectedTemplate.content && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Content Template</h5>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm font-mono">
                    {selectedTemplate.content}
                  </div>
                </div>
              )}

              {selectedTemplate.platforms && selectedTemplate.platforms.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Platforms</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.platforms.map((platform: string) => (
                      <Badge key={platform} variant="secondary">
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm">Tags</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={() => {
                  setIsPreviewOpen(false)
                  handleUseTemplate(selectedTemplate)
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Use This Template
                </Button>
                <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}