'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, CheckCheck, Settings, Filter, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationItem } from './notification-item'
import { NotificationFilters } from './notification-filters'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationData, NotificationCategory, NotificationPriority } from '@/lib/notifications/types'
import { cn } from '@/lib/utils'

interface NotificationCenterProps {
  className?: string
  showBadge?: boolean
  maxWidth?: string
}

export function NotificationCenter({ className, showBadge = true, maxWidth = 'sm:max-w-md' }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    categories: [] as NotificationCategory[],
    priorities: [] as NotificationPriority[],
    read: 'all' as 'all' | 'unread' | 'read',
    dateRange: null as { start: Date; end: Date } | null
  })

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
    refresh
  } = useNotifications()

  // Filter notifications based on active filters
  const filteredNotifications = notifications.filter(notification => {
    // Category filter
    if (filters.categories.length > 0 && !filters.categories.includes(notification.category)) {
      return false
    }

    // Priority filter
    if (filters.priorities.length > 0 && !filters.priorities.includes(notification.priority)) {
      return false
    }

    // Read status filter
    if (filters.read === 'unread' && notification.readAt) {
      return false
    }
    if (filters.read === 'read' && !notification.readAt) {
      return false
    }

    // Date range filter
    if (filters.dateRange) {
      const notificationDate = new Date(notification.createdAt)
      if (notificationDate < filters.dateRange.start || notificationDate > filters.dateRange.end) {
        return false
      }
    }

    return true
  })

  // Group notifications by tab
  const notificationsByTab = {
    all: filteredNotifications,
    unread: filteredNotifications.filter(n => !n.readAt),
    social: filteredNotifications.filter(n => n.category === NotificationCategory.SOCIAL_MEDIA),
    team: filteredNotifications.filter(n => n.category === NotificationCategory.TEAM),
    content: filteredNotifications.filter(n => n.category === NotificationCategory.CONTENT),
    system: filteredNotifications.filter(n => n.category === NotificationCategory.SYSTEM)
  }

  const currentNotifications = notificationsByTab[activeTab as keyof typeof notificationsByTab] || []

  const handleNotificationAction = async (notification: NotificationData, action: string) => {
    switch (action) {
      case 'mark_read':
        if (!notification.readAt) {
          await markAsRead(notification.id)
        }
        break
      case 'archive':
        await archiveNotification(notification.id)
        break
      case 'delete':
        await deleteNotification(notification.id)
        break
      case 'open':
        if (notification.actionUrl) {
          window.open(notification.actionUrl, '_blank')
          if (!notification.readAt) {
            await markAsRead(notification.id)
          }
        }
        break
    }
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  const handleClearFilters = () => {
    setFilters({
      categories: [],
      priorities: [],
      read: 'all',
      dateRange: null
    })
  }

  const getTriggerIcon = () => {
    if (loading) {
      return <div className="h-5 w-5 animate-pulse bg-gray-300 rounded-full" />
    }

    return (
      <div className="relative">
        <Bell className="h-5 w-5" />
        {showBadge && unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs p-0 min-w-[20px]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          {getTriggerIcon()}
        </Button>
      </SheetTrigger>

      <SheetContent 
        side="right" 
        className={cn("w-full p-0", maxWidth)}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-lg font-semibold">
                  Notifications
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </SheetDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className="h-8 w-8"
                >
                  <Filter className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Mark all as read
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={refresh}>
                      <Archive className="mr-2 h-4 w-4" />
                      Refresh
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearFilters}>
                      Clear filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </SheetHeader>

          {/* Filters */}
          {showFilters && (
            <div className="border-b bg-muted/50 p-4">
              <NotificationFilters
                filters={filters}
                onFiltersChange={setFilters}
                notificationCounts={{
                  all: notificationsByTab.all.length,
                  unread: notificationsByTab.unread.length,
                  social: notificationsByTab.social.length,
                  team: notificationsByTab.team.length,
                  content: notificationsByTab.content.length,
                  system: notificationsByTab.system.length
                }}
              />
            </div>
          )}

          {/* Tabs */}
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
          >
            <TabsList className="grid grid-cols-6 mx-4 mt-2">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">
                Unread
                {notificationsByTab.unread.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {notificationsByTab.unread.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
              <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
              <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
              <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
            </TabsList>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value={activeTab} className="h-full mt-2">
                <ScrollArea className="h-full">
                  <div className="px-2">
                    {error && (
                      <div className="mx-4 mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <p className="text-sm text-destructive">
                          Failed to load notifications. Please try again.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refresh}
                          className="mt-2"
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    {loading && currentNotifications.length === 0 && (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">Loading notifications...</p>
                        </div>
                      </div>
                    )}

                    {!loading && currentNotifications.length === 0 && (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            No notifications
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activeTab === 'unread' ? "You're all caught up!" : `No ${activeTab} notifications found.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {currentNotifications.map((notification, index) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onAction={(action) => handleNotificationAction(notification, action)}
                        className={index !== currentNotifications.length - 1 ? "border-b" : ""}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}