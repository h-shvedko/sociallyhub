'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  BarChart3,
  FileText,
  Download,
  Mail,
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Send,
  Eye,
  Settings,
  TrendingUp,
  Users,
  Target,
  DollarSign,
  Share2,
  Filter
} from 'lucide-react'
import { 
  Client, 
  ReportFrequency, 
  ReportFormat 
} from '@/types/client'

interface ClientReportingSystemProps {
  client: Client
  onGenerateReport?: (reportConfig: any) => void
  onScheduleReport?: (scheduleConfig: any) => void
}

export function ClientReportingSystem({ 
  client, 
  onGenerateReport, 
  onScheduleReport 
}: ClientReportingSystemProps) {
  const [activeTab, setActiveTab] = useState('templates')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'engagement_rate',
    'reach',
    'impressions',
    'clicks'
  ])
  const [reportConfig, setReportConfig] = useState({
    frequency: ReportFrequency.WEEKLY,
    format: [ReportFormat.PDF],
    autoEmail: false,
    recipients: [client.email]
  })

  // Mock report templates
  const reportTemplates = [
    {
      id: '1',
      name: 'Executive Summary',
      description: 'High-level performance overview for leadership',
      frequency: 'Weekly',
      format: 'PDF',
      metrics: ['Reach', 'Engagement', 'ROI', 'Growth'],
      lastGenerated: new Date('2024-01-20'),
      isActive: true
    },
    {
      id: '2',
      name: 'Detailed Analytics',
      description: 'Comprehensive metrics and performance data',
      frequency: 'Monthly',
      format: 'Excel',
      metrics: ['All Metrics', 'Demographics', 'Content Analysis'],
      lastGenerated: new Date('2024-01-15'),
      isActive: true
    },
    {
      id: '3',
      name: 'Social Media ROI',
      description: 'Return on investment and conversion tracking',
      frequency: 'Quarterly',
      format: 'PDF',
      metrics: ['Conversions', 'Revenue', 'Cost per Acquisition'],
      lastGenerated: new Date('2024-01-01'),
      isActive: false
    }
  ]

  const availableMetrics = [
    { id: 'engagement_rate', name: 'Engagement Rate', category: 'Engagement' },
    { id: 'reach', name: 'Reach', category: 'Audience' },
    { id: 'impressions', name: 'Impressions', category: 'Audience' },
    { id: 'clicks', name: 'Clicks', category: 'Engagement' },
    { id: 'shares', name: 'Shares', category: 'Engagement' },
    { id: 'comments', name: 'Comments', category: 'Engagement' },
    { id: 'likes', name: 'Likes', category: 'Engagement' },
    { id: 'followers_growth', name: 'Follower Growth', category: 'Audience' },
    { id: 'website_traffic', name: 'Website Traffic', category: 'Conversions' },
    { id: 'leads_generated', name: 'Leads Generated', category: 'Conversions' },
    { id: 'conversion_rate', name: 'Conversion Rate', category: 'Conversions' },
    { id: 'roi', name: 'ROI', category: 'Business' },
    { id: 'cost_per_click', name: 'Cost per Click', category: 'Business' },
    { id: 'cost_per_lead', name: 'Cost per Lead', category: 'Business' }
  ]

  const groupedMetrics = availableMetrics.reduce((groups, metric) => {
    if (!groups[metric.category]) {
      groups[metric.category] = []
    }
    groups[metric.category].push(metric)
    return groups
  }, {} as Record<string, typeof availableMetrics>)

  const handleMetricToggle = (metricId: string, checked: boolean) => {
    setSelectedMetrics(prev => 
      checked 
        ? [...prev, metricId]
        : prev.filter(id => id !== metricId)
    )
  }

  const handleGenerateReport = (templateId: string) => {
    const template = reportTemplates.find(t => t.id === templateId)
    if (template) {
      onGenerateReport?.({
        templateId,
        clientId: client.id,
        metrics: selectedMetrics,
        format: reportConfig.format,
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        }
      })
    }
  }

  const mockScheduledReports = [
    {
      id: '1',
      name: 'Weekly Executive Report',
      frequency: 'Weekly',
      nextRun: new Date('2024-01-27'),
      recipients: ['john@client.com', 'sarah@client.com'],
      format: 'PDF',
      status: 'Active'
    },
    {
      id: '2',
      name: 'Monthly Analytics',
      frequency: 'Monthly',
      nextRun: new Date('2024-02-01'),
      recipients: ['marketing@client.com'],
      format: 'Excel',
      status: 'Active'
    }
  ]

  const mockRecentReports = [
    {
      id: '1',
      name: 'Executive Summary - Jan 2024',
      generatedDate: new Date('2024-01-20'),
      format: 'PDF',
      size: '2.4 MB',
      downloadCount: 5,
      status: 'Completed'
    },
    {
      id: '2',
      name: 'Detailed Analytics - Dec 2023',
      generatedDate: new Date('2024-01-01'),
      format: 'Excel',
      size: '5.1 MB',
      downloadCount: 3,
      status: 'Completed'
    },
    {
      id: '3',
      name: 'Social Media ROI - Q4 2023',
      generatedDate: new Date('2023-12-31'),
      format: 'PDF',
      size: '1.8 MB',
      downloadCount: 8,
      status: 'Completed'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Reporting</h2>
          <p className="text-sm text-muted-foreground">
            Generate and manage reports for {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {reportTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {template.frequency}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {template.format}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Included Metrics</Label>
                    <div className="flex flex-wrap gap-1">
                      {template.metrics.map((metric, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {metric}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Last generated: {template.lastGenerated.toLocaleDateString()}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleGenerateReport(template.id)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Generate
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scheduled Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockScheduledReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <h4 className="font-medium">{report.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.frequency}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next: {report.nextRun.toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {report.format}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {report.recipients.length} recipients
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{report.status}</Badge>
                      <Button variant="outline" size="sm">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Report History</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Bulk Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockRecentReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-medium">{report.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Generated: {report.generatedDate.toLocaleDateString()}</span>
                          <span>Size: {report.size}</span>
                          <span>Downloaded: {report.downloadCount} times</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{report.status}</Badge>
                      <Button variant="outline" size="sm">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Report Configuration */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Custom Report Builder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Report Name</Label>
                    <Input placeholder="Enter report name..." />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Frequency</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Format</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="dashboard">Dashboard Link</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Date Range</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" />
                      <Input type="date" />
                    </div>
                  </div>

                  <div>
                    <Label>Email Recipients</Label>
                    <div className="space-y-2">
                      {reportConfig.recipients.map((email, index) => (
                        <div key={index} className="flex gap-2">
                          <Input value={email} readOnly />
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-3 w-3 mr-2" />
                        Add Recipient
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="autoEmail"
                      checked={reportConfig.autoEmail}
                      onCheckedChange={(checked) => setReportConfig(prev => ({
                        ...prev,
                        autoEmail: checked as boolean
                      }))}
                    />
                    <Label htmlFor="autoEmail">
                      Automatically email report when generated
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(groupedMetrics).map(([category, metrics]) => (
                      <div key={category}>
                        <Label className="font-medium mb-2 block">{category}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {metrics.map((metric) => (
                            <div key={metric.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={metric.id}
                                checked={selectedMetrics.includes(metric.id)}
                                onCheckedChange={(checked) => handleMetricToggle(metric.id, checked as boolean)}
                              />
                              <Label htmlFor={metric.id} className="text-sm">
                                {metric.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Report Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Selected metrics: {selectedMetrics.length}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Will Include:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {selectedMetrics.slice(0, 5).map((metricId) => {
                          const metric = availableMetrics.find(m => m.id === metricId)
                          return (
                            <li key={metricId}>• {metric?.name}</li>
                          )
                        })}
                        {selectedMetrics.length > 5 && (
                          <li>• ... and {selectedMetrics.length - 5} more</li>
                        )}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <Button className="w-full">
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Report
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Generate Now
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}