'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  MessageCircle,
  Send,
  X,
  Minimize2,
  User,
  Bot,
  Clock,
  Star,
  AlertCircle,
  CheckCircle,
  Phone,
  Mail
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useDictionary } from '@/hooks/use-dictionary'

interface SupportAgent {
  id: string
  displayName: string
  title: string
  availability: 'available' | 'busy'
  image?: string
  lastSeen: string
}

interface SupportStatus {
  isOnline: boolean
  onlineAgents: number
  availableAgents: number
  averageResponseTimeMinutes: number
  agents: SupportAgent[]
}

interface ChatMessage {
  id: string
  content: string
  senderType: 'user' | 'agent' | 'system'
  senderName: string
  messageType: string
  createdAt: string
}

interface ChatSession {
  id: string
  sessionId: string
  status: string
  assignedAgent?: {
    id: string
    displayName: string
    title: string
    isOnline: boolean
    user?: { image?: string }
  }
  messages: ChatMessage[]
}

interface LiveChatWidgetProps {
  isOpen: boolean
  onClose: () => void
  onContactForm: () => void
}

export function LiveChatWidget({ isOpen, onClose, onContactForm }: LiveChatWidgetProps) {
  const { t } = useDictionary()
  const [supportStatus, setSupportStatus] = useState<SupportStatus | null>(null)
  const [chatSession, setChatSession] = useState<ChatSession | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showRating, setShowRating] = useState(false)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)

  // Fetch support status on open
  useEffect(() => {
    if (isOpen && !supportStatus) {
      fetchSupportStatus()
    }
  }, [isOpen])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [chatSession?.messages])

  // Polling for new messages
  useEffect(() => {
    if (chatSession && chatSession.status !== 'closed') {
      startMessagePolling()
    } else {
      stopMessagePolling()
    }

    return () => stopMessagePolling()
  }, [chatSession])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const startMessagePolling = () => {
    if (pollingInterval.current) return

    pollingInterval.current = setInterval(async () => {
      if (chatSession) {
        try {
          const response = await fetch(`/api/support/chat/${chatSession.id}?sessionId=${chatSession.sessionId}`)
          if (response.ok) {
            const data = await response.json()
            setChatSession(prev => prev ? { ...prev, messages: data.messages } : null)
          }
        } catch (error) {
          console.error('Failed to poll messages:', error)
        }
      }
    }, 3000) // Poll every 3 seconds
  }

  const stopMessagePolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current)
      pollingInterval.current = null
    }
  }

  const fetchSupportStatus = async () => {
    try {
      const response = await fetch('/api/support/agents/status')
      if (response.ok) {
        const status = await response.json()
        setSupportStatus(status)
      } else {
        throw new Error('Failed to fetch support status')
      }
    } catch (error) {
      console.error('Failed to fetch support status:', error)
      setError('Unable to connect to support. Please try again.')
    }
  }

  const startChat = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: 'General Support',
          department: 'support'
        })
      })

      if (response.ok) {
        const data = await response.json()

        // Fetch the full chat session
        const chatResponse = await fetch(`/api/support/chat/${data.chatId}?sessionId=${data.sessionId}`)
        if (chatResponse.ok) {
          const chatData = await chatResponse.json()
          setChatSession(chatData)
        }
      } else {
        throw new Error('Failed to start chat')
      }
    } catch (error) {
      console.error('Failed to start chat:', error)
      setError('Failed to start chat. Please try the contact form instead.')
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatSession || messageLoading) return

    setMessageLoading(true)
    const messageContent = newMessage.trim()
    setNewMessage('')

    try {
      const response = await fetch(`/api/support/chat/${chatSession.id}/messages?sessionId=${chatSession.sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: messageContent
        })
      })

      if (response.ok) {
        // The polling will pick up the new message
        // But we can also manually refresh to be immediate
        const chatResponse = await fetch(`/api/support/chat/${chatSession.id}?sessionId=${chatSession.sessionId}`)
        if (chatResponse.ok) {
          const chatData = await chatResponse.json()
          setChatSession(chatData)
        }
      } else {
        throw new Error('Failed to send message')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setError('Failed to send message. Please try again.')
      setNewMessage(messageContent) // Restore message
    } finally {
      setMessageLoading(false)
    }
  }

  const closeChat = async () => {
    if (!chatSession) return

    try {
      await fetch(`/api/support/chat/${chatSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'close'
        })
      })

      setShowRating(true)
    } catch (error) {
      console.error('Failed to close chat:', error)
    }
  }

  const submitRating = async () => {
    if (!chatSession || !rating) return

    try {
      await fetch(`/api/support/chat/${chatSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'rate',
          rating,
          feedback: feedback.trim() || undefined
        })
      })

      setShowRating(false)
      setChatSession(null)
      onClose()
    } catch (error) {
      console.error('Failed to submit rating:', error)
    }
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getMessageIcon = (senderType: string) => {
    switch (senderType) {
      case 'agent':
        return <User className="h-4 w-4" />
      case 'system':
        return <Bot className="h-4 w-4" />
      default:
        return <MessageCircle className="h-4 w-4" />
    }
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md h-[600px] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <div>
                <DialogTitle className="text-lg">
                  {chatSession ? 'Live Support Chat' : 'Support Center'}
                </DialogTitle>
                {supportStatus && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className={`w-2 h-2 rounded-full ${supportStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                    {supportStatus.isOnline
                      ? `${supportStatus.availableAgents} agents available`
                      : 'All agents offline'
                    }
                    {supportStatus.averageResponseTimeMinutes > 0 && (
                      <span>• ~{supportStatus.averageResponseTimeMinutes} min response</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {chatSession && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMinimized(!isMinimized)}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeChat}
                  >
                    End Chat
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {!isMinimized && (
          <div className="flex-1 flex flex-col min-h-0">
            {!chatSession ? (
              // Pre-chat view
              <div className="flex-1 p-4 space-y-4">
                {supportStatus ? (
                  <>
                    {supportStatus.isOnline ? (
                      <div className="space-y-4">
                        <div className="text-center space-y-2">
                          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                          <h3 className="font-semibold">Support Available</h3>
                          <p className="text-sm text-muted-foreground">
                            {supportStatus.availableAgents} agents ready to help
                          </p>
                        </div>

                        {supportStatus.agents.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">Available Agents</h4>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {supportStatus.agents.slice(0, 3).map((agent) => (
                                <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={agent.image} />
                                    <AvatarFallback>{agent.displayName[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{agent.displayName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{agent.title}</p>
                                  </div>
                                  <Badge
                                    variant={agent.availability === 'available' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {agent.availability}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={startChat}
                          disabled={isLoading}
                          className="w-full"
                        >
                          {isLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Starting Chat...
                            </>
                          ) : (
                            <>
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Start Live Chat
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center space-y-2">
                          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
                          <h3 className="font-semibold">Support Currently Offline</h3>
                          <p className="text-sm text-muted-foreground">
                            Our support team is currently offline. We typically respond within 2-4 hours.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Button onClick={onContactForm} className="w-full">
                            <Mail className="h-4 w-4 mr-2" />
                            Send us a Message
                          </Button>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">
                              We'll get back to you as soon as possible
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                    <Skeleton className="h-4 w-3/4 mx-auto" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                )}
              </div>
            ) : (
              // Chat view
              <>
                {chatSession.assignedAgent && (
                  <div className="px-4 py-2 border-b bg-muted/30 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={chatSession.assignedAgent.user?.image} />
                        <AvatarFallback>{chatSession.assignedAgent.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{chatSession.assignedAgent.displayName}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <div className={`w-2 h-2 rounded-full ${chatSession.assignedAgent.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {chatSession.assignedAgent.title}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.senderType === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.senderType === 'system'
                            ? 'bg-muted text-muted-foreground text-center text-sm'
                            : 'bg-muted'
                        }`}
                      >
                        {message.senderType !== 'user' && message.senderType !== 'system' && (
                          <div className="flex items-center gap-2 mb-1">
                            {getMessageIcon(message.senderType)}
                            <span className="text-xs font-medium">{message.senderName}</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.senderType === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input */}
                {chatSession.status !== 'closed' && (
                  <div className="p-4 border-t flex-shrink-0">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        disabled={messageLoading}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || messageLoading}
                        size="sm"
                      >
                        {messageLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Rating Dialog */}
        {showRating && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-sm">
              <CardHeader>
                <CardTitle className="text-center">Rate Your Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      variant="ghost"
                      size="sm"
                      onClick={() => setRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    </Button>
                  ))}
                </div>
                <Textarea
                  placeholder="Share your feedback (optional)"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowRating(false)} className="flex-1">
                    Skip
                  </Button>
                  <Button onClick={submitRating} disabled={!rating} className="flex-1">
                    Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}