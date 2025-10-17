'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Download,
  Share,
  Subtitles,
  List
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  videoId: string
  videoUrl: string
  title: string
  description?: string
  thumbnailUrl?: string
  duration?: number
  chapters?: Array<{
    id: string
    title: string
    startTime: number
    endTime: number
  }>
  transcript?: string
  className?: string
  autoplay?: boolean
  controls?: boolean
  showChapters?: boolean
  showTranscript?: boolean
  allowDownload?: boolean
  allowShare?: boolean
  onTimeUpdate?: (currentTime: number) => void
  onProgress?: (progress: number) => void
}

export default function VideoPlayer({
  videoId,
  videoUrl,
  title,
  description,
  thumbnailUrl,
  duration = 0,
  chapters = [],
  transcript,
  className,
  autoplay = false,
  controls = true,
  showChapters = true,
  showTranscript = false,
  allowDownload = true,
  allowShare = true,
  onTimeUpdate,
  onProgress
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [quality, setQuality] = useState('auto')
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [showChapterList, setShowChapterList] = useState(false)
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadStart = () => setLoading(true)
    const handleCanPlay = () => setLoading(false)
    const handleTimeUpdate = () => {
      const currentTime = video.currentTime
      setCurrentTime(currentTime)
      onTimeUpdate?.(currentTime)
    }
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const progress = (video.buffered.end(0) / video.duration) * 100
        onProgress?.(progress)
      }
    }
    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('progress', handleProgress)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('progress', handleProgress)
      video.removeEventListener('ended', handleEnded)
    }
  }, [onTimeUpdate, onProgress])

  useEffect(() => {
    let timeout: NodeJS.Timeout

    const handleMouseMove = () => {
      setShowControls(true)
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false)
        }
      }, 3000)
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      container.addEventListener('mouseleave', () => {
        if (isPlaying) {
          setShowControls(false)
        }
      })
    }

    return () => {
      clearTimeout(timeout)
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove)
      }
    }
  }, [isPlaying])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const newTime = (value[0] / 100) * duration
    video.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = value[0]
    video.volume = newVolume / 100
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume / 100
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen()
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
    setIsFullscreen(!isFullscreen)
  }

  const skipTime = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
  }

  const jumpToChapter = (startTime: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = startTime
    setCurrentTime(startTime)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getCurrentChapter = () => {
    return chapters.find(chapter =>
      currentTime >= chapter.startTime && currentTime <= chapter.endTime
    )
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
      <div
        ref={containerRef}
        className="relative w-full aspect-video cursor-pointer"
        onClick={togglePlay}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src={videoUrl}
          poster={thumbnailUrl}
          className="w-full h-full object-contain"
          autoPlay={autoplay}
          muted={isMuted}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setCurrentTime(0)
            }
          }}
        />

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}

        {/* Play Button Overlay */}
        {!isPlaying && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full w-16 h-16"
              onClick={(e) => {
                e.stopPropagation()
                togglePlay()
              }}
            >
              <Play className="h-8 w-8 ml-1" />
            </Button>
          </div>
        )}

        {/* Current Chapter Badge */}
        {getCurrentChapter() && (
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="bg-black/80 text-white">
              {getCurrentChapter()?.title}
            </Badge>
          </div>
        )}

        {/* Controls */}
        {controls && (
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300',
              showControls ? 'opacity-100' : 'opacity-0'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress Bar */}
            <div className="mb-4">
              <Slider
                value={[progressPercentage]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="w-full"
              />
              {/* Chapter markers */}
              {chapters.map((chapter) => {
                const markerPosition = (chapter.startTime / duration) * 100
                return (
                  <div
                    key={chapter.id}
                    className="absolute top-0 w-0.5 h-2 bg-yellow-500 transform -translate-x-0.5"
                    style={{ left: `${markerPosition}%` }}
                    title={chapter.title}
                  />
                )
              })}
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={togglePlay}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => skipTime(-10)}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={() => skipTime(10)}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={toggleMute}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="w-20">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                    />
                  </div>
                </div>

                <div className="text-white text-sm ml-4">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {showChapters && chapters.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={() => setShowChapterList(!showChapterList)}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                )}

                {transcript && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
                  >
                    <Subtitles className="h-4 w-4" />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setPlaybackSpeed(0.5)}>
                      Speed: 0.5x
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPlaybackSpeed(1)}>
                      Speed: 1x
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPlaybackSpeed(1.25)}>
                      Speed: 1.25x
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPlaybackSpeed(1.5)}>
                      Speed: 1.5x
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPlaybackSpeed(2)}>
                      Speed: 2x
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setQuality('360p')}>
                      Quality: 360p
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuality('720p')}>
                      Quality: 720p
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuality('1080p')}>
                      Quality: 1080p
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQuality('auto')}>
                      Quality: Auto
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {allowShare && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    <Share className="h-4 w-4" />
                  </Button>
                )}

                {allowDownload && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chapter List Panel */}
      {showChapterList && chapters.length > 0 && (
        <Card className="absolute top-0 right-0 w-80 max-h-96 overflow-y-auto bg-white/95 backdrop-blur">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Chapters</h3>
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  className={cn(
                    'w-full text-left p-2 rounded hover:bg-gray-100 transition-colors',
                    currentTime >= chapter.startTime && currentTime <= chapter.endTime &&
                    'bg-blue-100 border-l-4 border-blue-500'
                  )}
                  onClick={() => jumpToChapter(chapter.startTime)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{chapter.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(chapter.startTime)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Transcript Panel */}
      {showTranscriptPanel && transcript && (
        <Card className="absolute top-0 right-0 w-96 max-h-96 overflow-y-auto bg-white/95 backdrop-blur">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Transcript</h3>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {transcript}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}