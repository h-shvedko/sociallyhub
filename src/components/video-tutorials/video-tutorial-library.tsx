"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { VisuallyHidden } from '@/components/ui/visually-hidden'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VideoPlayerModal } from './video-player-modal'
import {
  Play,
  Search,
  Filter,
  Clock,
  Star,
  Eye,
  BookOpen,
  Video,
  Users,
  TrendingUp,
  X
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

interface Category {
  slug: string
  name: string
  icon?: string
  count: number
}

interface VideoTutorialLibraryProps {
  isOpen: boolean
  onClose: () => void
}

export function VideoTutorialLibrary({ isOpen, onClose }: VideoTutorialLibraryProps) {
  const [tutorials, setTutorials] = useState<VideoTutorial[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTutorial, setSelectedTutorial] = useState<VideoTutorial | null>(null)
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchTutorials()
    }
  }, [isOpen, selectedCategory])

  const fetchTutorials = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') {
        params.append('categorySlug', selectedCategory)
      }

      const response = await fetch(`/api/video-tutorials?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTutorials(data.tutorials || [])

        // Extract categories from tutorials
        const categoryMap = new Map<string, Category>()
        categoryMap.set('all', { slug: 'all', name: 'All Videos', count: data.tutorials?.length || 0 })

        data.tutorials?.forEach((tutorial: VideoTutorial) => {
          const { slug, name, icon } = tutorial.category
          if (categoryMap.has(slug)) {
            categoryMap.get(slug)!.count++
          } else {
            categoryMap.set(slug, { slug, name, icon, count: 1 })
          }
        })

        setCategories(Array.from(categoryMap.values()))
      }
    } catch (error) {
      console.error('Failed to fetch tutorials:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTutorials = tutorials.filter(tutorial =>
    searchQuery === '' ||
    tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleTutorialClick = (tutorial: VideoTutorial) => {
    setSelectedTutorial(tutorial)
    setIsPlayerOpen(true)
  }

  const handleProgressUpdate = (progress: any) => {
    // Update tutorial progress in the list
    setTutorials(prev => prev.map(tutorial =>
      tutorial.id === selectedTutorial?.id
        ? { ...tutorial, userProgress: [progress] }
        : tutorial
    ))
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl w-full h-[90vh] p-0 gap-0">
          <VisuallyHidden>
            <DialogTitle>Video Tutorial Library</DialogTitle>
            <DialogDescription>
              Browse and watch video tutorials organized by category
            </DialogDescription>
          </VisuallyHidden>

          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Video className="h-6 w-6 text-blue-600" />
                  <h2 className="text-2xl font-bold">Video Tutorial Library</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Search */}
              <div className="flex gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tutorials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4" />
                  {filteredTutorials.length} tutorials
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="h-full">
                {/* Category Tabs */}
                <div className="border-b bg-gray-50 px-6">
                  <TabsList className="h-12">
                    {categories.map((category) => (
                      <TabsTrigger
                        key={category.slug}
                        value={category.slug}
                        className="flex items-center gap-2"
                      >
                        {category.icon && <span>{category.icon}</span>}
                        {category.name}
                        <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">
                          {category.count}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* Tutorial Grid */}
                <TabsContent value={selectedCategory} className="p-6 h-full overflow-auto m-0">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading tutorials...</p>
                      </div>
                    </div>
                  ) : filteredTutorials.length === 0 ? (
                    <div className="text-center py-12">
                      <Video className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No tutorials found</h3>
                      <p className="text-gray-600">
                        {searchQuery ? 'Try adjusting your search terms' : 'No tutorials available in this category'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTutorials.map((tutorial) => {
                        const userProgress = tutorial.userProgress?.[0]
                        const progressPercentage = userProgress && tutorial.duration
                          ? (userProgress.lastPosition / tutorial.duration) * 100
                          : 0

                        return (
                          <div
                            key={tutorial.id}
                            className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => handleTutorialClick(tutorial)}
                          >
                            {/* Thumbnail */}
                            <div className="relative aspect-video bg-gray-100 rounded-t-lg overflow-hidden">
                              {tutorial.thumbnailUrl ? (
                                <img
                                  src={tutorial.thumbnailUrl}
                                  alt={tutorial.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                  <Video className="h-12 w-12 text-white" />
                                </div>
                              )}

                              {/* Play Overlay */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <div className="bg-white/90 group-hover:bg-white rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform">
                                  <Play className="h-6 w-6 text-gray-900 ml-0.5" />
                                </div>
                              </div>

                              {/* Duration */}
                              {tutorial.duration && (
                                <div className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
                                  {formatDuration(tutorial.duration)}
                                </div>
                              )}

                              {/* Progress Bar */}
                              {progressPercentage > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                                  <div
                                    className="h-full bg-blue-500"
                                    style={{ width: `${progressPercentage}%` }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                                  {tutorial.title}
                                </h3>
                                {userProgress?.isCompleted && (
                                  <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded ml-2 flex-shrink-0">
                                    Completed
                                  </div>
                                )}
                              </div>

                              {tutorial.description && (
                                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                                  {tutorial.description}
                                </p>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {tutorial.views.toLocaleString()}
                                </span>
                                {tutorial.averageRating && (
                                  <span className="flex items-center gap-1">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    {tutorial.averageRating.toFixed(1)}
                                  </span>
                                )}
                                {tutorial.authorName && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {tutorial.authorName}
                                  </span>
                                )}
                              </div>

                              {/* Tags and Difficulty */}
                              <div className="flex items-center justify-between">
                                <div className="flex flex-wrap gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getDifficultyColor(tutorial.difficulty)}`}
                                  >
                                    {tutorial.difficulty}
                                  </Badge>
                                  {tutorial.tags.slice(0, 2).map((tag, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {tutorial.tags.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{tutorial.tags.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        tutorial={selectedTutorial}
        onProgressUpdate={handleProgressUpdate}
      />
    </>
  )
}