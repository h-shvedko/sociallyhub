"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, X } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface PostSchedulerProps {
  isOpen: boolean
  onClose: () => void
  initialDate?: Date
}

const platforms = [
  { id: 'TWITTER', name: 'Twitter', color: 'bg-blue-500' },
  { id: 'FACEBOOK', name: 'Facebook', color: 'bg-blue-600' },
  { id: 'INSTAGRAM', name: 'Instagram', color: 'bg-pink-500' },
  { id: 'LINKEDIN', name: 'LinkedIn', color: 'bg-blue-700' },
  { id: 'YOUTUBE', name: 'YouTube', color: 'bg-red-500' },
  { id: 'TIKTOK', name: 'TikTok', color: 'bg-black' },
]

export function PostScheduler({ isOpen, onClose, initialDate }: PostSchedulerProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['TWITTER'])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scheduledDate, setScheduledDate] = useState(
    initialDate ? format(initialDate, 'yyyy-MM-dd') : ''
  )
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [loading, setLoading] = useState(false)

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const handleSubmit = async (status: 'DRAFT' | 'SCHEDULED') => {
    if (!content.trim()) return

    setLoading(true)
    try {
      const scheduledAt = status === 'SCHEDULED' && scheduledDate && scheduledTime
        ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
        : null

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: {
            text: content,
            media: [],
            hashtags: [],
            mentions: []
          },
          platforms: selectedPlatforms,
          status,
          scheduledAt,
          tags: []
        }),
      })

      if (response.ok) {
        onClose()
        // Reset form
        setTitle('')
        setContent('')
        setSelectedPlatforms(['TWITTER'])
        
        // Refresh the page to show new post
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create post:', error)
      alert('Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule Post
          </DialogTitle>
          <DialogDescription>
            Create a new post to schedule for your social media platforms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              placeholder="Enter a title for your post..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              placeholder="What would you like to share?"
              className="min-h-[120px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>Platforms</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {platforms.map((platform) => (
                <Card
                  key={platform.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedPlatforms.includes(platform.id) 
                      ? 'ring-2 ring-primary shadow-md' 
                      : ''
                  }`}
                  onClick={() => togglePlatform(platform.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${platform.color}`} />
                      <span className="text-sm font-medium">{platform.name}</span>
                      {selectedPlatforms.includes(platform.id) && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Schedule Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Schedule Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit('DRAFT')}
            disabled={!content.trim() || loading}
            className="flex-1"
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit('SCHEDULED')}
            disabled={!content.trim() || !scheduledDate || loading}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            {loading ? 'Scheduling...' : 'Schedule Post'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}