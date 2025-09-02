'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Send, 
  Loader2, 
  Mail, 
  MessageSquare, 
  Phone, 
  FileText,
  Paperclip,
  Calendar
} from 'lucide-react'
import { Client } from '@/types/client'

interface SendMessageDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MessageType = 'email' | 'sms' | 'internal'
type MessagePriority = 'low' | 'normal' | 'high' | 'urgent'

export function SendMessageDialog({ client, open, onOpenChange }: SendMessageDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [messageData, setMessageData] = useState({
    type: 'email' as MessageType,
    priority: 'normal' as MessagePriority,
    subject: '',
    message: '',
    recipient: '',
    scheduleDate: '',
    scheduleTime: '',
    isScheduled: false
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setMessageData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSend = async () => {
    if (!client || !messageData.message.trim()) return

    setIsLoading(true)
    try {
      // Simulate API call for sending message
      const payload = {
        clientId: client.id,
        type: messageData.type,
        priority: messageData.priority,
        subject: messageData.subject,
        message: messageData.message,
        recipient: messageData.recipient || client.email,
        scheduled: messageData.isScheduled,
        scheduleDate: messageData.scheduleDate,
        scheduleTime: messageData.scheduleTime
      }

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      console.log('Message sent:', payload)
      
      // Reset form and close dialog
      setMessageData({
        type: 'email',
        priority: 'normal',
        subject: '',
        message: '',
        recipient: '',
        scheduleDate: '',
        scheduleTime: '',
        isScheduled: false
      })
      onOpenChange(false)
      
      // You could add toast notification here
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getMessageTypeIcon = (type: MessageType) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <Phone className="h-4 w-4" />
      case 'internal':
        return <MessageSquare className="h-4 w-4" />
      default:
        return <Mail className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: MessagePriority) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'normal':
        return 'bg-blue-100 text-blue-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'urgent':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {getMessageTypeIcon(messageData.type)}
            Send Message to {client.name}
          </DialogTitle>
          <DialogDescription>
            Compose and send a message to your client
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {/* Recipient Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={client.logo} alt={client.name} />
                  <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.company && client.company !== client.name && client.company}
                  </p>
                </div>
                <Badge className={getPriorityColor(messageData.priority)}>
                  {messageData.priority}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Message Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select 
                value={messageData.type} 
                onValueChange={(value: MessageType) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="internal">Internal Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={messageData.priority} 
                onValueChange={(value: MessagePriority) => handleInputChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label htmlFor="recipient">
              {messageData.type === 'email' ? 'Email Address' : 
               messageData.type === 'sms' ? 'Phone Number' : 'Recipient'}
            </Label>
            <Input
              id="recipient"
              value={messageData.recipient || (messageData.type === 'email' ? client.email : client.phone)}
              onChange={(e) => handleInputChange('recipient', e.target.value)}
              placeholder={
                messageData.type === 'email' ? 'client@example.com' :
                messageData.type === 'sms' ? '+1 (555) 123-4567' : 'Internal recipient'
              }
            />
          </div>

          {/* Subject (for email and internal) */}
          {(messageData.type === 'email' || messageData.type === 'internal') && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={messageData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Message subject..."
              />
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={messageData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              placeholder={
                messageData.type === 'sms' 
                  ? 'Keep your message short for SMS...' 
                  : 'Type your message here...'
              }
              rows={messageData.type === 'sms' ? 3 : 6}
              maxLength={messageData.type === 'sms' ? 160 : undefined}
            />
            {messageData.type === 'sms' && (
              <p className="text-xs text-muted-foreground">
                {messageData.message.length}/160 characters
              </p>
            )}
          </div>

          {/* Schedule Option */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="schedule"
                  checked={messageData.isScheduled}
                  onChange={(e) => handleInputChange('isScheduled', e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="schedule" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule for later
                </Label>
              </div>
              
              {messageData.isScheduled && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={messageData.scheduleDate}
                      onChange={(e) => handleInputChange('scheduleDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={messageData.scheduleTime}
                      onChange={(e) => handleInputChange('scheduleTime', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Templates */}
          <Card>
            <CardContent className="pt-4">
              <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Follow-up meeting',
                  'Project update',
                  'Invoice reminder',
                  'Thank you note',
                  'Status update'
                ].map((template) => (
                  <Button
                    key={template}
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange('subject', template)}
                  >
                    {template}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSend}
            disabled={isLoading || !messageData.message.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {messageData.isScheduled ? 'Scheduling...' : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {messageData.isScheduled ? 'Schedule' : 'Send'} Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}