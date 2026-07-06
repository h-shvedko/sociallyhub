"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { UserSettings, NotificationPreferences } from '@prisma/client'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { formatDateWithPreferences, formatTimeWithPreferences, formatDateTimeWithPreferences } from '@/lib/utils/date-time'

interface SettingsContextType {
  // Settings data
  userSettings: UserSettings | null
  notificationPreferences: NotificationPreferences | null
  
  // Loading states
  loading: boolean
  saving: boolean
  
  // Update functions
  updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>
  updateNotificationPreferences: (updates: Partial<NotificationPreferences>) => Promise<void>
  refreshSettings: () => Promise<void>
  
  // Utility functions
  formatDate: (date: Date | string) => string
  formatTime: (date: Date | string) => string
  formatDateTime: (date: Date | string) => string
  
  // Theme helpers
  applyTheme: () => void
  getThemeClasses: () => Record<string, string>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

interface SettingsProviderProps {
  children: React.ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { data: session, status } = useSession()
  const { setTheme } = useTheme()
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch user settings
  const fetchSettings = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Fetch user settings and notification preferences in parallel
      const [settingsResponse, preferencesResponse] = await Promise.all([
        fetch('/api/user/settings'),
        fetch('/api/user/notification-preferences')
      ])

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        setUserSettings(settingsData.settings)
      }

      if (preferencesResponse.ok) {
        const preferencesData = await preferencesResponse.json()
        setNotificationPreferences(preferencesData.preferences)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  // Update user settings
  const updateUserSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!session?.user?.id) return

    try {
      setSaving(true)
      
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setUserSettings(data.settings)

        // Push a theme change into next-themes immediately (the settings-change
        // effect also re-applies font-scale/compact once state updates).
        if (updates.theme) {
          setTheme(updates.theme)
        }
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating user settings:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [session?.user?.id, setTheme])

  // Update notification preferences
  const updateNotificationPreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!session?.user?.id) return

    try {
      setSaving(true)
      
      const response = await fetch('/api/user/notification-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        const data = await response.json()
        setNotificationPreferences(data.preferences)
      } else {
        throw new Error('Failed to update notification preferences')
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [session?.user?.id])

  // Refresh settings
  const refreshSettings = useCallback(async () => {
    await fetchSettings()
  }, [fetchSettings])

  // Format date with user preferences
  const formatDate = useCallback((date: Date | string) => {
    if (!userSettings) return new Date(date).toLocaleDateString()
    
    return formatDateWithPreferences(
      date,
      userSettings.dateFormat,
      userSettings.language,
      userSettings.timezone
    )
  }, [userSettings])

  // Format time with user preferences
  const formatTime = useCallback((date: Date | string) => {
    if (!userSettings) return new Date(date).toLocaleTimeString()
    
    return formatTimeWithPreferences(
      date,
      userSettings.timeFormat,
      userSettings.language,
      userSettings.timezone
    )
  }, [userSettings])

  // Format datetime with user preferences
  const formatDateTime = useCallback((date: Date | string) => {
    if (!userSettings) return new Date(date).toLocaleString()
    
    return formatDateTimeWithPreferences(
      date,
      userSettings.dateFormat,
      userSettings.timeFormat,
      userSettings.language,
      userSettings.timezone
    )
  }, [userSettings])

  // Apply theme to document.
  // Theme (light/dark/system) is delegated to next-themes via setTheme — it owns
  // the `dark` class on <html> and system-preference tracking (no-flash SSR).
  // The DB preference is authoritative: we push it into next-themes here.
  const applyTheme = useCallback(() => {
    if (typeof window === 'undefined' || !userSettings) return

    const root = document.documentElement

    // Delegate light/dark/system to next-themes
    setTheme(userSettings.theme)

    // Apply font scale
    const fontScaleMap = {
      'small': '0.9',
      'normal': '1.0',
      'large': '1.1'
    }
    const scale = fontScaleMap[userSettings.fontScale as keyof typeof fontScaleMap] || '1.0'
    root.style.setProperty('--font-scale', scale)

    // Apply compact mode
    if (userSettings.compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }

    // Apply sidebar collapsed state
    if (userSettings.sidebarCollapsed) {
      root.classList.add('sidebar-collapsed')
    } else {
      root.classList.remove('sidebar-collapsed')
    }
  }, [userSettings, setTheme])

  // Get theme classes for components
  const getThemeClasses = useCallback(() => {
    if (!userSettings) return {}

    return {
      compact: userSettings.compactMode ? 'compact' : '',
      fontScale: `font-scale-${userSettings.fontScale}`,
      colorScheme: `color-scheme-${userSettings.colorScheme}`,
      theme: userSettings.theme
    }
  }, [userSettings])

  // Initialize settings on session change
  useEffect(() => {
    if (status === 'authenticated') {
      fetchSettings()
    } else if (status === 'unauthenticated') {
      setUserSettings(null)
      setNotificationPreferences(null)
      setLoading(false)
    }
  }, [status, fetchSettings])

  // Apply theme when settings change (also syncs next-themes on settings load,
  // keeping the DB preference authoritative post-login). next-themes owns
  // system-preference tracking, so no prefers-color-scheme listener is needed here.
  useEffect(() => {
    if (userSettings) {
      applyTheme()
    }
  }, [userSettings, applyTheme])

  const value: SettingsContextType = {
    userSettings,
    notificationPreferences,
    loading,
    saving,
    updateUserSettings,
    updateNotificationPreferences,
    refreshSettings,
    formatDate,
    formatTime,
    formatDateTime,
    applyTheme,
    getThemeClasses
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}