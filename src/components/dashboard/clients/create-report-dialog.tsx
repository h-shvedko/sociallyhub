'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Users,
  Calendar,
  Clock,
  BarChart3,
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle,
  Download,
  Mail,
  Plus,
  X
} from 'lucide-react'

interface CreateReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients?: any[]
  templates?: any[]
  onReportCreated?: (report: any) => void
  editReport?: any
}

interface ReportMetric {
  id: string
  label: string
  value: string
  checked: boolean
}

const defaultMetrics: ReportMetric[] = [
  { id: '1', label: 'Followers', value: 'followers', checked: true },
  { id: '2', label: 'Engagement Rate', value: 'engagement_rate', checked: true },
  { id: '3', label: 'Reach', value: 'reach', checked: true },
  { id: '4', label: 'Impressions', value: 'impressions', checked: true },
  { id: '5', label: 'Website Clicks', value: 'website_clicks', checked: false },
  { id: '6', label: 'Profile Visits', value: 'profile_visits', checked: false },
  { id: '7', label: 'Saves', value: 'saves', checked: false },
  { id: '8', label: 'Shares', value: 'shares', checked: false },
  { id: '9', label: 'Comments', value: 'comments', checked: false },
  { id: '10', label: 'Likes', value: 'likes', checked: false },
  { id: '11', label: 'ROI', value: 'roi', checked: false },
  { id: '12', label: 'Conversion Rate', value: 'conversion_rate', checked: false },
]

