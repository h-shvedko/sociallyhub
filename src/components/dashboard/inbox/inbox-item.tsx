'use client'

import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  MessageSquare, 
  AtSign, 
  Mail, 
  Star, 
  MessageCircle,
  MoreVertical,
  UserCheck,
  Clock,
  CheckCircle,
  AlertCircle,
  Smile,
  Frown,
  Meh,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InboxMessage {
  id: string
  workspaceId: string
  socialAccountId: string
  type: 'COMMENT' | 'MENTION' | 'DIRECT_MESSAGE' | 'REVIEW' | 'REPLY'
  providerThreadId?: string
  providerItemId: string
  content: string
  authorName?: string
  authorHandle?: string
  authorAvatar?: string
  sentiment?: string
  status: 'OPEN' | 'ASSIGNED' | 'SNOOZED' | 'CLOSED'
  assigneeId?: string
  tags: string[]
  internalNotes?: string
  slaBreachedAt?: string
  createdAt: string
  updatedAt: string
  socialAccount: {
    id: string
    provider: string
    handle: string
    displayName: string
  }
  assignee?: {
    id: string
    name: string
    image?: string
  }
  conversation?: {
    threadData: any
  }
}

interface InboxItemProps {
  message: InboxMessage
  isSelected: boolean
  onClick: () => void
  onUpdate: (message: InboxMessage) => void
}

export function InboxItem({ message, isSelected, onClick, onUpdate }: InboxItemProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'COMMENT': return MessageSquare
      case 'MENTION': return AtSign
      case 'DIRECT_MESSAGE': return Mail
      case 'REVIEW': return Star
      case 'REPLY': return MessageCircle
      default: return MessageSquare
    }
  }

  const getPlatformIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'twitter': return Twitter
      case 'facebook': return Facebook
      case 'instagram': return Instagram
      case 'linkedin': return Linkedin
      case 'youtube': return Youtube
      default: return MessageSquare
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-100 text-red-800 border-red-200'
      case 'ASSIGNED': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'SNOOZED': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'CLOSED': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN': return AlertCircle
      case 'ASSIGNED': return UserCheck
      case 'SNOOZED': return Clock
      case 'CLOSED': return CheckCircle
      default: return MessageCircle
    }
  }

  const getSentimentIcon = (sentiment?: string) => {
    if (!sentiment) return null
    
    switch (sentiment) {
      case 'positive': return <Smile className="h-3 w-3 text-green-600" />
      case 'negative': return <Frown className="h-3 w-3 text-red-600" />
      case 'neutral': return <Meh className="h-3 w-3 text-gray-600" />
      default: return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      return `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/inbox/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      
      if (response.ok) {
        const updatedMessage = await response.json()
        onUpdate(updatedMessage)
      }
    } catch (error) {
      console.error('Error updating message status:', error)
    }
  }

  const TypeIcon = getTypeIcon(message.type)
  const PlatformIcon = getPlatformIcon(message.socialAccount.provider)
  const StatusIcon = getStatusIcon(message.status)

  return (
    <div
      className={cn(
        "p-4 hover:bg-muted/50 cursor-pointer transition-colors border-l-4",
        isSelected ? "bg-muted/50 border-l-primary" : "border-l-transparent",
        message.slaBreachedAt && "bg-red-50 border-l-red-500"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Author Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={message.authorAvatar} />
            <AvatarFallback className="text-xs">
              {message.authorName?.slice(0, 2)?.toUpperCase() || 'UN'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">
                {message.authorName || 'Unknown User'}
              </h4>
              {message.authorHandle && (
                <span className="text-xs text-muted-foreground">
                  @{message.authorHandle}
                </span>
              )}
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <TypeIcon className="h-3 w-3 text-muted-foreground" />
                <PlatformIcon className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>

            {/* Content */}
            <p className="text-sm text-foreground line-clamp-2 mb-2">
              {message.content}
            </p>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{message.socialAccount.displayName}</span>
              <span>•</span>
              <span>{formatDate(message.createdAt)}</span>
              {message.sentiment && (
                <>
                  <span>•</span>
                  {getSentimentIcon(message.sentiment)}
                </>
              )}
            </div>

            {/* Tags */}
            {message.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs py-0">
                    {tag}
                  </Badge>
                ))}
                {message.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs py-0">
                    +{message.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status Badge */}
          <Badge className={cn("text-xs", getStatusColor(message.status))}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {message.status.toLowerCase()}
          </Badge>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusUpdate('ASSIGNED')}>
                <UserCheck className="h-4 w-4 mr-2" />
                Assign to me
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusUpdate('SNOOZED')}>
                <Clock className="h-4 w-4 mr-2" />
                Snooze
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusUpdate('CLOSED')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as closed
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleStatusUpdate('OPEN')}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Reopen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Assignee */}
      {message.assignee && (
        <div className="flex items-center gap-2 mt-2 ml-13">
          <Avatar className="h-5 w-5">
            <AvatarImage src={message.assignee.image} />
            <AvatarFallback className="text-xs">
              {message.assignee.name?.slice(0, 2)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            Assigned to {message.assignee.name}
          </span>
        </div>
      )}

      {/* SLA Breach Warning */}
      {message.slaBreachedAt && (
        <div className="flex items-center gap-2 mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          <AlertCircle className="h-3 w-3" />
          SLA breached
        </div>
      )}
    </div>
  )
}