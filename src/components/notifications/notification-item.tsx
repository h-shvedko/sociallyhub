'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  Check, 
  ExternalLink, 
  Archive, 
  Trash2, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle,
  Users,
  FileText,
  BarChart3,
  Settings,
  Shield,
  MessageSquare,
  Heart,
  Share2,
  TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NotificationData, NotificationType, NotificationPriority, NotificationCategory } from '@/lib/notifications/types'
import { cn } from '@/lib/utils'

interface NotificationItemProps {
  notification: NotificationData
  onAction: (action: string) => void
  className?: string
}

export function NotificationItem({ notification, onAction, className }: NotificationItemProps) {
  const isUnread = !notification.readAt
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })

  const getNotificationIcon = () => {
    switch (notification.category) {
      case NotificationCategory.SOCIAL_MEDIA:
        switch (notification.type) {
          case NotificationType.POST_PUBLISHED:
            return <CheckCircle className="h-4 w-4 text-green-500" />
          case NotificationType.POST_FAILED:
            return <XCircle className="h-4 w-4 text-red-500" />
          case NotificationType.ENGAGEMENT_MILESTONE:
            return <TrendingUp className="h-4 w-4 text-blue-500" />
          case NotificationType.MENTION_RECEIVED:
            return <MessageSquare className="h-4 w-4 text-purple-500" />
          default:
            return <Share2 className="h-4 w-4 text-blue-500" />
        }
      case NotificationCategory.TEAM:
        return <Users className="h-4 w-4 text-green-500" />
      case NotificationCategory.CONTENT:
        return <FileText className="h-4 w-4 text-orange-500" />
      case NotificationCategory.ANALYTICS:
        return <BarChart3 className="h-4 w-4 text-purple-500" />
      case NotificationCategory.SYSTEM:
        return <Settings className="h-4 w-4 text-gray-500" />
      case NotificationCategory.SECURITY:
        return <Shield className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getPriorityColor = () => {
    switch (notification.priority) {
      case NotificationPriority.CRITICAL:
        return 'destructive'
      case NotificationPriority.HIGH:
        return 'orange'
      case NotificationPriority.MEDIUM:
        return 'blue'
      case NotificationPriority.LOW:
        return 'gray'
      default:
        return 'gray'
    }
  }

  const getPriorityBadgeVariant = () => {
    switch (notification.priority) {
      case NotificationPriority.CRITICAL:
        return 'destructive'
      case NotificationPriority.HIGH:
        return 'default'
      case NotificationPriority.MEDIUM:
        return 'secondary'
      case NotificationPriority.LOW:
        return 'outline'
      default:
        return 'outline'
    }
  }

  const handleClick = () => {
    if (isUnread) {
      onAction('mark_read')
    }
    if (notification.actionUrl) {
      onAction('open')
    }
  }

  return (
    <div
      className={cn(
        "group relative p-4 hover:bg-muted/50 transition-colors cursor-pointer",
        isUnread && "bg-blue-50/50 border-l-4 border-l-blue-500",
        className
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        {/* Avatar or Icon */}
        <div className="flex-shrink-0">
          {notification.sender?.avatar ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={notification.sender.avatar} alt={notification.sender.name} />
              <AvatarFallback>
                {notification.sender.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              {getNotificationIcon()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              "text-sm font-medium leading-tight",
              isUnread ? "text-foreground" : "text-muted-foreground"
            )}>
              {notification.title}
            </h4>

            <div className="flex items-center gap-2 flex-shrink-0">
              {notification.priority !== NotificationPriority.LOW && (
                <Badge
                  variant={getPriorityBadgeVariant()}
                  className="text-xs"
                >
                  {notification.priority}
                </Badge>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="h-1 w-1 bg-current rounded-full" />
                    <div className="h-1 w-1 bg-current rounded-full" />
                    <div className="h-1 w-1 bg-current rounded-full" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {isUnread && (
                    <DropdownMenuItem onClick={() => onAction('mark_read')}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark as read
                    </DropdownMenuItem>
                  )}
                  {notification.actionUrl && (
                    <DropdownMenuItem onClick={() => onAction('open')}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onAction('archive')}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onAction('delete')}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {notification.sender && (
                <span className="text-xs text-muted-foreground">
                  from {notification.sender.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {timeAgo}
              </span>
            </div>

            {/* Action Button */}
            {notification.actionLabel && notification.actionUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onAction('open')
                }}
              >
                {notification.actionLabel}
              </Button>
            )}
          </div>

          {/* Additional metadata for specific notification types */}
          {notification.type === NotificationType.POST_PUBLISHED && notification.metadata?.platform && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {notification.metadata.platform}
              </Badge>
              {notification.metadata.metrics && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {notification.metadata.metrics.likes || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 className="h-3 w-3" />
                    {notification.metadata.metrics.shares || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {notification.metadata.metrics.comments || 0}
                  </span>
                </div>
              )}
            </div>
          )}

          {notification.type === NotificationType.TEAM_INVITATION && notification.metadata?.role && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                Role: {notification.metadata.role}
              </Badge>
            </div>
          )}

          {notification.type === NotificationType.ENGAGEMENT_MILESTONE && notification.metadata && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground">
                {notification.metadata.metric}: {notification.metadata.value?.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Unread indicator */}
        {isUnread && (
          <div className="flex-shrink-0 self-start">
            <div className="h-2 w-2 bg-blue-500 rounded-full" />
          </div>
        )}
      </div>

      {/* Image preview for relevant notifications */}
      {notification.imageUrl && (
        <div className="mt-3 ml-11">
          <img
            src={notification.imageUrl}
            alt=""
            className="h-20 w-20 rounded-lg object-cover border"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}