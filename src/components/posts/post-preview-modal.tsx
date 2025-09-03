"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Twitter, 
  Facebook, 
  Instagram, 
  Linkedin, 
  Youtube,
  MessageCircle,
  Heart,
  Repeat2,
  Share,
  ThumbsUp,
  Eye,
  Clock
} from "lucide-react"

interface Post {
  id: string
  title: string | null
  baseContent: string | null
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  platforms: string[]
  variants: any[]
  media: any[]
  owner: {
    name: string | null
    email: string
    image: string | null
  }
}

interface PostPreviewModalProps {
  post: Post | null
  isOpen: boolean
  onClose: () => void
}

const platformIcons = {
  TWITTER: Twitter,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
  YOUTUBE: Youtube,
}

const platformColors = {
  TWITTER: "bg-blue-500",
  FACEBOOK: "bg-blue-600",
  INSTAGRAM: "bg-gradient-to-r from-purple-500 to-pink-500",
  LINKEDIN: "bg-blue-700",
  YOUTUBE: "bg-red-600",
}

export default function PostPreviewModal({ post, isOpen, onClose }: PostPreviewModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("")

  if (!post) return null

  // Set default platform when modal opens
  const firstPlatform = post.platforms[0] || ""
  const activePlatform = selectedPlatform || firstPlatform

  const formatContent = (content: string, platform: string) => {
    // Platform-specific content formatting
    switch (platform) {
      case 'TWITTER':
        return content.length > 280 ? content.substring(0, 277) + '...' : content
      case 'INSTAGRAM':
        // Instagram allows longer captions, show hashtags prominently
        return content
      case 'LINKEDIN':
        // LinkedIn professional formatting
        return content
      case 'FACEBOOK':
        return content
      default:
        return content
    }
  }

  const getCharacterLimit = (platform: string) => {
    switch (platform) {
      case 'TWITTER': return 280
      case 'INSTAGRAM': return 2200
      case 'LINKEDIN': return 3000
      case 'FACEBOOK': return 63206
      default: return 0
    }
  }

  const renderPlatformPreview = (platform: string) => {
    const Icon = platformIcons[platform as keyof typeof platformIcons] || MessageCircle
    const content = formatContent(post.baseContent || "", platform)
    const characterCount = content.length
    const characterLimit = getCharacterLimit(platform)

    return (
      <div className="space-y-4">
        {/* Platform Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg text-white ${platformColors[platform as keyof typeof platformColors] || 'bg-gray-500'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{platform} Preview</h3>
            <p className="text-sm text-muted-foreground">
              {characterCount}/{characterLimit} characters
            </p>
          </div>
        </div>

        {/* Preview Card */}
        <Card className="max-w-md">
          <CardContent className="p-4">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {post.owner.name?.[0] || post.owner.email[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {post.owner.name || post.owner.email.split('@')[0]}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.status === 'SCHEDULED' && post.scheduledAt 
                    ? `Scheduled for ${new Date(post.scheduledAt).toLocaleString()}`
                    : post.publishedAt 
                    ? `Published ${new Date(post.publishedAt).toLocaleDateString()}`
                    : 'Draft'
                  }
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="mb-3">
              <p className="text-sm whitespace-pre-wrap">{content}</p>
              
              {/* Media Preview */}
              {post.media && post.media.length > 0 && (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    {post.media.slice(0, 4).map((mediaItem: any, index: number) => (
                      <div key={mediaItem.id || index} className="relative aspect-square group">
                        {mediaItem.mimeType?.startsWith('image/') ? (
                          <img
                            src={mediaItem.thumbnailUrl || mediaItem.url}
                            alt={mediaItem.originalName || 'Post image'}
                            className="w-full h-full object-cover rounded-lg border border-border group-hover:border-primary transition-colors"
                            loading="lazy"
                            title={mediaItem.originalName || 'Post image'}
                            onError={(e) => {
                              // Fallback to original URL if thumbnail fails to load
                              const target = e.target as HTMLImageElement
                              if (target.src !== mediaItem.url) {
                                target.src = mediaItem.url
                              }
                            }}
                          />
                        ) : mediaItem.mimeType?.startsWith('video/') ? (
                          <div className="relative w-full h-full rounded-lg border border-border group-hover:border-primary transition-colors overflow-hidden">
                            {mediaItem.thumbnailUrl ? (
                              <>
                                <img
                                  src={mediaItem.thumbnailUrl}
                                  alt={mediaItem.originalName || 'Video thumbnail'}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  title={mediaItem.originalName || 'Video'}
                                  onError={(e) => {
                                    // Hide broken thumbnail and show placeholder
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                  <div className="bg-black/60 rounded-full p-3">
                                    <Eye className="h-5 w-5 text-white" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <div className="flex flex-col items-center gap-1">
                                  <Eye className="h-6 w-6 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Video</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full bg-muted rounded-lg border border-border group-hover:border-primary transition-colors flex items-center justify-center">
                            <div className="flex flex-col items-center gap-1">
                              <Eye className="h-6 w-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Media</span>
                            </div>
                          </div>
                        )}
                        {post.media.length > 4 && index === 3 && (
                          <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm">
                            <div className="text-center">
                              <span className="text-white text-sm font-semibold block">
                                +{post.media.length - 4}
                              </span>
                              <span className="text-white/80 text-xs">more</span>
                            </div>
                          </div>
                        )}
                        {/* Hover overlay */}
                        {(mediaItem.mimeType?.startsWith('image/') || (mediaItem.mimeType?.startsWith('video/') && mediaItem.thumbnailUrl)) && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Eye className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Character limit warning */}
              {characterCount > characterLimit * 0.9 && (
                <div className="mt-2">
                  <Badge 
                    variant={characterCount > characterLimit ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {characterCount > characterLimit 
                      ? `${characterCount - characterLimit} chars over limit`
                      : `${characterLimit - characterCount} chars remaining`
                    }
                  </Badge>
                </div>
              )}
            </div>

            {/* Platform-specific engagement simulation */}
            <div className="flex items-center gap-4 pt-2 border-t text-muted-foreground">
              {platform === 'TWITTER' && (
                <>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <MessageCircle className="h-4 w-4" />
                    <span>12</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-green-500">
                    <Repeat2 className="h-4 w-4" />
                    <span>8</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-red-500">
                    <Heart className="h-4 w-4" />
                    <span>24</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <Share className="h-4 w-4" />
                  </button>
                </>
              )}
              
              {platform === 'FACEBOOK' && (
                <>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <ThumbsUp className="h-4 w-4" />
                    <span>15</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <MessageCircle className="h-4 w-4" />
                    <span>3</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <Share className="h-4 w-4" />
                    <span>5</span>
                  </button>
                </>
              )}
              
              {platform === 'INSTAGRAM' && (
                <>
                  <button className="flex items-center gap-1 text-sm hover:text-red-500">
                    <Heart className="h-4 w-4" />
                    <span>42</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <MessageCircle className="h-4 w-4" />
                    <span>7</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <Share className="h-4 w-4" />
                  </button>
                </>
              )}
              
              {platform === 'LINKEDIN' && (
                <>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <ThumbsUp className="h-4 w-4" />
                    <span>18</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <MessageCircle className="h-4 w-4" />
                    <span>6</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm hover:text-blue-500">
                    <Share className="h-4 w-4" />
                    <span>4</span>
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform-specific tips */}
        <div className="bg-muted p-3 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Platform Tips</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {platform === 'TWITTER' && (
              <>
                <li>• Keep it under 280 characters for maximum engagement</li>
                <li>• Use 1-2 relevant hashtags</li>
                <li>• Ask questions to encourage replies</li>
              </>
            )}
            {platform === 'INSTAGRAM' && (
              <>
                <li>• Use high-quality visuals (add images/videos)</li>
                <li>• Include 5-10 relevant hashtags</li>
                <li>• Write engaging captions that tell a story</li>
              </>
            )}
            {platform === 'LINKEDIN' && (
              <>
                <li>• Focus on professional, valuable content</li>
                <li>• Use industry-specific hashtags</li>
                <li>• Encourage professional discussion</li>
              </>
            )}
            {platform === 'FACEBOOK' && (
              <>
                <li>• Longer posts perform well with engagement</li>
                <li>• Include calls-to-action</li>
                <li>• Use emojis to increase engagement</li>
              </>
            )}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Post Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Post Info */}
          <div className="bg-muted p-4 rounded-lg">
            <h3 className="font-semibold mb-2">
              {post.title || "Untitled Post"}
            </h3>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                {post.status}
              </Badge>
              <span>Created: {new Date(post.createdAt).toLocaleDateString()}</span>
              {post.scheduledAt && (
                <span>Scheduled: {new Date(post.scheduledAt).toLocaleDateString()}</span>
              )}
              {post.publishedAt && (
                <span>Published: {new Date(post.publishedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Platform Tabs */}
          {post.platforms.length > 1 ? (
            <Tabs 
              value={activePlatform} 
              onValueChange={setSelectedPlatform}
            >
              <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                {post.platforms.map((platform) => {
                  const Icon = platformIcons[platform as keyof typeof platformIcons] || MessageCircle
                  return (
                    <TabsTrigger key={platform} value={platform} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{platform}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
              
              {post.platforms.map((platform) => (
                <TabsContent key={platform} value={platform}>
                  {renderPlatformPreview(platform)}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            renderPlatformPreview(firstPlatform)
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}