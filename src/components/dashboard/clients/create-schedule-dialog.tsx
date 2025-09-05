'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Clock, Calendar, Mail } from 'lucide-react'

interface CreateScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScheduleCreated: (schedule?: any) => void
  clients?: any[]
  templates?: any[]
  editSchedule?: any
  toast: any
}

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily', description: 'Every day at the specified time' },
  { value: 'WEEKLY', label: 'Weekly', description: 'Every week on the selected day' },
  { value: 'MONTHLY', label: 'Monthly', description: 'Every month on the selected date' },
  { value: 'QUARTERLY', label: 'Quarterly', description: 'Every 3 months on the selected date' }
]

const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

export function CreateScheduleDialog({ 
  open, 
  onOpenChange, 
  onScheduleCreated,
  clients = [],
  templates = [],
  editSchedule,
  toast 
}: CreateScheduleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState(editSchedule?.name || '')
  const [clientId, setClientId] = useState(editSchedule?.clientId || '')
  const [templateId, setTemplateId] = useState(editSchedule?.templateId || '')
  const [frequency, setFrequency] = useState(editSchedule?.frequency || 'WEEKLY')
  const [dayOfWeek, setDayOfWeek] = useState(editSchedule?.dayOfWeek ?? 1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState(editSchedule?.dayOfMonth ?? 1)
  const [time, setTime] = useState(editSchedule?.time || '09:00')
  const [recipients, setRecipients] = useState<string[]>(editSchedule?.recipients || [])
  const [recipientInput, setRecipientInput] = useState('')
  const [isActive, setIsActive] = useState(editSchedule?.isActive ?? true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Schedule name is required')
      return
    }

    if (!clientId) {
      toast.error('Please select a client')
      return
    }

    if (!templateId) {
      toast.error('Please select a template')
      return
    }

    if (!time) {
      toast.error('Please specify the time')
      return
    }

    // Validate time format
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      toast.error('Invalid time format. Use HH:MM format (e.g., 09:00)')
      return
    }

    setIsLoading(true)

    try {
      const url = editSchedule 
        ? `/api/client-reports/schedules/${editSchedule.id}`
        : '/api/client-reports/schedules'
      
      const response = await fetch(url, {
        method: editSchedule ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          clientId,
          templateId,
          frequency,
          dayOfWeek: frequency === 'WEEKLY' ? dayOfWeek : null,
          dayOfMonth: frequency === 'MONTHLY' || frequency === 'QUARTERLY' ? dayOfMonth : null,
          time,
          recipients,
          isActive
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Schedule ${editSchedule ? 'updated' : 'created'} successfully`)
        onScheduleCreated(data.schedule)
        resetForm()
      } else {
        const error = await response.json()
        toast.error(`Failed to create schedule: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast.error('Failed to create schedule. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    if (editSchedule) {
      setName(editSchedule.name || '')
      setClientId(editSchedule.clientId || '')
      setTemplateId(editSchedule.templateId || '')
      setFrequency(editSchedule.frequency || 'WEEKLY')
      setDayOfWeek(editSchedule.dayOfWeek ?? 1)
      setDayOfMonth(editSchedule.dayOfMonth ?? 1)
      setTime(editSchedule.time || '09:00')
      setRecipients(editSchedule.recipients || [])
      setIsActive(editSchedule.isActive ?? true)
    } else {
      setName('')
      setClientId('')
      setTemplateId('')
      setFrequency('WEEKLY')
      setDayOfWeek(1)
      setDayOfMonth(1)
      setTime('09:00')
      setRecipients([])
      setIsActive(true)
    }
    setRecipientInput('')
  }

  const handleAddRecipient = () => {
    const email = recipientInput.trim()
    if (email && email.includes('@') && !recipients.includes(email)) {
      setRecipients(prev => [...prev, email])
      setRecipientInput('')
    }
  }

  const handleRemoveRecipient = (email: string) => {
    setRecipients(prev => prev.filter(r => r !== email))
  }

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      resetForm()
    }
  }

  const selectedClient = clients.find(c => c.id === clientId)
  const selectedTemplate = templates.find(t => t.id === templateId)

  // Initialize form when editSchedule changes
  React.useEffect(() => {
    if (editSchedule) {
      setName(editSchedule.name || '')
      setClientId(editSchedule.clientId || '')
      setTemplateId(editSchedule.templateId || '')
      setFrequency(editSchedule.frequency || 'WEEKLY')
      setDayOfWeek(editSchedule.dayOfWeek ?? 1)
      setDayOfMonth(editSchedule.dayOfMonth ?? 1)
      setTime(editSchedule.time || '09:00')
      setRecipients(editSchedule.recipients || [])
      setIsActive(editSchedule.isActive ?? true)
    }
  }, [editSchedule])

  // Pre-fill recipient with client email when client is selected
  React.useEffect(() => {
    if (selectedClient?.email && !recipients.includes(selectedClient.email)) {
      setRecipients([selectedClient.email])
    }
  }, [selectedClient, recipients])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {editSchedule ? 'Edit Scheduled Report' : 'Create Scheduled Report'}
          </DialogTitle>
          <DialogDescription>
            Set up automated report generation and delivery
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="schedule-name">Schedule Name *</Label>
              <Input
                id="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly Performance Report for Acme Corp"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client-select">Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col">
                          <span>{client.name}</span>
                          {client.company && (
                            <span className="text-xs text-muted-foreground">{client.company}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="template-select">Template *</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.filter(t => t.isActive).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex flex-col">
                          <span>{template.name}</span>
                          <span className="text-xs text-muted-foreground">{template.type}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="space-y-4">
            <div>
              <Label>Frequency *</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {frequencyOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      frequency === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => setFrequency(option.value)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          frequency === option.value ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {frequency === 'WEEKLY' && (
                <div>
                  <Label>Day of Week</Label>
                  <Select value={dayOfWeek.toString()} onValueChange={(value) => setDayOfWeek(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(frequency === 'MONTHLY' || frequency === 'QUARTERLY') && (
                <div>
                  <Label>Day of Month</Label>
                  <Select value={dayOfMonth.toString()} onValueChange={(value) => setDayOfMonth(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="time-input">Time *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="time-input"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Email Recipients */}
          <div className="space-y-4">
            <div>
              <Label>Email Recipients</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      placeholder="Enter email address"
                      className="pl-10"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddRecipient()
                        }
                      }}
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleAddRecipient}
                    disabled={!recipientInput.trim() || !recipientInput.includes('@')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recipients.map((email) => (
                      <Badge key={email} variant="secondary" className="text-xs">
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipient(email)}
                          className="ml-2 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Recipients will receive the generated report via email
                </p>
              </div>
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="schedule-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="schedule-active">
                Active (schedule will run automatically)
              </Label>
            </div>
          </div>

          {/* Preview */}
          {name && clientId && templateId && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Schedule Preview</h4>
              <div className="text-sm space-y-1">
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Client:</strong> {selectedClient?.name}</p>
                <p><strong>Template:</strong> {selectedTemplate?.name}</p>
                <p><strong>Frequency:</strong> {frequency.toLowerCase()}</p>
                <p><strong>Time:</strong> {time}</p>
                {recipients.length > 0 && (
                  <p><strong>Recipients:</strong> {recipients.length} email(s)</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading 
                ? (editSchedule ? 'Updating...' : 'Creating...') 
                : (editSchedule ? 'Update Schedule' : 'Create Schedule')
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}