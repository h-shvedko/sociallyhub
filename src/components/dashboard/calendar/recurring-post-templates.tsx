"use client"

import { useState, useEffect } from "react"
import { format, addDays, addWeeks, addMonths, addYears } from "date-fns"
import { 
  Repeat, 
  Plus, 
  X, 
  Save, 
  Calendar as CalendarIcon,
  Clock,
  Edit,
  Trash2,
  Copy
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RecurringPostTemplatesProps {
  isOpen: boolean
  onClose: () => void
}

interface RecurringTemplate {
  id: string
  name: string
  content: string
  platforms: string[]
  recurrence: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly'
    interval: number
    daysOfWeek?: number[] // 0 = Sunday, 1 = Monday, etc.
    dayOfMonth?: number
    endDate?: string
  }
  schedule: {
    startDate: string
    time: string
  }
  isActive: boolean
}

const platforms = [
  { id: 'TWITTER', name: 'Twitter', color: 'bg-blue-500' },
  { id: 'FACEBOOK', name: 'Facebook', color: 'bg-blue-600' },
  { id: 'INSTAGRAM', name: 'Instagram', color: 'bg-pink-500' },
  { id: 'LINKEDIN', name: 'LinkedIn', color: 'bg-blue-700' },
  { id: 'YOUTUBE', name: 'YouTube', color: 'bg-red-500' },
  { id: 'TIKTOK', name: 'TikTok', color: 'bg-black' },
]

const daysOfWeek = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
]

