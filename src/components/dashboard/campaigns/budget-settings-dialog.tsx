'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, DollarSign, Bell, TrendingUp } from 'lucide-react'

interface BudgetSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSave?: (settings: any) => void
}

interface BudgetSettings {
  defaultCurrency: string
  budgetAlerts: {
    enabled: boolean
    warningThreshold: number
    criticalThreshold: number
    emailNotifications: boolean
    slackNotifications: boolean
  }
  budgetLimits: {
    dailyLimit?: number
    monthlyLimit?: number
    campaignLimit?: number
    autoStop: boolean
  }
  reporting: {
    frequency: string
    recipients: string[]
    includeCostAnalysis: boolean
    includeForecast: boolean
  }
}

export function BudgetSettingsDialog({ open, onOpenChange, workspaceId, onSave }: BudgetSettingsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<BudgetSettings>({
    defaultCurrency: 'USD',
    budgetAlerts: {
      enabled: true,
      warningThreshold: 75,
      criticalThreshold: 90,
      emailNotifications: true,
      slackNotifications: false
    },
    budgetLimits: {
      autoStop: false
    },
    reporting: {
      frequency: 'weekly',
      recipients: [],
      includeCostAnalysis: true,
      includeForecast: true
    }
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/budget/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, settings })
      })

      if (response.ok) {
        onSave?.(settings)
        onOpenChange(false)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving budget settings:', error)
      alert('Failed to save budget settings')
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev }
      const keys = path.split('.')
      let obj = newSettings as any
      
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]]
      }
      
      obj[keys[keys.length - 1]] = value
      return newSettings
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Budget Settings
          </DialogTitle>
          <DialogDescription>
            Configure budget management, alerts, and reporting preferences
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="limits">Limits</TabsTrigger>
              <TabsTrigger value="reporting">Reporting</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Currency & Display</CardTitle>
                  <CardDescription>Set default currency and formatting preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Default Currency</Label>
                      <Select 
                        value={settings.defaultCurrency}
                        onValueChange={(value) => updateSettings('defaultCurrency', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Alert Settings */}
            <TabsContent value="alerts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Budget Alerts
                  </CardTitle>
                  <CardDescription>Get notified when budgets reach certain thresholds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alerts-enabled">Enable Budget Alerts</Label>
                    <Switch
                      id="alerts-enabled"
                      checked={settings.budgetAlerts.enabled}
                      onCheckedChange={(value) => updateSettings('budgetAlerts.enabled', value)}
                    />
                  </div>

                  {settings.budgetAlerts.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="warning-threshold">Warning Threshold (%)</Label>
                          <Input
                            id="warning-threshold"
                            type="number"
                            min="1"
                            max="100"
                            value={settings.budgetAlerts.warningThreshold}
                            onChange={(e) => updateSettings('budgetAlerts.warningThreshold', parseInt(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="critical-threshold">Critical Threshold (%)</Label>
                          <Input
                            id="critical-threshold"
                            type="number"
                            min="1"
                            max="100"
                            value={settings.budgetAlerts.criticalThreshold}
                            onChange={(e) => updateSettings('budgetAlerts.criticalThreshold', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="email-notifications">Email Notifications</Label>
                          <Switch
                            id="email-notifications"
                            checked={settings.budgetAlerts.emailNotifications}
                            onCheckedChange={(value) => updateSettings('budgetAlerts.emailNotifications', value)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="slack-notifications">Slack Notifications</Label>
                          <Switch
                            id="slack-notifications"
                            checked={settings.budgetAlerts.slackNotifications}
                            onCheckedChange={(value) => updateSettings('budgetAlerts.slackNotifications', value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Limits Settings */}
            <TabsContent value="limits" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Budget Limits
                  </CardTitle>
                  <CardDescription>Set spending limits and automatic controls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="daily-limit">Daily Spending Limit</Label>
                      <Input
                        id="daily-limit"
                        type="number"
                        placeholder="No limit"
                        value={settings.budgetLimits.dailyLimit || ''}
                        onChange={(e) => updateSettings('budgetLimits.dailyLimit', e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="monthly-limit">Monthly Spending Limit</Label>
                      <Input
                        id="monthly-limit"
                        type="number"
                        placeholder="No limit"
                        value={settings.budgetLimits.monthlyLimit || ''}
                        onChange={(e) => updateSettings('budgetLimits.monthlyLimit', e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="campaign-limit">Per-Campaign Limit</Label>
                    <Input
                      id="campaign-limit"
                      type="number"
                      placeholder="No limit"
                      value={settings.budgetLimits.campaignLimit || ''}
                      onChange={(e) => updateSettings('budgetLimits.campaignLimit', e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-stop">Auto-Stop Campaigns</Label>
                      <p className="text-xs text-muted-foreground">Automatically pause campaigns when budget limits are reached</p>
                    </div>
                    <Switch
                      id="auto-stop"
                      checked={settings.budgetLimits.autoStop}
                      onCheckedChange={(value) => updateSettings('budgetLimits.autoStop', value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reporting Settings */}
            <TabsContent value="reporting" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Budget Reporting
                  </CardTitle>
                  <CardDescription>Configure automated budget reports</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-frequency">Report Frequency</Label>
                    <Select 
                      value={settings.reporting.frequency}
                      onValueChange={(value) => updateSettings('reporting.frequency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cost-analysis">Include Cost Analysis</Label>
                      <Switch
                        id="cost-analysis"
                        checked={settings.reporting.includeCostAnalysis}
                        onCheckedChange={(value) => updateSettings('reporting.includeCostAnalysis', value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="forecast">Include Budget Forecast</Label>
                      <Switch
                        id="forecast"
                        checked={settings.reporting.includeForecast}
                        onCheckedChange={(value) => updateSettings('reporting.includeForecast', value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}