export function CreateReportDialog({
  open,
  onOpenChange,
  clients = [],
  templates = [],
  onReportCreated,
  editReport
}: CreateReportDialogProps) {
  const [activeTab, setActiveTab] = useState('basic')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  
  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    templateId: '',
    name: '',
    description: '',
    type: 'CUSTOM',
    format: 'PDF',
    frequency: 'ON_DEMAND',
    recipients: [] as string[]
  })
  
  const [selectedMetrics, setSelectedMetrics] = useState<ReportMetric[]>(defaultMetrics)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [recipientInput, setRecipientInput] = useState('')

  // Initialize form data when editing
  useEffect(() => {
    if (editReport) {
      setFormData({
        clientId: editReport.client?.id || '',
        templateId: editReport.template?.id || '',
        name: editReport.name || '',
        description: editReport.description || '',
        type: editReport.type || 'CUSTOM',
        format: editReport.format || 'PDF',
        frequency: editReport.frequency || 'ON_DEMAND',
        recipients: editReport.recipients || []
      })
      setSelectedTemplate(editReport.template?.id || '')
    } else {
      // Reset form when creating new report
      setFormData({
        clientId: '',
        templateId: '',
        name: '',
        description: '',
        type: 'CUSTOM',
        format: 'PDF',
        frequency: 'ON_DEMAND',
        recipients: []
      })
      setSelectedTemplate('')
    }
  }, [editReport, open])

  useEffect(() => {
    if (selectedTemplate && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplate)
      if (template) {
        setFormData(prev => ({
          ...prev,
          templateId: template.id,
          name: `${template.name} - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          type: template.type,
          format: template.format[0] || 'PDF'
        }))
        
        // Update selected metrics based on template
        if (template.metrics && template.metrics.length > 0) {
          setSelectedMetrics(prevMetrics => 
            prevMetrics.map(metric => ({
              ...metric,
              checked: template.metrics.includes(metric.value)
            }))
          )
        }
      }
    }
  }, [selectedTemplate, templates])

  const handleMetricToggle = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.map(metric =>
        metric.id === metricId
          ? { ...metric, checked: !metric.checked }
          : metric
      )
    )
  }

  const handleAddRecipient = () => {
    if (recipientInput && recipientInput.includes('@')) {
      setFormData(prev => ({
        ...prev,
        recipients: [...prev.recipients, recipientInput]
      }))
      setRecipientInput('')
    }
  }

  const handleRemoveRecipient = (email: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter(r => r !== email)
    }))
  }

  const handleGenerateReport = async () => {
    if (!formData.clientId || !formData.name) {
      alert('Please select a client and enter a report name')
      return
    }

    setIsLoading(true)
    try {
      const selectedMetricValues = selectedMetrics
        .filter(m => m.checked)
        .map(m => m.value)

      const reportData = {
        ...formData,
        config: {
          metrics: selectedMetricValues,
          dateRange: dateRange,
          includeComparisons: true,
          includeCharts: true
        }
      }

      const url = editReport ? `/api/client-reports/${editReport.id}` : '/api/client-reports'
      const method = editReport ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData)
      })

      if (response.ok) {
        const result = await response.json()
        if (onReportCreated) {
          onReportCreated(result.report)
        }
        onOpenChange(false)
        resetForm()
      } else {
        const error = await response.json()
        alert(`Failed to ${editReport ? 'update' : 'create'} report: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error(`Error ${editReport ? 'updating' : 'creating'} report:`, error)
      alert(`Failed to ${editReport ? 'update' : 'create'} report. Please try again.`)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      clientId: '',
      templateId: '',
      name: '',
      description: '',
      type: 'CUSTOM',
      format: 'PDF',
      frequency: 'ON_DEMAND',
      recipients: []
    })
    setSelectedMetrics(defaultMetrics)
    setSelectedTemplate('')
    setRecipientInput('')
    setActiveTab('basic')
  }

  const selectedClient = clients.find(c => c.id === formData.clientId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editReport ? 'Edit Report' : 'Create New Report'}
          </DialogTitle>
          <DialogDescription>
            {editReport 
              ? 'Update your client report with new settings and metrics'
              : 'Generate a comprehensive report for your client with customizable metrics and formatting'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="basic" className="space-y-4 p-4">
              {/* Template Selection */}
              {templates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Use Template (Optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {templates.map((template) => (
                        <Card
                          key={template.id}
                          className={`cursor-pointer transition-all ${
                            selectedTemplate === template.id
                              ? 'ring-2 ring-primary'
                              : 'hover:shadow-md'
                          }`}
                          onClick={() => setSelectedTemplate(template.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-medium text-sm">{template.name}</h4>
                              {template.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {template.description}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Client Selection */}
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}
                >
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {client.name}
                          {client.company && (
                            <span className="text-muted-foreground">
                              - {client.company}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Report Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Report Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Monthly Performance Report - January 2024"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a brief description of this report..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Report Type and Format */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Report Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXECUTIVE">Executive Summary</SelectItem>
                      <SelectItem value="PERFORMANCE">Performance Analytics</SelectItem>
                      <SelectItem value="ANALYTICS">Detailed Analytics</SelectItem>
                      <SelectItem value="CUSTOM">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format">Output Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, format: value }))}
                  >
                    <SelectTrigger id="format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PDF">PDF Document</SelectItem>
                      <SelectItem value="EXCEL">Excel Spreadsheet</SelectItem>
                      <SelectItem value="CSV">CSV File</SelectItem>
                      <SelectItem value="DASHBOARD_LINK">Dashboard Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="text-xs">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4 p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Select Metrics to Include</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Choose which metrics should appear in your report
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedMetrics.map((metric) => (
                      <div key={metric.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={metric.id}
                          checked={metric.checked}
                          onCheckedChange={() => handleMetricToggle(metric.id)}
                        />
                        <Label
                          htmlFor={metric.id}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {metric.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Additional Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="comparisons" defaultChecked />
                    <Label htmlFor="comparisons" className="text-sm font-normal">
                      Include period comparisons
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="charts" defaultChecked />
                    <Label htmlFor="charts" className="text-sm font-normal">
                      Include visual charts and graphs
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="insights" defaultChecked />
                    <Label htmlFor="insights" className="text-sm font-normal">
                      Include AI-generated insights
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="recommendations" />
                    <Label htmlFor="recommendations" className="text-sm font-normal">
                      Include recommendations
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 p-4">
              {/* Frequency */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Report Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ON_DEMAND">On Demand (One-time)</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Email Recipients</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Add email addresses to send the report when it&apos;s ready
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="email@example.com"
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddRecipient()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddRecipient}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.recipients.length > 0 && (
                    <div className="space-y-2">
                      {formData.recipients.map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between p-2 bg-muted rounded"
                        >
                          <span className="text-sm flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {email}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRecipient(email)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Report Summary */}
              {selectedClient && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Report Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client:</span>
                      <span className="font-medium">{selectedClient.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Report Type:</span>
                      <span className="font-medium">{formData.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Format:</span>
                      <span className="font-medium">{formData.format}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selected Metrics:</span>
                      <span className="font-medium">
                        {selectedMetrics.filter(m => m.checked).length} metrics
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date Range:</span>
                      <span className="font-medium">
                        {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerateReport}
            disabled={isLoading || !formData.clientId || !formData.name}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4 mr-2" />
                {editReport ? 'Update Report' : 'Generate Report'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}