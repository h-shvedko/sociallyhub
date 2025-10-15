"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PostComposer from "@/components/posts/post-composer"
import PostPreviewModal from "@/components/posts/post-preview-modal"
import { 
  Plus, 
  Calendar, 
  Send, 
  Edit, 
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Image,
  Video,
  Archive,
  ArchiveRestore
} from "lucide-react"
import { Input } from "@/components/ui/input"

interface Post {
  id: string
  title: string | null
  baseContent: string | null
  status: string
  ownerId: string
  owner: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  approver?: {
    id: string
    name: string | null
    email: string
  } | null
  scheduledAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  tags: string[]
  campaign?: {
    id: string
    name: string
  } | null
  platforms: string[]
  variants: any[]
  media: any[]
  metrics: Record<string, number>
}

const statusStyles = {
  DRAFT: { color: "bg-gray-100 text-gray-800", icon: Edit },
  SCHEDULED: { color: "bg-blue-100 text-blue-800", icon: Clock },
  PUBLISHED: { color: "bg-green-100 text-green-800", icon: CheckCircle },
  FAILED: { color: "bg-red-100 text-red-800", icon: AlertCircle },
  ARCHIVED: { color: "bg-yellow-100 text-yellow-800", icon: Archive }
}

export default function PostsPage() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("all")
  const [showComposer, setShowComposer] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [previewPost, setPreviewPost] = useState<Post | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  // Fetch posts from API
  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/posts?status=${activeTab === 'all' ? '' : activeTab}`)
      if (response.ok) {
        const data = await response.json()
        setPosts(data.posts || [])
      } else {
        console.error('Failed to fetch posts:', response.statusText)
        setPosts([])
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  // Load posts on component mount and when activeTab changes
  useEffect(() => {
    fetchPosts()
  }, [activeTab])

  // Get workspaceId from session or API when session is available
  useEffect(() => {
    const getWorkspaceId = async () => {
      console.log('🔍 Session state:', {
        hasSession: !!session,
        userId: session?.user?.id,
        sessionWorkspaceId: session?.user?.workspaceId
      })

      if (!session?.user?.id) {
        console.log('❌ No session or user ID, skipping workspace fetch')
        return
      }

      try {
        // Try to get from session first
        if (session.user.workspaceId) {
          console.log('✅ Using workspaceId from session:', session.user.workspaceId)
          setWorkspaceId(session.user.workspaceId)
          return
        }

        // Fetch from API
        console.log('🔄 Fetching workspaceId from API...')
        const response = await fetch('/api/user/workspace')
        if (response.ok) {
          const data = await response.json()
          console.log('✅ Received workspaceId from API:', data.workspaceId)
          setWorkspaceId(data.workspaceId)
        } else {
          console.error('❌ API error:', response.status, response.statusText)
          // Final fallback: use the demo workspace ID
          console.log('🚧 Using final fallback demo workspace')
          setWorkspaceId('demo-workspace')
        }
      } catch (error) {
        console.error('❌ Error getting workspaceId:', error)
        // Final fallback: use the demo workspace ID
        console.log('🚧 Using final fallback demo workspace due to error')
        setWorkspaceId('demo-workspace')
      }
    }

    getWorkspaceId()
  }, [session])

  // Check for compose parameter to auto-open composer
  useEffect(() => {
    const shouldCompose = searchParams.get('compose')
    if (shouldCompose === 'true') {
      setShowComposer(true)
      // Clean up the URL parameter
      window.history.replaceState({}, '', '/dashboard/posts')
    }
  }, [searchParams])

  const handlePostSave = async (postData: any) => {
    try {
      const isEditing = postData.id
      const url = isEditing ? `/api/posts/${postData.id}` : '/api/posts'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      })
      
      if (response.ok) {
        setShowComposer(false)
        setEditingPost(null)
        await fetchPosts() // Refresh posts list
      } else {
        const error = await response.json()
        console.error('Failed to save post:', error)
        // TODO: Show error message to user
      }
    } catch (error) {
      console.error('Error saving post:', error)
      // TODO: Show error message to user
    }
  }

  const handlePostSchedule = async (postData: any, scheduledTime: Date) => {
    try {
      const isEditing = postData.id
      const url = isEditing ? `/api/posts/${postData.id}` : '/api/posts'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...postData,
          status: 'SCHEDULED',
          scheduledAt: scheduledTime.toISOString(),
        }),
      })
      
      if (response.ok) {
        setShowComposer(false)
        setEditingPost(null)
        await fetchPosts()
      } else {
        const error = await response.json()
        console.error('Failed to schedule post:', error)
      }
    } catch (error) {
      console.error('Error scheduling post:', error)
    }
  }

  const handlePostPublish = async (postData: any) => {
    try {
      const isEditing = postData.id
      const url = isEditing ? `/api/posts/${postData.id}` : '/api/posts'
      const method = isEditing ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...postData,
          status: 'PUBLISHED',
        }),
      })
      
      if (response.ok) {
        setShowComposer(false)
        setEditingPost(null)
        await fetchPosts()
      } else {
        const error = await response.json()
        console.error('Failed to publish post:', error)
      }
    } catch (error) {
      console.error('Error publishing post:', error)
    }
  }

  // Handle post actions
  const handleEditPost = (post: Post) => {
    setEditingPost(post)
    setShowComposer(true)
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return
    
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        await fetchPosts()
      } else {
        const error = await response.json()
        console.error('Failed to delete post:', error)
      }
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  const handlePreviewPost = (post: Post) => {
    setPreviewPost(post)
  }

  const handleArchivePost = async (postId: string) => {
    if (!confirm('Are you sure you want to archive this post?')) return
    
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      })
      
      if (response.ok) {
        await fetchPosts()
      } else {
        const error = await response.json()
        console.error('Failed to archive post:', error)
      }
    } catch (error) {
      console.error('Error archiving post:', error)
    }
  }

  const handleUnarchivePost = async (postId: string) => {
    if (!confirm('Are you sure you want to restore this post from archive?')) return
    
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'DRAFT' }),
      })
      
      if (response.ok) {
        await fetchPosts()
      } else {
        const error = await response.json()
        console.error('Failed to unarchive post:', error)
      }
    } catch (error) {
      console.error('Error unarchiving post:', error)
    }
  }

  const filteredPosts = posts.filter(post => {
    const content = post.baseContent || ''
    const title = post.title || ''
    const matchesSearch = content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         title.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  if (showComposer) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setShowComposer(false)}
            className="mb-4"
          >
            ← Back to Posts
          </Button>
          <h1 className="text-3xl font-bold">
            {editingPost ? "Edit Post" : "Create New Post"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {editingPost ? "Update your post content and settings" : "Compose and schedule content for your social media platforms"}
          </p>
        </div>

        {!workspaceId ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading workspace...</p>
            </div>
          </div>
        ) : (
          <PostComposer
            initialContent={editingPost?.baseContent || ""}
            initialTitle={editingPost?.title || ""}
            initialPlatforms={editingPost?.platforms || []}
            initialMedia={editingPost?.media || []}
            editMode={!!editingPost}
            postId={editingPost?.id}
            workspaceId={workspaceId}
            onSave={handlePostSave}
            onSchedule={handlePostSchedule}
            onPublish={handlePostPublish}
          />
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Posts</h1>
          <p className="text-muted-foreground mt-2">
            Manage your social media content and campaigns
          </p>
        </div>
        <Button onClick={() => setShowComposer(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Post
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Posts</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Posts Grid */}
          <div className="grid gap-6">
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-muted-foreground">Loading posts...</div>
                </CardContent>
              </Card>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => {
                const StatusIcon = statusStyles[post.status as keyof typeof statusStyles]?.icon || Edit
                
                return (
                  <Card key={post.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-semibold text-lg">{post.title || 'Untitled Post'}</h3>
                            <Badge className={statusStyles[post.status as keyof typeof statusStyles]?.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {post.status}
                            </Badge>
                          </div>
                          
                          <p className="text-muted-foreground mb-4 line-clamp-2">
                            {post.baseContent || 'No content'}
                          </p>
                          
                          {/* Enhanced Media Preview */}
                          {post.media && post.media.length > 0 && (
                            <div className="mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Image className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground font-medium">
                                  {post.media.length} {post.media.length === 1 ? 'attachment' : 'attachments'}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-3 max-w-md">
                                {post.media.slice(0, 4).map((mediaItem: any, index: number) => (
                                  <div 
                                    key={mediaItem.id || index} 
                                    className="rounded-xl border bg-card text-card-foreground shadow-sm relative group aspect-square overflow-hidden"
                                  >
                                    {mediaItem.mimeType?.startsWith('image/') ? (
                                      <img
                                        src={mediaItem.thumbnailUrl || mediaItem.url}
                                        alt={mediaItem.originalName || 'Post image'}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                                      <div className="relative w-full h-full group-hover:scale-105 transition-transform duration-300">
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
                                              <div className="bg-black/60 rounded-full p-2">
                                                <Video className="h-4 w-4 text-white" />
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-1">
                                              <Video className="h-6 w-6 text-blue-600" />
                                              <span className="text-xs text-blue-600 font-medium">Video</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                                        <div className="flex flex-col items-center gap-1">
                                          <Image className="h-6 w-6 text-gray-600" />
                                          <span className="text-xs text-gray-600 font-medium">File</span>
                                        </div>
                                      </div>
                                    )}
                                    {post.media.length > 4 && index === 3 && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                        <div className="text-center">
                                          <span className="text-white text-sm font-semibold block">
                                            +{post.media.length - 4}
                                          </span>
                                          <span className="text-white/80 text-xs">more</span>
                                        </div>
                                      </div>
                                    )}
                                    {/* Hover overlay for images and videos with thumbnails */}
                                    {(mediaItem.mimeType?.startsWith('image/') || (mediaItem.mimeType?.startsWith('video/') && mediaItem.thumbnailUrl)) && (
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <div className="bg-white/90 rounded-full p-2">
                                          <Eye className="h-4 w-4 text-gray-700" />
                                        </div>
                                      </div>
                                    )}
                                    {/* Media type indicator */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-md font-medium">
                                        {mediaItem.mimeType?.startsWith('image/') ? 'IMG' : 
                                         mediaItem.mimeType?.startsWith('video/') ? 'VID' : 'FILE'}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span>Platforms:</span>
                              <div className="flex gap-1">
                                {post.platforms.map((platform) => (
                                  <Badge key={platform} variant="outline" className="text-xs">
                                    {platform}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            {post.scheduledAt && (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {new Date(post.scheduledAt).toLocaleString()}
                                </span>
                              </div>
                            )}
                            
                            {post.publishedAt && (
                              <div className="flex items-center gap-1">
                                <Send className="h-4 w-4" />
                                <span>
                                  Published {new Date(post.publishedAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Metrics */}
                          {Object.keys(post.metrics).length > 0 && (
                            <div className="flex gap-6 mt-4 pt-4 border-t">
                              {post.metrics.reach && (
                                <div className="text-center">
                                  <div className="font-semibold">{Math.floor(post.metrics.reach).toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">Reach</div>
                                </div>
                              )}
                              {post.metrics.engagement && (
                                <div className="text-center">
                                  <div className="font-semibold">{Math.floor(post.metrics.engagement).toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">Engagement</div>
                                </div>
                              )}
                              {post.metrics.clicks && (
                                <div className="text-center">
                                  <div className="font-semibold">{Math.floor(post.metrics.clicks)}</div>
                                  <div className="text-xs text-muted-foreground">Clicks</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex lg:flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex items-center gap-2"
                            onClick={() => handlePreviewPost(post)}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex items-center gap-2"
                            onClick={() => handleEditPost(post)}
                            disabled={post.status === 'PUBLISHED'}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex items-center gap-2 text-red-600 hover:text-red-700"
                            onClick={() => handleDeletePost(post.id)}
                            disabled={post.status === 'PUBLISHED' || post.status === 'ARCHIVED'}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                          {post.status === 'ARCHIVED' ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                              onClick={() => handleUnarchivePost(post.id)}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                              Restore
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex items-center gap-2 text-yellow-600 hover:text-yellow-700"
                              onClick={() => handleArchivePost(post.id)}
                            >
                              <Archive className="h-4 w-4" />
                              Archive
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-muted-foreground">
                    {searchQuery ? "No posts match your search." : "No posts found."}
                  </div>
                  <Button 
                    onClick={() => setShowComposer(true)}
                    className="mt-4"
                  >
                    Create your first post
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Post Preview Modal */}
      <PostPreviewModal
        post={previewPost}
        isOpen={!!previewPost}
        onClose={() => setPreviewPost(null)}
      />
    </div>
  )
}