export function RecurringPostTemplates({ isOpen, onClose }: RecurringPostTemplatesProps) {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([])
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'edit'>('list')
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null)
  const [loading, setLoading] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    platforms: ['TWITTER'],
    recurrenceType: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: 1,
    daysOfWeek: [1], // Default to Monday
    dayOfMonth: 1,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    endDate: '',
    isActive: true
  })

  // Load templates from localStorage (in a real app, this would be from an API)
  useEffect(() => {
    const savedTemplates = localStorage.getItem('recurringTemplates')
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates))
    }
  }, [])

  const saveTemplates = (newTemplates: RecurringTemplate[]) => {
    setTemplates(newTemplates)
    localStorage.setItem('recurringTemplates', JSON.stringify(newTemplates))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      content: '',
      platforms: ['TWITTER'],
      recurrenceType: 'weekly',
      interval: 1,
      daysOfWeek: [1],
      dayOfMonth: 1,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      time: '09:00',
      endDate: '',
      isActive: true
    })
    setEditingTemplate(null)
  }

  const handleSaveTemplate = () => {
    const template: RecurringTemplate = {
      id: editingTemplate?.id || Date.now().toString(),
      name: formData.name,
      content: formData.content,
      platforms: formData.platforms,
      recurrence: {
        type: formData.recurrenceType,
        interval: formData.interval,
        daysOfWeek: formData.recurrenceType === 'weekly' ? formData.daysOfWeek : undefined,
        dayOfMonth: formData.recurrenceType === 'monthly' ? formData.dayOfMonth : undefined,
        endDate: formData.endDate || undefined
      },
      schedule: {
        startDate: formData.startDate,
        time: formData.time
      },
      isActive: formData.isActive
    }

    if (editingTemplate) {
      saveTemplates(templates.map(t => t.id === template.id ? template : t))
    } else {
      saveTemplates([...templates, template])
    }

    resetForm()
    setActiveTab('list')
  }

  const handleEditTemplate = (template: RecurringTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      content: template.content,
      platforms: template.platforms,
      recurrenceType: template.recurrence.type,
      interval: template.recurrence.interval,
      daysOfWeek: template.recurrence.daysOfWeek || [1],
      dayOfMonth: template.recurrence.dayOfMonth || 1,
      startDate: template.schedule.startDate,
      time: template.schedule.time,
      endDate: template.recurrence.endDate || '',
      isActive: template.isActive
    })
    setActiveTab('edit')
  }

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      saveTemplates(templates.filter(t => t.id !== id))
    }
  }

  const handleToggleActive = (id: string) => {
    saveTemplates(templates.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ))
  }

  const handleDuplicateTemplate = (template: RecurringTemplate) => {
    const duplicate: RecurringTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Copy)`
    }
    saveTemplates([...templates, duplicate])
  }

  const generatePosts = async (template: RecurringTemplate) => {
    setLoading(true)
    try {
      const posts = []
      const startDate = new Date(template.schedule.startDate)
      const endDate = template.recurrence.endDate ? new Date(template.recurrence.endDate) : addMonths(startDate, 3)
      
      let currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        let shouldSchedule = false
        
        if (template.recurrence.type === 'daily') {
          shouldSchedule = true
        } else if (template.recurrence.type === 'weekly') {
          const dayOfWeek = currentDate.getDay()
          shouldSchedule = template.recurrence.daysOfWeek?.includes(dayOfWeek) || false
        } else if (template.recurrence.type === 'monthly') {
          shouldSchedule = currentDate.getDate() === template.recurrence.dayOfMonth
        } else if (template.recurrence.type === 'yearly') {
          shouldSchedule = currentDate.getMonth() === startDate.getMonth() && 
                         currentDate.getDate() === startDate.getDate()
        }
        
        if (shouldSchedule) {
          const [hours, minutes] = template.schedule.time.split(':')
          const scheduledDateTime = new Date(currentDate)
          scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
          
          posts.push({
            title: `${template.name} - ${format(scheduledDateTime, 'MMM dd')}`,
            content: {
              text: template.content,
              media: [],
              hashtags: [],
              mentions: []
            },
            platforms: template.platforms,
            status: 'SCHEDULED',
            scheduledAt: scheduledDateTime.toISOString(),
            tags: ['recurring', template.id]
          })
        }
        
        // Move to next occurrence
        switch (template.recurrence.type) {
          case 'daily':
            currentDate = addDays(currentDate, template.recurrence.interval)
            break
          case 'weekly':
            currentDate = addWeeks(currentDate, template.recurrence.interval)
            break
          case 'monthly':
            currentDate = addMonths(currentDate, template.recurrence.interval)
            break
          case 'yearly':
            currentDate = addYears(currentDate, template.recurrence.interval)
            break
        }
      }

      // Create posts in batches
      const results = await Promise.allSettled(
        posts.map(post =>
          fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post)
          })
        )
      )

      const successful = results.filter(result => result.status === 'fulfilled').length
      const failed = results.length - successful

      if (failed > 0) {
        alert(`Generated ${successful} posts successfully. ${failed} posts failed.`)
      } else {
        alert(`Successfully generated ${successful} recurring posts!`)
      }

      window.location.reload()
    } catch (error) {
      console.error('Failed to generate recurring posts:', error)
      alert('Failed to generate recurring posts')
    } finally {
      setLoading(false)
    }
  }

  const getRecurrenceDescription = (template: RecurringTemplate) => {
    const { type, interval, daysOfWeek, dayOfMonth } = template.recurrence
    
    if (type === 'daily') {
      return interval === 1 ? 'Daily' : `Every ${interval} days`
    } else if (type === 'weekly') {
      const days = daysOfWeek?.map(d => daysOfWeek.find(day => day.value === d)?.short).join(', ')
      return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`
    } else if (type === 'monthly') {
      return interval === 1 ? `Monthly on day ${dayOfMonth}` : `Every ${interval} months on day ${dayOfMonth}`
    } else if (type === 'yearly') {
      return interval === 1 ? 'Yearly' : `Every ${interval} years`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Recurring Post Templates
          </DialogTitle>
          <DialogDescription>
            Create templates for posts that repeat automatically on your schedule
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Templates ({templates.length})</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="edit" disabled={!editingTemplate}>
              {editingTemplate ? 'Edit Template' : 'Edit'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {templates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Repeat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">No recurring templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first recurring post template to automate your social media posting
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <Card key={template.id} className={`${!template.isActive ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{template.name}</h4>
                            <Badge variant={template.isActive ? 'default' : 'secondary'}>
                              {template.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant="outline">
                              {getRecurrenceDescription(template)}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {template.content}
                          </p>
                          
                          <div className="flex items-center gap-2 mb-2">
                            {template.platforms.map(platformId => {
                              const platform = platforms.find(p => p.id === platformId)
                              return (
                                <div
                                  key={platformId}
                                  className="flex items-center gap-1 text-xs bg-muted/30 rounded px-2 py-1"
                                >
                                  <div className={`w-2 h-2 rounded-full ${platform?.color}`} />
                                  {platform?.name}
                                </div>
                              )
                            })}
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            Next: {format(new Date(template.schedule.startDate), 'MMM dd, yyyy')} at {template.schedule.time}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(template.id)}
                            title={template.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {template.isActive ? <Clock className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generatePosts(template)}
                            disabled={loading}
                            title="Generate Posts"
                          >
                            <Repeat className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateTemplate(template)}
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Recurring Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Daily Motivation, Weekly Tips"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Content *</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Your recurring post content..."
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Platforms</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {platforms.map((platform) => (
                      <Card
                        key={platform.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          formData.platforms.includes(platform.id) 
                            ? 'ring-2 ring-primary shadow-md' 
                            : ''
                        }`}
                        onClick={() => {
                          const newPlatforms = formData.platforms.includes(platform.id)
                            ? formData.platforms.filter(p => p !== platform.id)
                            : [...formData.platforms, platform.id]
                          setFormData({ ...formData, platforms: newPlatforms })
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${platform.color}`} />
                            <span className="text-sm font-medium">{platform.name}</span>
                            {formData.platforms.includes(platform.id) && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                ✓
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recurrence Type</Label>
                    <Select 
                      value={formData.recurrenceType} 
                      onValueChange={(value: any) => setFormData({ ...formData, recurrenceType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Interval</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.interval}
                      onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>

                {formData.recurrenceType === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex gap-2 flex-wrap">
                      {daysOfWeek.map((day) => (
                        <Button
                          key={day.value}
                          variant={formData.daysOfWeek.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const newDays = formData.daysOfWeek.includes(day.value)
                              ? formData.daysOfWeek.filter(d => d !== day.value)
                              : [...formData.daysOfWeek, day.value]
                            setFormData({ ...formData, daysOfWeek: newDays })
                          }}
                        >
                          {day.short}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {formData.recurrenceType === 'monthly' && (
                  <div className="space-y-2">
                    <Label>Day of Month</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.dayOfMonth}
                      onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                  />
                  <Label htmlFor="active">Activate template immediately</Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm()
                  setActiveTab('list')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!formData.name || !formData.content || formData.platforms.length === 0}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {editingTemplate && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Edit Template: {editingTemplate.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Same form fields as create, but with editing template data */}
                    <div className="space-y-2">
                      <Label>Template Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Daily Motivation, Weekly Tips"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Content *</Label>
                      <Textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Your recurring post content..."
                        rows={3}
                      />
                    </div>

                    {/* Rest of the form fields same as create tab */}
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setActiveTab('list')
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={!formData.name || !formData.content || formData.platforms.length === 0}
                    className="flex-1"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Update Template
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}