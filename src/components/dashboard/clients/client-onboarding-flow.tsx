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
  Globe,
  UserPlus,
  Shield,
  Key,
  Users,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Link,
  BookOpen,
  Video,
  Download,
  Play,
  CheckSquare,
  GraduationCap
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
  
  // State for Account Setup
  const [teamMembers, setTeamMembers] = useState([
    { id: '1', name: '', email: '', role: 'VIEWER', status: 'pending' }
  ])
  
  // State for Social Media Integration
  const [socialAccounts, setSocialAccounts] = useState([
    { platform: 'FACEBOOK', connected: false, accountName: '', accountId: '' },
    { platform: 'TWITTER', connected: false, accountName: '', accountId: '' },
    { platform: 'INSTAGRAM', connected: false, accountName: '', accountId: '' },
    { platform: 'LINKEDIN', connected: false, accountName: '', accountId: '' },
    { platform: 'YOUTUBE', connected: false, accountName: '', accountId: '' }
  ])
  
  // State for Training & Documentation
  const [trainingProgress, setTrainingProgress] = useState([
    { id: '1', title: 'Platform Overview', completed: false, type: 'video', duration: '15 min' },
    { id: '2', title: 'Creating Your First Post', completed: false, type: 'video', duration: '20 min' },
    { id: '3', title: 'Understanding Analytics', completed: false, type: 'document', duration: '10 min' },
    { id: '4', title: 'Team Collaboration', completed: false, type: 'video', duration: '25 min' },
    { id: '5', title: 'Best Practices Guide', completed: false, type: 'document', duration: '15 min' }
  ])
  const [kickoffScheduled, setKickoffScheduled] = useState(false)
  const [kickoffDate, setKickoffDate] = useState('')
  const [kickoffTime, setKickoffTime] = useState('')

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

  const handleStepComplete = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]))
    if (currentStep < (template?.steps.length || 0) - 1) {
      setCurrentStep(currentStep + 1)
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

  const addTeamMember = () => {
    setTeamMembers([...teamMembers, {
      id: Date.now().toString(),
      name: '',
      email: '',
      role: 'VIEWER',
      status: 'pending'
    }])
  }

  const removeTeamMember = (id: string) => {
    setTeamMembers(teamMembers.filter(member => member.id !== id))
  }

  const updateTeamMember = (id: string, field: string, value: string) => {
    setTeamMembers(teamMembers.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    ))
  }

  const toggleSocialAccount = (platform: string) => {
    setSocialAccounts(accounts => accounts.map(account =>
      account.platform === platform ? { ...account, connected: !account.connected } : account
    ))
  }

  const updateSocialAccount = (platform: string, field: string, value: string) => {
    setSocialAccounts(accounts => accounts.map(account =>
      account.platform === platform ? { ...account, [field]: value } : account
    ))
  }

  const toggleTrainingItem = (id: string) => {
    setTrainingProgress(items => items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ))
  }

  const renderAccountSetup = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Account Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Members Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Team Members</Label>
            <Button variant="outline" size="sm" onClick={addTeamMember}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
          
          <div className="space-y-3">
            {teamMembers.map((member, index) => (
              <div key={member.id} className="grid grid-cols-12 gap-3 items-end p-4 border rounded-lg">
                <div className="col-span-3">
                  <Label>Name</Label>
                  <Input
                    placeholder="Full Name"
                    value={member.name}
                    onChange={(e) => updateTeamMember(member.id, 'name', e.target.value)}
                  />
                </div>
                <div className="col-span-4">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@company.com"
                    value={member.email}
                    onChange={(e) => updateTeamMember(member.id, 'email', e.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <Label>Role</Label>
                  <Select value={member.role} onValueChange={(value) => updateTeamMember(member.id, 'role', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="PUBLISHER">Publisher</SelectItem>
                      <SelectItem value="ANALYST">Analyst</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeTeamMember(member.id)}
                    disabled={teamMembers.length === 1}
                    className="w-full"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions Overview */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Role Permissions</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Shield className="h-4 w-4 text-red-500" />
                <div>
                  <p className="font-medium">Owner</p>
                  <p className="text-sm text-muted-foreground">Full access to all features</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Key className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="font-medium">Admin</p>
                  <p className="text-sm text-muted-foreground">Manage users and settings</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="font-medium">Publisher</p>
                  <p className="text-sm text-muted-foreground">Create and publish content</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div>
                  <p className="font-medium">Analyst</p>
                  <p className="text-sm text-muted-foreground">View analytics and reports</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <AlertCircle className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="font-medium">Viewer</p>
                  <p className="text-sm text-muted-foreground">Read-only access</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Security Settings</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Two-Factor Authentication</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select 2FA method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email verification</SelectItem>
                  <SelectItem value="sms">SMS verification</SelectItem>
                  <SelectItem value="app">Authenticator app</SelectItem>
                  <SelectItem value="none">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Password Policy</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (8+ chars)</SelectItem>
                  <SelectItem value="strong">Strong (12+ chars, mixed)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (16+ chars, special)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderSocialMediaIntegration = () => {
    const getPlatformIcon = (platform: string) => {
      switch (platform) {
        case 'FACEBOOK': return <Facebook className="h-5 w-5 text-blue-600" />
        case 'TWITTER': return <Twitter className="h-5 w-5 text-sky-500" />
        case 'INSTAGRAM': return <Instagram className="h-5 w-5 text-pink-600" />
        case 'LINKEDIN': return <Linkedin className="h-5 w-5 text-blue-700" />
        case 'YOUTUBE': return <Youtube className="h-5 w-5 text-red-600" />
        default: return <Link className="h-5 w-5" />
      }
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Social Media Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform Connections */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Connect Social Media Accounts</Label>
            <div className="space-y-3">
              {socialAccounts.map((account) => (
                <div key={account.platform} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getPlatformIcon(account.platform)}
                    <div>
                      <p className="font-medium">{account.platform}</p>
                      {account.connected && account.accountName && (
                        <p className="text-sm text-muted-foreground">@{account.accountName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.connected ? (
                      <>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Connected
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleSocialAccount(account.platform)}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSocialAccount(account.platform)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account Configuration */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Account Configuration</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Default Posting Time</Label>
                <Input type="time" />
              </div>
              <div>
                <Label>Time Zone</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utc">UTC</SelectItem>
                    <SelectItem value="est">Eastern Time</SelectItem>
                    <SelectItem value="pst">Pacific Time</SelectItem>
                    <SelectItem value="cst">Central Time</SelectItem>
                    <SelectItem value="mst">Mountain Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Publishing Settings */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Publishing Settings</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Auto-publish approved posts</p>
                  <p className="text-sm text-muted-foreground">Automatically publish posts when approved</p>
                </div>
                <Button variant="outline" size="sm">Enable</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Cross-platform posting</p>
                  <p className="text-sm text-muted-foreground">Post to multiple platforms simultaneously</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Content adaptation</p>
                  <p className="text-sm text-muted-foreground">Automatically adapt content for each platform</p>
                </div>
                <Button variant="outline" size="sm">Setup</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderTrainingDocumentation = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Training & Documentation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Training Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Training Materials</Label>
            <Badge variant="outline">
              {trainingProgress.filter(item => item.completed).length} of {trainingProgress.length} complete
            </Badge>
          </div>
          <div className="space-y-3">
            {trainingProgress.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTrainingItem(item.id)}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                      item.completed 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-muted-foreground hover:border-green-500'
                    }`}
                  >
                    {item.completed && <CheckSquare className="h-3 w-3" />}
                  </button>
                  <div className="flex items-center gap-2">
                    {item.type === 'video' ? (
                      <Video className="h-4 w-4 text-blue-500" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-green-500" />
                    )}
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.duration}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4 mr-1" />
                    {item.type === 'video' ? 'Watch' : 'Read'}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kickoff Meeting */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Kickoff Meeting</Label>
          {!kickoffScheduled ? (
            <div className="p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-2">Schedule Your Kickoff Meeting</p>
              <p className="text-sm text-muted-foreground mb-4">
                Let's schedule a 60-minute session to get you started with the platform
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-md mx-auto">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={kickoffDate}
                    onChange={(e) => setKickoffDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={kickoffTime}
                    onChange={(e) => setKickoffTime(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                className="mt-4"
                onClick={() => setKickoffScheduled(true)}
                disabled={!kickoffDate || !kickoffTime}
              >
                Schedule Meeting
              </Button>
            </div>
          ) : (
            <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">Kickoff Meeting Scheduled</p>
              </div>
              <p className="text-sm text-green-600">
                {new Date(kickoffDate).toLocaleDateString()} at {kickoffTime}
              </p>
              <p className="text-sm text-green-600 mt-1">
                You'll receive a calendar invitation and meeting link via email.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setKickoffScheduled(false)}>
                Reschedule
              </Button>
            </div>
          )}
        </div>

        {/* Additional Resources */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Additional Resources</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                <p className="font-medium">Knowledge Base</p>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Comprehensive guides and tutorials
              </p>
              <Button variant="outline" size="sm">
                Browse Articles
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-5 w-5 text-green-500" />
                <p className="font-medium">Video Library</p>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Step-by-step video tutorials
              </p>
              <Button variant="outline" size="sm">
                Watch Videos
              </Button>
            </div>
          </div>
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
        return renderAccountSetup()
      case 5:
        return renderSocialMediaIntegration()
      case 6:
        return renderTrainingDocumentation()
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
            <Button onClick={handleStepComplete}>
              {currentStep === template.steps.length - 1 ? 'Complete Onboarding' : 'Next Step'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}