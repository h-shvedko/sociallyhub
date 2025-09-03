"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { 
  Users,
  Edit,
  MessageSquare,
  Eye,
  Save,
  Share2,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Plus,
  Minus,
  Calendar,
  Hash,
  AtSign,
  Image as ImageIcon,
  Video,
  Link2,
  FileText,
  Settings,
  History,
  Undo,
  Redo,
  Copy,
  ExternalLink,
  Send,
  UserCheck,
  Crown,
  Shield,
  Star,
  Zap,
  Lock,
  Unlock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

interface CollaborativePost {
  id: string
  title: string
  content: {
    text: string
    hashtags: string[]
    mentions: string[]
    media: Array<{
      id: string
      type: 'image' | 'video' | 'link'
      url: string
      title?: string
      description?: string
    }>
  }
  platforms: string[]
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED'
  scheduledFor?: Date
  createdBy: {
    id: string
    name: string
    email: string
    image?: string
    role: string
  }
  collaborators: Array<{
    id: string
    name: string
    email: string
    image?: string
    role: string
    permissions: ('edit' | 'comment' | 'approve' | 'schedule')[]
    isOnline: boolean
    lastActive: Date
    cursor?: {
      position: number
      selection?: { start: number; end: number }
    }
  }>
  comments: Array<{
    id: string
    author: {
      id: string
      name: string
      image?: string
    }
    content: string
    position?: number  // Character position in text for inline comments
    resolved: boolean
    createdAt: Date
    replies?: Array<{
      id: string
      author: { id: string; name: string; image?: string }
      content: string
      createdAt: Date
    }>
  }>
  revisions: Array<{
    id: string
    content: any
    author: { id: string; name: string }
    createdAt: Date
    description: string
  }>
  settings: {
    allowComments: boolean
    allowSuggestions: boolean
    requireApproval: boolean
    lockWhenScheduled: boolean
  }
  createdAt: Date
  updatedAt: Date
}

interface Suggestion {
  id: string
  type: 'replace' | 'insert' | 'delete'
  position: { start: number; end: number }
  originalText: string
  suggestedText: string
  author: {
    id: string
    name: string
    image?: string
  }
  reasoning?: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: Date
}

interface CollaborativePostEditorProps {
  postId?: string
  workspaceId?: string
  onSave?: (post: CollaborativePost) => void
  onPublish?: (post: CollaborativePost) => void
}

