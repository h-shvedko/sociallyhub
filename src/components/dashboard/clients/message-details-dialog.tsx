'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  User,
  Phone,
  Copy,
  ExternalLink
} from 'lucide-react'

interface MessageDetailsDialogProps {
  message: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MessageDetailsDialog({ message, open, onOpenChange }: MessageDetailsDialogProps) {
  if (!message) return null

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CLOSED':
        return 'bg-green-100 text-green-800'
      case 'OPEN':
        return 'bg-blue-100 text-blue-800'
      case 'SNOOZED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CLOSED':
        return <CheckCircle2 className="h-4 w-4" />
      case 'OPEN':
        return <Clock className="h-4 w-4" />
      case 'SNOOZED':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'normal':
        return 'bg-blue-100 text-blue-800'
      case 'low':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add a toast notification here
      console.log('📋 Copied to clipboard:', text)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const MessageIcon = message.type === 'EMAIL' ? Mail : MessageSquare

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageIcon className="h-5 w-5" />
            Message Details
          </DialogTitle>
          <DialogDescription>
            Complete details and content of the sent message
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-6">
          {/* Message Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageIcon className="h-5 w-5" />
                  {message.subject || 'No Subject'}
                </span>
                <div className="flex items-center gap-2">
                  <Badge className={getPriorityColor(message.priority)}>
                    {(message.priority || 'normal').toUpperCase()}
                  </Badge>
                  <Badge className={getStatusColor(message.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(message.status)}
                      {message.status || 'UNKNOWN'}
                    </div>
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Sent Date</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(message.createdAt || message.date)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <MessageIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Message Type</p>
                    <p className="text-sm text-muted-foreground">
                      {message.type === 'EMAIL' ? 'Email Message' : 'SMS Message'}
                    </p>
                  </div>
                </div>

                {message.scheduledAt && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Scheduled For</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(message.scheduledAt)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Message ID</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground font-mono">
                        {message.id}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(message.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message Content */}
          <Card>
            <CardHeader>
              <CardTitle>Message Content</CardTitle>
            </CardHeader>
            <CardContent>
              {message.subject && message.type === 'EMAIL' && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Subject Line</span>
                  </div>
                  <div className="bg-accent p-3 rounded-md">
                    <p className="font-medium">{message.subject}</p>
                  </div>
                </div>
              )}
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Message Body</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(message.content || '')}
                    className="h-6 px-2 text-xs"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="whitespace-pre-wrap text-sm font-normal leading-relaxed">
                    {message.content || 'No content available'}
                  </pre>
                </div>
              </div>

              {message.type === 'SMS' && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>Character count: {(message.content || '').length}/160</span>
                  {(message.content || '').length > 160 && (
                    <Badge variant="destructive" className="text-xs">
                      Exceeds SMS limit
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Delivery Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(message.status)}
                    <span className="text-sm">
                      {message.status === 'CLOSED' ? 'Successfully Delivered' :
                       message.status === 'OPEN' ? 'Pending/Failed - Available for Retry' :
                       message.status === 'SNOOZED' ? 'Scheduled for Later' :
                       'Unknown Status'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Priority Level</p>
                  <Badge className={getPriorityColor(message.priority)}>
                    {(message.priority || 'normal').toUpperCase()}
                  </Badge>
                </div>
              </div>

              {message.type === 'EMAIL' && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <div className="flex items-start gap-3">
                    <ExternalLink className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Email Testing</p>
                      <p className="text-sm text-blue-700 mb-2">
                        This email was delivered to the development mail server for testing.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('http://localhost:8025', '_blank')}
                        className="text-blue-700 border-blue-200 hover:bg-blue-100"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View in Mailhog
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => copyToClipboard(JSON.stringify(message, null, 2))}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Message Data
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}