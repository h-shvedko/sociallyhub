'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { NotificationData, NotificationStats } from '@/lib/notifications/types'
import { notificationManager } from '@/lib/notifications/notification-manager'
import { websocketManager } from '@/lib/notifications/websocket-manager'

export interface UseNotificationsOptions {
  enableRealTime?: boolean
  pollInterval?: number
  maxNotifications?: number
  categories?: string[]
}

export interface UseNotificationsReturn {
  notifications: NotificationData[]
  unreadCount: number
  loading: boolean
  error: string | null
  stats: NotificationStats | null
  connected: boolean
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  archiveNotification: (notificationId: string) => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  refresh: () => Promise<void>
  subscribeToRealTime: () => void
  unsubscribeFromRealTime: () => void
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    enableRealTime = true,
    pollInterval = 30000, // 30 seconds
    maxNotifications = 100,
    categories = []
  } = options

  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [connected, setConnected] = useState(false)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribeWebSocket = useRef<(() => void) | null>(null)
  const unsubscribeNotifications = useRef<(() => void) | null>(null)

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success) {
        let fetchedNotifications = data.data.notifications || []
        
        // Filter by categories if specified
        if (categories.length > 0) {
          fetchedNotifications = fetchedNotifications.filter((n: NotificationData) => 
            categories.includes(n.category)
          )
        }

        // Limit notifications
        if (fetchedNotifications.length > maxNotifications) {
          fetchedNotifications = fetchedNotifications.slice(0, maxNotifications)
        }

        setNotifications(fetchedNotifications)
        setUnreadCount(data.data.stats?.unread || 0)
        setStats(data.data.stats || null)
        setError(null)
      } else {
        throw new Error(data.error || 'Failed to fetch notifications')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Failed to fetch notifications:', err)
    }
  }, [session?.user?.id, categories, maxNotifications])

  // Handle real-time notification
  const handleRealtimeNotification = useCallback((notification: NotificationData) => {
    // Filter by categories if specified
    if (categories.length > 0 && !categories.includes(notification.category)) {
      return
    }

    setNotifications(prev => {
      // Check if notification already exists
      const exists = prev.some(n => n.id === notification.id)
      if (exists) return prev

      // Add new notification at the beginning
      const updated = [notification, ...prev].slice(0, maxNotifications)
      return updated
    })

    // Update unread count
    if (!notification.readAt) {
      setUnreadCount(prev => prev + 1)
    }

    // Show browser notification if supported and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: notification.imageUrl || '/icon-192.png',
        tag: notification.id,
        data: {
          notificationId: notification.id,
          actionUrl: notification.actionUrl
        }
      })
    }
  }, [categories, maxNotifications])

  // Subscribe to real-time notifications
  const subscribeToRealTime = useCallback(() => {
    if (!session?.user?.id || !enableRealTime) return

    // Subscribe to WebSocket connection status
    unsubscribeWebSocket.current = websocketManager.onConnection((state) => {
      setConnected(state.connected)
    })

    // Subscribe to notifications
    unsubscribeNotifications.current = notificationManager.subscribe(
      session.user.id,
      handleRealtimeNotification
    )

    // Connect WebSocket if not connected
    if (!websocketManager.isConnected()) {
      websocketManager.connect(session.user.id, session.user.workspaceId)
        .catch(err => {
          console.error('Failed to connect to WebSocket:', err)
        })
    }
  }, [session?.user?.id, session?.user?.workspaceId, enableRealTime, handleRealtimeNotification])

  // Unsubscribe from real-time notifications
  const unsubscribeFromRealTime = useCallback(() => {
    if (unsubscribeWebSocket.current) {
      unsubscribeWebSocket.current()
      unsubscribeWebSocket.current = null
    }

    if (unsubscribeNotifications.current) {
      unsubscribeNotifications.current()
      unsubscribeNotifications.current = null
    }

    setConnected(false)
  }, [])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, readAt: new Date().toISOString() }
              : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        
        // Send via WebSocket if connected
        if (websocketManager.isConnected()) {
          await websocketManager.markNotificationAsRead(notificationId)
        }
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const now = new Date().toISOString()
        setNotifications(prev => 
          prev.map(n => ({ ...n, readAt: n.readAt || now }))
        )
        setUnreadCount(0)
        
        // Send via WebSocket if connected
        if (websocketManager.isConnected()) {
          await websocketManager.markAllNotificationsAsRead()
        }
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [])

  // Archive notification
  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        
        // Update unread count if the notification was unread
        const notification = notifications.find(n => n.id === notificationId)
        if (notification && !notification.readAt) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (err) {
      console.error('Failed to archive notification:', err)
    }
  }, [notifications])

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        
        // Update unread count if the notification was unread
        const notification = notifications.find(n => n.id === notificationId)
        if (notification && !notification.readAt) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }, [notifications])

  // Refresh notifications
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchNotifications()
    setLoading(false)
  }, [fetchNotifications])

  // Initial load
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications().finally(() => setLoading(false))
    }
  }, [session?.user?.id, fetchNotifications])

  // Set up polling
  useEffect(() => {
    if (!session?.user?.id) return

    if (pollInterval > 0 && !enableRealTime) {
      pollIntervalRef.current = setInterval(fetchNotifications, pollInterval)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [session?.user?.id, pollInterval, enableRealTime, fetchNotifications])

  // Set up real-time subscriptions
  useEffect(() => {
    if (session?.user?.id && enableRealTime) {
      subscribeToRealTime()
    }

    return () => {
      unsubscribeFromRealTime()
    }
  }, [session?.user?.id, enableRealTime, subscribeToRealTime, unsubscribeFromRealTime])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    error,
    stats,
    connected,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refresh,
    subscribeToRealTime,
    unsubscribeFromRealTime
  }
}