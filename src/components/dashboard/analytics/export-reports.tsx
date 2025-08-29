"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { 
  Download,
  FileText,
  FileSpreadsheet,
  Calendar,
  Clock,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Eye,
  MessageSquare,
  Share2,
  Heart,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

type ReportFormat = 'pdf' | 'excel' | 'csv'
type ReportType = 'summary' | 'detailed' | 'engagement' | 'performance' | 'custom'
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'custom'

interface ReportMetric {
  id: string
  name: string
  description: string
  category: 'engagement' | 'performance' | 'audience' | 'content'
  icon: React.ReactNode
}

interface ExportReportsProps {
  className?: string
}

const AVAILABLE_METRICS: ReportMetric[] = [
  {
    id: 'posts_published',
    name: 'Posts Published',
    description: 'Total number of posts published',
    category: 'content',
    icon: <BarChart3 className="h-4 w-4" />
  },
  {
    id: 'engagement_rate',
    name: 'Engagement Rate',
    description: 'Average engagement rate across all posts',
    category: 'engagement',
    icon: <TrendingUp className="h-4 w-4" />
  },
  {
    id: 'total_reach',
    name: 'Total Reach',
    description: 'Total number of users reached',
    category: 'audience',
    icon: <Users className="h-4 w-4" />
  },
  {
    id: 'page_views',
    name: 'Page Views',
    description: 'Total page views and impressions',
    category: 'performance',
    icon: <Eye className="h-4 w-4" />
  },
  {
    id: 'total_comments',
    name: 'Total Comments',
    description: 'All comments across platforms',
    category: 'engagement',
    icon: <MessageSquare className="h-4 w-4" />
  },
  {
    id: 'total_shares',
    name: 'Total Shares',
    description: 'All shares and reposts',
    category: 'engagement',
    icon: <Share2 className="h-4 w-4" />
  },
  {
    id: 'total_likes',
    name: 'Total Likes',
    description: 'All likes and reactions',
    category: 'engagement',
    icon: <Heart className="h-4 w-4" />
  },
  {
    id: 'follower_growth',
    name: 'Follower Growth',
    description: 'Growth in followers/subscribers',
    category: 'audience',
    icon: <Activity className="h-4 w-4" />
  }
]

const REPORT_TEMPLATES = [
  {
    id: 'summary',
    name: 'Executive Summary',
    description: 'High-level overview with key metrics and trends',
    icon: <FileText className="h-4 w-4" />,
    metrics: ['posts_published', 'engagement_rate', 'total_reach', 'follower_growth']
  },
  {
    id: 'detailed',
    name: 'Detailed Analytics',
    description: 'Comprehensive report with all available metrics',
    icon: <FileSpreadsheet className="h-4 w-4" />,
    metrics: AVAILABLE_METRICS.map(m => m.id)
  },
  {
    id: 'engagement',
    name: 'Engagement Report',
    description: 'Focus on user engagement and interaction metrics',
    icon: <TrendingUp className="h-4 w-4" />,
    metrics: ['engagement_rate', 'total_comments', 'total_shares', 'total_likes']
  },
  {
    id: 'performance',
    name: 'Performance Report',
    description: 'Content performance and reach analysis',
    icon: <BarChart3 className="h-4 w-4" />,
    metrics: ['posts_published', 'total_reach', 'page_views', 'engagement_rate']
  }
]

