'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, Calendar, Mail, Plus } from 'lucide-react'
import { Campaign } from '@/types/campaign'

interface CampaignReportingProps {
  workspaceId: string
  campaigns: Campaign[]
}

export function CampaignReporting({ workspaceId, campaigns }: CampaignReportingProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaign Reporting</h2>
          <p className="text-sm text-muted-foreground">
            Generate and schedule automated reports for your campaigns
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Report Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            name: 'Executive Summary',
            description: 'High-level campaign performance overview',
            format: 'PDF',
            frequency: 'Weekly'
          },
          {
            name: 'Detailed Performance',
            description: 'Comprehensive metrics and analytics',
            format: 'Excel',
            frequency: 'Monthly'
          },
          {
            name: 'A/B Test Results',
            description: 'A/B testing outcomes and insights',
            format: 'PDF',
            frequency: 'On-demand'
          }
        ].map((template, index) => (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="text-base">{template.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {template.format}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {template.frequency}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Download className="h-3 w-3 mr-1" />
                  Generate
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Mail className="h-3 w-3 mr-1" />
                  Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2" />
            <p>Report history and scheduled reports would display here</p>
            <p className="text-xs">Download links, generation status, and delivery tracking</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}