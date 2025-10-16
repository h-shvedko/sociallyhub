"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Clock, CheckCircle } from 'lucide-react'

interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
  department: string
  priority: string
}

interface ContactFormSubmissionResult {
  id: string
  ticketNumber: string
  status: string
  assignedAgent?: {
    displayName: string
    title: string
  }
  estimatedResponseTime: string
  message: string
}

interface ContactFormFallbackProps {
  onClose: () => void
  onSubmitSuccess?: (result: ContactFormSubmissionResult) => void
}

export function ContactFormFallback({ onClose, onSubmitSuccess }: ContactFormFallbackProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    department: 'support',
    priority: 'medium'
  })

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<ContactFormSubmissionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
  }

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Name is required')
      return false
    }
    if (!formData.email.trim()) {
      setError('Email is required')
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address')
      return false
    }
    if (!formData.subject.trim()) {
      setError('Subject is required')
      return false
    }
    if (!formData.message.trim()) {
      setError('Message is required')
      return false
    }
    return true
  }

  const submitForm = async () => {
    if (!validateForm()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit contact form')
      }

      setResult(data)
      setSubmitted(true)
      onSubmitSuccess?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit contact form')
    } finally {
      setLoading(false)
    }
  }

  if (submitted && result) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-green-700">Message Sent Successfully!</CardTitle>
          <CardDescription>
            We've received your message and will respond soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Ticket Number:</span>
              <span className="text-blue-600 font-mono">{result.ticketNumber}</span>
            </div>

            {result.assignedAgent && (
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Assigned Agent:</span>
                <span className="text-gray-900">
                  {result.assignedAgent.displayName} - {result.assignedAgent.title}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Response Time:</span>
              <span className="text-green-600 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {result.estimatedResponseTime}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Status:</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                {result.status}
              </span>
            </div>
          </div>

          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              You'll receive a confirmation email at <strong>{formData.email}</strong> with your ticket details.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Contact Support
        </CardTitle>
        <CardDescription>
          Live chat is currently unavailable. Send us a message and we'll get back to you as soon as possible.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Your full name"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            placeholder="Brief description of your issue"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => handleInputChange('department', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="support">General Support</SelectItem>
                <SelectItem value="technical">Technical Support</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => handleInputChange('priority', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message *</Label>
          <Textarea
            id="message"
            value={formData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            placeholder="Please describe your issue in detail..."
            rows={5}
            disabled={loading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={submitForm}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Message'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}