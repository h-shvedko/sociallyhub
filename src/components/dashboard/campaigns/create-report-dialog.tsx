'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { Campaign } from '@/types/campaign'
import { FileText, Calendar } from 'lucide-react'

interface CreateReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaigns: Campaign[]
  onCreate: (data: any) => void
  children?: React.ReactNode
}

export function CreateReportDialog({ 
  open, 
  onOpenChange, 
  campaigns,
  onCreate,
  children 
}: CreateReportDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'PERFORMANCE',
    format: 'PDF',
    frequency: 'ON_DEMAND',
    campaigns: [] as string[],
    includeSections: {
      overview: true,
      performance: true,
      demographics: false,
      content: false,
      budget: false,
      abTests: false,
      recommendations: false
    },
    recipients: '',
    description: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/campaign-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create report')
      }

      const result = await response.json()
      onCreate(result.report)

      // Reset form
      setFormData({
        name: '',
        type: 'PERFORMANCE',
        format: 'PDF',
        frequency: 'ON_DEMAND',
        campaigns: [],
        includeSections: {
          overview: true,
          performance: true,
          demographics: false,
          content: false,
          budget: false,
          abTests: false,
          recommendations: false
        },
        recipients: '',
        description: ''
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating report:', error)
      alert('Failed to create report: ' + (error as Error).message)
    }
  }

  const handleCampaignToggle = (campaignId: string) => {
    setFormData(prev => ({
      ...prev,
      campaigns: prev.campaigns.includes(campaignId)
        ? prev.campaigns.filter(id => id !== campaignId)
        : [...prev.campaigns, campaignId]
    }))
  }

  const handleSectionToggle = (section: string) => {
    setFormData(prev => ({
      ...prev,
      includeSections: {
        ...prev.includeSections,
        [section]: !prev.includeSections[section as keyof typeof prev.includeSections]
      }
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Report</DialogTitle>
          <DialogDescription>
            Generate a custom report for your campaigns
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Monthly Performance Report"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Report Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERFORMANCE">Performance Report</SelectItem>
                  <SelectItem value="EXECUTIVE">Executive Summary</SelectItem>
                  <SelectItem value="DETAILED">Detailed Analytics</SelectItem>
                  <SelectItem value="AB_TEST">A/B Test Results</SelectItem>
                  <SelectItem value="CUSTOM">Custom Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select 
                value={formData.format} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, format: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="EXCEL">Excel</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="HTML">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select 
                value={formData.frequency} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ON_DEMAND">On Demand</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Campaigns</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No campaigns available</p>
              ) : (
                campaigns.map(campaign => (
                  <div key={campaign.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={campaign.id}
                      checked={formData.campaigns.includes(campaign.id)}
                      onCheckedChange={() => handleCampaignToggle(campaign.id)}
                    />
                    <label 
                      htmlFor={campaign.id} 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {campaign.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Include Sections</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(formData.includeSections).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={() => handleSectionToggle(key)}
                  />
                  <label 
                    htmlFor={key} 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer capitalize"
                  >
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients">Email Recipients (Optional)</Label>
            <Input
              id="recipients"
              value={formData.recipients}
              onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Additional notes or requirements for this report"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || formData.campaigns.length === 0}>
              <FileText className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}