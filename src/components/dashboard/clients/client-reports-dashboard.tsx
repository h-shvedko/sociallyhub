'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Filter,
  MoreVertical,
  MoreHorizontal,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause
} from 'lucide-react'
import { CreateReportDialog } from './create-report-dialog'
import { EditTemplateDialog } from './edit-template-dialog'
import { CreateScheduleDialog } from './create-schedule-dialog'
import { CreateTemplateDialog } from './create-template-dialog'
import { useToast } from '@/hooks/use-toast'
import { ToastContainer } from '@/components/ui/toast'

interface ClientReportsProps {
  clients?: any[]
}

interface ClientReport {
  id: string
  name: string
  description?: string
  type: string
  format: string
  frequency: string
  status: string
  client: {
    id: string
    name: string
    company?: string
  }
  template?: {
    id: string
    name: string
    type: string
  }
  lastGenerated?: Date
  downloadCount: number
  fileSize?: string
  createdAt: Date
}

interface ReportTemplate {
  id: string
  name: string
  description?: string
  type: string
  format: string[]
  metrics: string[]
  isActive: boolean
  isDefault: boolean
}

interface ReportSchedule {
  id: string
  name: string
  frequency: string
  dayOfWeek?: number
  dayOfMonth?: number
  time: string
  recipients: string[]
  isActive: boolean
  lastRun?: Date
  nextRun?: Date
  client: {
    id: string
    name: string
    company?: string
    email?: string
  }
  template: {
    id: string
    name: string
    type: string
    format: string[]
  }
  createdAt: Date
}

