'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Mail,
  Phone,
  Video,
  Calendar,
  MessageSquare,
  Send,
  Plus,
  Search,
  Filter,
  Paperclip,
  Clock,
  User,
  Star,
  Reply,
  Forward,
  Archive,
  Trash2,
  Edit,
  Eye,
  CheckCircle2
} from 'lucide-react'
import { 
  Client, 
  ClientCommunication, 
  CommunicationType, 
  CommunicationStatus,
  CommunicationPriority,
  CommunicationChannel
} from '@/types/client'

interface ClientCommunicationToolsProps {
  client: Client
  onSendMessage?: (message: any) => void
  onScheduleMeeting?: (meeting: any) => void
}

export function ClientCommunicationTools({ 
  client, 
  onSendMessage, 
  onScheduleMeeting 
}: ClientCommunicationToolsProps) {
  const [activeTab, setActiveTab] = useState('inbox')
  const [isComposing, setIsComposing] = useState(false)
  const [selectedCommunication, setSelectedCommunication] = useState<ClientCommunication | null>(null)
  const [messageContent, setMessageContent] = useState('')
  const [messageSubject, setMessageSubject] = useState('')
  const [messagePriority, setMessagePriority] = useState<CommunicationPriority>(CommunicationPriority.NORMAL)

  // Mock communications data
  const mockCommunications: ClientCommunication[] = [
    {
      id: '1',
      clientId: client.id,
      type: CommunicationType.EMAIL,
      subject: 'Monthly Report Review',
      content: 'Hi team, I wanted to discuss the monthly report and some adjustments we need to make for next month.',
      status: CommunicationStatus.READ,
      priority: CommunicationPriority.HIGH,
      channel: CommunicationChannel.EMAIL,
      senderId: 'user1',
      recipientEmails: [client.email],
      sentDate: new Date('2024-01-20T10:30:00'),
      readDate: new Date('2024-01-20T14:15:00'),
      responseDate: new Date('2024-01-20T16:45:00'),
      createdAt: new Date('2024-01-20T10:30:00'),
      updatedAt: new Date('2024-01-20T16:45:00'),
      tags: ['Report', 'Monthly Review']
    },
    {
      id: '2',
      clientId: client.id,
      type: CommunicationType.MEETING,
      subject: 'Q1 Strategy Session',
      content: 'Quarterly planning meeting to discuss goals and objectives for the first quarter.',
      status: CommunicationStatus.SENT,
      priority: CommunicationPriority.NORMAL,
      channel: CommunicationChannel.VIDEO_CALL,
      senderId: 'user2',
      recipientEmails: [client.email, 'team@client.com'],
      scheduledDate: new Date('2024-01-25T09:00:00'),
      sentDate: new Date('2024-01-18T14:00:00'),
      createdAt: new Date('2024-01-18T14:00:00'),
      updatedAt: new Date('2024-01-18T14:00:00'),
      tags: ['Strategy', 'Planning']
    },
    {
      id: '3',
      clientId: client.id,
      type: CommunicationType.PROPOSAL,
      subject: 'Additional Services Proposal',
      content: 'Proposal for additional social media management services for Instagram and TikTok.',
      status: CommunicationStatus.SENT,
      priority: CommunicationPriority.HIGH,
      channel: CommunicationChannel.EMAIL,
      senderId: 'user1',
      recipientEmails: [client.email],
      sentDate: new Date('2024-01-15T11:20:00'),
      createdAt: new Date('2024-01-15T11:20:00'),
      updatedAt: new Date('2024-01-15T11:20:00'),
      tags: ['Proposal', 'Services'],
      followUpDate: new Date('2024-01-22T11:20:00')
    }
  ]

  const getStatusColor = (status: CommunicationStatus) => {
    switch (status) {
      case CommunicationStatus.SENT:
        return 'bg-blue-100 text-blue-800'
      case CommunicationStatus.READ:
        return 'bg-green-100 text-green-800'
      case CommunicationStatus.RESPONDED:
        return 'bg-purple-100 text-purple-800'
      case CommunicationStatus.FAILED:
        return 'bg-red-100 text-red-800'
      case CommunicationStatus.DRAFT:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: CommunicationPriority) => {
    switch (priority) {
      case CommunicationPriority.URGENT:
        return 'bg-red-100 text-red-800'
      case CommunicationPriority.HIGH:
        return 'bg-orange-100 text-orange-800'
      case CommunicationPriority.NORMAL:
        return 'bg-blue-100 text-blue-800'
      case CommunicationPriority.LOW:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getChannelIcon = (channel: CommunicationChannel) => {
    switch (channel) {
      case CommunicationChannel.EMAIL:
        return <Mail className="h-4 w-4" />
      case CommunicationChannel.PHONE:
        return <Phone className="h-4 w-4" />
      case CommunicationChannel.VIDEO_CALL:
        return <Video className="h-4 w-4" />
      case CommunicationChannel.SMS:
        return <MessageSquare className="h-4 w-4" />
      default:
        return <Mail className="h-4 w-4" />
    }
  }

  const handleSendMessage = () => {
    const newMessage = {
      clientId: client.id,
      type: CommunicationType.EMAIL,
      subject: messageSubject,
      content: messageContent,
      priority: messagePriority,
      channel: CommunicationChannel.EMAIL,
      recipientEmails: [client.email]
    }
    
    onSendMessage?.(newMessage)
    setIsComposing(false)
    setMessageContent('')
    setMessageSubject('')
    setMessagePriority(CommunicationPriority.NORMAL)
  }

  const communicationTemplates = [
    {
      id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to our social media management service!',
      content: 'Thank you for choosing us for your social media needs. We\'re excited to work with you...'
    },
    {
      id: 'report',
      name: 'Monthly Report',
      subject: 'Your Monthly Social Media Report',
      content: 'Please find attached your monthly social media performance report...'
    },
    {
      id: 'checkin',
      name: 'Check-in',
      subject: 'Quick check-in on your social media goals',
      content: 'I wanted to check in and see how you\'re feeling about our progress...'
    },
    {
      id: 'proposal',
      name: 'Service Proposal',
      subject: 'Proposal for Additional Services',
      content: 'Based on our recent discussions, I\'d like to propose some additional services...'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Communication Center</h2>
          <p className="text-sm text-muted-foreground">
            Manage all communications with {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
          <Button size="sm" onClick={() => setIsComposing(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Messages List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Messages</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search messages..."
                          className="pl-10 w-48"
                        />
                      </div>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockCommunications.map((comm) => (
                      <div 
                        key={comm.id}
                        className={`p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
                          selectedCommunication?.id === comm.id ? 'border-primary bg-accent/25' : ''
                        }`}
                        onClick={() => setSelectedCommunication(comm)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(comm.channel)}
                            <h4 className="font-medium text-sm">{comm.subject}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getPriorityColor(comm.priority)} variant="outline">
                              {comm.priority.toLowerCase()}
                            </Badge>
                            <Badge className={getStatusColor(comm.status)} variant="outline">
                              {comm.status.toLowerCase()}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {comm.content}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {comm.sentDate ? comm.sentDate.toLocaleDateString() : 'Draft'}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {comm.type}
                          </div>
                          {comm.tags && comm.tags.length > 0 && (
                            <div className="flex gap-1">
                              {comm.tags.map((tag, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {comm.followUpDate && (
                          <div className="mt-2 text-xs text-orange-600">
                            Follow up due: {comm.followUpDate.toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Message Detail */}
            <div>
              {selectedCommunication ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Message Details</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedCommunication(null)}>
                        ×
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold">{selectedCommunication.subject}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getStatusColor(selectedCommunication.status)}>
                          {selectedCommunication.status.toLowerCase()}
                        </Badge>
                        <Badge className={getPriorityColor(selectedCommunication.priority)} variant="outline">
                          {selectedCommunication.priority.toLowerCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-sm">
                      <div className="space-y-2 text-muted-foreground">
                        <div>Type: {selectedCommunication.type}</div>
                        <div>Channel: {selectedCommunication.channel}</div>
                        <div>Recipients: {selectedCommunication.recipientEmails.join(', ')}</div>
                        {selectedCommunication.sentDate && (
                          <div>Sent: {selectedCommunication.sentDate.toLocaleString()}</div>
                        )}
                        {selectedCommunication.readDate && (
                          <div>Read: {selectedCommunication.readDate.toLocaleString()}</div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm whitespace-pre-wrap">{selectedCommunication.content}</p>
                    </div>

                    {selectedCommunication.tags && (
                      <div className="flex flex-wrap gap-1">
                        {selectedCommunication.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-4 border-t">
                      <Button variant="outline" size="sm">
                        <Reply className="h-3 w-3 mr-2" />
                        Reply
                      </Button>
                      <Button variant="outline" size="sm">
                        <Forward className="h-3 w-3 mr-2" />
                        Forward
                      </Button>
                      <Button variant="outline" size="sm">
                        <Archive className="h-3 w-3 mr-2" />
                        Archive
                      </Button>
                      <Button variant="outline" size="sm">
                        <Star className="h-3 w-3 mr-2" />
                        Star
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2" />
                      <p>Select a message to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compose Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting Request</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select 
                    value={messagePriority} 
                    onValueChange={(value) => setMessagePriority(value as CommunicationPriority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CommunicationPriority.LOW}>Low</SelectItem>
                      <SelectItem value={CommunicationPriority.NORMAL}>Normal</SelectItem>
                      <SelectItem value={CommunicationPriority.HIGH}>High</SelectItem>
                      <SelectItem value={CommunicationPriority.URGENT}>Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>To</Label>
                <Input value={client.email} readOnly />
              </div>

              <div>
                <Label>Subject</Label>
                <Input 
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="Enter subject..."
                />
              </div>

              <div>
                <Label>Message</Label>
                <Textarea 
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  rows={8}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach
                  </Button>
                  <Button variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsComposing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scheduled Communications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2" />
                <p>No scheduled communications</p>
                <p className="text-xs">Messages and meetings scheduled for future delivery will appear here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Message Templates</CardTitle>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {communicationTemplates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm font-medium text-muted-foreground">
                          {template.subject}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => {
                            setMessageSubject(template.subject)
                            setMessageContent(template.content)
                            setActiveTab('compose')
                          }}
                        >
                          Use Template
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}