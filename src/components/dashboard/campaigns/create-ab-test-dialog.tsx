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
import { Slider } from '@/components/ui/slider'
import { Campaign } from '@/types/campaign'
import { Split } from 'lucide-react'

interface CreateABTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaigns: Campaign[]
  onCreate: (data: any) => void
  children?: React.ReactNode
}

export function CreateABTestDialog({ 
  open, 
  onOpenChange, 
  campaigns,
  onCreate,
  children 
}: CreateABTestDialogProps) {
  const [formData, setFormData] = useState({
    campaignId: '',
    testName: '',
    description: '',
    variantA: {
      name: 'Variant A',
      content: ''
    },
    variantB: {
      name: 'Variant B', 
      content: ''
    },
    splitPercentage: [50],
    metrics: ['conversions'],
    minSampleSize: 100,
    confidenceLevel: 95
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/ab-tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create A/B test')
      }

      const result = await response.json()
      onCreate(result.abTest)

      // Reset form
      setFormData({
        campaignId: '',
        testName: '',
        description: '',
        variantA: { name: 'Variant A', content: '' },
        variantB: { name: 'Variant B', content: '' },
        splitPercentage: [50],
        metrics: ['conversions'],
        minSampleSize: 100,
        confidenceLevel: 95
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating A/B test:', error)
      alert('Failed to create A/B test: ' + (error as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create A/B Test</DialogTitle>
          <DialogDescription>
            Set up an A/B test to compare different versions of your campaign
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Select 
                value={formData.campaignId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, campaignId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="testName">Test Name</Label>
              <Input
                id="testName"
                value={formData.testName}
                onChange={(e) => setFormData(prev => ({ ...prev, testName: e.target.value }))}
                placeholder="e.g., Headline Comparison"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what you're testing and why"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Variant A</Label>
              <Input
                value={formData.variantA.name}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  variantA: { ...prev.variantA, name: e.target.value }
                }))}
                placeholder="Variant name"
              />
              <Textarea
                value={formData.variantA.content}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  variantA: { ...prev.variantA, content: e.target.value }
                }))}
                placeholder="Variant content or description"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Variant B</Label>
              <Input
                value={formData.variantB.name}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  variantB: { ...prev.variantB, name: e.target.value }
                }))}
                placeholder="Variant name"
              />
              <Textarea
                value={formData.variantB.content}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  variantB: { ...prev.variantB, content: e.target.value }
                }))}
                placeholder="Variant content or description"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Traffic Split</Label>
            <div className="flex items-center gap-4">
              <span className="text-sm">A: {formData.splitPercentage[0]}%</span>
              <Slider
                value={formData.splitPercentage}
                onValueChange={(value) => setFormData(prev => ({ ...prev, splitPercentage: value }))}
                min={10}
                max={90}
                step={10}
                className="flex-1"
              />
              <span className="text-sm">B: {100 - formData.splitPercentage[0]}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Confidence Level</Label>
              <Select 
                value={formData.confidenceLevel.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, confidenceLevel: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90%</SelectItem>
                  <SelectItem value="95">95%</SelectItem>
                  <SelectItem value="99">99%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sampleSize">Min Sample Size</Label>
              <Input
                id="sampleSize"
                type="number"
                value={formData.minSampleSize}
                onChange={(e) => setFormData(prev => ({ ...prev, minSampleSize: parseInt(e.target.value) }))}
                min={50}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.campaignId || !formData.testName}>
              <Split className="h-4 w-4 mr-2" />
              Create Test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}