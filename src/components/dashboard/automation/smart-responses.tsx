'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  MessageCircle,
  Bot,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Send,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface SmartResponse {
  id: string
  sourceType: string
  sourcePlatform: string
  originalMessage: string
  suggestedResponse: string
  responseType: string
  tone: string
  sentiment: number
  intent: string
  category: string
  urgency: string
  confidenceScore: number
  status: string
  createdAt: string
}

interface SmartResponsesProps {
  workspaceId: string
}

export function SmartResponses({ workspaceId }: SmartResponsesProps) {
  const [responses, setResponses] = useState<SmartResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterUrgency, setFilterUrgency] = useState('all')
  const [selectedResponse, setSelectedResponse] = useState<SmartResponse | null>(null)
  const [showResponseDialog, setShowResponseDialog] = useState(false)

  useEffect(() => {
    fetchSmartResponses()
  }, [workspaceId])

  const fetchSmartResponses = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/automation/smart-responses?workspaceId=${workspaceId}`)
      const data = await response.json()
      // Ensure data is an array
      setResponses(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching smart responses:', error)
      setResponses([])
    } finally {
      setLoading(false)
    }
  }

  const handleResponseAction = async (responseId: string, action: string, feedback?: string) => {
    try {
      await fetch(`/api/automation/smart-responses/${responseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback })
      })
      
      setResponses(responses => 
        responses.map(response => 
          response.id === responseId 
            ? { ...response, status: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : response.status }
            : response
        )
      )
    } catch (error) {
      console.error('Error updating response:', error)
    }
  }

  const filteredResponses = Array.isArray(responses) ? responses.filter(response => {
    const matchesSearch = response.originalMessage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         response.suggestedResponse?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || response.status?.toLowerCase() === filterStatus
    const matchesUrgency = filterUrgency === 'all' || response.urgency?.toLowerCase() === filterUrgency
    
    return matchesSearch && matchesStatus && matchesUrgency
  }) : []

  const getUrgencyColor = (urgency: string) => {
    switch (urgency.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSentimentEmoji = (sentiment: number) => {
    if (sentiment > 0.5) return '😊'
    if (sentiment < -0.5) return '😞'
    return '😐'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded mb-4"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Smart Responses
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredResponses.length} responses • {filteredResponses.filter(r => r.status === 'PENDING').length} pending review
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search responses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterUrgency} onValueChange={setFilterUrgency}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Response List */}
      <div className="space-y-4">
        {filteredResponses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No smart responses found</h3>
              <p className="text-gray-600">
                {searchTerm || filterStatus !== 'all' || filterUrgency !== 'all' 
                  ? "Try adjusting your filters"
                  : "Smart responses will appear here when detected"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredResponses.map(response => (
            <Card key={response.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{response.sourcePlatform}</Badge>
                        <Badge className={getUrgencyColor(response.urgency)}>
                          {response.urgency}
                        </Badge>
                        <Badge className={getStatusColor(response.status)}>
                          {response.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {response.category} • {response.intent} • {getSentimentEmoji(response.sentiment)} {(response.sentiment * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500">
                      Confidence: {(response.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                
                {/* Original Message */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Original Message:</h4>
                  <p className="text-sm">{response.originalMessage}</p>
                </div>
                
                {/* Suggested Response */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">Suggested Response ({response.tone}):</h4>
                  <p className="text-sm text-blue-800">{response.suggestedResponse}</p>
                </div>
                
                {/* Actions */}
                {response.status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      className="flex items-center gap-1"
                      onClick={() => handleResponseAction(response.id, 'approve')}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      Approve & Send
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedResponse(response)
                        setShowResponseDialog(true)
                      }}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResponseAction(response.id, 'reject')}
                    >
                      <ThumbsDown className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
                
                {response.status === 'SENT' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Response sent successfully
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Smart Response</DialogTitle>
          </DialogHeader>
          
          {selectedResponse && (
            <div className="space-y-4">
              <div>
                <Label>Original Message</Label>
                <div className="p-3 bg-gray-50 rounded text-sm mt-1">
                  {selectedResponse.originalMessage}
                </div>
              </div>
              
              <div>
                <Label htmlFor="response">Suggested Response</Label>
                <Textarea 
                  id="response"
                  defaultValue={selectedResponse.suggestedResponse}
                  rows={4}
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Response Tone</Label>
                  <Select defaultValue={selectedResponse.tone}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FRIENDLY">Friendly</SelectItem>
                      <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                      <SelectItem value="CASUAL">Casual</SelectItem>
                      <SelectItem value="EMPATHETIC">Empathetic</SelectItem>
                      <SelectItem value="FORMAL">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Response Type</Label>
                  <Select defaultValue={selectedResponse.responseType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANSWER">Answer</SelectItem>
                      <SelectItem value="ACKNOWLEDGE">Acknowledge</SelectItem>
                      <SelectItem value="ESCALATE">Escalate</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowResponseDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  handleResponseAction(selectedResponse.id, 'approve')
                  setShowResponseDialog(false)
                }}>
                  <Send className="w-4 h-4 mr-1" />
                  Update & Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}