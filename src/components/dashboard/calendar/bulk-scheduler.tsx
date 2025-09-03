"use client"

import { useState } from "react"
import { format, addDays, addWeeks, addMonths } from "date-fns"
import { Calendar as CalendarIcon, Clock, Plus, X, Upload } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

interface BulkSchedulerProps {
  isOpen: boolean
  onClose: () => void
}

interface BulkPost {
  id: string
  content: string
  platforms: string[]
  scheduledDate?: string
  scheduledTime?: string
}

const platforms = [
  { id: 'TWITTER', name: 'Twitter', color: 'bg-blue-500' },
  { id: 'FACEBOOK', name: 'Facebook', color: 'bg-blue-600' },
  { id: 'INSTAGRAM', name: 'Instagram', color: 'bg-pink-500' },
  { id: 'LINKEDIN', name: 'LinkedIn', color: 'bg-blue-700' },
  { id: 'YOUTUBE', name: 'YouTube', color: 'bg-red-500' },
  { id: 'TIKTOK', name: 'TikTok', color: 'bg-black' },
]

export function BulkScheduler({ isOpen, onClose }: BulkSchedulerProps) {
  const [posts, setPosts] = useState<BulkPost[]>([
    { id: '1', content: '', platforms: ['TWITTER'] }
  ])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['TWITTER'])
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState('09:00')
  const [scheduleType, setScheduleType] = useState<'sequential' | 'same-time' | 'custom'>('sequential')
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [intervalCount, setIntervalCount] = useState(1)
  const [loading, setLoading] = useState(false)

  const addPost = () => {
    const newId = (posts.length + 1).toString()
    setPosts([...posts, { id: newId, content: '', platforms: [...selectedPlatforms] }])
  }

  const removePost = (id: string) => {
    setPosts(posts.filter(post => post.id !== id))
  }

  const updatePost = (id: string, field: keyof BulkPost, value: any) => {
    setPosts(posts.map(post => 
      post.id === id ? { ...post, [field]: value } : post
    ))
  }

  const togglePlatformForAll = (platformId: string) => {
    const newPlatforms = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter(p => p !== platformId)
      : [...selectedPlatforms, platformId]
    
    setSelectedPlatforms(newPlatforms)
    setPosts(posts.map(post => ({ ...post, platforms: newPlatforms })))
  }

  const generateSchedule = () => {
    const baseDate = new Date(`${startDate}T${startTime}`)
    
    return posts.map((post, index) => {
      if (scheduleType === 'same-time') {
        return { ...post, scheduledAt: baseDate.toISOString() }
      } else if (scheduleType === 'sequential') {
        let scheduledDate = new Date(baseDate)
        
        switch (interval) {
          case 'daily':
            scheduledDate = addDays(baseDate, index * intervalCount)
            break
          case 'weekly':
            scheduledDate = addWeeks(baseDate, index * intervalCount)
            break
          case 'monthly':
            scheduledDate = addMonths(baseDate, index * intervalCount)
            break
        }
        
        return { ...post, scheduledAt: scheduledDate.toISOString() }
      } else {
        // Custom scheduling - use individual dates
        const postDate = post.scheduledDate ? 
          new Date(`${post.scheduledDate}T${post.scheduledTime || startTime}`) : 
          new Date(baseDate.getTime() + index * 60 * 60 * 1000) // Default: 1 hour apart
        
        return { ...post, scheduledAt: postDate.toISOString() }
      }
    }).filter(post => post.content.trim())
  }

  const handleBulkSchedule = async () => {
    const scheduledPosts = generateSchedule()
    
    if (scheduledPosts.length === 0) {
      alert('Please add at least one post with content')
      return
    }

    setLoading(true)
    try {
      const results = await Promise.allSettled(
        scheduledPosts.map(post =>
          fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: {
                text: post.content,
                media: [],
                hashtags: [],
                mentions: []
              },
              platforms: post.platforms,
              status: 'SCHEDULED',
              scheduledAt: post.scheduledAt,
              tags: []
            })
          })
        )
      )

      const successful = results.filter(result => result.status === 'fulfilled').length
      const failed = results.length - successful

      if (failed > 0) {
        alert(`Scheduled ${successful} posts successfully. ${failed} posts failed.`)
      } else {
        alert(`Successfully scheduled ${successful} posts!`)
      }

      onClose()
      window.location.reload()
    } catch (error) {
      console.error('Bulk scheduling failed:', error)
      alert('Bulk scheduling failed')
    } finally {
      setLoading(false)
    }
  }

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const csv = e.target?.result as string
      const lines = csv.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      
      const newPosts: BulkPost[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const post: BulkPost = {
          id: i.toString(),
          content: values[headers.indexOf('content')] || '',
          platforms: (values[headers.indexOf('platforms')] || 'TWITTER').split(';'),
          scheduledDate: values[headers.indexOf('date')] || undefined,
          scheduledTime: values[headers.indexOf('time')] || undefined
        }
        
        if (post.content) {
          newPosts.push(post)
        }
      }
      
      if (newPosts.length > 0) {
        setPosts(newPosts)
        setScheduleType('custom')
      }
    }
    
    reader.readAsText(file)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Schedule Posts
          </DialogTitle>
          <DialogDescription>
            Schedule multiple posts at once with custom timing and platforms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Import CSV */}
          <Card>
            <CardContent className="p-4">
              <Label htmlFor="csv-import" className="text-sm font-medium">
                Import from CSV (optional)
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  id="csv-import"
                  type="file"
                  accept=".csv"
                  onChange={importFromCSV}
                  className="flex-1"
                />
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                CSV format: content, platforms (semicolon-separated), date, time
              </p>
            </CardContent>
          </Card>

          {/* Global Platform Selection */}
          <div className="space-y-3">
            <Label>Default Platforms</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {platforms.map((platform) => (
                <Card
                  key={platform.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedPlatforms.includes(platform.id) 
                      ? 'ring-2 ring-primary shadow-md' 
                      : ''
                  }`}
                  onClick={() => togglePlatformForAll(platform.id)}
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

          {/* Schedule Type */}
          <div className="space-y-3">
            <Label>Schedule Type</Label>
            <Select value={scheduleType} onValueChange={(value: any) => setScheduleType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential (with intervals)</SelectItem>
                <SelectItem value="same-time">Same time for all posts</SelectItem>
                <SelectItem value="custom">Custom dates for each post</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scheduling Options */}
          {scheduleType !== 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {scheduleType === 'sequential' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Interval</Label>
                <Select value={interval} onValueChange={(value: any) => setInterval(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Interval Count</Label>
                <Input
                  type="number"
                  min="1"
                  value={intervalCount}
                  onChange={(e) => setIntervalCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Posts ({posts.length})</Label>
              <Button variant="outline" size="sm" onClick={addPost}>
                <Plus className="h-4 w-4 mr-1" />
                Add Post
              </Button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {posts.map((post, index) => (
                <Card key={post.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder={`Post ${index + 1} content...`}
                          value={post.content}
                          onChange={(e) => updatePost(post.id, 'content', e.target.value)}
                          rows={2}
                        />
                        
                        {scheduleType === 'custom' && (
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="date"
                              value={post.scheduledDate || startDate}
                              onChange={(e) => updatePost(post.id, 'scheduledDate', e.target.value)}
                            />
                            <Input
                              type="time"
                              value={post.scheduledTime || startTime}
                              onChange={(e) => updatePost(post.id, 'scheduledTime', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                      
                      {posts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePost(post.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Preview */}
          <Card>
            <CardContent className="p-4">
              <Label className="text-sm font-medium">Schedule Preview</Label>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                {generateSchedule().slice(0, 5).map((post, index) => (
                  <div key={index} className="text-xs text-muted-foreground">
                    Post {index + 1}: {format(new Date(post.scheduledAt!), 'MMM dd, yyyy HH:mm')}
                  </div>
                ))}
                {posts.length > 5 && (
                  <div className="text-xs text-muted-foreground">
                    ...and {posts.length - 5} more posts
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
            onClick={handleBulkSchedule}
            disabled={loading || posts.every(p => !p.content.trim())}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            {loading ? 'Scheduling...' : `Schedule ${generateSchedule().length} Posts`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}