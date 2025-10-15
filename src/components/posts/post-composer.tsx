"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  Send, 
  Calendar, 
  Save, 
  Upload, 
  Image, 
  Video, 
  Link, 
  Hash, 
  Smile, 
  X,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Music,
  Sparkles,
  Brain
} from "lucide-react"
import { EmojiPicker } from "@/components/ui/emoji-picker"
import { AIContentGenerator } from "@/components/ai/ai-content-generator"
import { HashtagSuggestions } from "@/components/ai/hashtag-suggestions"
import { ToneAnalyzer } from "@/components/ai/tone-analyzer"
import { PerformancePredictor } from "@/components/ai/performance-predictor"
import { ImageAnalyzer } from "@/components/ai/visual/image-analyzer"
import { ImageOptimizer } from "@/components/ai/visual/image-optimizer"
import { cn } from "@/lib/utils"

// Social platform configurations
const SOCIAL_PLATFORMS = {
  TWITTER: {
    name: "Twitter/X",
    icon: Twitter,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    charLimit: 280,
    mediaLimit: 4,
    videoLimit: "2:20",
    features: ["text", "media", "hashtags", "mentions"]
  },
  FACEBOOK: {
    name: "Facebook",
    icon: Facebook,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    charLimit: 63206,
    mediaLimit: 10,
    videoLimit: "240:00",
    features: ["text", "media", "hashtags", "mentions", "link"]
  },
  INSTAGRAM: {
    name: "Instagram",
    icon: Instagram,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    charLimit: 2200,
    mediaLimit: 10,
    videoLimit: "10:00",
    features: ["text", "media", "hashtags", "mentions"]
  },
  LINKEDIN: {
    name: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    charLimit: 3000,
    mediaLimit: 9,
    videoLimit: "10:00",
    features: ["text", "media", "hashtags", "mentions", "link"]
  },
  YOUTUBE: {
    name: "YouTube",
    icon: Youtube,
    color: "text-red-500",
    bgColor: "bg-red-50",
    charLimit: 5000,
    mediaLimit: 1,
    videoLimit: "unlimited",
    features: ["text", "video", "hashtags", "link"]
  },
  TIKTOK: {
    name: "TikTok",
    icon: Music,
    color: "text-black",
    bgColor: "bg-gray-50",
    charLimit: 150,
    mediaLimit: 1,
    videoLimit: "10:00",
    features: ["text", "video", "hashtags", "mentions"]
  }
} as const

interface PostComposerProps {
  initialContent?: string
  initialTitle?: string
  initialPlatforms?: string[]
  initialMedia?: MediaItem[]
  editMode?: boolean
  postId?: string
  workspaceId: string
  onSave?: (postData: any) => Promise<void>
  onSchedule?: (postData: any, scheduledTime: Date) => Promise<void>
  onPublish?: (postData: any) => Promise<void>
  className?: string
}

interface MediaItem {
  id: string
  type: "image" | "video"
  url: string
  file?: File
  alt?: string
}

interface PostContent {
  text: string
  media: MediaItem[]
  link?: string
  hashtags: string[]
  mentions: string[]
}

