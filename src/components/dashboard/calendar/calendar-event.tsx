"use client"

import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Circle,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube
} from "lucide-react"

interface Post {
  id: string
  title: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  scheduledAt: string | null
  platforms: string[]
}

interface CalendarEventProps {
  post: Post
  compact?: boolean
  detailed?: boolean
}

const statusConfig = {
  DRAFT: {
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Circle,
    label: 'Draft'
  },
  SCHEDULED: {
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock,
    label: 'Scheduled'
  },
  PUBLISHED: {
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
    label: 'Published'
  },
  FAILED: {
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
    label: 'Failed'
  }
}

const platformIcons = {
  TWITTER: Twitter,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
  YOUTUBE: Youtube,
  TIKTOK: Circle // Default for TikTok
}

export function CalendarEvent({ post, compact = false, detailed = false }: CalendarEventProps) {
  const status = statusConfig[post.status]
  const StatusIcon = status.icon

  if (compact) {
    return (
      <div
        className={cn(
          "text-xs p-2 rounded-md border cursor-pointer hover:shadow-sm transition-all duration-200",
          status.color
        )}
      >
        <div className="flex items-center gap-1 mb-1">
          <StatusIcon className="h-3 w-3 shrink-0" />
          <span className="font-medium truncate">{post.title || 'Untitled'}</span>
        </div>
        {post.scheduledAt && (
          <div className="text-xs opacity-70">
            {format(new Date(post.scheduledAt), 'HH:mm')}
          </div>
        )}
      </div>
    )
  }

  if (detailed) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-medium text-sm leading-tight">{post.title || 'Untitled'}</h4>
            <Badge variant="outline" className={cn("text-xs", status.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          
          {post.scheduledAt && (
            <div className="text-xs text-muted-foreground mb-2">
              {format(new Date(post.scheduledAt), 'MMM dd, HH:mm')}
            </div>
          )}
          
          <div className="flex items-center gap-1 flex-wrap">
            {post.platforms.map((platform) => {
              const PlatformIcon = platformIcons[platform as keyof typeof platformIcons] || Circle
              return (
                <div
                  key={platform}
                  className="flex items-center gap-1 text-xs bg-muted/30 rounded px-2 py-1"
                >
                  <PlatformIcon className="h-3 w-3" />
                  {platform.toLowerCase()}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default view
  return (
    <div
      className={cn(
        "text-xs p-2 rounded-md border cursor-pointer hover:shadow-sm transition-all duration-200 mb-1",
        status.color
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        <StatusIcon className="h-3 w-3 shrink-0" />
        <span className="font-medium truncate">{post.title || 'Untitled'}</span>
      </div>
      
      <div className="flex items-center justify-between">
        {post.scheduledAt && (
          <div className="text-xs opacity-70">
            {format(new Date(post.scheduledAt), 'HH:mm')}
          </div>
        )}
        <div className="flex items-center gap-1">
          {post.platforms.slice(0, 3).map((platform) => {
            const PlatformIcon = platformIcons[platform as keyof typeof platformIcons] || Circle
            return (
              <PlatformIcon
                key={platform}
                className="h-3 w-3 opacity-60"
                title={platform}
              />
            )
          })}
          {post.platforms.length > 3 && (
            <span className="text-xs opacity-60">+{post.platforms.length - 3}</span>
          )}
        </div>
      </div>
    </div>
  )
}