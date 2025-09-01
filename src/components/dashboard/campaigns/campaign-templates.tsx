'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Layout, Plus, Copy, Star, Clock } from 'lucide-react'
import { CreateTemplateDialog } from './create-template-dialog'

interface CampaignTemplatesProps {
  workspaceId: string
}

export function CampaignTemplates({ workspaceId }: CampaignTemplatesProps) {
  const [templates, setTemplates] = useState<any[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const handleCreateTemplate = async (templateData: any) => {
    try {
      console.log('Creating template:', templateData)
      
      // For now, just add it to local state
      const newTemplate = {
        id: `template_${Date.now()}`,
        ...templateData,
        usageCount: 0,
        rating: 0,
        createdAt: new Date().toISOString()
      }
      
      setTemplates(prev => [...prev, newTemplate])
      setIsCreateOpen(false)
    } catch (error) {
      console.error('Error creating template:', error)
    }
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
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {template.rating}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div>{template.objectives} objectives</div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Used {template.usageCount} times
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => console.log('Use Template clicked')} disabled>
                    <Copy className="h-3 w-3 mr-1" />
                    Use Template
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => console.log('Preview clicked')} disabled>
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Custom Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Layout className="h-12 w-12 mx-auto mb-2" />
            <p>Your custom campaign templates would display here</p>
            <p className="text-xs">Create reusable templates from successful campaigns</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}