'use client'

import React, { useState, useEffect } from 'react'
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
import { X, Plus } from 'lucide-react'

interface EditTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: any
  onTemplateUpdated: () => void
  toast: any
}

const availableMetrics = [
  'total_reach',
  'engagement_rate',
  'impressions',
  'clicks',
  'conversions',
  'roi',
  'ctr',
  'cpm',
  'cpc',
  'followers_growth',
  'mentions',
  'shares',
  'comments',
  'likes',
  'saves',
  'profile_visits',
  'website_clicks',
  'email_signups',
  'app_downloads',
  'video_views'
]

const availableFormats = ['PDF', 'HTML', 'CSV', 'EXCEL']

export function EditTemplateDialog({ 
  open, 
  onOpenChange, 
  template,
  onTemplateUpdated,
  toast 
}: EditTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('PERFORMANCE')
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (template) {
      setName(template.name || '')
      setDescription(template.description || '')
      setType(template.type || 'PERFORMANCE')
      setSelectedFormats(template.format || [])
      setSelectedMetrics(template.metrics || [])
      setIsActive(template.isActive !== undefined ? template.isActive : true)
      setIsDefault(template.isDefault || false)
    }
  }, [template])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Template name is required')
      return
    }

    if (selectedFormats.length === 0) {
      toast.error('At least one format must be selected')
      return
    }

    if (selectedMetrics.length === 0) {
      toast.error('At least one metric must be selected')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/client-reports/templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          type,
          format: selectedFormats,
          metrics: selectedMetrics,
          isActive,
          isDefault
        }),
      })

      if (response.ok) {
        toast.success('Template updated successfully')
        onTemplateUpdated()
      } else {
        const error = await response.json()
        toast.error(`Failed to update template: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating template:', error)
      toast.error('Failed to update template. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormatToggle = (format: string) => {
    setSelectedFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    )
  }

  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    )
  }

  const formatMetricName = (metric: string) => {
    return metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Report Template</DialogTitle>
          <DialogDescription>
            Modify the template configuration and metrics
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter template name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="template-type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXECUTIVE">Executive Summary</SelectItem>
                    <SelectItem value="PERFORMANCE">Performance Report</SelectItem>
                    <SelectItem value="ANALYTICS">Analytics Report</SelectItem>
                    <SelectItem value="CUSTOM">Custom Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this template is used for"
                rows={2}
              />
            </div>
          </div>

          {/* Formats */}
          <div>
            <Label>Export Formats</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {availableFormats.map((format) => (
                <div key={format} className="flex items-center space-x-2">
                  <Checkbox
                    id={`format-${format}`}
                    checked={selectedFormats.includes(format)}
                    onCheckedChange={() => handleFormatToggle(format)}
                  />
                  <Label htmlFor={`format-${format}`} className="text-sm">
                    {format}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div>
            <Label>Metrics to Include</Label>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {availableMetrics.map((metric) => (
                  <div key={metric} className="flex items-center space-x-2">
                    <Checkbox
                      id={`metric-${metric}`}
                      checked={selectedMetrics.includes(metric)}
                      onCheckedChange={() => handleMetricToggle(metric)}
                    />
                    <Label htmlFor={`metric-${metric}`} className="text-sm">
                      {formatMetricName(metric)}
                    </Label>
                  </div>
                ))}
              </div>
              
              {/* Selected Metrics Display */}
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedMetrics.map((metric) => (
                  <Badge
                    key={metric}
                    variant="secondary"
                    className="text-xs"
                  >
                    {formatMetricName(metric)}
                    <button
                      type="button"
                      onClick={() => handleMetricToggle(metric)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Template Settings */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="template-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="template-active">
                Active (available for use)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="template-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="template-default">
                Set as default template
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}