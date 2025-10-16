"use client"

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Star,
  Clock,
  Eye,
  ThumbsUp,
  X,
  ExternalLink
} from 'lucide-react'

interface VideoTutorial {
  id: string
  title: string
  slug: string
  description?: string
  thumbnailUrl?: string
  videoUrl: string
  videoPlatform: string
  videoId?: string
  duration?: number
  difficulty: string
  tags: string[]
  transcript?: string
  views: number
  likes: number
  averageRating?: number
  authorName?: string
  authorAvatar?: string
  publishedAt?: string
  category: {
    name: string
    slug: string
    icon?: string
  }
  userProgress?: {
    watchTime: number
    lastPosition: number
    isCompleted: boolean
    rating?: number
    feedback?: string
    updatedAt: string
  }[]
}

interface VideoPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  tutorial: VideoTutorial | null
  onProgressUpdate?: (progress: any) => void
}

export function VideoPlayerModal({
  isOpen,
  onClose,
  tutorial,
  onProgressUpdate
}: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [userRating, setUserRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  const videoRef = useRef<HTMLIFrameElement>(null)
  const progressInterval = useRef<NodeJS.Timeout>()

  const userProgress = tutorial?.userProgress?.[0]

  useEffect(() => {
    if (tutorial && userProgress) {
      setCurrentTime(userProgress.lastPosition)
      setUserRating(userProgress.rating || null)
      setFeedback(userProgress.feedback || '')
    }
  }, [tutorial, userProgress])

  // Progress tracking
  useEffect(() => {
    if (isPlaying && tutorial) {
      progressInterval.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1

          // Update progress every 10 seconds
          if (newTime % 10 === 0) {
            updateProgress({
              watchTime: newTime,
              lastPosition: newTime,
              isCompleted: duration > 0 && newTime >= duration * 0.9
            })
          }

          return newTime
        })
      }, 1000)
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [isPlaying, tutorial, duration])

  const updateProgress = async (progressData: any) => {
    if (!tutorial) return

    try {
      const response = await fetch(`/api/video-tutorials/${tutorial.slug}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      })

      if (response.ok) {
        const updatedProgress = await response.json()
        onProgressUpdate?.(updatedProgress)
      }
    } catch (error) {
      console.error('Failed to update progress:', error)
    }
  }

  const submitRating = async () => {
    if (!tutorial || !userRating) return

    await updateProgress({
      rating: userRating,
      feedback: feedback.trim() || null
    })

    setShowFeedback(false)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getVideoEmbedUrl = (tutorial: VideoTutorial) => {
    if (tutorial.videoPlatform === 'youtube' && tutorial.videoId) {
      return `https://www.youtube.com/embed/${tutorial.videoId}?enablejsapi=1&origin=${window.location.origin}`
    }
    if (tutorial.videoPlatform === 'vimeo' && tutorial.videoId) {
      return `https://player.vimeo.com/video/${tutorial.videoId}`
    }
    return tutorial.videoUrl
  }

  const openExternalVideo = () => {
    if (tutorial) {
      window.open(tutorial.videoUrl, '_blank')
    }
  }

  if (!tutorial) return null

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  const userProgressPercentage = userProgress && tutorial.duration
    ? (userProgress.lastPosition / tutorial.duration) * 100
    : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0">
        <VisuallyHidden>
          <DialogTitle>{tutorial.title}</DialogTitle>
          <DialogDescription>
            Video tutorial: {tutorial.description}
          </DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col h-[80vh]">
          {/* Video Player */}
          <div className="relative bg-black aspect-video">
            <iframe
              ref={videoRef}
              src={getVideoEmbedUrl(tutorial)}
              title={tutorial.title}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />

            {/* External Link Button */}
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 opacity-75 hover:opacity-100"
              onClick={openExternalVideo}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in {tutorial.videoPlatform}
            </Button>

            {/* Progress Bar */}
            {userProgressPercentage > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${userProgressPercentage}%` }}
                />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{tutorial.title}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <Badge variant="outline">
                    {tutorial.difficulty}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {tutorial.duration ? formatDuration(tutorial.duration) : 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {tutorial.views.toLocaleString()} views
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-4 w-4" />
                    {tutorial.likes.toLocaleString()}
                  </span>
                  {tutorial.averageRating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      {tutorial.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Author */}
                {tutorial.authorName && (
                  <div className="flex items-center gap-2 mb-4">
                    {tutorial.authorAvatar && (
                      <img
                        src={tutorial.authorAvatar}
                        alt={tutorial.authorName}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-sm font-medium">{tutorial.authorName}</span>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="feedback">Rate & Review</TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-4">
                <div className="space-y-4">
                  {tutorial.description && (
                    <div>
                      <h3 className="font-semibold mb-2">About this tutorial</h3>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {tutorial.description}
                      </p>
                    </div>
                  )}

                  {tutorial.tags.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {tutorial.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="mt-4">
                {tutorial.transcript ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Video Transcript</h3>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-auto">
                      {tutorial.transcript}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No transcript available for this video.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="feedback" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Rate this tutorial</h3>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setUserRating(rating)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              userRating && rating <= userRating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Leave feedback (optional)</h3>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Share your thoughts about this tutorial..."
                      rows={4}
                    />
                  </div>

                  <Button
                    onClick={submitRating}
                    disabled={!userRating}
                    className="w-full"
                  >
                    Submit Rating
                  </Button>

                  {userProgress?.rating && (
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✓ You rated this tutorial {userProgress.rating} stars
                        {userProgress.feedback && (
                          <span className="block mt-1 text-green-600">
                            "{userProgress.feedback}"
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}