export function ExportReports({ className }: ExportReportsProps) {
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf')
  const [selectedType, setSelectedType] = useState<ReportType>('summary')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['posts_published', 'engagement_rate', 'total_reach'])
  const [reportTitle, setReportTitle] = useState('Social Media Analytics Report')
  const [reportDescription, setReportDescription] = useState('')
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeTables, setIncludeTables] = useState(true)
  const [includeComparisons, setIncludeComparisons] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [lastExport, setLastExport] = useState<Date | null>(null)
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleReportTypeChange = (type: ReportType) => {
    setSelectedType(type)
    if (type === 'custom') return
    
    const template = REPORT_TEMPLATES.find(t => t.id === type)
    if (template) {
      setSelectedMetrics(template.metrics)
      setReportTitle(template.name)
      setReportDescription(template.description)
    }
  }

  const handleMetricToggle = (metricId: string, checked: boolean) => {
    setSelectedMetrics(prev => 
      checked 
        ? [...prev, metricId]
        : prev.filter(id => id !== metricId)
    )
  }

  const handleExport = async () => {
    setExporting(true)
    setExportStatus('idle')
    
    try {
      const exportRequest = {
        format: selectedFormat,
        type: selectedType,
        timeRange,
        customStartDate: timeRange === 'custom' ? customStartDate : undefined,
        customEndDate: timeRange === 'custom' ? customEndDate : undefined,
        metrics: selectedMetrics,
        title: reportTitle,
        description: reportDescription,
        options: {
          includeCharts,
          includeTables,
          includeComparisons
        }
      }

      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportRequest)
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the exported file
      const blob = await response.blob()
      const filename = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.${selectedFormat}`
      
      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setLastExport(new Date())
      setExportStatus('success')
      
    } catch (error) {
      console.error('Export failed:', error)
      setExportStatus('error')
    } finally {
      setExporting(false)
    }
  }

  const generateMockReportData = (exportData: any): string => {
    if (exportData.format === 'csv') {
      return `Report Title,${exportData.title}
Time Range,${getTimeRangeLabel(exportData.timeRange)}
Generated,${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}

Metric,Value,Change
Posts Published,42,+12%
Engagement Rate,4.8%,+0.3%
Total Reach,"15,234",+8%
Total Comments,128,+15%
Total Shares,89,+22%
Total Likes,456,+5%`
    }
    
    if (exportData.format === 'excel') {
      return 'Mock Excel data - in real implementation this would generate actual Excel file'
    }
    
    // PDF
    return 'Mock PDF data - in real implementation this would generate actual PDF file'
  }

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d': return 'Last 7 Days'
      case '30d': return 'Last 30 Days'
      case '90d': return 'Last 90 Days'
      case '1y': return 'Last Year'
      case 'custom': return 'Custom Range'
      default: return 'Last 30 Days'
    }
  }

  const getStatusIcon = () => {
    switch (exportStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusMessage = () => {
    switch (exportStatus) {
      case 'success':
        return `Report exported successfully at ${format(lastExport!, 'HH:mm:ss')}`
      case 'error':
        return 'Export failed. Please try again.'
      default:
        return 'Configure your report settings and click export'
    }
  }

  const selectedTemplate = REPORT_TEMPLATES.find(t => t.id === selectedType)
  const groupedMetrics = AVAILABLE_METRICS.reduce((acc, metric) => {
    if (!acc[metric.category]) acc[metric.category] = []
    acc[metric.category].push(metric)
    return acc
  }, {} as Record<string, ReportMetric[]>)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Export Analytics Reports</span>
              </CardTitle>
              <CardDescription>
                Generate and download comprehensive analytics reports
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-sm text-muted-foreground">
                {getStatusMessage()}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Type & Format */}
          <Card>
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select value={selectedType} onValueChange={handleReportTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_TEMPLATES.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center space-x-2">
                            {template.icon}
                            <span>{template.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">
                        <div className="flex items-center space-x-2">
                          <Settings className="h-4 w-4" />
                          <span>Custom Report</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="export-format">Export Format</Label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>PDF Document</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="excel">
                        <div className="flex items-center space-x-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>Excel Spreadsheet</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="csv">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>CSV File</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedTemplate && selectedType !== 'custom' && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-2 text-sm">
                    {selectedTemplate.icon}
                    <span className="font-medium">{selectedTemplate.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedTemplate.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Time Range</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {timeRange === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Report Details */}
          <Card>
            <CardHeader>
              <CardTitle>Report Customization</CardTitle>
              <CardDescription>
                Customize your report title, description, and formatting options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="report-title">Report Title</Label>
                <Input
                  id="report-title"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Enter a custom title for your report"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will appear as the main heading in your exported report
                </p>
              </div>

              <div>
                <Label htmlFor="report-description">Report Description (Optional)</Label>
                <Textarea
                  id="report-description"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Add a description explaining the purpose of this report..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will appear below the title to provide context about the report
                </p>
              </div>

              <Separator />

              <div>
                <Label>Report Formatting Options</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose what elements to include in your exported report
                </p>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="include-charts"
                      checked={includeCharts}
                      onCheckedChange={setIncludeCharts}
                    />
                    <div>
                      <Label htmlFor="include-charts">Include charts and graphs</Label>
                      <p className="text-xs text-muted-foreground">Add visual charts to illustrate your data</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="include-tables"
                      checked={includeTables}
                      onCheckedChange={setIncludeTables}
                    />
                    <div>
                      <Label htmlFor="include-tables">Include data tables</Label>
                      <p className="text-xs text-muted-foreground">Add detailed tables with raw metric values</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="include-comparisons"
                      checked={includeComparisons}
                      onCheckedChange={setIncludeComparisons}
                    />
                    <div>
                      <Label htmlFor="include-comparisons">Include period comparisons</Label>
                      <p className="text-xs text-muted-foreground">Show performance changes vs previous period</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Selection */}
          {selectedType === 'custom' && (
            <Card>
              <CardHeader>
                <CardTitle>Select Metrics</CardTitle>
                <CardDescription>Choose which metrics to include in your report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(groupedMetrics).map(([category, metrics]) => (
                    <div key={category}>
                      <h4 className="font-medium capitalize mb-3">{category} Metrics</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {metrics.map((metric) => (
                          <div key={metric.id} className="flex items-start space-x-3">
                            <Checkbox
                              id={metric.id}
                              checked={selectedMetrics.includes(metric.id)}
                              onCheckedChange={(checked) => handleMetricToggle(metric.id, checked as boolean)}
                            />
                            <div className="flex-1">
                              <Label htmlFor={metric.id} className="flex items-center space-x-2 cursor-pointer">
                                {metric.icon}
                                <span>{metric.name}</span>
                              </Label>
                              <p className="text-xs text-muted-foreground mt-1">
                                {metric.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview & Export Panel */}
        <div className="space-y-6">
          {/* Export Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Export Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium">Format</div>
                <div className="text-sm text-muted-foreground capitalize">{selectedFormat}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium">Time Range</div>
                <div className="text-sm text-muted-foreground">{getTimeRangeLabel(timeRange)}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium">Metrics</div>
                <div className="text-sm text-muted-foreground">{selectedMetrics.length} selected</div>
              </div>

              <Separator />

              <Button
                onClick={handleExport}
                disabled={exporting || selectedMetrics.length === 0}
                className="w-full"
              >
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Templates</CardTitle>
              <CardDescription>Ready-made report configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {REPORT_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    variant={selectedType === template.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleReportTypeChange(template.id as ReportType)}
                    className="w-full justify-start"
                  >
                    {template.icon}
                    <span className="ml-2">{template.name}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Exports */}
          {lastExport && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Recent Export</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div className="font-medium">{reportTitle}</div>
                  <div className="text-muted-foreground">
                    {format(lastExport, 'MMM d, yyyy HH:mm')}
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {selectedFormat.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}