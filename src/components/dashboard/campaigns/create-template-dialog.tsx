'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
import { Layout, Plus } from 'lucide-react'
import { CampaignType } from '@/types/campaign'

interface CreateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: any) => void
  children?: React.ReactNode
}

const platformOptions = [
  { value: 'TWITTER', label: 'Twitter' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'TIKTOK', label: 'TikTok' },
]

export function CreateTemplateDialog({ 
  open, 
  onOpenChange, 
  onCreate,
  children 
}: CreateTemplateDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: CampaignType.CUSTOM,
    platforms: [] as string[],
    objectives: [] as any[],
    content: {
      text: '',
      hashtags: [] as string[],
      variables: [] as any[]
    },
    scheduling: {
      frequency: 'CUSTOM',
      times: [] as string[],
      timezone: 'UTC'
    },
    isReusable: true
  })

  const [currentObjective, setCurrentObjective] = useState('')
  const [currentHashtag, setCurrentHashtag] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onCreate(formData)
    // Reset form
    setFormData({
      name: '',
      description: '',
      category: CampaignType.CUSTOM,
      platforms: [],
      objectives: [],
      content: {
        text: '',
        hashtags: [],
        variables: []
      },
      scheduling: {
        frequency: 'CUSTOM',
        times: [],
        timezone: 'UTC'
      },
      isReusable: true
    })
    onOpenChange(false)
  }

  const handlePlatformToggle = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }))
  }

  const addObjective = () => {
    if (currentObjective.trim()) {
      setFormData(prev => ({
        ...prev,
        objectives: [...prev.objectives, currentObjective.trim()]
      }))
      setCurrentObjective('')
    }
  }

  const addHashtag = () => {
    if (currentHashtag.trim()) {
      const hashtag = currentHashtag.trim().startsWith('#') 
        ? currentHashtag.trim() 
        : `#${currentHashtag.trim()}`
      setFormData(prev => ({
        ...prev,
        content: {
          ...prev.content,
          hashtags: [...prev.content.hashtags, hashtag]
        }
      }))
      setCurrentHashtag('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Campaign Template</DialogTitle>
          <DialogDescription>
            Create a reusable template for your campaigns
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Product Launch Template"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this template is for"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Campaign Category</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value: CampaignType) => setFormData(prev => ({ ...prev, category: value }))}
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

          <div className="space-y-2">
            <Label>Target Platforms</Label>
            <div className="grid grid-cols-3 gap-2">
              {platformOptions.map(platform => (
                <div key={platform.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={platform.value}
                    checked={formData.platforms.includes(platform.value)}
                    onCheckedChange={() => handlePlatformToggle(platform.value)}
                  />
                  <label 
                    htmlFor={platform.value} 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {platform.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Campaign Objectives</Label>
            <div className="flex gap-2">
              <Input
                value={currentObjective}
                onChange={(e) => setCurrentObjective(e.target.value)}
                placeholder="e.g., Increase brand awareness by 25%"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
              />
              <Button type="button" onClick={addObjective} size="sm">
                Add
              </Button>
            </div>
            {formData.objectives.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.objectives.map((obj, index) => (
                  <Badge key={index} variant="secondary">
                    {obj}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        objectives: prev.objectives.filter((_, i) => i !== index)
                      }))}
                      className="ml-2 text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content Template</Label>
            <Textarea
              id="content"
              value={formData.content.text}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                content: { ...prev.content, text: e.target.value }
              }))}
              placeholder="Write your template content here. Use {{variable_name}} for dynamic content."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Hashtags</Label>
            <div className="flex gap-2">
              <Input
                value={currentHashtag}
                onChange={(e) => setCurrentHashtag(e.target.value)}
                placeholder="e.g., marketing"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
              />
              <Button type="button" onClick={addHashtag} size="sm">
                Add
              </Button>
            </div>
            {formData.content.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.content.hashtags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        content: {
                          ...prev.content,
                          hashtags: prev.content.hashtags.filter((_, i) => i !== index)
                        }
                      }))}
                      className="ml-2 text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="reusable"
              checked={formData.isReusable}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                isReusable: checked as boolean 
              }))}
            />
            <label 
              htmlFor="reusable" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Make this template reusable across campaigns
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name || formData.platforms.length === 0}>
              <Layout className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}