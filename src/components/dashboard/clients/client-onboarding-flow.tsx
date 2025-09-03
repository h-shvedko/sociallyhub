'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  User,
  Building,
  CreditCard,
  Palette,
  Settings,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Globe
} from 'lucide-react'
import { 
  Client, 
  OnboardingStep, 
  OnboardingStepStatus, 
  OnboardingTemplate,
  ServiceLevel,
  BillingCycle,
  PaymentMethod
} from '@/types/client'

interface ClientOnboardingFlowProps {
  clientId?: string
  templateId?: string
  onComplete?: (client: Client) => void
}

export function ClientOnboardingFlow({ 
  clientId, 
  templateId, 
  onComplete 
}: ClientOnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [clientData, setClientData] = useState<Partial<Client>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null)

  // Mock onboarding template
  const mockTemplate: OnboardingTemplate = {
    id: '1',
    name: 'Standard Client Onboarding',
    description: 'Complete onboarding process for new clients',
    industry: 'general',
    serviceLevel: ServiceLevel.STANDARD,
    estimatedDuration: 14,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [
      {
        id: '1',
        title: 'Basic Information',
        description: 'Collect client basic details and contact information',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 0,
        required: true
      },
      {
        id: '2',
        title: 'Service Configuration',
        description: 'Set up service level and contract details',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 1,
        required: true
      },
      {
        id: '3',
        title: 'Billing Setup',
        description: 'Configure billing information and payment methods',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 2,
        required: true
      },
      {
        id: '4',
        title: 'Brand Guidelines',
        description: 'Upload brand assets and define visual identity',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 3,
        required: false
      },
      {
        id: '5',
        title: 'Account Setup',
        description: 'Create user accounts and set permissions',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 4,
        required: true
      },
      {
        id: '6',
        title: 'Social Media Integration',
        description: 'Connect social media accounts',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 5,
        required: true
      },
      {
        id: '7',
        title: 'Training & Documentation',
        description: 'Provide training materials and schedule kickoff',
        status: OnboardingStepStatus.NOT_STARTED,
        order: 6,
        required: false
      }
    ]
  }

  useEffect(() => {
    setTemplate(mockTemplate)
  }, [templateId])

  const getStepIcon = (status: OnboardingStepStatus, stepIndex: number) => {
    if (completedSteps.has(stepIndex)) {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    }
    if (currentStep === stepIndex) {
      return <Clock className="h-5 w-5 text-blue-600" />
    }
    return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
  }

  const getStepStatus = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) return 'completed'
    if (currentStep === stepIndex) return 'current'
    return 'upcoming'
  }

  const handleStepComplete = async () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]))
    
    // If this is the last step, save the client to database
    if (currentStep === (template?.steps.length || 0) - 1) {
      await handleCompleteOnboarding()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleCompleteOnboarding = async () => {
    if (!clientData.name || !clientData.email) {
      alert('Please fill in required fields: Name and Email')
      return
    }

    try {
      setIsLoading(true)
      
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workspaceId: 'placeholder', // Will be resolved by API
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
          company: clientData.company,
          industry: clientData.industry,
          website: clientData.website,
          notes: clientData.notes,
          tags: clientData.labels || []
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create client')
      }

      const savedClient = await response.json()
      
      if (onComplete) {
        onComplete(savedClient)
      }

      alert('Client onboarding completed successfully!')
    } catch (error) {
      console.error('Error completing onboarding:', error)
      alert('Failed to complete onboarding. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const calculateProgress = () => {
    const totalSteps = template?.steps.length || 0
    const completed = completedSteps.size
    return totalSteps > 0 ? (completed / totalSteps) * 100 : 0
  }

  const renderBasicInformation = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Basic Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="clientName">Client Name *</Label>
            <Input 
              id="clientName"
              placeholder="Enter client name"
              value={clientData.name || ''}
              onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input 
              id="company"
              placeholder="Enter company name"
              value={clientData.company || ''}
              onChange={(e) => setClientData({ ...clientData, company: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input 
              id="email"
              type="email"
              placeholder="Enter email address"
              value={clientData.email || ''}
              onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone"
              placeholder="Enter phone number"
              value={clientData.phone || ''}
              onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Select 
              value={clientData.industry || ''} 
              onValueChange={(value) => setClientData({ ...clientData, industry: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input 
              id="website"
              placeholder="https://example.com"
              value={clientData.website || ''}
              onChange={(e) => setClientData({ ...clientData, website: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea 
            id="notes"
            placeholder="Any additional information about the client..."
            value={clientData.notes || ''}
            onChange={(e) => setClientData({ ...clientData, notes: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  )

  const renderServiceConfiguration = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Service Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Service Level *</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select service level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic - $299/month</SelectItem>
                <SelectItem value="standard">Standard - $599/month</SelectItem>
                <SelectItem value="premium">Premium - $999/month</SelectItem>
                <SelectItem value="enterprise">Enterprise - Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contract Duration</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual (10% discount)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" />
          </div>
          <div>
            <Label>Assigned Account Manager</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="john">John Smith</SelectItem>
                <SelectItem value="sarah">Sarah Johnson</SelectItem>
                <SelectItem value="mike">Mike Davis</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Service Includes</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Social Media Accounts</span>
              <Badge variant="outline">5 accounts</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Monthly Posts</span>
              <Badge variant="outline">30 posts</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Team Members</span>
              <Badge variant="outline">3 users</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Analytics Reports</span>
              <Badge variant="outline">Weekly</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderBillingSetup = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Billing Email</Label>
            <Input type="email" placeholder="billing@company.com" />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Billing Cycle</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Terms</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Net 15</SelectItem>
                <SelectItem value="30">Net 30</SelectItem>
                <SelectItem value="45">Net 45</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Billing Address</Label>
          <div className="grid grid-cols-1 gap-3">
            <Input placeholder="Street Address" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="City" />
              <Input placeholder="State/Province" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="ZIP/Postal Code" />
              <Input placeholder="Country" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderBrandGuidelines = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Brand Guidelines
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Primary Color</Label>
            <div className="flex gap-2">
              <Input type="color" className="w-16" />
              <Input placeholder="#000000" />
            </div>
          </div>
          <div>
            <Label>Secondary Color</Label>
            <div className="flex gap-2">
              <Input type="color" className="w-16" />
              <Input placeholder="#000000" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Logo Upload</Label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop your logo here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                SVG, PNG, JPG up to 10MB
              </p>
            </div>
          </div>
        </div>

        <div>
          <Label>Brand Guidelines Document</Label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload brand guidelines document
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOC up to 50MB
              </p>
            </div>
          </div>
        </div>

        <div>
          <Label>Voice & Tone</Label>
          <Textarea 
            placeholder="Describe your brand's voice and tone..."
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBasicInformation()
      case 1:
        return renderServiceConfiguration()
      case 2:
        return renderBillingSetup()
      case 3:
        return renderBrandGuidelines()
      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Account Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Create user accounts and set up team permissions...
              </p>
            </CardContent>
          </Card>
        )
      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Social Media Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Connect social media accounts and configure settings...
              </p>
            </CardContent>
          </Card>
        )
      case 6:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Training & Documentation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Provide training materials and schedule kickoff meeting...
              </p>
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  if (!template) {
    return <div>Loading onboarding template...</div>
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Client Onboarding</h2>
                <p className="text-sm text-muted-foreground">
                  {template.name} • Estimated completion: {template.estimatedDuration} days
                </p>
              </div>
              <Badge variant="outline">
                Step {currentStep + 1} of {template.steps.length}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(calculateProgress())}% complete</span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {template.steps.map((step, index) => (
              <div 
                key={step.id} 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  getStepStatus(index) === 'current' 
                    ? 'border-blue-500 bg-blue-50' 
                    : getStepStatus(index) === 'completed'
                    ? 'border-green-500 bg-green-50'
                    : 'border-border hover:bg-accent'
                }`}
                onClick={() => setCurrentStep(index)}
              >
                {getStepIcon(step.status, index)}
                <div className="flex-1">
                  <h4 className="font-medium">{step.title}</h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {step.required && (
                  <Badge variant="secondary" className="text-xs">Required</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div className="space-y-4">
        {renderStepContent()}
        
        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={currentStep >= template.steps.length - 1}
            >
              Skip
            </Button>
            <Button onClick={handleStepComplete} disabled={isLoading}>
              {isLoading && currentStep === template.steps.length - 1 
                ? 'Saving...' 
                : currentStep === template.steps.length - 1 
                  ? 'Complete Onboarding' 
                  : 'Next Step'
              }
              {!isLoading && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}