export function ClientReportsDashboard({ clients = [] }: ClientReportsProps) {
  const { toasts, toast, removeToast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [reports, setReports] = useState<ClientReport[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false)
  const [showEditTemplateDialog, setShowEditTemplateDialog] = useState(false)
  const [showCreateTemplateDialog, setShowCreateTemplateDialog] = useState(false)
  const [showCreateScheduleDialog, setShowCreateScheduleDialog] = useState(false)
  const [showEditScheduleDialog, setShowEditScheduleDialog] = useState(false)
  const [showDeleteScheduleDialog, setShowDeleteScheduleDialog] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ClientReport | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<ReportSchedule | null>(null)

  useEffect(() => {
    fetchReports()
    fetchTemplates()
    if (activeTab === 'scheduled') {
      fetchSchedules()
    }
  }, [selectedClient, selectedStatus, selectedType, activeTab])

  const fetchReports = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      
      if (selectedClient && selectedClient !== 'all') params.append('clientId', selectedClient)
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus)
      if (selectedType && selectedType !== 'all') params.append('type', selectedType)

      const response = await fetch(`/api/client-reports?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSchedules = async () => {
    try {
      setIsSchedulesLoading(true)
      const params = new URLSearchParams()
      
      if (selectedClient && selectedClient !== 'all') params.append('clientId', selectedClient)

      const response = await fetch(`/api/client-reports/schedules?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setSchedules(data.schedules || [])
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setIsSchedulesLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/client-reports/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'GENERATING':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'SCHEDULED':
        return <Clock className="h-4 w-4 text-orange-600" />
      default:
        return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'GENERATING':
        return 'bg-blue-100 text-blue-800'
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      case 'SCHEDULED':
        return 'bg-orange-100 text-orange-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleDownloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/client-reports/${reportId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${reportId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        // Refresh reports to update download count
        fetchReports()
      }
    } catch (error) {
      console.error('Error downloading report:', error)
    }
  }

  const handleReportCreated = (newReport?: any) => {
    // Add the new report to the list immediately for better UX
    if (newReport) {
      setReports(prevReports => [newReport, ...prevReports])
    }
    // Also refresh the full list to ensure consistency
    fetchReports()
    // Close the dialog
    setShowCreateDialog(false)
  }

  const handleViewDetails = (report: ClientReport) => {
    setSelectedReport(report)
    setShowViewDialog(true)
  }

  const handleEditReport = (report: ClientReport) => {
    setSelectedReport(report)
    setShowEditDialog(true)
  }

  const handleDeleteReport = async (report: ClientReport) => {
    setSelectedReport(report)
    setShowDeleteDialog(true)
  }

  const handleSendEmail = (report: ClientReport) => {
    setSelectedReport(report)
    setShowSendEmailDialog(true)
  }

  const handleEditTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template)
    setShowEditTemplateDialog(true)
  }

  const handleUseTemplate = (template: ReportTemplate) => {
    // Open the create report dialog with the template pre-selected
    setSelectedTemplate(template)
    setShowCreateDialog(true)
  }

  const handleTemplateUpdated = (updatedTemplate?: any) => {
    // Update the specific template in the local state immediately
    if (updatedTemplate) {
      setTemplates(prevTemplates => 
        prevTemplates.map(template => 
          template.id === updatedTemplate.id ? updatedTemplate : template
        )
      )
    }
    // Also refresh from server to ensure consistency
    fetchTemplates()
    setShowEditTemplateDialog(false)
    setSelectedTemplate(null)
  }

  const handleTemplateCreated = (newTemplate?: any) => {
    // Add the new template to the local state immediately
    if (newTemplate) {
      setTemplates(prevTemplates => [newTemplate, ...prevTemplates])
    }
    // Also refresh from server to ensure consistency
    fetchTemplates()
    setShowCreateTemplateDialog(false)
  }

  const confirmDeleteReport = async () => {
    if (!selectedReport) return
    
    try {
      const response = await fetch(`/api/client-reports/${selectedReport.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // Remove from local state immediately
        setReports(prevReports => prevReports.filter(r => r.id !== selectedReport.id))
        setShowDeleteDialog(false)
        setSelectedReport(null)
      } else {
        console.error('Failed to delete report')
      }
    } catch (error) {
      console.error('Error deleting report:', error)
    }
  }

  const handleSendEmailConfirm = async () => {
    if (!selectedReport) return

    const recipientsInput = (document.getElementById('email-recipients') as HTMLInputElement)?.value
    const subjectInput = (document.getElementById('email-subject') as HTMLInputElement)?.value
    const messageInput = (document.getElementById('email-message') as HTMLTextAreaElement)?.value

    if (!recipientsInput.trim()) {
      toast.error('Please enter at least one recipient email address')
      return
    }

    const recipients = recipientsInput.split(',').map(email => email.trim()).filter(email => email)
    
    try {
      const response = await fetch(`/api/client-reports/${selectedReport.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients,
          subject: subjectInput,
          message: messageInput
        })
      })

      if (response.ok) {
        toast.success('Report sent successfully!')
        setShowSendEmailDialog(false)
        setSelectedReport(null)
      } else {
        const error = await response.json()
        toast.error(`Failed to send report: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sending report:', error)
      toast.error('Failed to send report. Please try again.')
    }
  }

  const toggleScheduleActive = async (scheduleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/client-reports/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      })

      if (response.ok) {
        toast.success(`Schedule ${isActive ? 'activated' : 'paused'} successfully`)
        fetchSchedules()
      } else {
        const error = await response.json()
        toast.error(`Failed to update schedule: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating schedule:', error)
      toast.error('Failed to update schedule. Please try again.')
    }
  }

  const runScheduleNow = async (scheduleId: string) => {
    try {
      const response = await fetch('/api/client-reports/schedules/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'default-cron-secret'}`
        },
        body: JSON.stringify({ scheduleId }),
      })

      if (response.ok) {
        toast.success('Schedule executed successfully')
        fetchSchedules()
        fetchReports()
      } else {
        const error = await response.json()
        toast.error(`Failed to execute schedule: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error executing schedule:', error)
      toast.error('Failed to execute schedule. Please try again.')
    }
  }

  const handleDeleteScheduleConfirm = async () => {
    if (!selectedSchedule) return

    try {
      const response = await fetch(`/api/client-reports/schedules/${selectedSchedule.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Schedule deleted successfully')
        fetchSchedules()
        setShowDeleteScheduleDialog(false)
        setSelectedSchedule(null)
      } else {
        const error = await response.json()
        toast.error(`Failed to delete schedule: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Failed to delete schedule. Please try again.')
    }
  }

  const filteredReports = reports.filter(report => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        report.name.toLowerCase().includes(query) ||
        report.client.name.toLowerCase().includes(query) ||
        report.type.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Calculate stats
  const stats = {
    total: reports.length,
    completed: reports.filter(r => r.status === 'COMPLETED').length,
    scheduled: reports.filter(r => r.status === 'SCHEDULED').length,
    generating: reports.filter(r => r.status === 'GENERATING').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Client Reports</h2>
          <p className="text-muted-foreground">
            Generate, schedule, and manage client performance reports
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              All time reports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              Ready for download
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground">
              Automated reports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generating</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.generating}</div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="GENERATING">Generating</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="EXECUTIVE">Executive</SelectItem>
                <SelectItem value="PERFORMANCE">Performance</SelectItem>
                <SelectItem value="ANALYTICS">Analytics</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchReports}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Reports List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No reports found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery || (selectedClient && selectedClient !== 'all') || (selectedStatus && selectedStatus !== 'all') || (selectedType && selectedType !== 'all')
                    ? "Try adjusting your filters or search terms"
                    : "Get started by creating your first client report"
                  }
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          {getStatusIcon(report.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{report.name}</h3>
                              <Badge className={getStatusColor(report.status)}>
                                {report.status.toLowerCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {report.client.name}
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {report.format}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(report.createdAt)}
                              </span>
                              {report.fileSize && (
                                <span className="flex items-center gap-1">
                                  <Download className="h-3 w-3" />
                                  {report.fileSize}
                                </span>
                              )}
                            </div>
                            {report.description && (
                              <p className="text-sm text-muted-foreground">
                                {report.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {report.downloadCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {report.downloadCount} downloads
                          </span>
                        )}
                        {report.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadReport(report.id)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(report)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditReport(report)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendEmail(report)}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteReport(report)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Report Templates</h3>
              <p className="text-muted-foreground text-sm">
                Manage and customize report templates for faster report generation
              </p>
            </div>
            <Button onClick={() => setShowCreateTemplateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className={template.isDefault ? 'ring-2 ring-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {template.name}
                        {template.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">FORMATS</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.format.map((format) => (
                          <Badge key={format} variant="outline" className="text-xs">
                            {format}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">METRICS ({template.metrics.length})</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.metrics.slice(0, 3).map((metric) => (
                          <Badge key={metric} variant="outline" className="text-xs">
                            {metric.replace('_', ' ')}
                          </Badge>
                        ))}
                        {template.metrics.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.metrics.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleUseTemplate(template)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Use Template
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Scheduled Reports</h2>
              <p className="text-muted-foreground">
                Automate report generation and delivery
              </p>
            </div>
            <Button 
              onClick={() => setShowCreateScheduleDialog(true)}
              className="shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </div>

          {/* Scheduled Reports Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Clock className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Active Schedules</p>
                    <p className="text-2xl font-bold">{schedules.filter(s => s.isActive).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Schedules</p>
                    <p className="text-2xl font-bold">{schedules.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Next Due</p>
                    <p className="text-sm font-bold">
                      {schedules.filter(s => s.isActive && s.nextRun).length > 0
                        ? new Date(Math.min(...schedules
                            .filter(s => s.isActive && s.nextRun)
                            .map(s => new Date(s.nextRun).getTime())
                          )).toLocaleDateString()
                        : 'None'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Mail className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Recipients</p>
                    <p className="text-2xl font-bold">
                      {schedules.reduce((total, s) => total + (s.recipients?.length || 0), 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedules List */}
          {isSchedulesLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Loading schedules...</span>
                </div>
              </CardContent>
            </Card>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Scheduled Reports</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Create your first automated report schedule to start generating reports automatically.
                </p>
                <Button onClick={() => setShowCreateScheduleDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg truncate">{schedule.name}</h3>
                          <Badge 
                            variant={schedule.isActive ? 'default' : 'secondary'}
                            className={schedule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                          >
                            {schedule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Client:</span>
                            <p className="font-medium">{schedule.client.name}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Template:</span>
                            <p className="font-medium">{schedule.template.name}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Frequency:</span>
                            <p className="font-medium capitalize">{schedule.frequency.toLowerCase()}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Time:</span>
                            <p className="font-medium">{schedule.time}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Recipients:</span>
                            <p className="font-medium">
                              {schedule.recipients?.length || 0} email{(schedule.recipients?.length || 0) !== 1 ? 's' : ''}
                            </p>
                            {schedule.recipients && schedule.recipients.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {schedule.recipients.slice(0, 2).join(', ')}
                                {schedule.recipients.length > 2 && ` +${schedule.recipients.length - 2} more`}
                              </p>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Next Run:</span>
                            <p className="font-medium">
                              {schedule.nextRun && schedule.isActive
                                ? new Date(schedule.nextRun).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Not scheduled'
                              }
                            </p>
                          </div>
                        </div>
                        
                        {schedule.lastRun && (
                          <div className="mt-4 text-sm">
                            <span className="font-medium text-muted-foreground">Last Run:</span>
                            <p className="font-medium text-xs text-muted-foreground">
                              {new Date(schedule.lastRun).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedSchedule(schedule)
                            setShowEditScheduleDialog(true)
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleScheduleActive(schedule.id, !schedule.isActive)}>
                            {schedule.isActive ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause Schedule
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Activate Schedule
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => runScheduleNow(schedule.id)}>
                            <Play className="h-4 w-4 mr-2" />
                            Run Now
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedSchedule(schedule)
                              setShowDeleteScheduleDialog(true)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Schedule
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Report History</h3>
              <p className="text-muted-foreground text-center">
                View detailed history and analytics for all generated reports
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Report Dialog */}
      <CreateReportDialog 
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            // Clear selected template when dialog closes
            setSelectedTemplate(null)
          }
        }}
        onReportCreated={handleReportCreated}
        clients={clients}
        templates={templates}
        selectedTemplate={selectedTemplate}
        toast={toast}
      />

      {/* View Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Report Details
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Report Name</Label>
                  <p className="text-sm font-semibold">{selectedReport.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(selectedReport.status)}>
                    {selectedReport.status.toLowerCase()}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Client</Label>
                  <p className="text-sm">{selectedReport.client.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Format</Label>
                  <p className="text-sm">{selectedReport.format}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Frequency</Label>
                  <p className="text-sm">{selectedReport.frequency}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(selectedReport.createdAt)}</p>
                </div>
              </div>
              {selectedReport.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1">{selectedReport.description}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                {selectedReport.status === 'COMPLETED' && (
                  <Button onClick={() => handleDownloadReport(selectedReport.id)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Delete Report
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="py-4">
              <p className="text-sm">
                <strong>Report:</strong> {selectedReport.name}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Client:</strong> {selectedReport.client.name}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteReport}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Report Dialog */}
      {selectedReport && (
        <CreateReportDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onReportCreated={handleReportCreated}
          clients={clients}
          templates={templates}
          editReport={selectedReport}
          toast={toast}
        />
      )}

      {/* Send Email Dialog */}
      <Dialog open={showSendEmailDialog} onOpenChange={setShowSendEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Report via Email
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Report</Label>
                <p className="text-sm font-semibold">{selectedReport.name}</p>
                <p className="text-xs text-muted-foreground">Client: {selectedReport.client.name}</p>
              </div>
              <div>
                <Label htmlFor="email-recipients">Recipients</Label>
                <Input
                  id="email-recipients"
                  placeholder="Enter email addresses separated by commas"
                  defaultValue={selectedReport.client.email || ''}
                />
              </div>
              <div>
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  defaultValue={`${selectedReport.name} - ${selectedReport.client.name}`}
                />
              </div>
              <div>
                <Label htmlFor="email-message">Message</Label>
                <Textarea
                  id="email-message"
                  placeholder="Add a personal message..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmailConfirm}>
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      {selectedTemplate && (
        <EditTemplateDialog
          open={showEditTemplateDialog}
          onOpenChange={setShowEditTemplateDialog}
          template={selectedTemplate}
          onTemplateUpdated={handleTemplateUpdated}
          toast={toast}
        />
      )}

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={showCreateTemplateDialog}
        onOpenChange={setShowCreateTemplateDialog}
        onTemplateCreated={handleTemplateCreated}
        toast={toast}
      />

      {/* Create Schedule Dialog */}
      <CreateScheduleDialog
        open={showCreateScheduleDialog}
        onOpenChange={setShowCreateScheduleDialog}
        onScheduleCreated={(schedule) => {
          if (schedule) {
            toast.success('Schedule created successfully')
            fetchSchedules()
          }
          setShowCreateScheduleDialog(false)
        }}
        clients={clients}
        templates={templates}
        toast={toast}
      />

      {/* Edit Schedule Dialog */}
      {selectedSchedule && (
        <CreateScheduleDialog
          open={showEditScheduleDialog}
          onOpenChange={setShowEditScheduleDialog}
          onScheduleCreated={(schedule) => {
            if (schedule) {
              toast.success('Schedule updated successfully')
              fetchSchedules()
            }
            setShowEditScheduleDialog(false)
            setSelectedSchedule(null)
          }}
          clients={clients}
          templates={templates}
          editSchedule={selectedSchedule}
          toast={toast}
        />
      )}

      {/* Delete Schedule Dialog */}
      <Dialog open={showDeleteScheduleDialog} onOpenChange={setShowDeleteScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Schedule
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedSchedule && (
            <div className="my-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold">{selectedSchedule.name}</h4>
              <p className="text-sm text-muted-foreground">Client: {selectedSchedule.client.name}</p>
              <p className="text-sm text-muted-foreground">Frequency: {selectedSchedule.frequency}</p>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteScheduleDialog(false)
                setSelectedSchedule(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteScheduleConfirm}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}