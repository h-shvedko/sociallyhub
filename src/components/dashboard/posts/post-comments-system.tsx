"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  MessageSquare,
  Send,
  Reply,
  Heart,
  Flag,
  MoreHorizontal,
  Pin,
  Edit,
  Trash2,
  User,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Search,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Bookmark,
  AtSign,
  Hash,
  Image as ImageIcon,
  Smile,
  Paperclip
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

interface Comment {
  id: string
  content: string
  author: {
    id: string
    name: string
    email: string
    image?: string
    role?: string
  }
  postId: string
  parentId?: string // For nested replies
  createdAt: Date
  updatedAt?: Date
  isEdited: boolean
  status: 'active' | 'hidden' | 'reported' | 'deleted'
  isPinned: boolean
  likes: number
  dislikes: number
  hasLiked?: boolean
  hasDisliked?: boolean
  replies: Comment[]
  mentions: string[]
  hashtags: string[]
  attachments?: Array<{
    id: string
    type: 'image' | 'file' | 'link'
    url: string
    name: string
    size?: number
  }>
  metadata?: {
    platform?: string
    ipAddress?: string
    userAgent?: string
    location?: string
  }
}

interface Post {
  id: string
  title: string
  content: string
  author: {
    id: string
    name: string
    image?: string
  }
  status: string
  commentsEnabled: boolean
  commentsCount: number
  createdAt: Date
}

interface CommentSettings {
  allowComments: boolean
  requireModeration: boolean
  allowReplies: boolean
  allowReactions: boolean
  allowAttachments: boolean
  maxDepth: number
  wordFilter: string[]
  blockedUsers: string[]
}

interface PostCommentsSystemProps {
  postId: string
  initialComments?: Comment[]
  currentUserId?: string
  isAdmin?: boolean
  onCommentChange?: (count: number) => void
}

