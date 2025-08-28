'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Send, 
  Calendar, 
  Image, 
  Sparkles,
  Hash,
  AtSign,
  Save,
  Eye,
  Zap,
  BarChart3,
  Clock,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PostComposerProps {
  workspaceId: string
}

export function PostComposer({ workspaceId }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter'])
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [isAIOptimizing, setIsAIOptimizing] = useState(false)
  const [aiSuggestions, setAISuggestions] = useState<string[]>([])

  const platforms = [
    { id: 'twitter', name: 'Twitter', icon: '𝕏', color: 'bg-black text-white' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼', color: 'bg-blue-700 text-white' },
    { id: 'facebook', name: 'Facebook', icon: '󠁦', color: 'bg-blue-600 text-white' },
    { id: 'instagram', name: 'Instagram', icon: '📷', color: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' }
  ]

  const handleAIOptimize = async () => {
    if (!content.trim()) return
    
    setIsAIOptimizing(true)
    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content,
          platforms: selectedPlatforms,
          workspaceId 
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAISuggestions(data.suggestions || [])
      }
    } catch (error) {
      console.error('AI optimization error:', error)
    } finally {
      setIsAIOptimizing(false)
    }
  }

  const handlePublish = async () => {
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          platforms: selectedPlatforms,
          scheduledFor: isScheduled ? scheduledDate : null,
          workspaceId
        })
      })

      if (response.ok) {
        // Reset form or redirect
        setContent('')
        setTitle('')
        // Show success message
      }
    } catch (error) {
      console.error('Publish error:', error)
    }
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    )
  }

  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Post</h1>
        <p className="text-muted-foreground">
          Create and schedule new social media posts with AI-powered optimization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Composer */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compose Your Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  placeholder="Post title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div>
                <Textarea
                  placeholder="What's happening? Share your thoughts..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
                <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                  <span>{content.length} characters</span>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                      <Image className="h-4 w-4 mr-1" />
                      Media
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Hash className="h-4 w-4 mr-1" />
                      Tags
                    </Button>
                    <Button variant="ghost" size="sm">
                      <AtSign className="h-4 w-4 mr-1" />
                      Mention
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          {aiSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <span>AI Suggestions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{suggestion}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setContent(suggestion)}
                      >
                        Use This
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Platform Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {platforms.map((platform) => (
                  <Button
                    key={platform.id}
                    variant="outline"
                    className={cn(
                      "h-16 flex-col space-y-1",
                      selectedPlatforms.includes(platform.id) && platform.color
                    )}
                    onClick={() => togglePlatform(platform.id)}
                  >
                    <div className="text-xl">{platform.icon}</div>
                    <div className="text-xs">{platform.name}</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="schedule"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                />
                <label htmlFor="schedule" className="text-sm">
                  Schedule for later
                </label>
              </div>
              
              {isScheduled && (
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              )}
            </CardContent>
          </Card>

          {/* AI Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4" />
                <span>AI Tools</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={handleAIOptimize}
                disabled={isAIOptimizing}
              >
                <Zap className="h-4 w-4 mr-2" />
                {isAIOptimizing ? 'Optimizing...' : 'AI Optimize'}
              </Button>
              
              <Button variant="outline" className="w-full justify-start">
                <BarChart3 className="h-4 w-4 mr-2" />
                Predict Performance
              </Button>
              
              <Button variant="outline" className="w-full justify-start">
                <Clock className="h-4 w-4 mr-2" />
                Best Time to Post
              </Button>
              
              <Button variant="outline" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Audience Analysis
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <Button 
                className="w-full" 
                onClick={handlePublish}
                disabled={!content.trim() || selectedPlatforms.length === 0}
              >
                <Send className="h-4 w-4 mr-2" />
                {isScheduled ? 'Schedule Post' : 'Publish Now'}
              </Button>
              
              <Button variant="outline" className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              
              <Button variant="outline" className="w-full">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}