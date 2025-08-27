"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Download,
  FileText,
  BarChart3,
  Mail,
  Calendar,
  Settings,
  Share,
  Eye,
  Clock,
  FileSpreadsheet,
  FileImage,
  Loader2
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ReportConfig {
  type: 'performance' | 'engagement' | 'audience' | 'content' | 'custom'
  format: 'pdf' | 'excel' | 'csv' | 'png'
  period: 'week' | 'month' | 'quarter' | 'year' | 'custom'
  customPeriod?: {
    start: string
    end: string
  }
  metrics: string[]
  includeCharts: boolean
  includeTables: boolean
  includeInsights: boolean
  branding: boolean
  schedule?: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    recipients: string[]
  }
}

interface PresetReport {
  id: string
  name: string
  description: string
  type: ReportConfig['type']
  metrics: string[]
  icon: React.ReactNode
  popular?: boolean
}

export function ExportableReports() {
  const [activeTab, setActiveTab] = useState('quick')
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: 'performance',
    format: 'pdf',
    period: 'month',
    metrics: [],
    includeCharts: true,
    includeTables: true,
    includeInsights: true,
    branding: true
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('')

  const presetReports: PresetReport[] = [
    {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level performance overview for leadership',
      type: 'performance',
      metrics: ['total-users', 'engagement-rate', 'growth', 'revenue'],
      icon: <BarChart3 className="h-5 w-5" />,
      popular: true
    },
    {
      id: 'social-performance',
      name: 'Social Media Performance',
      description: 'Detailed social media metrics and insights',
      type: 'engagement',
      metrics: ['likes', 'shares', 'comments', 'reach', 'impressions'],
      icon: <Share className="h-5 w-5" />,
      popular: true
    },
    {
      id: 'audience-insights',
      name: 'Audience Insights',
      description: 'Demographics and behavior analysis',
      type: 'audience',
      metrics: ['demographics', 'interests', 'behavior', 'growth'],
      icon: <Eye className="h-5 w-5" />
    },
    {
      id: 'content-analysis',
      name: 'Content Analysis',
      description: 'Content performance and optimization insights',
      type: 'content',
      metrics: ['post-performance', 'content-types', 'timing', 'hashtags'],
      icon: <FileText className="h-5 w-5" />
    }
  ]

  const availableMetrics = {
    performance: [
      'total-users', 'active-users', 'session-duration', 'bounce-rate',
      'conversion-rate', 'revenue', 'growth-rate', 'retention'
    ],
    engagement: [
      'likes', 'comments', 'shares', 'saves', 'reach', 'impressions',
      'engagement-rate', 'click-through-rate', 'video-views'
    ],
    audience: [
      'demographics', 'location', 'age-groups', 'interests', 'devices',
      'traffic-sources', 'new-vs-returning', 'user-journey'
    ],
    content: [
      'post-performance', 'content-types', 'posting-times', 'hashtag-performance',
      'top-content', 'content-engagement', 'viral-content'
    ]
  }

  const generateReport = async () => {
    setIsGenerating(true)
    try {
      // Mock report generation
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      const reportData = {
        title: getReportTitle(),
        generatedAt: new Date().toISOString(),
        period: reportConfig.period,
        customPeriod: reportConfig.customPeriod,
        metrics: reportConfig.metrics,
        format: reportConfig.format,
        config: reportConfig
      }

      // Generate and download the report
      await downloadReport(reportData)
      
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const getReportTitle = () => {
    if (selectedPreset) {
      const preset = presetReports.find(p => p.id === selectedPreset)
      return preset?.name || 'Analytics Report'
    }
    return `${reportConfig.type.charAt(0).toUpperCase() + reportConfig.type.slice(1)} Report`
  }

  const downloadReport = async (data: any) => {
    const filename = `${getReportTitle().toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}`
    
    switch (reportConfig.format) {
      case 'pdf':
        await generatePDFReport(data, `${filename}.pdf`)
        break
      case 'excel':
        await generateExcelReport(data, `${filename}.xlsx`)
        break
      case 'csv':
        await generateCSVReport(data, `${filename}.csv`)
        break
      case 'png':
        await generateImageReport(data, `${filename}.png`)
        break
    }
  }

  const generatePDFReport = async (data: any, filename: string) => {
    // Mock PDF generation
    const pdfContent = generatePDFContent(data)
    const blob = new Blob([pdfContent], { type: 'application/pdf' })
    downloadFile(blob, filename)
  }

  const generateExcelReport = async (data: any, filename: string) => {
    // Mock Excel generation
    const csvContent = generateCSVContent(data)
    const blob = new Blob([csvContent], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    downloadFile(blob, filename)
  }

  const generateCSVReport = async (data: any, filename: string) => {
    const csvContent = generateCSVContent(data)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    downloadFile(blob, filename)
  }

  const generateImageReport = async (data: any, filename: string) => {
    // Mock image generation (would use canvas or chart library)
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')!
    
    // Simple mock chart
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.font = '24px Arial'
    ctx.fillText(data.title, 50, 50)
    ctx.fillText(`Generated: ${format(new Date(), 'PPP')}`, 50, 100)
    
    canvas.toBlob((blob) => {
      if (blob) downloadFile(blob, filename)
    }, 'image/png')
  }

  const generateCSVContent = (data: any) => {
    const headers = ['Metric', 'Value', 'Period', 'Generated At']
    const rows = data.metrics.map((metric: string) => [
      metric.replace('-', ' ').toUpperCase(),
      Math.floor(Math.random() * 10000),
      data.period,
      data.generatedAt
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const generatePDFContent = (data: any) => {
    // Mock PDF content (would use PDF library like jsPDF)
    return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj

xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
492
%%EOF`
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectPreset = (presetId: string) => {
    setSelectedPreset(presetId)
    const preset = presetReports.find(p => p.id === presetId)
    if (preset) {
      setReportConfig(prev => ({
        ...prev,
        type: preset.type,
        metrics: preset.metrics
      }))
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Export Reports</span>
          </CardTitle>
          <CardDescription>
            Generate and export analytics reports in various formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick">Quick Reports</TabsTrigger>
              <TabsTrigger value="custom">Custom Report</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presetReports.map((preset) => (
                  <Card 
                    key={preset.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50",
                      selectedPreset === preset.id && "ring-2 ring-primary"
                    )}
                    onClick={() => selectPreset(preset.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {preset.icon}
                          <CardTitle className="text-base">{preset.name}</CardTitle>
                        </div>
                        {preset.popular && (
                          <Badge variant="secondary" className="text-xs">Popular</Badge>
                        )}
                      </div>
                      <CardDescription>{preset.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {preset.metrics.slice(0, 4).map((metric) => (
                          <Badge key={metric} variant="outline" className="text-xs">
                            {metric.replace('-', ' ')}
                          </Badge>
                        ))}
                        {preset.metrics.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{preset.metrics.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedPreset && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Export Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <Select 
                          value={reportConfig.format} 
                          onValueChange={(value: any) => setReportConfig(prev => ({ ...prev, format: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4" />
                                <span>PDF Report</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="excel">
                              <div className="flex items-center space-x-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>Excel (.xlsx)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="csv">
                              <div className="flex items-center space-x-2">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>CSV Data</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="png">
                              <div className="flex items-center space-x-2">
                                <FileImage className="h-4 w-4" />
                                <span>PNG Image</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Time Period</Label>
                        <Select 
                          value={reportConfig.period} 
                          onValueChange={(value: any) => setReportConfig(prev => ({ ...prev, period: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="week">Last Week</SelectItem>
                            <SelectItem value="month">Last Month</SelectItem>
                            <SelectItem value="quarter">Last Quarter</SelectItem>
                            <SelectItem value="year">Last Year</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Include</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="charts" 
                              checked={reportConfig.includeCharts}
                              onCheckedChange={(checked) => 
                                setReportConfig(prev => ({ ...prev, includeCharts: !!checked }))
                              }
                            />
                            <Label htmlFor="charts" className="text-sm">Charts</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="tables" 
                              checked={reportConfig.includeTables}
                              onCheckedChange={(checked) => 
                                setReportConfig(prev => ({ ...prev, includeTables: !!checked }))
                              }
                            />
                            <Label htmlFor="tables" className="text-sm">Data Tables</Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={generateReport} 
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Report...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Generate & Download Report
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Report Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Report Type</Label>
                      <Select 
                        value={reportConfig.type} 
                        onValueChange={(value: any) => setReportConfig(prev => ({ ...prev, type: value, metrics: [] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="performance">Performance Report</SelectItem>
                          <SelectItem value="engagement">Engagement Report</SelectItem>
                          <SelectItem value="audience">Audience Report</SelectItem>
                          <SelectItem value="content">Content Report</SelectItem>
                          <SelectItem value="custom">Custom Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Metrics to Include</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {availableMetrics[reportConfig.type]?.map((metric) => (
                          <div key={metric} className="flex items-center space-x-2">
                            <Checkbox 
                              id={metric}
                              checked={reportConfig.metrics.includes(metric)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setReportConfig(prev => ({ 
                                    ...prev, 
                                    metrics: [...prev.metrics, metric] 
                                  }))
                                } else {
                                  setReportConfig(prev => ({ 
                                    ...prev, 
                                    metrics: prev.metrics.filter(m => m !== metric) 
                                  }))
                                }
                              }}
                            />
                            <Label htmlFor={metric} className="text-sm">
                              {metric.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Export Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Format</Label>
                        <Select 
                          value={reportConfig.format} 
                          onValueChange={(value: any) => setReportConfig(prev => ({ ...prev, format: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="png">PNG</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Period</Label>
                        <Select 
                          value={reportConfig.period} 
                          onValueChange={(value: any) => setReportConfig(prev => ({ ...prev, period: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="week">Week</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="quarter">Quarter</SelectItem>
                            <SelectItem value="year">Year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Options</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="custom-charts" 
                            checked={reportConfig.includeCharts}
                            onCheckedChange={(checked) => 
                              setReportConfig(prev => ({ ...prev, includeCharts: !!checked }))
                            }
                          />
                          <Label htmlFor="custom-charts">Include Charts</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="custom-tables" 
                            checked={reportConfig.includeTables}
                            onCheckedChange={(checked) => 
                              setReportConfig(prev => ({ ...prev, includeTables: !!checked }))
                            }
                          />
                          <Label htmlFor="custom-tables">Include Data Tables</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="insights" 
                            checked={reportConfig.includeInsights}
                            onCheckedChange={(checked) => 
                              setReportConfig(prev => ({ ...prev, includeInsights: !!checked }))
                            }
                          />
                          <Label htmlFor="insights">Include Insights</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="branding" 
                            checked={reportConfig.branding}
                            onCheckedChange={(checked) => 
                              setReportConfig(prev => ({ ...prev, branding: !!checked }))
                            }
                          />
                          <Label htmlFor="branding">Include Company Branding</Label>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={generateReport} 
                      disabled={isGenerating || reportConfig.metrics.length === 0}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Generate Custom Report
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5" />
                    <span>Scheduled Reports</span>
                  </CardTitle>
                  <CardDescription>
                    Set up automatic report generation and delivery
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No Scheduled Reports</p>
                    <p className="text-sm">Create automated reports to be delivered regularly</p>
                    <Button className="mt-4">
                      <Settings className="h-4 w-4 mr-2" />
                      Set up Scheduled Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}