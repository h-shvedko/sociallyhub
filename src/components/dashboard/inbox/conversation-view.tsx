'use client'

import React, { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { 
  MessageCircle, 
  User, 
  Calendar, 
  Tag, 
  StickyNote, 
  ExternalLink,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Clock,
  Eye,
  Reply
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

interface ConversationViewProps {
  message: InboxMessage
  onUpdate: (message: InboxMessage) => void
}

interface ThreadMessage {
  id: string
  author: {
    name: string
    handle?: string
    avatar?: string
  }
  content: string
  timestamp: string
  isOriginal?: boolean
  isReply?: boolean
}

export function ConversationView({ message, onUpdate }: ConversationViewProps) {
  const [internalNote, setInternalNote] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])

  useEffect(() => {
    // Parse conversation thread data
    if (message.conversation?.threadData) {
      try {
        const threadData = message.conversation.threadData
        const messages: ThreadMessage[] = []
        
        // Add original message
        messages.push({
          id: message.providerItemId,
          author: {
            name: message.authorName || 'Unknown User',
            handle: message.authorHandle,
            avatar: message.authorAvatar
          },
          content: message.content,
          timestamp: message.createdAt,
          isOriginal: true
        })
        
        // Add thread messages if available
        if (threadData.replies && Array.isArray(threadData.replies)) {
          threadData.replies.forEach((reply: any, index: number) => {
            messages.push({
              id: reply.id || `reply-${index}`,
              author: {
                name: reply.author?.name || 'Unknown User',
                handle: reply.author?.handle,
                avatar: reply.author?.avatar
              },
              content: reply.content || reply.text || '',
              timestamp: reply.created_at || reply.timestamp || new Date().toISOString(),
              isReply: true
            })
          })
        }
        
        setThreadMessages(messages)
      } catch (error) {
        console.error('Error parsing thread data:', error)
        // Fallback to just the original message
        setThreadMessages([{
          id: message.providerItemId,
          author: {
            name: message.authorName || 'Unknown User',
            handle: message.authorHandle,
            avatar: message.authorAvatar
          },
          content: message.content,
          timestamp: message.createdAt,
          isOriginal: true
        }])
      }
    } else {
      // No thread data, just show original message
      setThreadMessages([{
        id: message.providerItemId,
        author: {
          name: message.authorName || 'Unknown User',
          handle: message.authorHandle,
          avatar: message.authorAvatar
        },
        content: message.content,
        timestamp: message.createdAt,
        isOriginal: true
      }])
    }
  }, [message])

  const getPlatformIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'twitter': return Twitter
      case 'facebook': return Facebook
      case 'instagram': return Instagram
      case 'linkedin': return Linkedin
      case 'youtube': return Youtube
      default: return MessageCircle
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleAddNote = async () => {
    if (!internalNote.trim()) return

    try {
      const response = await fetch(`/api/inbox/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          internalNotes: message.internalNotes 
            ? `${message.internalNotes}\n---\n${internalNote.trim()}`
            : internalNote.trim()
        })
      })

      if (response.ok) {
        const updatedMessage = await response.json()
        onUpdate(updatedMessage)
        setInternalNote('')
        setIsAddingNote(false)
      }
    } catch (error) {
      console.error('Error adding note:', error)
    }
  }

  const PlatformIcon = getPlatformIcon(message.socialAccount.provider)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-5 w-5" />
          Conversation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <PlatformIcon className="h-4 w-4" />
            <span className="font-medium">{message.socialAccount.displayName}</span>
            <Badge variant="outline" className="text-xs">
              {message.type.toLowerCase().replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(message.createdAt)}</span>
          </div>

          {message.tags.length > 0 && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {message.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Conversation Thread */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Messages</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {threadMessages.map((threadMessage, index) => (
              <div key={threadMessage.id} className={cn(
                "flex gap-3 p-3 rounded-lg",
                threadMessage.isOriginal 
                  ? "bg-muted/50 border border-muted" 
                  : "bg-background border border-border"
              )}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={threadMessage.author.avatar} />
                  <AvatarFallback className="text-xs">
                    {threadMessage.author.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="text-sm font-medium">
                      {threadMessage.author.name}
                    </h5>
                    {threadMessage.author.handle && (
                      <span className="text-xs text-muted-foreground">
                        @{threadMessage.author.handle}
                      </span>
                    )}
                    {threadMessage.isOriginal && (
                      <Badge variant="outline" className="text-xs">
                        Original
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(threadMessage.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    {threadMessage.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* External Link */}
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => {
            // This would open the original post/message in a new tab
            // URL construction would depend on the platform
            window.open(`https://${message.socialAccount.provider.toLowerCase()}.com`, '_blank')
          }}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View on {message.socialAccount.provider}
        </Button>

        <Separator />

        {/* Internal Notes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Internal Notes
            </h4>
            {!isAddingNote && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsAddingNote(true)}
              >
                Add Note
              </Button>
            )}
          </div>

          {message.internalNotes && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg whitespace-pre-wrap">
              {message.internalNotes}
            </div>
          )}

          {isAddingNote && (
            <div className="space-y-2">
              <Textarea
                placeholder="Add an internal note..."
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddNote}>
                  Add Note
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setIsAddingNote(false)
                    setInternalNote('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!message.internalNotes && !isAddingNote && (
            <p className="text-xs text-muted-foreground">
              No internal notes yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}