'use client'

// In-app notifications hook (ADR-0010, Phase 1.4).
//
// Data flow (persist-first — the DB is the source of truth):
//   1. `fetch('/api/notifications')`  — the authoritative list + unread count.
//   2. `EventSource('/api/notifications/stream')` — realtime SSE nudge: a new
//      Notification row is pushed the moment a producer calls `notifyUser`.
//   3. 30s poll — the correctness fallback. It runs even while SSE is connected,
//      so a dropped/blocked stream never leaves the UI stale: every 30s the hook
//      reconciles from the DB. A missed SSE message costs latency, not data.
//
// The old socket.io `websocketManager` / in-memory `notificationManager.subscribe`
// realtime path is GONE — that transport never had a server and could not connect
// (ADR-0010). Realtime now rides the SSE route backed by Redis pub/sub.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { NotificationData, NotificationStats } from '@/lib/notifications/types'

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

/**
 * True when a notification has not been read yet. A persisted `Notification`
 * row carries a `status` enum (`UNREAD`/`READ`/`DISMISSED`); we prefer it and
 * fall back to `readAt` for any shape that omits it.
 */
function isUnread(n: { status?: string; readAt?: string | null }): boolean {
  if (n.status) return n.status === 'UNREAD'
  return !n.readAt
}

/**
 * Normalize a raw notification (from the API or an SSE message) into the shape
 * the UI reads. SSE forwards the raw Prisma `Notification` row verbatim, whose
 * caller-supplied fields (`actionUrl`, `actionLabel`, `metadata`, ...) live in
 * the `data` JSON column; surface them at the top level so `NotificationItem`
 * can render them. Top-level row fields win over anything inside `data`.
 */
function normalizeNotification(raw: unknown): NotificationData {
  const row = (raw ?? {}) as Record<string, unknown>
  const data =
    row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}
  return { ...data, ...row } as unknown as NotificationData
}

/**
 * Extract `{ list, unread, stats }` from the notifications API response. Kept
 * defensive so the hook survives the exact envelope of the DB-backed route
 * regardless of whether rows sit at `data.notifications`, `notifications`, or
 * the response root, and whether the unread count is reported or must be
 * computed from the rows.
 */
function extractPayload(json: unknown): {
  list: NotificationData[]
  unread: number
  stats: NotificationStats | null
} {
  const body = (json ?? {}) as Record<string, unknown>
  const inner =
    body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : body

  const rawList = Array.isArray(inner.notifications)
    ? inner.notifications
    : Array.isArray(body.notifications)
      ? body.notifications
      : Array.isArray(inner)
        ? (inner as unknown[])
        : []

  const list = (rawList as unknown[]).map(normalizeNotification)

  const stats = (inner.stats ?? body.stats ?? null) as NotificationStats | null
  const reported =
    stats?.unread ??
    (typeof inner.unreadCount === 'number' ? inner.unreadCount : undefined) ??
    (typeof body.unreadCount === 'number' ? body.unreadCount : undefined)
  const unread = typeof reported === 'number' ? reported : list.filter(isUnread).length

  return { list, unread, stats }
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
  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch the authoritative list + unread count from the DB-backed API.
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

      const { list, unread, stats: fetchedStats } = extractPayload(await response.json())

      let fetched = list

      // Filter by categories if specified (no-op for the default empty list).
      if (categories.length > 0) {
        fetched = fetched.filter((n) => n.category && categories.includes(n.category))
      }

      if (fetched.length > maxNotifications) {
        fetched = fetched.slice(0, maxNotifications)
      }

      setNotifications(fetched)
      setUnreadCount(unread)
      setStats(fetchedStats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Failed to fetch notifications:', err)
    }
  }, [session?.user?.id, categories, maxNotifications])

  // Handle a realtime notification pushed over SSE.
  const handleRealtimeNotification = useCallback((notification: NotificationData) => {
    // Filter by categories if specified
    if (categories.length > 0 && notification.category && !categories.includes(notification.category)) {
      return
    }

    setNotifications(prev => {
      // De-dupe: SSE may race the poll that already inserted this row.
      const exists = prev.some(n => n.id === notification.id)
      if (exists) return prev

      // Prepend the new notification, capped at maxNotifications.
      return [notification, ...prev].slice(0, maxNotifications)
    })

    // Bump the unread badge for genuinely-unread rows.
    if (isUnread(notification)) {
      setUnreadCount(prev => prev + 1)
    }

    // Native browser notification when permitted (best-effort, optional).
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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

  // Open the SSE stream. The browser's native EventSource auto-reconnects on
  // error; the 30s poll covers any gap while it is down (persist-first).
  const subscribeToRealTime = useCallback(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return
    if (!session?.user?.id || !enableRealTime) return
    if (eventSourceRef.current) return // already streaming

    const es = new EventSource('/api/notifications/stream')

    es.onopen = () => setConnected(true)

    es.onmessage = (event) => {
      try {
        handleRealtimeNotification(normalizeNotification(JSON.parse(event.data)))
      } catch (err) {
        console.error('Failed to parse SSE notification:', err)
      }
    }

    es.onerror = () => {
      // EventSource retries on its own; mark degraded so the UI (and the poll
      // fallback) know realtime is not currently live. Do NOT close here — that
      // would defeat the browser's built-in reconnect.
      setConnected(false)
    }

    eventSourceRef.current = es
  }, [session?.user?.id, enableRealTime, handleRealtimeNotification])

  const unsubscribeFromRealTime = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setConnected(false)
  }, [])

  // Mark a single notification as read.
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
              ? ({ ...n, readAt: new Date().toISOString(), status: 'READ' } as NotificationData)
              : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }, [])

  // Mark all notifications as read.
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
          prev.map(n => ({ ...n, readAt: n.readAt || now, status: 'READ' } as NotificationData))
        )
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [])

  // Archive (dismiss) a notification.
  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setNotifications(prev => {
          const target = prev.find(n => n.id === notificationId)
          if (target && isUnread(target)) {
            setUnreadCount(u => Math.max(0, u - 1))
          }
          return prev.filter(n => n.id !== notificationId)
        })
      }
    } catch (err) {
      console.error('Failed to archive notification:', err)
    }
  }, [])

  // Delete a notification (falls back to archive semantics server-side).
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setNotifications(prev => {
          const target = prev.find(n => n.id === notificationId)
          if (target && isUnread(target)) {
            setUnreadCount(u => Math.max(0, u - 1))
          }
          return prev.filter(n => n.id !== notificationId)
        })
      }
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }, [])

  // Manual refresh.
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchNotifications()
    setLoading(false)
  }, [fetchNotifications])

  // Initial load.
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications().finally(() => setLoading(false))
    }
  }, [session?.user?.id, fetchNotifications])

  // 30s poll — always on as the correctness fallback, even while SSE is live.
  useEffect(() => {
    if (!session?.user?.id || pollInterval <= 0) return

    pollIntervalRef.current = setInterval(() => {
      void fetchNotifications()
    }, pollInterval)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [session?.user?.id, pollInterval, fetchNotifications])

  // SSE realtime subscription.
  useEffect(() => {
    if (session?.user?.id && enableRealTime) {
      subscribeToRealTime()
    }

    return () => {
      unsubscribeFromRealTime()
    }
  }, [session?.user?.id, enableRealTime, subscribeToRealTime, unsubscribeFromRealTime])

  // Request native notification permission once.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
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
