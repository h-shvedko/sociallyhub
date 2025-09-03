'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AccountSetupData,
  ProfileSetup,
  WorkspaceSetup,
  UserPreferences,
  NotificationSettings,
  CompanySize,
  ThemePreference,
  DashboardLayout,
  DefaultView,
  NotificationFrequency
} from '@/types/onboarding'
import {
  User,
  Building2,
  Settings,
  Bell,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Upload,
  Globe,
  Palette,
  Layout,
  Eye,
  Mail,
  Smartphone,
  MessageSquare,
  Phone
} from 'lucide-react'

interface AccountSetupWizardProps {
  initialData?: Partial<AccountSetupData>
  onComplete?: (data: AccountSetupData) => void
  onCancel?: () => void
}

export function AccountSetupWizard({
  initialData,
  onComplete,
  onCancel
}: AccountSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [setupData, setSetupData] = useState<AccountSetupData>({
    profile: {
      firstName: '',
      lastName: '',
      email: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...initialData?.profile
    },
    workspace: {
      name: '',
      industry: '',
      size: CompanySize.SOLO,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: 'USD',
      ...initialData?.workspace
    },
    preferences: {
      language: 'en',
      dateFormat: 'MM/dd/yyyy',
      timeFormat: '12h',
      theme: ThemePreference.SYSTEM,
      dashboardLayout: DashboardLayout.COMFORTABLE,
      defaultView: DefaultView.DASHBOARD,
      ...initialData?.preferences
    },
    notifications: {
      email: {
        enabled: true,
        marketing: false,
        updates: true,
        reports: true,
        mentions: true,
        frequency: NotificationFrequency.DAILY
      },
      push: {
        enabled: true,
        posts: true,
        mentions: true,
        analytics: false,
        team: true
      },
      inApp: {
        enabled: true,
        sound: true,
        desktop: true,
        mobile: true
      },
      ...initialData?.notifications
    }
  })

  const steps = [
    { id: 'profile', title: 'Profile Setup', icon: User, description: 'Personal information and contact details' },
    { id: 'workspace', title: 'Workspace Setup', icon: Building2, description: 'Company and workspace configuration' },
    { id: 'preferences', title: 'Preferences', icon: Settings, description: 'Interface and display settings' },
    { id: 'notifications', title: 'Notifications', icon: Bell, description: 'Communication preferences' }
  ]

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete?.(setupData)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const updateProfileData = (field: keyof ProfileSetup, value: string) => {
    setSetupData(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value
      }
    }))
  }

  const updateWorkspaceData = (field: keyof WorkspaceSetup, value: string | CompanySize) => {
    setSetupData(prev => ({
      ...prev,
      workspace: {
        ...prev.workspace,
        [field]: value
      }
    }))
  }

  const updatePreferencesData = (field: keyof UserPreferences, value: string | ThemePreference | DashboardLayout | DefaultView) => {
    setSetupData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value
      }
    }))
  }

  const updateNotificationData = (category: keyof NotificationSettings, field: string, value: boolean | NotificationFrequency) => {
    setSetupData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [category]: {
          ...prev.notifications[category],
          [field]: value
        }
      }
    }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Profile Setup
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Profile Setup</h2>
              <p className="text-muted-foreground">Let's start with your personal information</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={setupData.profile.firstName}
                  onChange={(e) => updateProfileData('firstName', e.target.value)}
                  placeholder="Enter your first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={setupData.profile.lastName}
                  onChange={(e) => updateProfileData('lastName', e.target.value)}
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={setupData.profile.email}
                onChange={(e) => updateProfileData('email', e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={setupData.profile.phone || ''}
                  onChange={(e) => updateProfileData('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone *</Label>
                <Select value={setupData.profile.timezone} onValueChange={(value) => updateProfileData('timezone', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London">GMT</SelectItem>
                    <SelectItem value="Europe/Berlin">CET</SelectItem>
                    <SelectItem value="Asia/Tokyo">JST</SelectItem>
                    <SelectItem value="Asia/Shanghai">CST</SelectItem>
                    <SelectItem value="Australia/Sydney">AEST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={setupData.profile.bio || ''}
                onChange={(e) => updateProfileData('bio', e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={setupData.profile.website || ''}
                  onChange={(e) => updateProfileData('website', e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn Profile</Label>
                <Input
                  id="linkedin"
                  value={setupData.profile.linkedinProfile || ''}
                  onChange={(e) => updateProfileData('linkedinProfile', e.target.value)}
                  placeholder="linkedin.com/in/yourprofile"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Profile Picture</Label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                  {setupData.profile.avatar ? (
                    <img src={setupData.profile.avatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
              </div>
            </div>
          </div>
        )

      case 1: // Workspace Setup
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Workspace Setup</h2>
              <p className="text-muted-foreground">Configure your workspace and company details</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace Name *</Label>
              <Input
                id="workspaceName"
                value={setupData.workspace.name}
                onChange={(e) => updateWorkspaceData('name', e.target.value)}
                placeholder="Your Company Name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={setupData.workspace.description || ''}
                onChange={(e) => updateWorkspaceData('description', e.target.value)}
                placeholder="Brief description of your company or workspace..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Select value={setupData.workspace.industry} onValueChange={(value) => updateWorkspaceData('industry', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="marketing">Marketing & Advertising</SelectItem>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="nonprofit">Non-profit</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="hospitality">Hospitality</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company Size *</Label>
                <Select value={setupData.workspace.size} onValueChange={(value: CompanySize) => updateWorkspaceData('size', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CompanySize.SOLO}>Solo (Just me)</SelectItem>
                    <SelectItem value={CompanySize.SMALL}>Small (2-10 people)</SelectItem>
                    <SelectItem value={CompanySize.MEDIUM}>Medium (11-50 people)</SelectItem>
                    <SelectItem value={CompanySize.LARGE}>Large (51-200 people)</SelectItem>
                    <SelectItem value={CompanySize.ENTERPRISE}>Enterprise (200+ people)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workspaceWebsite">Website</Label>
                <Input
                  id="workspaceWebsite"
                  type="url"
                  value={setupData.workspace.website || ''}
                  onChange={(e) => updateWorkspaceData('website', e.target.value)}
                  placeholder="https://company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={setupData.workspace.currency} onValueChange={(value) => updateWorkspaceData('currency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD (C$)</SelectItem>
                    <SelectItem value="AUD">AUD (A$)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center">
                <Palette className="h-5 w-5 mr-2" />
                Branding (Optional)
              </h3>
              
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    {setupData.workspace.logo ? (
                      <img src={setupData.workspace.logo} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={setupData.workspace.branding?.primaryColor || '#3b82f6'}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={setupData.workspace.branding?.primaryColor || '#3b82f6'}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={setupData.workspace.branding?.secondaryColor || '#6366f1'}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={setupData.workspace.branding?.secondaryColor || '#6366f1'}
                      placeholder="#6366f1"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 2: // Preferences
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Preferences</h2>
              <p className="text-muted-foreground">Customize your interface and display settings</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Globe className="h-5 w-5 mr-2" />
                  Localization
                </h3>
                
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={setupData.preferences.language} onValueChange={(value) => updatePreferencesData('language', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="it">Italiano</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select value={setupData.preferences.dateFormat} onValueChange={(value) => updatePreferencesData('dateFormat', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/dd/yyyy">MM/DD/YYYY (US)</SelectItem>
                      <SelectItem value="dd/MM/yyyy">DD/MM/YYYY (EU)</SelectItem>
                      <SelectItem value="yyyy-MM-dd">YYYY-MM-DD (ISO)</SelectItem>
                      <SelectItem value="dd MMM yyyy">DD MMM YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Time Format</Label>
                  <Select value={setupData.preferences.timeFormat} onValueChange={(value) => updatePreferencesData('timeFormat', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12 Hour (AM/PM)</SelectItem>
                      <SelectItem value="24h">24 Hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Appearance
                </h3>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={setupData.preferences.theme} onValueChange={(value: ThemePreference) => updatePreferencesData('theme', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ThemePreference.LIGHT}>Light</SelectItem>
                      <SelectItem value={ThemePreference.DARK}>Dark</SelectItem>
                      <SelectItem value={ThemePreference.SYSTEM}>System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dashboard Layout</Label>
                  <Select value={setupData.preferences.dashboardLayout} onValueChange={(value: DashboardLayout) => updatePreferencesData('dashboardLayout', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DashboardLayout.COMPACT}>Compact</SelectItem>
                      <SelectItem value={DashboardLayout.COMFORTABLE}>Comfortable</SelectItem>
                      <SelectItem value={DashboardLayout.SPACIOUS}>Spacious</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default View</Label>
                  <Select value={setupData.preferences.defaultView} onValueChange={(value: DefaultView) => updatePreferencesData('defaultView', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DefaultView.DASHBOARD}>Dashboard</SelectItem>
                      <SelectItem value={DefaultView.CONTENT}>Content</SelectItem>
                      <SelectItem value={DefaultView.CALENDAR}>Calendar</SelectItem>
                      <SelectItem value={DefaultView.ANALYTICS}>Analytics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )

      case 3: // Notifications
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Notification Preferences</h2>
              <p className="text-muted-foreground">Choose how you want to be notified</p>
            </div>

            <div className="space-y-6">
              {/* Email Notifications */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Mail className="h-5 w-5 mr-2" />
                    Email Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                    </div>
                    <Switch
                      checked={setupData.notifications.email.enabled}
                      onCheckedChange={(checked) => updateNotificationData('email', 'enabled', checked)}
                    />
                  </div>

                  {setupData.notifications.email.enabled && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {[
                          { key: 'updates', label: 'Product Updates', description: 'New features and improvements' },
                          { key: 'reports', label: 'Reports', description: 'Weekly and monthly performance reports' },
                          { key: 'mentions', label: 'Mentions', description: 'When you are mentioned in posts or comments' },
                          { key: 'marketing', label: 'Marketing', description: 'Tips, tutorials, and promotional content' }
                        ].map(({ key, label, description }) => (
                          <div key={key} className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>{label}</Label>
                              <p className="text-sm text-muted-foreground">{description}</p>
                            </div>
                            <Switch
                              checked={setupData.notifications.email[key as keyof typeof setupData.notifications.email] as boolean}
                              onCheckedChange={(checked) => updateNotificationData('email', key, checked)}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label>Email Frequency</Label>
                        <Select
                          value={setupData.notifications.email.frequency}
                          onValueChange={(value: NotificationFrequency) => updateNotificationData('email', 'frequency', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NotificationFrequency.IMMEDIATE}>Immediate</SelectItem>
                            <SelectItem value={NotificationFrequency.HOURLY}>Hourly</SelectItem>
                            <SelectItem value={NotificationFrequency.DAILY}>Daily</SelectItem>
                            <SelectItem value={NotificationFrequency.WEEKLY}>Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Push Notifications */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <Smartphone className="h-5 w-5 mr-2" />
                    Push Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Browser and mobile push notifications</p>
                    </div>
                    <Switch
                      checked={setupData.notifications.push.enabled}
                      onCheckedChange={(checked) => updateNotificationData('push', 'enabled', checked)}
                    />
                  </div>

                  {setupData.notifications.push.enabled && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {[
                          { key: 'posts', label: 'Posts', description: 'When posts are published or scheduled' },
                          { key: 'mentions', label: 'Mentions', description: 'When you are mentioned' },
                          { key: 'analytics', label: 'Analytics', description: 'Performance reports and insights' },
                          { key: 'team', label: 'Team', description: 'Team member activities and updates' }
                        ].map(({ key, label, description }) => (
                          <div key={key} className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>{label}</Label>
                              <p className="text-sm text-muted-foreground">{description}</p>
                            </div>
                            <Switch
                              checked={setupData.notifications.push[key as keyof typeof setupData.notifications.push] as boolean}
                              onCheckedChange={(checked) => updateNotificationData('push', key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* In-App Notifications */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    In-App Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable In-App Notifications</Label>
                      <p className="text-sm text-muted-foreground">Show notifications within the application</p>
                    </div>
                    <Switch
                      checked={setupData.notifications.inApp.enabled}
                      onCheckedChange={(checked) => updateNotificationData('inApp', 'enabled', checked)}
                    />
                  </div>

                  {setupData.notifications.inApp.enabled && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        {[
                          { key: 'sound', label: 'Sound', description: 'Play notification sounds' },
                          { key: 'desktop', label: 'Desktop', description: 'Show on desktop browsers' },
                          { key: 'mobile', label: 'Mobile', description: 'Show on mobile devices' }
                        ].map(({ key, label, description }) => (
                          <div key={key} className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>{label}</Label>
                              <p className="text-sm text-muted-foreground">{description}</p>
                            </div>
                            <Switch
                              checked={setupData.notifications.inApp[key as keyof typeof setupData.notifications.inApp] as boolean}
                              onCheckedChange={(checked) => updateNotificationData('inApp', key, checked)}
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 0: // Profile
        return setupData.profile.firstName && setupData.profile.lastName && setupData.profile.email && setupData.profile.timezone
      case 1: // Workspace
        return setupData.workspace.name && setupData.workspace.industry
      case 2: // Preferences
        return true
      case 3: // Notifications
        return true
      default:
        return false
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Account Setup
          </h1>
          <p className="text-muted-foreground">Let's get your account configured perfectly</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                    ${isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                      isActive ? 'bg-blue-500 border-blue-500 text-white' : 
                      'bg-white border-gray-300 text-gray-400'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`
                      h-0.5 w-16 mx-2 transition-colors
                      ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                    `} />
                  )}
                </div>
              )
            })}
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between mt-2">
            <Badge variant="outline">{steps[currentStep].title}</Badge>
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <Card className="bg-white/70 backdrop-blur-md border-0 shadow-xl mb-8">
          <CardContent className="p-8 md:p-12">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="bg-white/50 backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <Button variant="ghost" onClick={onCancel}>
            Cancel Setup
          </Button>

          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {currentStep === steps.length - 1 ? (
              <>
                Complete Setup
                <CheckCircle className="h-4 w-4 ml-1" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}