'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Calendar
} from 'lucide-react'
import { Client } from '@/types/client'

interface SendMessageDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMessageSent?: (messageData: any) => void
}

export function SendMessageDialog({ client, open, onOpenChange, onMessageSent }: SendMessageDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [messageData, setMessageData] = useState({
    type: 'email',
    subject: '',
    content: '',
    priority: 'normal',
    schedule: false,
    scheduledDate: '',
    scheduledTime: ''
  })

  const handleSend = async () => {
    if (!client) return
    
    setIsLoading(true)
    try {
      console.log('📧 Sending message to client:', client.name, messageData)
      
      // Make real API call to send message
      const response = await fetch(`/api/clients/${client.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const result = await response.json()
      console.log('✅ Message sent successfully:', result)
      
      onMessageSent?.(result)
      onOpenChange(false)
      
      // Reset form
      setMessageData({
        type: 'email',
        subject: '',
        content: '',
        priority: 'normal',
        schedule: false,
        scheduledDate: '',
        scheduledTime: ''
      })
    } catch (error) {
      console.error('❌ Error sending message:', error)
      // TODO: Show error toast to user
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to send message'}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Message to {client.name}
          </DialogTitle>
          <DialogDescription>
            Compose and send a message to your client via email or SMS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Message Type</Label>
              <Select value={messageData.type} onValueChange={(value) => setMessageData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={messageData.priority} onValueChange={(value) => setMessageData(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <Badge className="bg-gray-100 text-gray-800">Low</Badge>
                  </SelectItem>
                  <SelectItem value="normal">
                    <Badge className="bg-blue-100 text-blue-800">Normal</Badge>
                  </SelectItem>
                  <SelectItem value="high">
                    <Badge className="bg-orange-100 text-orange-800">High</Badge>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <Badge className="bg-red-100 text-red-800">Urgent</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 bg-accent rounded-md">
            <div className="flex items-center gap-2 text-sm">
              {messageData.type === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
              <span className="font-medium">Sending to:</span>
              {messageData.type === 'email' && client.email && <span>{client.email}</span>}
              {messageData.type === 'sms' && client.phone && <span>{client.phone}</span>}
              {messageData.type === 'email' && !client.email && (
                <span className="text-destructive">No email address on file</span>
              )}
              {messageData.type === 'sms' && !client.phone && (
                <span className="text-destructive">No phone number on file</span>
              )}
            </div>
          </div>

          {messageData.type === 'email' && (
            <div>
              <Label>Subject</Label>
              <Input
                placeholder="Email subject"
                value={messageData.subject}
                onChange={(e) => setMessageData(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
          )}

          <div>
            <Label>Message Content</Label>
            <Textarea
              placeholder="Write your message here..."
              value={messageData.content}
              onChange={(e) => setMessageData(prev => ({ ...prev, content: e.target.value }))}
              rows={6}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={messageData.schedule}
              onCheckedChange={(checked) => setMessageData(prev => ({ ...prev, schedule: checked }))}
            />
            <Label>Schedule for later</Label>
          </div>
          
          {messageData.schedule && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={messageData.scheduledDate}
                  onChange={(e) => setMessageData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={messageData.scheduledTime}
                  onChange={(e) => setMessageData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                />
              </div>
            </div>
          )}

          {messageData.content && (
            <div className="border rounded-md p-3 bg-muted/50">
              <Label className="text-sm font-medium">Preview:</Label>
              {messageData.subject && (
                <div className="font-medium mt-2">Subject: {messageData.subject}</div>
              )}
              <div className="whitespace-pre-wrap text-sm mt-2">{messageData.content}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={
              isLoading || 
              !messageData.content || 
              (messageData.type === 'email' && !messageData.subject) ||
              (messageData.type === 'email' && !client.email) ||
              (messageData.type === 'sms' && !client.phone)
            }
          >
            {isLoading ? 'Sending...' : messageData.schedule ? 'Schedule Message' : 'Send Message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}