export function CollaborativePostEditor({ 
  postId, 
  workspaceId,
  onSave,
  onPublish 
}: CollaborativePostEditorProps) {
  const [post, setPost] = useState<CollaborativePost | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [activeTab, setActiveTab] = useState("editor")
  const [isCommentMode, setIsCommentMode] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [newComment, setNewComment] = useState("")
  const [isAddCollaboratorOpen, setIsAddCollaboratorOpen] = useState(false)
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("")
  const [newCollaboratorPermissions, setNewCollaboratorPermissions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorPosition, setCursorPosition] = useState(0)

  useEffect(() => {
    loadMockData()
    
    // Simulate real-time collaboration
    const interval = setInterval(() => {
      updateCollaboratorStatus()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const loadMockData = () => {
    const mockPost: CollaborativePost = {
      id: "post_1",
      title: "Spring Collection Launch Campaign",
      content: {
        text: "🌸 Spring is finally here! We're excited to introduce our new collection that celebrates the beauty of renewal and growth. From vibrant florals to fresh pastels, every piece tells a story of transformation. \n\nSwipe to see our favorites and let us know which piece speaks to your spring style! ✨\n\n#SpringCollection #NewArrivals #SpringFashion #Renewal #Growth #StyleInspiration",
        hashtags: ["SpringCollection", "NewArrivals", "SpringFashion", "Renewal", "Growth", "StyleInspiration"],
        mentions: ["@fashionweek", "@styleinfluencer"],
        media: [
          {
            id: "m1",
            type: "image",
            url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400",
            title: "Spring Collection Hero Image"
          },
          {
            id: "m2", 
            type: "image",
            url: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400",
            title: "Floral Dress Detail"
          }
        ]
      },
      platforms: ["Instagram", "Facebook", "Pinterest"],
      status: "IN_REVIEW",
      scheduledFor: new Date("2024-03-20T10:00:00"),
      createdBy: {
        id: "u1",
        name: "Sarah Johnson", 
        email: "sarah@company.com",
        image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
        role: "Content Creator"
      },
      collaborators: [
        {
          id: "u2",
          name: "Mike Chen",
          email: "mike@company.com",
          role: "Marketing Manager",
          permissions: ["edit", "comment", "approve"],
          isOnline: true,
          lastActive: new Date("2024-03-15T14:25:00")
        },
        {
          id: "u3",
          name: "Emily Davis",
          email: "emily@company.com",
          image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
          role: "Brand Director", 
          permissions: ["edit", "comment", "approve", "schedule"],
          isOnline: false,
          lastActive: new Date("2024-03-15T11:30:00")
        },
        {
          id: "u4",
          name: "Alex Wilson",
          email: "alex@company.com",
          role: "Copywriter",
          permissions: ["edit", "comment"],
          isOnline: true,
          lastActive: new Date("2024-03-15T14:28:00")
        }
      ],
      comments: [
        {
          id: "c1",
          author: {
            id: "u2",
            name: "Mike Chen"
          },
          content: "Love the energy of this post! The emojis really enhance the spring feeling.",
          position: 0,
          resolved: false,
          createdAt: new Date("2024-03-15T10:15:00"),
          replies: [
            {
              id: "r1",
              author: { id: "u1", name: "Sarah Johnson" },
              content: "Thanks Mike! I wanted to capture that fresh spring energy.",
              createdAt: new Date("2024-03-15T10:30:00")
            }
          ]
        },
        {
          id: "c2",
          author: {
            id: "u3", 
            name: "Emily Davis",
            image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face"
          },
          content: "Should we consider adding a call-to-action? Maybe 'Shop now' or 'Explore the collection'?",
          position: 280,
          resolved: false,
          createdAt: new Date("2024-03-15T11:00:00")
        },
        {
          id: "c3",
          author: {
            id: "u4",
            name: "Alex Wilson"
          },
          content: "The copy flows really well. I'd suggest making the second paragraph a bit shorter for better mobile readability.",
          position: 150,
          resolved: false,
          createdAt: new Date("2024-03-15T13:45:00")
        }
      ],
      revisions: [
        {
          id: "r1",
          content: { text: "Original draft content...", hashtags: [], mentions: [] },
          author: { id: "u1", name: "Sarah Johnson" },
          createdAt: new Date("2024-03-14T16:20:00"),
          description: "Initial draft"
        },
        {
          id: "r2",
          content: { text: "Revised content with emoji improvements...", hashtags: [], mentions: [] },
          author: { id: "u1", name: "Sarah Johnson" },
          createdAt: new Date("2024-03-15T09:10:00"),
          description: "Added emojis and improved tone"
        }
      ],
      settings: {
        allowComments: true,
        allowSuggestions: true,
        requireApproval: true,
        lockWhenScheduled: false
      },
      createdAt: new Date("2024-03-14T16:20:00"),
      updatedAt: new Date("2024-03-15T14:30:00")
    }

    setPost(mockPost)

    // Mock suggestions
    setSuggestions([
      {
        id: "s1",
        type: "replace",
        position: { start: 180, end: 220 },
        originalText: "every piece tells a story of transformation",
        suggestedText: "each piece embodies the spirit of renewal",
        author: {
          id: "u4", 
          name: "Alex Wilson"
        },
        reasoning: "More concise and impactful language",
        status: "pending",
        createdAt: new Date("2024-03-15T12:30:00")
      },
      {
        id: "s2",
        type: "insert",
        position: { start: 350, end: 350 },
        originalText: "",
        suggestedText: "\n\n🛍️ Shop the collection now with early bird discounts!",
        author: {
          id: "u3",
          name: "Emily Davis"
        },
        reasoning: "Adding a clear call-to-action as discussed",
        status: "pending",
        createdAt: new Date("2024-03-15T13:15:00")
      }
    ])
  }

  const updateCollaboratorStatus = () => {
    if (!post) return
    
    // Simulate collaborator activity
    setPost(prev => {
      if (!prev) return prev
      
      const updatedCollaborators = prev.collaborators.map(collab => ({
        ...collab,
        isOnline: Math.random() > 0.3, // Randomly simulate online/offline
        lastActive: collab.isOnline ? new Date() : collab.lastActive
      }))
      
      return { ...prev, collaborators: updatedCollaborators }
    })
  }

  const handleTextChange = (newText: string) => {
    if (!post) return
    
    setPost(prev => prev ? {
      ...prev,
      content: { ...prev.content, text: newText },
      updatedAt: new Date()
    } : null)
  }

  const handleAddComment = () => {
    if (!post || !newComment.trim()) return

    const comment = {
      id: Date.now().toString(),
      author: {
        id: "current-user",
        name: "Current User"
      },
      content: newComment,
      position: cursorPosition,
      resolved: false,
      createdAt: new Date()
    }

    setPost(prev => prev ? {
      ...prev,
      comments: [...prev.comments, comment]
    } : null)

    setNewComment("")
    setIsCommentMode(false)
    toast.success("Comment added")
  }

  const handleResolveComment = (commentId: string) => {
    if (!post) return

    setPost(prev => prev ? {
      ...prev,
      comments: prev.comments.map(comment => 
        comment.id === commentId 
          ? { ...comment, resolved: true }
          : comment
      )
    } : null)

    toast.success("Comment resolved")
  }

  const handleSuggestionAction = (suggestionId: string, action: 'accept' | 'reject') => {
    setSuggestions(prev => prev.map(suggestion => 
      suggestion.id === suggestionId 
        ? { ...suggestion, status: action === 'accept' ? 'accepted' : 'rejected' }
        : suggestion
    ))

    if (action === 'accept') {
      const suggestion = suggestions.find(s => s.id === suggestionId)
      if (suggestion && post) {
        // Apply the suggestion to the text
        const currentText = post.content.text
        let newText = currentText
        
        if (suggestion.type === 'replace') {
          newText = currentText.slice(0, suggestion.position.start) + 
                   suggestion.suggestedText + 
                   currentText.slice(suggestion.position.end)
        } else if (suggestion.type === 'insert') {
          newText = currentText.slice(0, suggestion.position.start) + 
                   suggestion.suggestedText + 
                   currentText.slice(suggestion.position.start)
        }
        
        setPost(prev => prev ? {
          ...prev,
          content: { ...prev.content, text: newText }
        } : null)
      }
    }

    toast.success(`Suggestion ${action}ed`)
  }

  const handleAddCollaborator = () => {
    if (!post || !newCollaboratorEmail.trim()) return

    const newCollaborator = {
      id: Date.now().toString(),
      name: newCollaboratorEmail.split('@')[0],
      email: newCollaboratorEmail,
      role: "Collaborator",
      permissions: newCollaboratorPermissions as ('edit' | 'comment' | 'approve' | 'schedule')[],
      isOnline: false,
      lastActive: new Date()
    }

    setPost(prev => prev ? {
      ...prev,
      collaborators: [...prev.collaborators, newCollaborator]
    } : null)

    setNewCollaboratorEmail("")
    setNewCollaboratorPermissions([])
    setIsAddCollaboratorOpen(false)
    toast.success("Collaborator added")
  }

  const handleSave = () => {
    if (!post) return
    
    // Create revision
    const revision = {
      id: Date.now().toString(),
      content: post.content,
      author: { id: "current-user", name: "Current User" },
      createdAt: new Date(),
      description: "Auto-saved changes"
    }

    setPost(prev => prev ? {
      ...prev,
      revisions: [...prev.revisions, revision],
      updatedAt: new Date()
    } : null)

    onSave?.(post)
    toast.success("Post saved")
  }

  const handleStatusChange = (newStatus: CollaborativePost['status']) => {
    if (!post) return

    setPost(prev => prev ? {
      ...prev,
      status: newStatus,
      updatedAt: new Date()
    } : null)

    toast.success(`Post status changed to ${newStatus}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'IN_REVIEW': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800'
      case 'PUBLISHED': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'brand director': return <Crown className="h-3 w-3 text-yellow-500" />
      case 'marketing manager': return <Shield className="h-3 w-3 text-blue-500" />
      case 'content creator': return <Star className="h-3 w-3 text-green-500" />
      default: return <User className="h-3 w-3 text-gray-500" />
    }
  }

  if (!post) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{post.title}</h2>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={getStatusColor(post.status)}>
                {post.status.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Last updated {formatDistanceToNow(post.updatedAt, { addSuffix: true })}
              </span>
              <span className="text-sm text-muted-foreground">
                • {post.collaborators.filter(c => c.isOnline).length} online
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          {post.status === 'APPROVED' && (
            <Button size="sm" onClick={() => onPublish?.(post)}>
              <Share2 className="h-4 w-4 mr-2" />
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Collaborators Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Collaborators</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {post.collaborators.slice(0, 5).map((collaborator) => (
                  <div key={collaborator.id} className="relative">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={collaborator.image} />
                      <AvatarFallback className="text-xs">
                        {collaborator.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-background",
                      collaborator.isOnline ? "bg-green-500" : "bg-gray-400"
                    )} />
                  </div>
                ))}
                
                {post.collaborators.length > 5 && (
                  <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs">
                    +{post.collaborators.length - 5}
                  </div>
                )}
              </div>
            </div>
            
            <Dialog open={isAddCollaboratorOpen} onOpenChange={setIsAddCollaboratorOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Collaborator</DialogTitle>
                  <DialogDescription>
                    Invite someone to collaborate on this post
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>Email Address</Label>
                    <input
                      type="email"
                      placeholder="Enter email address..."
                      value={newCollaboratorEmail}
                      onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  
                  <div>
                    <Label>Permissions</Label>
                    <div className="space-y-2 mt-2">
                      {['edit', 'comment', 'approve', 'schedule'].map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={permission}
                            checked={newCollaboratorPermissions.includes(permission)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewCollaboratorPermissions([...newCollaboratorPermissions, permission])
                              } else {
                                setNewCollaboratorPermissions(newCollaboratorPermissions.filter(p => p !== permission))
                              }
                            }}
                          />
                          <Label htmlFor={permission} className="capitalize">
                            {permission}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddCollaboratorOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCollaborator}>
                    Add Collaborator
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="comments">
            Comments ({post.comments.filter(c => !c.resolved).length})
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            Suggestions ({suggestions.filter(s => s.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Content Editor</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant={isCommentMode ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setIsCommentMode(!isCommentMode)}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Comment Mode
                  </Button>
                  <Button 
                    variant={showSuggestions ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Suggestions
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Label>Post Content</Label>
                  <Textarea
                    ref={textareaRef}
                    value={post.content.text}
                    onChange={(e) => {
                      handleTextChange(e.target.value)
                      setCursorPosition(e.target.selectionStart)
                    }}
                    onSelect={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      setCursorPosition(target.selectionStart)
                      if (target.selectionStart !== target.selectionEnd) {
                        setSelectedText(target.value.slice(target.selectionStart, target.selectionEnd))
                      }
                    }}
                    placeholder="Write your post content..."
                    className="min-h-[200px] resize-none"
                    disabled={post.status === 'PUBLISHED' || !post.settings.allowComments}
                  />
                  
                  {isCommentMode && (
                    <div className="absolute top-8 right-2 bg-yellow-100 border border-yellow-300 rounded px-2 py-1 text-xs">
                      Comment mode active - click to add comments
                    </div>
                  )}
                </div>

                {isCommentMode && (
                  <div className="border rounded-lg p-4 bg-muted">
                    <Label>Add Comment at Position {cursorPosition}</Label>
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add your comment..."
                      className="mt-2"
                    />
                    <div className="flex space-x-2 mt-2">
                      <Button size="sm" onClick={handleAddComment}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Comment
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setIsCommentMode(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hashtags</Label>
                    <div className="flex flex-wrap gap-1 mt-2 p-2 border rounded-md min-h-[40px]">
                      {post.content.hashtags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          #{tag}
                        </Badge>
                      ))}
                      <input
                        type="text"
                        placeholder="Add hashtag..."
                        className="flex-1 min-w-[100px] border-none outline-none bg-transparent text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            const newTag = e.currentTarget.value.replace('#', '').trim()
                            if (!post.content.hashtags.includes(newTag)) {
                              setPost(prev => prev ? {
                                ...prev,
                                content: {
                                  ...prev.content,
                                  hashtags: [...prev.content.hashtags, newTag]
                                }
                              } : null)
                            }
                            e.currentTarget.value = ''
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Platforms</Label>
                    <div className="flex flex-wrap gap-1 mt-2 p-2 border rounded-md">
                      {post.platforms.map((platform, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {post.content.media.length > 0 && (
                  <div>
                    <Label>Media</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                      {post.content.media.map((media) => (
                        <div key={media.id} className="relative border rounded-lg overflow-hidden">
                          {media.type === 'image' ? (
                            <img 
                              src={media.url} 
                              alt={media.title} 
                              className="w-full h-24 object-cover"
                            />
                          ) : (
                            <div className="w-full h-24 bg-muted flex items-center justify-center">
                              {media.type === 'video' ? (
                                <Video className="h-8 w-8 text-muted-foreground" />
                              ) : (
                                <Link2 className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1">
                            <p className="text-xs truncate">{media.title}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comments & Feedback</CardTitle>
              <CardDescription>
                {post.comments.filter(c => !c.resolved).length} active comments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-4">
                  {post.comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className={cn(
                        "border rounded-lg p-4 space-y-3",
                        comment.resolved ? "bg-green-50 border-green-200" : "bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={comment.author.image} />
                            <AvatarFallback className="text-xs">
                              {comment.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium text-sm">{comment.author.name}</span>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(comment.createdAt, { addSuffix: true })}</span>
                              {comment.position !== undefined && (
                                <span>• Position {comment.position}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {!comment.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveComment(comment.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                      
                      <p className="text-sm">{comment.content}</p>
                      
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-6 space-y-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start space-x-2">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={reply.author.image} />
                                <AvatarFallback className="text-xs">
                                  {reply.author.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium text-xs">{reply.author.name}</span>
                                <p className="text-xs text-muted-foreground">{reply.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {post.comments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                      <p>No comments yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suggestions</CardTitle>
              <CardDescription>
                Review and manage content suggestions from collaborators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={suggestion.author.image} />
                          <AvatarFallback className="text-xs">
                            {suggestion.author.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-sm">{suggestion.author.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs capitalize">
                            {suggestion.type}
                          </Badge>
                        </div>
                      </div>
                      
                      <Badge 
                        className={cn(
                          "text-xs",
                          suggestion.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          suggestion.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        )}
                      >
                        {suggestion.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {suggestion.originalText && (
                        <div>
                          <Label className="text-xs text-red-600">Original:</Label>
                          <p className="text-sm bg-red-50 border border-red-200 rounded p-2 line-through">
                            {suggestion.originalText}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <Label className="text-xs text-green-600">Suggested:</Label>
                        <p className="text-sm bg-green-50 border border-green-200 rounded p-2">
                          {suggestion.suggestedText}
                        </p>
                      </div>
                      
                      {suggestion.reasoning && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Reasoning:</Label>
                          <p className="text-xs text-muted-foreground italic">{suggestion.reasoning}</p>
                        </div>
                      )}
                    </div>
                    
                    {suggestion.status === 'pending' && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleSuggestionAction(suggestion.id, 'accept')}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestionAction(suggestion.id, 'reject')}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                
                {suggestions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Edit className="h-8 w-8 mx-auto mb-2" />
                    <p>No suggestions yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revision History</CardTitle>
              <CardDescription>
                Track changes and previous versions of this post
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {post.revisions.reverse().map((revision, index) => (
                  <div key={revision.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <History className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{revision.description}</p>
                        <p className="text-xs text-muted-foreground">
                          by {revision.author.name} • {format(revision.createdAt, 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      {index > 0 && (
                        <Button variant="outline" size="sm">
                          <Undo className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Post Preview</CardTitle>
              <CardDescription>
                See how your post will appear on different platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="instagram">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="pinterest">Pinterest</TabsTrigger>
                </TabsList>
                
                <TabsContent value="instagram" className="mt-4">
                  <div className="border rounded-lg p-4 bg-white max-w-md mx-auto">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"></div>
                      <div>
                        <p className="font-medium text-sm">company_official</p>
                        <p className="text-xs text-muted-foreground">Sponsored</p>
                      </div>
                    </div>
                    
                    {post.content.media[0] && (
                      <img 
                        src={post.content.media[0].url} 
                        alt="Post content"
                        className="w-full aspect-square object-cover rounded mb-3"
                      />
                    )}
                    
                    <div className="space-y-2">
                      <p className="text-sm whitespace-pre-wrap">{post.content.text}</p>
                      <div className="flex flex-wrap gap-1">
                        {post.content.hashtags.slice(0, 5).map(tag => (
                          <span key={tag} className="text-xs text-blue-600">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="facebook" className="mt-4">
                  <div className="border rounded-lg p-4 bg-white max-w-lg mx-auto">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        C
                      </div>
                      <div>
                        <p className="font-medium text-sm">Company Official</p>
                        <p className="text-xs text-muted-foreground">2 hours ago • 🌍</p>
                      </div>
                    </div>
                    
                    <p className="text-sm mb-3 whitespace-pre-wrap">{post.content.text}</p>
                    
                    {post.content.media[0] && (
                      <img 
                        src={post.content.media[0].url} 
                        alt="Post content"
                        className="w-full rounded mb-3"
                      />
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="pinterest" className="mt-4">
                  <div className="border rounded-lg overflow-hidden bg-white max-w-xs mx-auto">
                    {post.content.media[0] && (
                      <img 
                        src={post.content.media[0].url} 
                        alt="Post content"
                        className="w-full"
                      />
                    )}
                    <div className="p-3">
                      <p className="text-sm font-medium line-clamp-2">{post.content.text.split('\n')[0]}</p>
                      <p className="text-xs text-muted-foreground mt-1">company.com</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Settings</DialogTitle>
            <DialogDescription>
              Configure collaboration and approval settings for this post
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Comments</Label>
                <p className="text-xs text-muted-foreground">Let collaborators add comments</p>
              </div>
              <Switch 
                checked={post.settings.allowComments}
                onCheckedChange={(checked) => setPost(prev => prev ? {
                  ...prev,
                  settings: { ...prev.settings, allowComments: checked }
                } : null)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Suggestions</Label>
                <p className="text-xs text-muted-foreground">Enable collaborative editing suggestions</p>
              </div>
              <Switch 
                checked={post.settings.allowSuggestions}
                onCheckedChange={(checked) => setPost(prev => prev ? {
                  ...prev,
                  settings: { ...prev.settings, allowSuggestions: checked }
                } : null)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Approval</Label>
                <p className="text-xs text-muted-foreground">Post must be approved before publishing</p>
              </div>
              <Switch 
                checked={post.settings.requireApproval}
                onCheckedChange={(checked) => setPost(prev => prev ? {
                  ...prev,
                  settings: { ...prev.settings, requireApproval: checked }
                } : null)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Lock When Scheduled</Label>
                <p className="text-xs text-muted-foreground">Prevent edits once post is scheduled</p>
              </div>
              <Switch 
                checked={post.settings.lockWhenScheduled}
                onCheckedChange={(checked) => setPost(prev => prev ? {
                  ...prev,
                  settings: { ...prev.settings, lockWhenScheduled: checked }
                } : null)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsSettingsOpen(false)}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}