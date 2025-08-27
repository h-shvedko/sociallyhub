'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Layout, Plus, Copy, Star, Clock } from 'lucide-react'

interface CampaignTemplatesProps {
  workspaceId: string
}

export function CampaignTemplates({ workspaceId }: CampaignTemplatesProps) {
  const templates = [
    {
      name: 'Product Launch Template',
      description: 'Complete template for launching new products',
      category: 'Product Launch',
      objectives: 5,
      usageCount: 12,
      rating: 4.8
    },
    {
      name: 'Brand Awareness Campaign',
      description: 'Build brand recognition and visibility',
      category: 'Brand Awareness',
      objectives: 3,
      usageCount: 8,
      rating: 4.6
    },
    {
      name: 'Lead Generation Template',
      description: 'Generate qualified leads and prospects',
      category: 'Lead Generation',
      objectives: 4,
      usageCount: 15,
      rating: 4.9
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaign Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable campaign templates to speed up campaign creation
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template, index) => (
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
                <Button variant="outline" size="sm" className="flex-1">
                  <Copy className="h-3 w-3 mr-1" />
                  Use Template
                </Button>
                <Button variant="ghost" size="sm">
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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