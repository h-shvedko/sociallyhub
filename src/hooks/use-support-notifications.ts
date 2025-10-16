"use client"

import { useState, useEffect, useRef } from 'react'

interface SupportMessage {
  id: string
  content: string
  senderType: 'user' | 'agent' | 'system'
  senderName: string
  messageType: string
  chatId: string
  createdAt: string
  readByUser: boolean
}

interface SupportChat {
  id: string
  status: string
  assignedAgent?: {
    displayName: string
    user?: {
      image?: string
    }
  }
  messages: SupportMessage[]
}

interface UseSupportNotificationsOptions {
  enabled?: boolean
  pollInterval?: number
  onNewMessage?: (message: SupportMessage, chat: SupportChat) => void
}

export function useSupportNotifications({
  enabled = true,
  pollInterval = 5000,
  onNewMessage
}: UseSupportNotificationsOptions = {}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeChats, setActiveChats] = useState<SupportChat[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const lastMessageIds = useRef<Set<string>>(new Set())
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const checkForNewMessages = async () => {
    if (!enabled) return

    try {
      setIsPolling(true)

      // Get active chats for the current user
      const response = await fetch('/api/support/chat')
      if (!response.ok) return

      const { chats } = await response.json()
      setActiveChats(chats || [])

      // Check for new messages
      const newMessages: { message: SupportMessage; chat: SupportChat }[] = []
      let totalUnread = 0

      chats?.forEach((chat: SupportChat) => {
        const unreadMessages = chat.messages.filter(
          msg => !msg.readByUser && msg.senderType !== 'user'
        )
        totalUnread += unreadMessages.length

        // Find truly new messages (not seen before)
        unreadMessages.forEach(message => {
          if (!lastMessageIds.current.has(message.id)) {
            lastMessageIds.current.add(message.id)
            newMessages.push({ message, chat })
          }
        })
      })

      setUnreadCount(totalUnread)

      // Notify about new messages
      newMessages.forEach(({ message, chat }) => {
        onNewMessage?.(message, chat)

        // Show browser notification if supported and page is not visible
        if (
          'Notification' in window &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          new Notification(`New message from ${message.senderName}`, {
            body: message.content,
            icon: '/favicon.ico',
            tag: `support-${chat.id}`
          })
        }

        // Show in-app notification
        if ((window as any).showNotification) {
          (window as any).showNotification({
            title: `${message.senderName} replied`,
            message: message.content,
            agentName: message.senderName,
            agentImage: chat.assignedAgent?.user?.image,
            onClick: () => {
              // Could open chat widget or navigate to chat
              console.log('Navigate to chat:', chat.id)
            }
          })
        }
      })
    } catch (error) {
      console.error('Failed to check for new messages:', error)
    } finally {
      setIsPolling(false)
    }
  }

  const startPolling = () => {
    if (pollIntervalRef.current) return

    // Initial check
    checkForNewMessages()

    // Set up polling
    pollIntervalRef.current = setInterval(checkForNewMessages, pollInterval)
  }

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return Notification.permission === 'granted'
  }

  const markAsRead = async (chatId: string) => {
    try {
      await fetch(`/api/support/chat/${chatId}/messages`)
      // This will mark messages as read on the server
      // Update local state
      setActiveChats(prevChats =>
        prevChats.map(chat =>
          chat.id === chatId
            ? {
                ...chat,
                messages: chat.messages.map(msg => ({
                  ...msg,
                  readByUser: true
                }))
              }
            : chat
        )
      )

      // Recalculate unread count
      const newUnreadCount = activeChats.reduce((total, chat) => {
        if (chat.id === chatId) return total
        return total + chat.messages.filter(msg => !msg.readByUser && msg.senderType !== 'user').length
      }, 0)
      setUnreadCount(newUnreadCount)
    } catch (error) {
      console.error('Failed to mark messages as read:', error)
    }
  }

  useEffect(() => {
    if (enabled) {
      startPolling()

      // Handle page visibility change
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Page is hidden, reduce polling frequency
          stopPolling()
          pollIntervalRef.current = setInterval(checkForNewMessages, pollInterval * 2)
        } else {
          // Page is visible, resume normal polling
          stopPolling()
          startPolling()
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        stopPolling()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    } else {
      stopPolling()
    }
  }, [enabled, pollInterval])

  return {
    unreadCount,
    activeChats,
    isPolling,
    startPolling,
    stopPolling,
    markAsRead,
    requestNotificationPermission
  }
}