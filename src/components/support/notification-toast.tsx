"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { X, MessageCircle } from 'lucide-react'

interface NotificationToastProps {
  id: string
  title: string
  message: string
  agentName?: string
  agentImage?: string
  timestamp: Date
  onDismiss: (id: string) => void
  onClick?: () => void
  duration?: number
}

export function NotificationToast({
  id,
  title,
  message,
  agentName,
  agentImage,
  timestamp,
  onDismiss,
  onClick,
  duration = 5000
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss(id), 300) // Wait for animation
  }

  const handleClick = () => {
    if (onClick) {
      onClick()
      handleDismiss()
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 w-80 transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <Card className="shadow-lg border-l-4 border-l-blue-500 bg-white">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {agentName && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={agentImage} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                  {agentName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
            )}
            {!agentName && (
              <div className="w-8 h-8 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-blue-600" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-gray-900 truncate">
                  {title}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                  onClick={handleDismiss}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                {message}
              </p>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                {onClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                    onClick={handleClick}
                  >
                    Reply
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface NotificationManagerProps {
  children: React.ReactNode
}

interface Notification {
  id: string
  title: string
  message: string
  agentName?: string
  agentImage?: string
  timestamp: Date
  onClick?: () => void
}

export function NotificationManager({ children }: NotificationManagerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    }

    setNotifications(prev => [...prev, newNotification])
  }

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  // Expose notification manager globally
  useEffect(() => {
    (window as any).showNotification = addNotification
    return () => {
      delete (window as any).showNotification
    }
  }, [])

  return (
    <>
      {children}
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          {...notification}
          onDismiss={dismissNotification}
        />
      ))}
    </>
  )
}