export default function PostComposer({
  initialContent = "",
  initialTitle = "",
  initialPlatforms = [],
  initialMedia = [],
  editMode = false,
  postId,
  workspaceId,
  onSave,
  onSchedule,
  onPublish,
  className
}: PostComposerProps) {

  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<keyof typeof SOCIAL_PLATFORMS>>(
    new Set(initialPlatforms as (keyof typeof SOCIAL_PLATFORMS)[])
  )
  
  const [title, setTitle] = useState(initialTitle)
  
  const [content, setContent] = useState<PostContent>({
    text: initialContent,
    media: initialMedia,
    hashtags: [],
    mentions: []
  })
  
  const [showHashtagInput, setShowHashtagInput] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [hashtagInput, setHashtagInput] = useState("")

  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // AI Features State
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [showVisualOptimization, setShowVisualOptimization] = useState(false)

  // Character count for selected platforms
  const getCharacterCounts = () => {
    const counts: Record<string, { current: number; limit: number; remaining: number }> = {}
    
    selectedPlatforms.forEach(platform => {
      const config = SOCIAL_PLATFORMS[platform]
      const current = content.text.length
      const limit = config.charLimit
      const remaining = limit - current
      
      counts[platform] = { current, limit, remaining }
    })
    
    return counts
  }

  // Toggle platform selection
  const togglePlatform = (platform: keyof typeof SOCIAL_PLATFORMS) => {
    const newPlatforms = new Set(selectedPlatforms)
    if (newPlatforms.has(platform)) {
      newPlatforms.delete(platform)
    } else {
      newPlatforms.add(platform)
    }
    setSelectedPlatforms(newPlatforms)
  }

  // Handle media upload
  const handleMediaUpload = useCallback(async (files: FileList) => {
    console.log('🔧 handleMediaUpload called with workspaceId:', workspaceId)

    if (!workspaceId) {
      console.error('❌ Cannot upload media: workspaceId is not available yet')
      alert('Please wait for workspace to load before uploading files')
      return
    }

    const uploadedMedia: MediaItem[] = []

    for (const file of Array.from(files)) {
      try {
        // Create FormData for upload
        const formData = new FormData()
        formData.append('file', file)
        formData.append('workspaceId', workspaceId)

        console.log('📤 Uploading file with workspaceId:', workspaceId)
        
        // Upload to server
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        })
        
        if (response.ok) {
          const uploadResult = await response.json()

          uploadedMedia.push({
            id: uploadResult.id,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: uploadResult.url,
            alt: file.name
          })
        } else {
          console.error('Upload request failed')
          // Fallback to blob URL for preview
          uploadedMedia.push({
            id: Math.random().toString(36).substr(2, 9),
            type: file.type.startsWith('video/') ? 'video' : 'image',
            url: URL.createObjectURL(file),
            file
          })
        }
      } catch (error) {
        console.error('Error uploading file:', error)
        // Fallback to blob URL for preview
        uploadedMedia.push({
          id: Math.random().toString(36).substr(2, 9),
          type: file.type.startsWith('video/') ? 'video' : 'image',
          url: URL.createObjectURL(file),
          file
        })
      }
    }
    
    setContent(prev => ({
      ...prev,
      media: [...prev.media, ...uploadedMedia]
    }))
  }, [workspaceId])

  // Remove media item
  const removeMedia = (id: string) => {
    setContent(prev => ({
      ...prev,
      media: prev.media.filter(item => item.id !== id)
    }))
  }

  // Extract hashtags and mentions from text
  const updateTextContent = (text: string) => {
    const hashtags = (text.match(/#[\w]+/g) || []).map(tag => tag.slice(1))
    const mentions = (text.match(/@[\w]+/g) || []).map(mention => mention.slice(1))
    
    setContent(prev => ({
      ...prev,
      text,
      hashtags,
      mentions
    }))
  }

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => ({
      ...prev,
      text: prev.text + emoji
    }))
  }

  // Add hashtag
  const addHashtag = (tag: string) => {
    const cleanTag = tag.replace(/^#/, '').trim()
    if (cleanTag && !content.hashtags.includes(cleanTag)) {
      setContent(prev => ({
        ...prev,
        hashtags: [...prev.hashtags, cleanTag]
      }))
    }
  }

  // Remove hashtag
  const removeHashtag = (tag: string) => {
    setContent(prev => ({
      ...prev,
      hashtags: prev.hashtags.filter(h => h !== tag)
    }))
  }

  // Handle hashtag input
  const handleHashtagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addHashtag(hashtagInput)
      setHashtagInput("")
    }
  }

  // Handle link input
  const handleLinkChange = (link: string) => {
    setContent(prev => ({
      ...prev,
      link
    }))
  }

  // AI Handlers
  const handleAIContentGenerated = (generatedContent: string) => {
    updateTextContent(generatedContent)
  }

  const handleHashtagAdd = (hashtag: string) => {
    addHashtag(hashtag)
  }

  const handleHashtagRemove = (hashtag: string) => {
    removeHashtag(hashtag)
  }

  // Handle save draft
  const handleSave = async () => {
    if (!onSave) return
    
    setIsLoading(true)
    try {
      await onSave({
        title,
        content,
        platforms: Array.from(selectedPlatforms),
        status: 'DRAFT',
        ...(editMode && postId && { id: postId })
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle schedule post
  const handleSchedule = async () => {
    if (!onSchedule || !scheduledTime) return
    
    setIsLoading(true)
    try {
      await onSchedule({
        title,
        content,
        platforms: Array.from(selectedPlatforms),
        ...(editMode && postId && { id: postId })
      }, scheduledTime)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle publish now
  const handlePublish = async () => {
    if (!onPublish) return
    
    setIsLoading(true)
    try {
      await onPublish({
        title,
        content,
        platforms: Array.from(selectedPlatforms),
        ...(editMode && postId && { id: postId })
      })
    } finally {
      setIsLoading(false)
    }
  }

  const characterCounts = getCharacterCounts()
  const hasContent = content.text.trim() || content.media.length > 0
  const canPublish = hasContent && selectedPlatforms.size > 0

  return (
    <div className={cn("space-y-6", className)}>
      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Choose Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(SOCIAL_PLATFORMS).map(([key, platform]) => {
              const Icon = platform.icon
              const isSelected = selectedPlatforms.has(key as keyof typeof SOCIAL_PLATFORMS)
              
              return (
                <Button
                  key={key}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "h-auto p-4 flex flex-col items-center space-y-2",
                    isSelected && platform.bgColor,
                    isSelected && platform.color
                  )}
                  onClick={() => togglePlatform(key as keyof typeof SOCIAL_PLATFORMS)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{platform.name}</span>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create Your Post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="post-title">Post Title (Optional)</Label>
            <Input
              id="post-title"
              placeholder="Add a title for your post..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
            />
          </div>
          
          {/* Text Content */}
          <div className="space-y-2">
            <Label htmlFor="post-content">Content</Label>
            <Textarea
              id="post-content"
              placeholder="What's happening? Share your thoughts..."
              value={content.text}
              onChange={(e) => updateTextContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            
            {/* Character counts for selected platforms */}
            {selectedPlatforms.size > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(characterCounts).map(([platform, count]) => (
                  <Badge
                    key={platform}
                    variant={count.remaining < 0 ? "destructive" : count.remaining < 20 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS].name}: {count.remaining}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Hashtags Display */}
          {content.hashtags.length > 0 && (
            <div className="space-y-2">
              <Label>Hashtags</Label>
              <div className="flex flex-wrap gap-2">
                {content.hashtags.map((hashtag) => (
                  <Badge key={hashtag} variant="secondary" className="flex items-center gap-1">
                    #{hashtag}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto w-auto p-0 hover:bg-transparent"
                      onClick={() => removeHashtag(hashtag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Hashtag Input */}
          {showHashtagInput && (
            <div className="space-y-2">
              <Label htmlFor="hashtag-input">Add Hashtag</Label>
              <div className="flex gap-2">
                <Input
                  id="hashtag-input"
                  placeholder="Enter hashtag (without #)..."
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyPress={handleHashtagKeyPress}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    addHashtag(hashtagInput)
                    setHashtagInput("")
                  }}
                  disabled={!hashtagInput.trim()}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowHashtagInput(false)
                    setHashtagInput("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Link Input */}
          {showLinkInput && (
            <div className="space-y-2">
              <Label htmlFor="link-input">Add Link</Label>
              <div className="flex gap-2">
                <Input
                  id="link-input"
                  placeholder="Enter URL..."
                  value={content.link || ""}
                  onChange={(e) => handleLinkChange(e.target.value)}
                  type="url"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkInput(false)}
                >
                  Done
                </Button>
              </div>
              {content.link && (
                <div className="text-sm text-muted-foreground">
                  Link preview: <a href={content.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{content.link}</a>
                </div>
              )}
            </div>
          )}

          {/* Media Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!workspaceId}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
                title={!workspaceId ? "Loading workspace..." : "Add media files"}
              >
                <Upload className="h-4 w-4" />
                Add Media
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => e.target.files && handleMediaUpload(e.target.files)}
              />
            </div>

            {/* Media Preview */}
            {content.media.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {content.media.map((item) => (
                  <div key={item.id} className="relative group">
                    <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                      {item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={item.url}
                          className="w-full h-full object-cover"
                          controls
                        />
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMedia(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex flex-wrap gap-2">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowHashtagInput(!showHashtagInput)}
              >
                <Hash className="h-4 w-4" />
                Hashtags
                {content.hashtags.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {content.hashtags.length}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowLinkInput(!showLinkInput)}
              >
                <Link className="h-4 w-4" />
                Link
                {content.link && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    ✓
                  </Badge>
                )}
              </Button>
              
              {/* AI Assistant Buttons */}
              <Button
                type="button"
                variant={showAIAssistant ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
              >
                <Sparkles className="h-4 w-4" />
                AI Assistant
              </Button>
              
              <Button
                type="button"
                variant={showAIAnalysis ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowAIAnalysis(!showAIAnalysis)}
              >
                <Brain className="h-4 w-4" />
                AI Analysis
              </Button>
              
              <Button
                type="button"
                variant={showVisualOptimization ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setShowVisualOptimization(!showVisualOptimization)}
                disabled={content.media.length === 0}
                title={content.media.length === 0 ? "Add images to use visual optimization" : ""}
              >
                <Image className="h-4 w-4" />
                Visual AI
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={!canPublish || isLoading}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={showScheduler}
                  onCheckedChange={setShowScheduler}
                />
                <Label htmlFor="schedule">Schedule</Label>
              </div>

              {showScheduler ? (
                <Button
                  onClick={handleSchedule}
                  disabled={!canPublish || !scheduledTime || isLoading}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule
                </Button>
              ) : (
                <Button
                  onClick={handlePublish}
                  disabled={!canPublish || isLoading}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Publish Now
                </Button>
              )}
            </div>
          </div>

          {/* Schedule DateTime Picker */}
          {showScheduler && (
            <div className="pt-4 border-t">
              <Label htmlFor="schedule-time">Schedule for</Label>
              <Input
                id="schedule-time"
                type="datetime-local"
                value={scheduledTime ? scheduledTime.toISOString().slice(0, 16) : ''}
                onChange={(e) => setScheduledTime(new Date(e.target.value))}
                min={new Date().toISOString().slice(0, 16)}
                className="mt-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Assistant Section */}
      {showAIAssistant && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIContentGenerator
            onContentGenerated={handleAIContentGenerated}
            selectedPlatforms={Array.from(selectedPlatforms)}
            initialPrompt=""
          />
          
          <HashtagSuggestions
            content={content.text}
            selectedPlatforms={Array.from(selectedPlatforms)}
            currentHashtags={content.hashtags}
            onHashtagAdd={handleHashtagAdd}
            onHashtagRemove={handleHashtagRemove}
          />
        </div>
      )}

      {/* AI Analysis Section */}
      {showAIAnalysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ToneAnalyzer
            content={content.text}
            postId={postId}
          />
          
          <PerformancePredictor
            content={content.text}
            selectedPlatforms={Array.from(selectedPlatforms)}
            postId={postId}
          />
        </div>
      )}

      {/* Visual Optimization Section */}
      {showVisualOptimization && content.media.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!workspaceId ? (
            <div className="col-span-2 text-center p-4 text-muted-foreground">
              Loading workspace information...
            </div>
          ) : (
            <>
          <ImageAnalyzer
            imageUrl={content.media.find(item => item.type === 'image')?.url}
            selectedPlatforms={Array.from(selectedPlatforms)}
            workspaceId={workspaceId}
            onAnalysisComplete={(analysis) => {
              console.log('Image analysis completed:', analysis)
            }}
          />
          
          <ImageOptimizer
            imageUrl={content.media.find(item => item.type === 'image')?.url}
            selectedPlatforms={Array.from(selectedPlatforms)}
            workspaceId={workspaceId}
            onOptimizationComplete={(results) => {
              console.log('Image optimization completed:', results)
            }}
          />
            </>
          )}
        </div>
      )}

      {/* Platform Previews */}
      {selectedPlatforms.size > 0 && hasContent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Previews</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={Array.from(selectedPlatforms)[0]} className="w-full">
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-6">
                {Array.from(selectedPlatforms).map((platform) => {
                  const Icon = SOCIAL_PLATFORMS[platform].icon
                  return (
                    <TabsTrigger key={platform} value={platform} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{SOCIAL_PLATFORMS[platform].name}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
              
              {Array.from(selectedPlatforms).map((platform) => {
                const PlatformIcon = SOCIAL_PLATFORMS[platform].icon
                return (
                  <TabsContent key={platform} value={platform} className="mt-4">
                    <div className={cn("p-4 rounded-lg border", SOCIAL_PLATFORMS[platform].bgColor)}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", SOCIAL_PLATFORMS[platform].color)}>
                          <PlatformIcon className="h-4 w-4" />
                        </div>
                      <div>
                        <div className="font-semibold text-sm">Your Brand Name</div>
                        <div className="text-xs text-muted-foreground">@yourbrand • now</div>
                      </div>
                    </div>
                    
                    {content.text && (
                      <div className="mb-3 whitespace-pre-wrap">{content.text}</div>
                    )}
                    
                    {content.media.length > 0 && (
                      <div className={cn(
                        "grid gap-2 mb-3",
                        content.media.length === 1 ? "grid-cols-1" : 
                        content.media.length === 2 ? "grid-cols-2" : 
                        "grid-cols-2"
                      )}>
                        {content.media.slice(0, 4).map((item) => (
                          <div key={item.id} className="aspect-video bg-muted rounded overflow-hidden">
                            {item.type === 'image' ? (
                              <img src={item.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>💬 Reply</span>
                      <span>🔁 Repost</span>
                      <span>❤️ Like</span>
                      <span>📤 Share</span>
                    </div>
                  </div>
                </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}