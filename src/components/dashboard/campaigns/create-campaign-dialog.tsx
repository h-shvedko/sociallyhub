'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range'
import { CampaignType, CampaignFormData } from '@/types/campaign'

interface CreateCampaignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: CampaignFormData) => void
  workspaceId: string
  children?: React.ReactNode
}

export function CreateCampaignDialog({ 
  open, 
  onOpenChange, 
  onCreate, 
  workspaceId,
  children 
}: CreateCampaignDialogProps) {
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    type: CampaignType.CUSTOM,
    objectives: []
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
    setFormData({
      name: '',
      description: '',
      type: CampaignType.CUSTOM,
      objectives: []
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Campaign</DialogTitle>
          <DialogDescription>
            Set up a new marketing campaign with objectives and targeting.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter campaign name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Campaign Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: CampaignType) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CampaignType.BRAND_AWARENESS}>Brand Awareness</SelectItem>
                  <SelectItem value={CampaignType.LEAD_GENERATION}>Lead Generation</SelectItem>
                  <SelectItem value={CampaignType.ENGAGEMENT}>Engagement</SelectItem>
                  <SelectItem value={CampaignType.SALES}>Sales</SelectItem>
                  <SelectItem value={CampaignType.PRODUCT_LAUNCH}>Product Launch</SelectItem>
                  <SelectItem value={CampaignType.EVENT_PROMOTION}>Event Promotion</SelectItem>
                  <SelectItem value={CampaignType.CONTENT_SERIES}>Content Series</SelectItem>
                  <SelectItem value={CampaignType.CUSTOM}>Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your campaign goals and strategy"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Campaign Duration (Optional)</Label>
            <DatePickerWithRange
              date={formData.startDate && formData.endDate ? {
                startDate: formData.startDate,
                endDate: formData.endDate
              } : undefined}
              onDateChange={(dateRange) => setFormData(prev => ({
                ...prev,
                startDate: dateRange?.startDate,
                endDate: dateRange?.endDate
              }))}
              placeholder="Select campaign duration"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name.trim()}>
              Create Campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}