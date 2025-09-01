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
  const reports: any[] = []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaign Reporting</h2>
          <p className="text-sm text-muted-foreground">
            Generate and schedule automated reports for your campaigns
          </p>
        </div>
        <Button onClick={() => console.log('Create Report clicked')} disabled>
          <Plus className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      {/* Report Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No reports found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first report to track campaign performance
                  </p>
                  <Button onClick={() => console.log('Create Report clicked')} disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          reports.map((template, index) => (
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
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => console.log('Generate clicked')} disabled>
                    <Download className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => console.log('Schedule clicked')} disabled>
                    <Mail className="h-3 w-3 mr-1" />
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
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