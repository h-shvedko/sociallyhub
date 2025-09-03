'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Globe,
  Mail,
  Phone,
  Building
} from 'lucide-react'
import { Client } from '@/types/client'

interface ClientSettingsDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsSaved?: (settingsData: any) => void
}

export function ClientSettingsDialog({ client, open, onOpenChange, onSettingsSaved }: ClientSettingsDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [settingsData, setSettingsData] = useState({
    // Profile Settings
    status: client?.status || 'ACTIVE',
    industry: client?.industry || '',
    timezone: 'UTC',
    language: 'en',
    
    // Communication Preferences
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: true,
    weeklyReports: true,
    monthlyReports: true,
    
    // Account Settings
    autoRenewal: true,
    dataRetention: '24',
    exportFormat: 'pdf',
    
    // Access Settings
    portalAccess: true,
    reportingAccess: true,
    campaignAccess: false,
    
    // Custom Settings
    customFields: [],
    notes: client?.notes || ''
  })

  const handleSave = async () => {
    if (!client) return
    
    setIsLoading(true)
    try {
      console.log('⚙️ Configuring settings for client:', client.name, settingsData)
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      onSettingsSaved?.(settingsData)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettingsData(prev => ({ ...prev, [field]: value }))
  }

  const addCustomField = () => {
    setSettingsData(prev => ({
      ...prev,
      customFields: [...prev.customFields, { key: '', value: '' }]
    }))
  }

  const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
    setSettingsData(prev => ({
      ...prev,
      customFields: prev.customFields.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const removeCustomField = (index: number) => {
    setSettingsData(prev => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index)
    }))
  }

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Settings for {client.name}
          </DialogTitle>
          <DialogDescription>
            Manage client-specific settings, preferences, and access controls.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Client Status</Label>
                    <Select value={settingsData.status} onValueChange={(value) => handleInputChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </SelectItem>
                        <SelectItem value="PROSPECT">
                          <Badge className="bg-blue-100 text-blue-800">Prospect</Badge>
                        </SelectItem>
                        <SelectItem value="ON_HOLD">
                          <Badge className="bg-yellow-100 text-yellow-800">On Hold</Badge>
                        </SelectItem>
                        <SelectItem value="CHURNED">
                          <Badge className="bg-red-100 text-red-800">Churned</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Industry</Label>
                    <Select value={settingsData.industry} onValueChange={(value) => handleInputChange('industry', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Retail">Retail</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Timezone</Label>
                    <Select value={settingsData.timezone} onValueChange={(value) => handleInputChange('timezone', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Language</Label>
                    <Select value={settingsData.language} onValueChange={(value) => handleInputChange('language', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="it">Italian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Communication Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label>Email Notifications</Label>
                  </div>
                  <Switch
                    checked={settingsData.emailNotifications}
                    onCheckedChange={(checked) => handleInputChange('emailNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Label>SMS Notifications</Label>
                  </div>
                  <Switch
                    checked={settingsData.smsNotifications}
                    onCheckedChange={(checked) => handleInputChange('smsNotifications', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Marketing Emails</Label>
                  <Switch
                    checked={settingsData.marketingEmails}
                    onCheckedChange={(checked) => handleInputChange('marketingEmails', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Weekly Reports</Label>
                  <Switch
                    checked={settingsData.weeklyReports}
                    onCheckedChange={(checked) => handleInputChange('weeklyReports', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Monthly Reports</Label>
                  <Switch
                    checked={settingsData.monthlyReports}
                    onCheckedChange={(checked) => handleInputChange('monthlyReports', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Auto-Renewal</Label>
                  <Switch
                    checked={settingsData.autoRenewal}
                    onCheckedChange={(checked) => handleInputChange('autoRenewal', checked)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data Retention (Months)</Label>
                    <Select value={settingsData.dataRetention} onValueChange={(value) => handleInputChange('dataRetention', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 Months</SelectItem>
                        <SelectItem value="24">24 Months</SelectItem>
                        <SelectItem value="36">36 Months</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Default Export Format</Label>
                    <Select value={settingsData.exportFormat} onValueChange={(value) => handleInputChange('exportFormat', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Access Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Client Portal Access</Label>
                    <p className="text-sm text-muted-foreground">Allow client to access the client portal</p>
                  </div>
                  <Switch
                    checked={settingsData.portalAccess}
                    onCheckedChange={(checked) => handleInputChange('portalAccess', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Reporting Access</Label>
                    <p className="text-sm text-muted-foreground">Allow client to view and download reports</p>
                  </div>
                  <Switch
                    checked={settingsData.reportingAccess}
                    onCheckedChange={(checked) => handleInputChange('reportingAccess', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Campaign Management</Label>
                    <p className="text-sm text-muted-foreground">Allow client to create and manage campaigns</p>
                  </div>
                  <Switch
                    checked={settingsData.campaignAccess}
                    onCheckedChange={(checked) => handleInputChange('campaignAccess', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Custom Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsData.customFields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Field name"
                      value={field.key}
                      onChange={(e) => updateCustomField(index, 'key', e.target.value)}
                    />
                    <Input
                      placeholder="Field value"
                      value={field.value}
                      onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomField(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addCustomField}>
                  Add Custom Field
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add any additional notes or settings specific to this client..."
                  value={settingsData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}