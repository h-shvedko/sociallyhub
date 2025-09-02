'use client'

import React, { useState, useEffect } from 'react'
import { Save, Bell, Mail, Smartphone, MessageSquare, Clock, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TimePicker } from '@/components/ui/time-picker'
import { useToast } from '@/hooks/use-toast'
import { NotificationPreferences, NotificationCategory, NotificationPriority, NotificationType } from '@/lib/notifications/types'

interface NotificationPreferencesProps {
  userId: string
  workspaceId?: string
  onSave?: (preferences: NotificationPreferences) => void
}

export function NotificationPreferencesComponent({ userId, workspaceId, onSave }: NotificationPreferencesProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId,
    workspaceId,
    channels: {
      inApp: true,
      email: true,
      push: false,
      sms: false
    },
    categories: {
      [NotificationCategory.SOCIAL_MEDIA]: {
        enabled: true,
        priority: NotificationPriority.MEDIUM,
        channels: ['inApp', 'email']
      },
      [NotificationCategory.TEAM]: {
        enabled: true,
        priority: NotificationPriority.HIGH,
        channels: ['inApp', 'email', 'push']
      },
      [NotificationCategory.CONTENT]: {
        enabled: true,
        priority: NotificationPriority.MEDIUM,
        channels: ['inApp', 'email']
      },
      [NotificationCategory.ANALYTICS]: {
        enabled: true,
        priority: NotificationPriority.LOW,
        channels: ['inApp']
      },
      [NotificationCategory.SYSTEM]: {
        enabled: true,
        priority: NotificationPriority.HIGH,
        channels: ['inApp', 'email']
      },
      [NotificationCategory.SECURITY]: {
        enabled: true,
        priority: NotificationPriority.CRITICAL,
        channels: ['inApp', 'email', 'push', 'sms']
      }
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    frequency: {
      immediate: [
        NotificationType.TEAM_INVITATION,
        NotificationType.APPROVAL_REQUESTED,
        NotificationType.SECURITY_ALERT,
        NotificationType.POST_FAILED
      ],
      digest: [
        NotificationType.POST_PUBLISHED,
        NotificationType.ENGAGEMENT_MILESTONE,
        NotificationType.ANALYTICS_REPORT
      ],
      digestInterval: 'daily'
    }
  })

  // Load preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [userId, workspaceId])

  const loadPreferences = async () => {
    try {
      const response = await fetch(`/api/notifications/preferences?userId=${userId}${workspaceId ? `&workspaceId=${workspaceId}` : ''}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setPreferences(data.data)
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    setSaving(true)
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      })

      if (response.ok) {
        toast({
          title: 'Preferences saved',
          description: 'Your notification preferences have been updated.'
        })
        
        if (onSave) {
          onSave(preferences)
        }
      } else {
        throw new Error('Failed to save preferences')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save notification preferences. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const updateChannelPreference = (channel: keyof NotificationPreferences['channels'], enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [channel]: enabled
      }
    }))
  }

  const updateCategoryPreference = (
    category: NotificationCategory, 
    field: keyof NotificationPreferences['categories'][NotificationCategory], 
    value: any
  ) => {
    setPreferences(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          [field]: value
        }
      }
    }))
  }

  const updateCategoryChannels = (category: NotificationCategory, channels: string[]) => {
    setPreferences(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          channels: channels as (keyof NotificationPreferences['channels'])[]
        }
      }
    }))
  }

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        updateChannelPreference('push', true)
        toast({
          title: 'Push notifications enabled',
          description: 'You will now receive push notifications.'
        })
      }
    }
  }

  const categoryLabels = {
    [NotificationCategory.SOCIAL_MEDIA]: {
      label: 'Social Media',
      description: 'Posts, engagement, and social account activities',
      icon: '📱'
    },
    [NotificationCategory.TEAM]: {
      label: 'Team & Collaboration',
      description: 'Invitations, member activities, and team updates',
      icon: '👥'
    },
    [NotificationCategory.CONTENT]: {
      label: 'Content & Approval',
      description: 'Content approval requests and workflow updates',
      icon: '📝'
    },
    [NotificationCategory.ANALYTICS]: {
      label: 'Analytics & Reports',
      description: 'Performance reports and analytics insights',
      icon: '📊'
    },
    [NotificationCategory.SYSTEM]: {
      label: 'System Updates',
      description: 'Platform updates and feature announcements',
      icon: '⚙️'
    },
    [NotificationCategory.SECURITY]: {
      label: 'Security & Alerts',
      description: 'Security alerts and account protection',
      icon: '🔒'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notification Preferences</h2>
          <p className="text-muted-foreground">
            Customize how and when you receive notifications.
          </p>
        </div>
        <Button onClick={savePreferences} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="frequency">Frequency</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Choose how you want to receive notifications across different channels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* In-App Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-500" />
                    <Label htmlFor="in-app" className="font-medium">
                      In-App Notifications
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Show notifications while using the application
                  </p>
                </div>
                <Switch
                  id="in-app"
                  checked={preferences.channels.inApp}
                  onCheckedChange={(enabled) => updateChannelPreference('inApp', enabled)}
                />
              </div>

              <Separator />

              {/* Email Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-green-500" />
                    <Label htmlFor="email" className="font-medium">
                      Email Notifications
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email"
                  checked={preferences.channels.email}
                  onCheckedChange={(enabled) => updateChannelPreference('email', enabled)}
                />
              </div>

              <Separator />

              {/* Push Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-purple-500" />
                    <Label htmlFor="push" className="font-medium">
                      Push Notifications
                    </Label>
                    {!preferences.channels.push && 'Notification' in window && Notification.permission === 'default' && (
                      <Badge variant="outline" className="text-xs">
                        Permission required
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications to your device
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!preferences.channels.push && 'Notification' in window && Notification.permission === 'default' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={requestPushPermission}
                    >
                      Enable
                    </Button>
                  )}
                  <Switch
                    id="push"
                    checked={preferences.channels.push}
                    onCheckedChange={(enabled) => updateChannelPreference('push', enabled)}
                    disabled={'Notification' in window && Notification.permission === 'denied'}
                  />
                </div>
              </div>

              <Separator />

              {/* SMS Notifications */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-500" />
                    <Label htmlFor="sms" className="font-medium">
                      SMS Notifications
                    </Label>
                    <Badge variant="secondary" className="text-xs">
                      Critical only
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive SMS for critical notifications only
                  </p>
                </div>
                <Switch
                  id="sms"
                  checked={preferences.channels.sms}
                  onCheckedChange={(enabled) => updateChannelPreference('sms', enabled)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <div className="space-y-4">
            {Object.entries(categoryLabels).map(([category, config]) => {
              const categoryPrefs = preferences.categories[category as NotificationCategory]
              
              return (
                <Card key={category}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-3 text-lg">
                        <span className="text-lg">{config.icon}</span>
                        {config.label}
                        <Switch
                          checked={categoryPrefs.enabled}
                          onCheckedChange={(enabled) => 
                            updateCategoryPreference(category as NotificationCategory, 'enabled', enabled)
                          }
                        />
                      </CardTitle>
                    </div>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  
                  {categoryPrefs.enabled && (
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Priority</Label>
                          <Select
                            value={categoryPrefs.priority}
                            onValueChange={(value) => 
                              updateCategoryPreference(
                                category as NotificationCategory, 
                                'priority', 
                                value as NotificationPriority
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NotificationPriority.LOW}>Low</SelectItem>
                              <SelectItem value={NotificationPriority.MEDIUM}>Medium</SelectItem>
                              <SelectItem value={NotificationPriority.HIGH}>High</SelectItem>
                              <SelectItem value={NotificationPriority.CRITICAL}>Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Channels</Label>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(preferences.channels).map(([channel, enabled]) => (
                              enabled && (
                                <Badge
                                  key={channel}
                                  variant={categoryPrefs.channels.includes(channel as any) ? "default" : "outline"}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const currentChannels = categoryPrefs.channels as string[]
                                    const newChannels = currentChannels.includes(channel)
                                      ? currentChannels.filter(c => c !== channel)
                                      : [...currentChannels, channel]
                                    updateCategoryChannels(category as NotificationCategory, newChannels)
                                  }}
                                >
                                  {channel === 'inApp' ? 'In-App' : channel.charAt(0).toUpperCase() + channel.slice(1)}
                                </Badge>
                              )
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Quiet Hours
              </CardTitle>
              <CardDescription>
                Set times when you don't want to receive notifications (except critical ones).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="quiet-hours" className="font-medium">
                    Enable Quiet Hours
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notifications will be silenced during specified hours
                  </p>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={preferences.quietHours?.enabled}
                  onCheckedChange={(enabled) => 
                    setPreferences(prev => ({
                      ...prev,
                      quietHours: {
                        ...prev.quietHours!,
                        enabled
                      }
                    }))
                  }
                />
              </div>

              {preferences.quietHours?.enabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Start Time</Label>
                      <TimePicker
                        value={preferences.quietHours.start}
                        onChange={(time) => 
                          setPreferences(prev => ({
                            ...prev,
                            quietHours: {
                              ...prev.quietHours!,
                              start: time
                            }
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">End Time</Label>
                      <TimePicker
                        value={preferences.quietHours.end}
                        onChange={(time) => 
                          setPreferences(prev => ({
                            ...prev,
                            quietHours: {
                              ...prev.quietHours!,
                              end: time
                            }
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      {preferences.quietHours.enabled ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      Quiet hours: {preferences.quietHours.start} - {preferences.quietHours.end} ({preferences.quietHours.timezone})
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Frequency Tab */}
        <TabsContent value="frequency">
          <Card>
            <CardHeader>
              <CardTitle>Notification Frequency</CardTitle>
              <CardDescription>
                Choose between immediate notifications or digest summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Digest Interval</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    How often do you want to receive digest notifications?
                  </p>
                  <Select
                    value={preferences.frequency?.digestInterval}
                    onValueChange={(value: 'hourly' | 'daily' | 'weekly') => 
                      setPreferences(prev => ({
                        ...prev,
                        frequency: {
                          ...prev.frequency!,
                          digestInterval: value
                        }
                      }))
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm font-medium">Immediate Notifications</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    These notifications will always be sent immediately:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preferences.frequency?.immediate.map(type => (
                      <Badge key={type} variant="default">
                        {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Digest Notifications</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    These notifications will be grouped into digest summaries:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {preferences.frequency?.digest.map(type => (
                      <Badge key={type} variant="secondary">
                        {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}