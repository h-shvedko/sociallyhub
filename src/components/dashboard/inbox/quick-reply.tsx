'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Reply, 
  Send, 
  StickyNote, 
  Sparkles, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Loader2
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

interface QuickReplyProps {
  message: InboxMessage
  onReply: (success: boolean) => void
}

interface ReplyTemplate {
  id: string
  name: string
  content: string
  category: string
}

export function QuickReply({ message, onReply }: QuickReplyProps) {
  const [replyContent, setReplyContent] = useState('')
  const [isPrivateNote, setIsPrivateNote] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates] = useState<ReplyTemplate[]>([
    {
      id: '1',
      name: 'Thank You',
      content: 'Thank you for your message! We appreciate your feedback.',
      category: 'positive'
    },
    {
      id: '2',
      name: 'Apologize',
      content: 'We apologize for any inconvenience. We\'re looking into this right away.',
      category: 'negative'
    },
    {
      id: '3',
      name: 'More Info',
      content: 'Could you please provide more details so we can better assist you?',
      category: 'neutral'
    },
    {
      id: '4',
      name: 'Follow Up',
      content: 'We\'ve resolved this issue. Please let us know if you need any further assistance.',
      category: 'positive'
    },
    {
      id: '5',
      name: 'Escalate',
      content: 'We\'ve escalated your concern to our team. Someone will get back to you within 24 hours.',
      category: 'neutral'
    }
  ])

  const handleSendReply = async () => {
    if (!replyContent.trim()) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/inbox/${message.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: replyContent.trim(),
          isPrivateNote
        })
      })

      if (response.ok) {
        const result = await response.json()
        setReplyContent('')
        onReply(result.success)
        
        if (result.success) {
          // Show success message based on type
          console.log(isPrivateNote ? 'Private note added' : 'Reply sent successfully')
        }
      } else {
        const error = await response.json()
        console.error('Reply failed:', error.error)
        onReply(false)
      }
    } catch (error) {
      console.error('Error sending reply:', error)
      onReply(false)
    } finally {
      setIsSending(false)
    }
  }

  const insertTemplate = (template: ReplyTemplate) => {
    setReplyContent(prev => 
      prev ? `${prev}\n\n${template.content}` : template.content
    )
    setShowTemplates(false)
  }

  const generateSmartReply = async () => {
    try {
      // This would use AI to generate a contextual reply
      // For now, we'll use a simple rule-based approach
      const sentiment = message.sentiment || 'neutral'
      let suggestedReply = ''

      switch (sentiment) {
        case 'positive':
          suggestedReply = 'Thank you so much for your kind words! We really appreciate your feedback.'
          break
        case 'negative':
          suggestedReply = 'We sincerely apologize for the issue you\'ve experienced. We\'re committed to making this right and will investigate immediately.'
          break
        default:
          suggestedReply = 'Thank you for reaching out. We\'ve received your message and will respond as soon as possible.'
      }

      setReplyContent(suggestedReply)
    } catch (error) {
      console.error('Error generating smart reply:', error)
    }
  }

  const getTemplatesByCategory = (category: string) => {
    return templates.filter(template => template.category === category)
  }

  const getReplyModeColor = () => {
    return isPrivateNote 
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            {isPrivateNote ? (
              <StickyNote className="h-5 w-5" />
            ) : (
              <Reply className="h-5 w-5" />
            )}
            {isPrivateNote ? 'Add Private Note' : 'Quick Reply'}
          </div>
          <Badge className={cn("text-xs", getReplyModeColor())}>
            {isPrivateNote ? 'Internal Note' : 'Public Reply'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reply Mode Toggle */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Reply Mode</Label>
          <Select 
            value={isPrivateNote ? 'note' : 'reply'} 
            onValueChange={(value) => setIsPrivateNote(value === 'note')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reply">
                <div className="flex items-center gap-2">
                  <Reply className="h-4 w-4" />
                  <span>Public Reply</span>
                </div>
              </SelectItem>
              <SelectItem value="note">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  <span>Internal Note</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Templates and Smart Reply */}
        {!isPrivateNote && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Quick Actions</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Templates
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateSmartReply}
                className="text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Smart Reply
              </Button>
            </div>

            {/* Template Selection */}
            {showTemplates && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <div className="text-sm font-medium">Reply Templates</div>
                <div className="space-y-1">
                  {message.sentiment && getTemplatesByCategory(message.sentiment).length > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground">
                        Suggested for {message.sentiment} sentiment:
                      </div>
                      {getTemplatesByCategory(message.sentiment).map((template) => (
                        <Button
                          key={template.id}
                          variant="ghost"
                          size="sm"
                          onClick={() => insertTemplate(template)}
                          className="w-full justify-start text-left h-auto p-2"
                        >
                          <div>
                            <div className="font-medium text-xs">{template.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {template.content}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </>
                  )}
                  
                  {templates.filter(t => t.category !== message.sentiment).length > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground mt-2">
                        Other templates:
                      </div>
                      {templates
                        .filter(t => t.category !== message.sentiment)
                        .map((template) => (
                          <Button
                            key={template.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => insertTemplate(template)}
                            className="w-full justify-start text-left h-auto p-2"
                          >
                            <div>
                              <div className="font-medium text-xs">{template.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {template.content}
                              </div>
                            </div>
                          </Button>
                        ))
                      }
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reply Content */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {isPrivateNote ? 'Note Content' : 'Reply Message'}
          </Label>
          <Textarea
            placeholder={
              isPrivateNote 
                ? 'Add an internal note about this message...'
                : 'Type your reply...'
            }
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{replyContent.length} characters</span>
            {!isPrivateNote && message.socialAccount.provider === 'TWITTER' && (
              <span className={cn(
                replyContent.length > 280 ? 'text-red-600' : 'text-muted-foreground'
              )}>
                {280 - replyContent.length} remaining
              </span>
            )}
          </div>
        </div>

        {/* Reply Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleSendReply}
            disabled={!replyContent.trim() || isSending}
            className="flex-1"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isPrivateNote ? (
              <StickyNote className="h-4 w-4 mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isSending 
              ? 'Sending...' 
              : isPrivateNote 
                ? 'Add Note' 
                : 'Send Reply'
            }
          </Button>
        </div>

        {/* Information */}
        {!isPrivateNote && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <div className="font-medium mb-1">Public Reply</div>
              <div>
                This reply will be posted publicly on {message.socialAccount.provider} 
                as @{message.socialAccount.handle} and will mark the message as closed.
              </div>
            </div>
          </div>
        )}

        {isPrivateNote && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
            <StickyNote className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <div className="font-medium mb-1">Internal Note</div>
              <div>
                This note will only be visible to your team members and will not be posted publicly.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}