'use client'

import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Ticket,
  User,
  Mail,
  Phone,
  FileText,
  Upload,
  X,
  AlertCircle,
  Check,
  Loader2,
  Tag,
  Building
} from 'lucide-react'

interface CreateTicketDialogProps {
  isOpen: boolean
  onClose: () => void
  onTicketCreated?: (ticket: any) => void
  workspaceId?: string
}

interface AttachmentFile {
  id: string
  file: File
  preview?: string
}

const TICKET_CATEGORIES = [
  { value: 'GENERAL', label: 'General Support', description: 'General questions and support' },
  { value: 'TECHNICAL', label: 'Technical Issue', description: 'Technical problems and bugs' },
  { value: 'BILLING', label: 'Billing & Payments', description: 'Payment and subscription issues' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request', description: 'Request new features' },
  { value: 'BUG_REPORT', label: 'Bug Report', description: 'Report software bugs' },
  { value: 'ACCOUNT', label: 'Account Issues', description: 'Account access and settings' },
  { value: 'INTEGRATION', label: 'Integrations', description: 'Third-party integration help' },
  { value: 'API', label: 'API Support', description: 'API documentation and help' },
  { value: 'SECURITY', label: 'Security', description: 'Security concerns and issues' },
  { value: 'PERFORMANCE', label: 'Performance', description: 'Performance and optimization' }
]

const PRIORITY_LEVELS = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-700', description: 'Non-urgent, can wait 3+ days' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700', description: 'Standard priority, 1-2 days' },
  { value: 'HIGH', label: 'High', color: 'bg-yellow-100 text-yellow-700', description: 'Important, within 12 hours' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-orange-100 text-orange-700', description: 'Very important, within 4 hours' },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-red-100 text-red-700', description: 'System down, within 1 hour' }
]

const TICKET_TYPES = [
  { value: 'SUPPORT', label: 'Support Request' },
  { value: 'TECHNICAL', label: 'Technical Support' },
  { value: 'BILLING', label: 'Billing Support' },
  { value: 'SALES', label: 'Sales Inquiry' },
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'COMPLIMENT', label: 'Compliment' },
  { value: 'SUGGESTION', label: 'Suggestion' }
]