export function PostCommentsSystem({ 
  postId, 
  initialComments = [],
  currentUserId = "current-user",
  isAdmin = false,
  onCommentChange 
}: PostCommentsSystemProps) {
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [settings, setSettings] = useState<CommentSettings>({
    allowComments: true,
    requireModeration: false,
    allowReplies: true,
    allowReactions: true,
    allowAttachments: true,
    maxDepth: 3,
    wordFilter: [],
    blockedUsers: []
  })
  
  const [newComment, setNewComment] = useState("")
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular' | 'controversial'>('newest')
  const [filterBy, setFilterBy] = useState<'all' | 'pinned' | 'reported'>('all')
  const [searchQuery, setSearchQuery] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadMockData()
  }, [postId])

  useEffect(() => {
    onCommentChange?.(comments.filter(c => c.status === 'active').length)
  }, [comments, onCommentChange])

  const loadMockData = () => {
    // Mock post data
    setPost({
      id: postId,
      title: "Spring Collection Campaign Launch",
      content: "🌸 Spring is here! Check out our new collection launching this weekend...",
      author: {
        id: "u1",
        name: "Sarah Johnson",
        image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face"
      },
      status: "published",
      commentsEnabled: true,
      commentsCount: 0,
      createdAt: new Date("2024-03-15T10:00:00")
    })

    // Mock comments data
    const mockComments: Comment[] = [
      {
        id: "c1",
        content: "Love this collection! The spring colors are absolutely perfect. Can't wait to see more pieces! 🌸✨",
        author: {
          id: "u2",
          name: "Emma Wilson",
          email: "emma@example.com",
          image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
          role: "Customer"
        },
        postId: postId,
        createdAt: new Date("2024-03-15T11:30:00"),
        isEdited: false,
        status: "active",
        isPinned: true,
        likes: 24,
        dislikes: 1,
        hasLiked: false,
        replies: [
          {
            id: "c1-r1",
            content: "Thank you Emma! We're so excited to share more pieces with you. Stay tuned for the full reveal! 💕",
            author: {
              id: "u1",
              name: "Sarah Johnson",
              email: "sarah@company.com",
              image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
              role: "Content Creator"
            },
            postId: postId,
            parentId: "c1",
            createdAt: new Date("2024-03-15T12:15:00"),
            isEdited: false,
            status: "active",
            isPinned: false,
            likes: 8,
            dislikes: 0,
            replies: [],
            mentions: ["Emma"],
            hashtags: []
          }
        ],
        mentions: [],
        hashtags: []
      },
      {
        id: "c2",
        content: "The photography in this campaign is stunning! Who was your photographer for this shoot? The lighting and composition are incredible. #SpringVibes #Photography",
        author: {
          id: "u3",
          name: "Mike Rodriguez",
          email: "mike@example.com",
          role: "Photographer"
        },
        postId: postId,
        createdAt: new Date("2024-03-15T13:45:00"),
        isEdited: false,
        status: "active",
        isPinned: false,
        likes: 16,
        dislikes: 0,
        replies: [],
        mentions: [],
        hashtags: ["SpringVibes", "Photography"]
      },
      {
        id: "c3", 
        content: "When will this collection be available in stores? I'm particularly interested in the floral dresses shown in image 2. Do you have sizing information available?",
        author: {
          id: "u4",
          name: "Lisa Chen",
          email: "lisa@example.com",
          image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=32&h=32&fit=crop&crop=face",
          role: "Customer"
        },
        postId: postId,
        createdAt: new Date("2024-03-15T14:20:00"),
        isEdited: false,
        status: "active",
        isPinned: false,
        likes: 12,
        dislikes: 0,
        replies: [
          {
            id: "c3-r1",
            content: "Hi Lisa! The collection launches this Saturday in all our stores and online. Sizing info will be available on our website tomorrow. Thanks for your interest! 😊",
            author: {
              id: "u5",
              name: "Customer Service",
              email: "support@company.com",
              role: "Support"
            },
            postId: postId,
            parentId: "c3",
            createdAt: new Date("2024-03-15T15:00:00"),
            isEdited: false,
            status: "active",
            isPinned: false,
            likes: 5,
            dislikes: 0,
            replies: [],
            mentions: ["Lisa"],
            hashtags: []
          }
        ],
        mentions: [],
        hashtags: []
      },
      {
        id: "c4",
        content: "This looks amazing but the prices seem a bit steep for the quality. Are there any discount codes available for first-time buyers?",
        author: {
          id: "u6",
          name: "Anonymous User",
          email: "anon@example.com",
          role: "Customer"
        },
        postId: postId,
        createdAt: new Date("2024-03-15T16:10:00"),
        isEdited: false,
        status: "active",
        isPinned: false,
        likes: 3,
        dislikes: 8,
        replies: [],
        mentions: [],
        hashtags: []
      },
      {
        id: "c5",
        content: "Absolutely love the sustainable approach you're taking with this collection! The eco-friendly materials and ethical production really matter. Keep up the great work! 🌱♻️",
        author: {
          id: "u7",
          name: "Green Fashion Advocate",
          email: "eco@example.com",
          role: "Influencer"
        },
        postId: postId,
        createdAt: new Date("2024-03-15T17:30:00"),
        isEdited: false,
        status: "active",
        isPinned: false,
        likes: 31,
        dislikes: 2,
        replies: [],
        mentions: [],
        hashtags: []
      }
    ]

    setComments(mockComments)
  }

  const handleSubmitComment = () => {
    if (!newComment.trim() || !post?.commentsEnabled) return

    const comment: Comment = {
      id: Date.now().toString(),
      content: newComment,
      author: {
        id: currentUserId,
        name: "Current User",
        email: "user@example.com",
        role: "User"
      },
      postId: postId,
      parentId: replyTo,
      createdAt: new Date(),
      isEdited: false,
      status: settings.requireModeration ? 'hidden' : 'active',
      isPinned: false,
      likes: 0,
      dislikes: 0,
      replies: [],
      mentions: extractMentions(newComment),
      hashtags: extractHashtags(newComment)
    }

    if (replyTo) {
      // Add as reply to existing comment
      setComments(prev => prev.map(c => 
        c.id === replyTo 
          ? { ...c, replies: [...c.replies, comment] }
          : c
      ))
    } else {
      // Add as top-level comment
      setComments(prev => [comment, ...prev])
    }

    setNewComment("")
    setReplyTo(null)
    toast.success(settings.requireModeration ? "Comment submitted for moderation" : "Comment posted")
  }

  const handleLikeComment = (commentId: string, isReply = false, parentId?: string) => {
    if (isReply && parentId) {
      setComments(prev => prev.map(comment => 
        comment.id === parentId 
          ? {
              ...comment,
              replies: comment.replies.map(reply => 
                reply.id === commentId 
                  ? {
                      ...reply,
                      likes: reply.hasLiked ? reply.likes - 1 : reply.likes + 1,
                      hasLiked: !reply.hasLiked,
                      dislikes: reply.hasDisliked ? reply.dislikes - 1 : reply.dislikes,
                      hasDisliked: false
                    }
                  : reply
              )
            }
          : comment
      ))
    } else {
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? {
              ...comment,
              likes: comment.hasLiked ? comment.likes - 1 : comment.likes + 1,
              hasLiked: !comment.hasLiked,
              dislikes: comment.hasDisliked ? comment.dislikes - 1 : comment.dislikes,
              hasDisliked: false
            }
          : comment
      ))
    }
  }

  const handleDislikeComment = (commentId: string, isReply = false, parentId?: string) => {
    if (isReply && parentId) {
      setComments(prev => prev.map(comment => 
        comment.id === parentId 
          ? {
              ...comment,
              replies: comment.replies.map(reply => 
                reply.id === commentId 
                  ? {
                      ...reply,
                      dislikes: reply.hasDisliked ? reply.dislikes - 1 : reply.dislikes + 1,
                      hasDisliked: !reply.hasDisliked,
                      likes: reply.hasLiked ? reply.likes - 1 : reply.likes,
                      hasLiked: false
                    }
                  : reply
              )
            }
          : comment
      ))
    } else {
      setComments(prev => prev.map(comment => 
        comment.id === commentId 
          ? {
              ...comment,
              dislikes: comment.hasDisliked ? comment.dislikes - 1 : comment.dislikes + 1,
              hasDisliked: !comment.hasDisliked,
              likes: comment.hasLiked ? comment.likes - 1 : comment.likes,
              hasLiked: false
            }
          : comment
      ))
    }
  }

  const handlePinComment = (commentId: string) => {
    setComments(prev => prev.map(comment => 
      comment.id === commentId 
        ? { ...comment, isPinned: !comment.isPinned }
        : comment
    ))
    toast.success("Comment pinned status updated")
  }

  const handleDeleteComment = (commentId: string, isReply = false, parentId?: string) => {
    if (isReply && parentId) {
      setComments(prev => prev.map(comment => 
        comment.id === parentId 
          ? {
              ...comment,
              replies: comment.replies.filter(reply => reply.id !== commentId)
            }
          : comment
      ))
    } else {
      setComments(prev => prev.filter(comment => comment.id !== commentId))
    }
    toast.success("Comment deleted")
  }

  const handleReportComment = (commentId: string) => {
    setComments(prev => prev.map(comment => 
      comment.id === commentId 
        ? { ...comment, status: 'reported' }
        : comment
    ))
    toast.success("Comment reported for review")
  }

  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@(\w+)/g)
    return matches ? matches.map(match => match.slice(1)) : []
  }

  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#(\w+)/g)
    return matches ? matches.map(match => match.slice(1)) : []
  }

  const sortComments = (comments: Comment[]): Comment[] => {
    const sorted = [...comments].sort((a, b) => {
      // Always show pinned comments first
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      
      switch (sortBy) {
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime()
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime()
        case 'popular':
          return (b.likes - b.dislikes) - (a.likes - a.dislikes)
        case 'controversial':
          return (b.likes + b.dislikes) - (a.likes + a.dislikes)
        default:
          return 0
      }
    })
    
    return sorted
  }

  const filterComments = (comments: Comment[]): Comment[] => {
    let filtered = comments.filter(comment => {
      if (filterBy === 'pinned') return comment.isPinned
      if (filterBy === 'reported') return comment.status === 'reported'
      return comment.status === 'active'
    })

    if (searchQuery) {
      filtered = filtered.filter(comment =>
        comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.author.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered
  }

  const renderComment = (comment: Comment, isReply = false, parentId?: string) => (
    <div key={comment.id} className={cn(
      "space-y-3",
      isReply && "ml-8 border-l-2 border-muted pl-4"
    )}>
      <div className={cn(
        "flex space-x-3 p-4 rounded-lg border",
        comment.isPinned && "border-blue-200 bg-blue-50",
        comment.status === 'reported' && "border-red-200 bg-red-50"
      )}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.author.image} />
          <AvatarFallback>
            {comment.author.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{comment.author.name}</span>
              {comment.author.role && (
                <Badge variant="secondary" className="text-xs">{comment.author.role}</Badge>
              )}
              {comment.isPinned && <Pin className="h-3 w-3 text-blue-500" />}
              {comment.status === 'reported' && <Flag className="h-3 w-3 text-red-500" />}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                {comment.isEdited && " (edited)"}
              </span>
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Comment Options</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {isAdmin && (
                    <>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => handlePinComment(comment.id)}
                      >
                        <Pin className="h-4 w-4 mr-2" />
                        {comment.isPinned ? 'Unpin' : 'Pin'} Comment
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => {
                          setComments(prev => prev.map(c => 
                            c.id === comment.id 
                              ? { ...c, status: c.status === 'hidden' ? 'active' : 'hidden' }
                              : c
                          ))
                        }}
                      >
                        {comment.status === 'hidden' ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                        {comment.status === 'hidden' ? 'Show' : 'Hide'} Comment
                      </Button>
                    </>
                  )}
                  
                  {comment.author.id === currentUserId && (
                    <>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => setEditingComment(comment.id)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Comment
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-red-600"
                        onClick={() => handleDeleteComment(comment.id, isReply, parentId)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Comment
                      </Button>
                    </>
                  )}
                  
                  {comment.author.id !== currentUserId && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-red-600"
                      onClick={() => handleReportComment(comment.id)}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report Comment
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="text-sm">
            {editingComment === comment.id ? (
              <div className="space-y-2">
                <Textarea
                  defaultValue={comment.content}
                  className="resize-none"
                />
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => setEditingComment(null)}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingComment(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{comment.content}</p>
            )}
          </div>
          
          {/* Mentions and hashtags */}
          {(comment.mentions.length > 0 || comment.hashtags.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {comment.mentions.map(mention => (
                <Badge key={mention} variant="secondary" className="text-xs">
                  <AtSign className="h-3 w-3 mr-1" />
                  {mention}
                </Badge>
              ))}
              {comment.hashtags.map(hashtag => (
                <Badge key={hashtag} variant="outline" className="text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {hashtag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Comment actions */}
          <div className="flex items-center space-x-4">
            {settings.allowReactions && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs",
                    comment.hasLiked && "text-blue-600 bg-blue-100"
                  )}
                  onClick={() => handleLikeComment(comment.id, isReply, parentId)}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {comment.likes}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 px-2 text-xs",
                    comment.hasDisliked && "text-red-600 bg-red-100"
                  )}
                  onClick={() => handleDislikeComment(comment.id, isReply, parentId)}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  {comment.dislikes}
                </Button>
              </>
            )}
            
            {settings.allowReplies && !isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setReplyTo(comment.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
            
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
          </div>
        </div>
      </div>
      
      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map(reply => renderComment(reply, true, comment.id))}
        </div>
      )}
      
      {/* Reply form */}
      {replyTo === comment.id && (
        <div className="ml-8 border-l-2 border-muted pl-4">
          <div className="space-y-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={`Reply to ${comment.author.name}...`}
              className="resize-none"
              rows={3}
            />
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setReplyTo(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSubmitComment}>
                  <Send className="h-4 w-4 mr-1" />
                  Reply
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const filteredAndSortedComments = sortComments(filterComments(comments))

  if (!post) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Comments ({comments.filter(c => c.status === 'active').length})</span>
          </h3>
          <p className="text-sm text-muted-foreground">Engage with your audience</p>
        </div>
        
        {isAdmin && (
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Comment Settings</DialogTitle>
                <DialogDescription>Configure comment preferences for this post</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Comments</p>
                    <p className="text-sm text-muted-foreground">Allow users to comment on this post</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowComments}
                    onChange={(e) => setSettings(prev => ({ ...prev, allowComments: e.target.checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Require Moderation</p>
                    <p className="text-sm text-muted-foreground">Comments need approval before being visible</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireModeration}
                    onChange={(e) => setSettings(prev => ({ ...prev, requireModeration: e.target.checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Allow Replies</p>
                    <p className="text-sm text-muted-foreground">Let users reply to comments</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowReplies}
                    onChange={(e) => setSettings(prev => ({ ...prev, allowReplies: e.target.checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Allow Reactions</p>
                    <p className="text-sm text-muted-foreground">Enable likes and dislikes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowReactions}
                    onChange={(e) => setSettings(prev => ({ ...prev, allowReactions: e.target.checked }))}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowSettings(false)}>
                  Save Settings
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {post.commentsEnabled && settings.allowComments ? (
        <>
          {/* Comment Form */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="resize-none"
                      rows={3}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm">
                      <Smile className="h-4 w-4" />
                    </Button>
                    {settings.allowAttachments && (
                      <Button variant="ghost" size="sm">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex space-x-2">
                    <span className="text-xs text-muted-foreground">
                      {newComment.length}/1000
                    </span>
                    <Button 
                      size="sm" 
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim()}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Comment
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters and Sorting */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder="Search comments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="controversial">Most Controversial</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Comments</SelectItem>
                    <SelectItem value="pinned">Pinned Only</SelectItem>
                    {isAdmin && <SelectItem value="reported">Reported</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Comments List */}
          <div className="space-y-4">
            {filteredAndSortedComments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                    <p>No comments yet</p>
                    <p className="text-sm">Be the first to start the conversation!</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="max-h-[800px]">
                <div className="space-y-4 pr-4">
                  {filteredAndSortedComments.map(comment => renderComment(comment))}
                </div>
              </ScrollArea>
            )}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2" />
              <p>Comments are disabled for this post</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}