export function CreateTicketDialog({ isOpen, onClose, onTicketCreated, workspaceId }: CreateTicketDialogProps) {
  const { data: session } = useSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<any>({})
  const [attachments, setAttachments] = useState<AttachmentFile[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    priority: 'MEDIUM',
    type: 'SUPPORT',
    guestName: '',
    guestEmail: '',
    guestPhone: ''
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const validateStep = (stepNumber: number) => {
    const newErrors: any = {}

    if (stepNumber === 1) {
      if (!formData.title.trim()) {
        newErrors.title = 'Title is required'
      }
      if (!formData.description.trim()) {
        newErrors.description = 'Description is required'
      }
    }

    if (stepNumber === 2 && !session?.user) {
      if (!formData.guestName.trim()) {
        newErrors.guestName = 'Name is required'
      }
      if (!formData.guestEmail.trim()) {
        newErrors.guestEmail = 'Email is required'
      } else if (!/\S+@\S+\.\S+/.test(formData.guestEmail)) {
        newErrors.guestEmail = 'Valid email is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1)
    }
  }

  const handlePrevious = () => {
    setStep(step - 1)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    files.forEach(file => {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`)
        return
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip'
      ]

      if (!allowedTypes.includes(file.type)) {
        alert(`File type not allowed: ${file.name}`)
        return
      }

      const attachment: AttachmentFile = {
        id: Math.random().toString(36).substr(2, 9),
        file
      }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string
          setAttachments(prev => [...prev, attachment])
        }
        reader.readAsDataURL(file)
      } else {
        setAttachments(prev => [...prev, attachment])
      }
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }

  const handleSubmit = async () => {
    if (!validateStep(step)) return

    setIsSubmitting(true)

    try {
      // Create ticket
      const ticketData = {
        ...formData,
        tags,
        workspaceId
      }

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ticketData)
      })

      if (!response.ok) {
        throw new Error('Failed to create ticket')
      }

      const { id: ticketId } = await response.json()

      // Upload attachments if any
      if (attachments.length > 0) {
        const uploadPromises = attachments.map(async (attachment) => {
          const formData = new FormData()
          formData.append('file', attachment.file)

          return fetch(`/api/support/tickets/${ticketId}/attachments`, {
            method: 'POST',
            body: formData
          })
        })

        await Promise.all(uploadPromises)
      }

      // Reset form and close
      setFormData({
        title: '',
        description: '',
        category: 'GENERAL',
        priority: 'MEDIUM',
        type: 'SUPPORT',
        guestName: '',
        guestEmail: '',
        guestPhone: ''
      })
      setAttachments([])
      setTags([])
      setStep(1)
      onClose()

      if (onTicketCreated) {
        onTicketCreated(ticketId)
      }

    } catch (error) {
      console.error('Failed to create ticket:', error)
      alert('Failed to create support ticket. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCategory = TICKET_CATEGORIES.find(cat => cat.value === formData.category)
  const selectedPriority = PRIORITY_LEVELS.find(pri => pri.value === formData.priority)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Create Support Ticket
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Progress */}
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step >= stepNumber
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div className={`
                    w-16 h-1 mx-2
                    ${step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Issue Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Describe Your Issue</h3>

              <div className="space-y-2">
                <Label htmlFor="title">Issue Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Brief description of the issue"
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.title}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Detailed Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Please provide detailed information about your issue..."
                  rows={6}
                  className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.description}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div>
                            <div className="font-medium">{category.label}</div>
                            <div className="text-xs text-gray-500">{category.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contact Information</h3>

              {session?.user ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{session.user.name}</p>
                        <p className="text-sm text-gray-600">{session.user.email}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Please provide your contact information so we can respond to your ticket.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="guestName">Full Name *</Label>
                      <Input
                        id="guestName"
                        value={formData.guestName}
                        onChange={(e) => handleInputChange('guestName', e.target.value)}
                        placeholder="Your full name"
                        className={errors.guestName ? 'border-red-500' : ''}
                      />
                      {errors.guestName && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.guestName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guestEmail">Email Address *</Label>
                      <Input
                        id="guestEmail"
                        type="email"
                        value={formData.guestEmail}
                        onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                        placeholder="your@email.com"
                        className={errors.guestEmail ? 'border-red-500' : ''}
                      />
                      {errors.guestEmail && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.guestEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="guestPhone">Phone Number (Optional)</Label>
                    <Input
                      id="guestPhone"
                      value={formData.guestPhone}
                      onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                      placeholder="Your phone number"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Priority & Attachments */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Priority & Attachments</h3>

              {/* Priority Selection */}
              <div className="space-y-3">
                <Label>Priority Level</Label>
                <div className="grid grid-cols-1 gap-2">
                  {PRIORITY_LEVELS.map((priority) => (
                    <button
                      key={priority.value}
                      onClick={() => handleInputChange('priority', priority.value)}
                      className={`
                        p-3 rounded-lg border text-left transition-colors
                        ${formData.priority === priority.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={priority.color}>
                              {priority.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{priority.description}</p>
                        </div>
                        {formData.priority === priority.value && (
                          <Check className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Tags */}
              <div className="space-y-3">
                <Label>Tags (Optional)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
              </div>

              <Separator />

              {/* File Attachments */}
              <div className="space-y-3">
                <Label>Attachments (Optional)</Label>
                <p className="text-sm text-gray-600">
                  Attach files to help us understand your issue better. Max 10MB per file.
                </p>

                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.doc,.docx,.zip"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {attachment.preview ? (
                              <img
                                src={attachment.preview}
                                alt={attachment.file.name}
                                className="w-8 h-8 object-cover rounded"
                              />
                            ) : (
                              <FileText className="h-8 w-8 text-gray-400" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{attachment.file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(attachment.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <div>
              {step > 1 && (
                <Button type="button" variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>

              {step < 3 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Ticket'
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Summary for step 3 */}
          {step === 3 && (
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h4 className="font-medium mb-3">Ticket Summary</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Title:</span> {formData.title}</div>
                  <div><span className="font-medium">Category:</span> {selectedCategory?.label}</div>
                  <div><span className="font-medium">Priority:</span> {selectedPriority?.label}</div>
                  <div><span className="font-medium">Type:</span> {TICKET_TYPES.find(t => t.value === formData.type)?.label}</div>
                  {attachments.length > 0 && (
                    <div><span className="font-medium">Attachments:</span> {attachments.length} file(s)</div>
                  )}
                  {tags.length > 0 && (
                    <div><span className="font-medium">Tags:</span> {tags.join(', ')}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}