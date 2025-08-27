"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  MessageSquare, 
  User, 
  Calendar, 
  Filter,
  Search,
  FileText,
  Image as ImageIcon,
  Video,
  Link2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  ArrowRight,
  Flag,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"

interface ApprovalRequest {
  id: string
  type: 'POST' | 'CAMPAIGN' | 'TEMPLATE' | 'SETTING_CHANGE'
  title: string
  description: string
  content?: {
    text?: string
    media?: Array<{
      type: 'image' | 'video' | 'link'
      url: string
      title?: string
    }>
    platforms?: string[]
    scheduledFor?: Date
  }
  requestedBy: {
    id: string
    name: string
    email: string
    image?: string
    role: string
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  createdAt: Date
  updatedAt: Date
  deadline?: Date
  approvers: Array<{
    id: string
    name: string
    email: string
    image?: string
    role: string
    decision?: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'
    feedback?: string
    decidedAt?: Date
  }>
  comments: Array<{
    id: string
    author: {
      id: string
      name: string
      image?: string
    }
    content: string
    createdAt: Date
  }>
  tags?: string[]
  estimatedReach?: number
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  requiredApprovers: number
  approvers: Array<{
    id: string
    name: string
    role: string
  }>
  autoApprovalRules?: {
    userRoles?: string[]
    contentTypes?: string[]
    conditions?: string[]
  }
  isDefault: boolean
  createdAt: Date
}

interface ApprovalWorkflowProps {
  workspaceId?: string
}

export function ApprovalWorkflow({ workspaceId }: ApprovalWorkflowProps) {
  const [activeTab, setActiveTab] = useState("pending")
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  useEffect(() => {
    loadMockData()
  }, [])

  const loadMockData = () => {
    // Mock approval requests
    setRequests([
      {
        id: "1",
        type: "POST",
        title: "Spring Campaign Launch Post",
        description: "Instagram post announcing our spring product launch with promotional video",
        content: {
          text: "🌸 Spring is here! Check out our new collection launching this weekend. Get 20% off with code SPRING20 #SpringLaunch #Fashion #Sale",
          media: [
            { type: "video", url: "/videos/spring-launch.mp4", title: "Spring Collection Video" },
            { type: "image", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400", title: "Product Showcase" }
          ],
          platforms: ["Instagram", "Facebook", "Twitter"],
          scheduledFor: new Date("2024-03-20T10:00:00")
        },
        requestedBy: {
          id: "u1",
          name: "Sarah Johnson",
          email: "sarah@company.com",
          image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
          role: "Content Creator"
        },
        status: "PENDING",
        priority: "HIGH",
        createdAt: new Date("2024-03-15T09:30:00"),
        updatedAt: new Date("2024-03-15T09:30:00"),
        deadline: new Date("2024-03-18T17:00:00"),
        approvers: [
          {
            id: "a1",
            name: "Mike Chen",
            email: "mike@company.com",
            role: "Marketing Manager"
          },
          {
            id: "a2", 
            name: "Emily Davis",
            email: "emily@company.com",
            role: "Brand Director"
          }
        ],
        comments: [
          {
            id: "c1",
            author: {
              id: "u1",
              name: "Sarah Johnson",
              image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face"
            },
            content: "This post is ready for review. The video showcases our key spring pieces and the copy includes our campaign hashtags.",
            createdAt: new Date("2024-03-15T09:35:00")
          }
        ],
        tags: ["campaign", "product-launch", "spring", "sale"],
        estimatedReach: 15000
      },
      {
        id: "2",
        type: "CAMPAIGN",
        title: "Q2 Email Marketing Campaign",
        description: "Comprehensive email campaign targeting existing customers with personalized product recommendations",
        requestedBy: {
          id: "u2",
          name: "Alex Wilson",
          email: "alex@company.com",
          role: "Email Marketing Specialist"
        },
        status: "CHANGES_REQUESTED",
        priority: "MEDIUM",
        createdAt: new Date("2024-03-14T14:20:00"),
        updatedAt: new Date("2024-03-15T11:45:00"),
        deadline: new Date("2024-03-25T17:00:00"),
        approvers: [
          {
            id: "a1",
            name: "Mike Chen", 
            email: "mike@company.com",
            role: "Marketing Manager",
            decision: "CHANGES_REQUESTED",
            feedback: "Please revise the subject line and reduce the number of CTA buttons. Also need to include the unsubscribe compliance statement.",
            decidedAt: new Date("2024-03-15T11:45:00")
          },
          {
            id: "a3",
            name: "Lisa Park",
            email: "lisa@company.com", 
            role: "Compliance Officer"
          }
        ],
        comments: [
          {
            id: "c2",
            author: {
              id: "a1",
              name: "Mike Chen"
            },
            content: "The targeting looks good but we need to address the compliance issues before approval.",
            createdAt: new Date("2024-03-15T11:47:00")
          }
        ],
        tags: ["email", "campaign", "q2", "personalization"],
        estimatedReach: 25000
      },
      {
        id: "3",
        type: "POST",
        title: "Behind the Scenes Content",
        description: "Instagram Stories series showing our team's daily work process",
        content: {
          text: "Take a look behind the scenes at our creative process! Our amazing team working hard to bring you the best content 👥✨ #BehindTheScenes #TeamWork",
          media: [
            { type: "image", url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400", title: "Team Meeting" },
            { type: "image", url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400", title: "Creative Workspace" }
          ],
          platforms: ["Instagram Stories", "LinkedIn"]
        },
        requestedBy: {
          id: "u3",
          name: "Jordan Smith",
          email: "jordan@company.com", 
          role: "Social Media Manager"
        },
        status: "APPROVED",
        priority: "LOW",
        createdAt: new Date("2024-03-13T16:10:00"),
        updatedAt: new Date("2024-03-14T10:20:00"),
        approvers: [
          {
            id: "a1",
            name: "Mike Chen",
            email: "mike@company.com",
            role: "Marketing Manager",
            decision: "APPROVED",
            feedback: "Great authentic content! This aligns well with our brand voice.",
            decidedAt: new Date("2024-03-14T10:20:00")
          }
        ],
        comments: [],
        tags: ["behind-scenes", "team", "authentic"],
        estimatedReach: 5000
      }
    ])

    // Mock workflow templates
    setTemplates([
      {
        id: "t1",
        name: "Standard Content Approval",
        description: "Default workflow for regular social media posts",
        requiredApprovers: 1,
        approvers: [
          { id: "a1", name: "Mike Chen", role: "Marketing Manager" }
        ],
        autoApprovalRules: {
          userRoles: ["Marketing Manager", "Brand Director"],
          contentTypes: ["POST"],
          conditions: ["low-priority", "no-promotional-content"]
        },
        isDefault: true,
        createdAt: new Date("2024-01-15")
      },
      {
        id: "t2", 
        name: "Campaign & Promotional Content",
        description: "Enhanced approval process for campaigns and promotional posts",
        requiredApprovers: 2,
        approvers: [
          { id: "a1", name: "Mike Chen", role: "Marketing Manager" },
          { id: "a2", name: "Emily Davis", role: "Brand Director" },
          { id: "a3", name: "Lisa Park", role: "Compliance Officer" }
        ],
        isDefault: false,
        createdAt: new Date("2024-01-20")
      },
      {
        id: "t3",
        name: "High-Risk Content Review", 
        description: "Comprehensive review for sensitive or high-impact content",
        requiredApprovers: 3,
        approvers: [
          { id: "a1", name: "Mike Chen", role: "Marketing Manager" },
          { id: "a2", name: "Emily Davis", role: "Brand Director" },
          { id: "a3", name: "Lisa Park", role: "Compliance Officer" },
          { id: "a4", name: "David Kim", role: "Legal Counsel" }
        ],
        isDefault: false,
        createdAt: new Date("2024-02-01")
      }
    ])
  }

  const handleApprovalDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED', feedback?: string) => {
    setRequests(prev => prev.map(req => {
      if (req.id === requestId) {
        const updatedApprovers = req.approvers.map(approver => 
          approver.id === "current-user" 
            ? { ...approver, decision, feedback, decidedAt: new Date() }
            : approver
        )
        
        const allDecided = updatedApprovers.every(approver => approver.decision)
        const hasRejection = updatedApprovers.some(approver => approver.decision === 'REJECTED')
        const hasChangesRequested = updatedApprovers.some(approver => approver.decision === 'CHANGES_REQUESTED')
        
        let newStatus: ApprovalRequest['status'] = req.status
        if (allDecided) {
          if (hasRejection) {
            newStatus = 'REJECTED'
          } else if (hasChangesRequested) {
            newStatus = 'CHANGES_REQUESTED'  
          } else {
            newStatus = 'APPROVED'
          }
        }

        return {
          ...req,
          status: newStatus,
          approvers: updatedApprovers,
          updatedAt: new Date()
        }
      }
      return req
    }))

    toast.success(`Request ${decision.toLowerCase().replace('_', ' ')} successfully`)
    setIsReviewDialogOpen(false)
    setReviewDecision(null)
    setReviewFeedback("")
  }

  const handleAddComment = (requestId: string, content: string) => {
    setRequests(prev => prev.map(req => 
      req.id === requestId 
        ? {
            ...req,
            comments: [
              ...req.comments,
              {
                id: Date.now().toString(),
                author: {
                  id: "current-user",
                  name: "Current User"
                },
                content,
                createdAt: new Date()
              }
            ]
          }
        : req
    ))
    toast.success("Comment added")
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200'
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200'
      case 'CHANGES_REQUESTED': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'PENDING': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />
      case 'REJECTED': return <XCircle className="h-4 w-4" />
      case 'CHANGES_REQUESTED': return <AlertCircle className="h-4 w-4" />
      case 'PENDING': return <Clock className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'POST': return <FileText className="h-4 w-4" />
      case 'CAMPAIGN': return <Zap className="h-4 w-4" />
      case 'TEMPLATE': return <FileText className="h-4 w-4" />
      case 'SETTING_CHANGE': return <Settings className="h-4 w-4" />
      default: return <FileText className="h-4 w-4" />
    }
  }

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         request.requestedBy.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesPriority = priorityFilter === "" || request.priority === priorityFilter
    const matchesType = typeFilter === "" || request.type === typeFilter
    
    return matchesSearch && matchesPriority && matchesType
  })

  const pendingRequests = filteredRequests.filter(r => r.status === 'PENDING')
  const reviewedRequests = filteredRequests.filter(r => r.status !== 'PENDING')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approval Workflows</h2>
          <p className="text-muted-foreground">Manage content approval requests and workflows</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span>Pending Review</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground">
              {pendingRequests.filter(r => r.priority === 'HIGH' || r.priority === 'URGENT').length} high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Approved Today</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'APPROVED' && 
                r.updatedAt.toDateString() === new Date().toDateString()).length}
            </div>
            <p className="text-xs text-muted-foreground">This week: 12</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>Changes Requested</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'CHANGES_REQUESTED').length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting updates</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span>Avg. Approval Time</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-xs text-muted-foreground">-15% from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search approval requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="flex h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex h-10 w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All Types</option>
              <option value="POST">Posts</option>
              <option value="CAMPAIGN">Campaigns</option>
              <option value="TEMPLATE">Templates</option>
              <option value="SETTING_CHANGE">Settings</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending Review ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="reviewed">
            Reviewed ({reviewedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="templates">
            Workflow Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="font-medium text-lg mb-2">All caught up!</h3>
                  <p>No pending approval requests at the moment.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          {getTypeIcon(request.type)}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium">{request.title}</h3>
                            <Badge className={cn("text-xs", getPriorityColor(request.priority))}>
                              {request.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {request.type}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">{request.description}</p>
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <User className="h-3 w-3" />
                              <span>{request.requestedBy.name}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDistanceToNow(request.createdAt, { addSuffix: true })}</span>
                            </div>
                            {request.deadline && (
                              <div className="flex items-center space-x-1">
                                <Flag className="h-3 w-3" />
                                <span>Due {formatDistanceToNow(request.deadline, { addSuffix: true })}</span>
                              </div>
                            )}
                            {request.estimatedReach && (
                              <div className="flex items-center space-x-1">
                                <Eye className="h-3 w-3" />
                                <span>{request.estimatedReach.toLocaleString()} reach</span>
                              </div>
                            )}
                          </div>

                          {request.tags && request.tags.length > 0 && (
                            <div className="flex items-center space-x-2">
                              {request.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Dialog 
                          open={isReviewDialogOpen && selectedRequest?.id === request.id}
                          onOpenChange={(open) => {
                            setIsReviewDialogOpen(open)
                            if (open) setSelectedRequest(request)
                            else setSelectedRequest(null)
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm">
                              Review
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh]">
                            <DialogHeader>
                              <DialogTitle>Review Request: {request.title}</DialogTitle>
                              <DialogDescription>
                                Submitted by {request.requestedBy.name} • {formatDistanceToNow(request.createdAt, { addSuffix: true })}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <ScrollArea className="max-h-[60vh] pr-4">
                              <div className="space-y-6">
                                {/* Request Details */}
                                <div>
                                  <h4 className="font-medium mb-2">Request Details</h4>
                                  <div className="bg-muted p-4 rounded-lg space-y-3">
                                    <div className="flex items-center space-x-4">
                                      <Badge className={getPriorityColor(request.priority)}>
                                        {request.priority} Priority
                                      </Badge>
                                      <Badge variant="outline">{request.type}</Badge>
                                      {request.deadline && (
                                        <Badge variant="outline">
                                          Due: {format(request.deadline, 'MMM dd, yyyy HH:mm')}
                                        </Badge>
                                      )}
                                    </div>
                                    <p>{request.description}</p>
                                  </div>
                                </div>

                                {/* Content Preview */}
                                {request.content && (
                                  <div>
                                    <h4 className="font-medium mb-2">Content Preview</h4>
                                    <div className="border rounded-lg p-4 space-y-4">
                                      {request.content.text && (
                                        <div>
                                          <Label className="text-xs text-muted-foreground">POST TEXT</Label>
                                          <p className="text-sm mt-1">{request.content.text}</p>
                                        </div>
                                      )}
                                      
                                      {request.content.media && request.content.media.length > 0 && (
                                        <div>
                                          <Label className="text-xs text-muted-foreground">MEDIA</Label>
                                          <div className="flex space-x-2 mt-2">
                                            {request.content.media.map((media, idx) => (
                                              <div key={idx} className="flex items-center space-x-2 bg-muted px-3 py-2 rounded text-xs">
                                                {media.type === 'image' && <ImageIcon className="h-4 w-4" />}
                                                {media.type === 'video' && <Video className="h-4 w-4" />}
                                                {media.type === 'link' && <Link2 className="h-4 w-4" />}
                                                <span>{media.title || media.url}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {request.content.platforms && (
                                        <div>
                                          <Label className="text-xs text-muted-foreground">PLATFORMS</Label>
                                          <div className="flex space-x-2 mt-1">
                                            {request.content.platforms.map(platform => (
                                              <Badge key={platform} variant="secondary" className="text-xs">
                                                {platform}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {request.content.scheduledFor && (
                                        <div>
                                          <Label className="text-xs text-muted-foreground">SCHEDULED FOR</Label>
                                          <p className="text-sm mt-1">
                                            {format(request.content.scheduledFor, 'MMMM dd, yyyy • HH:mm')}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Approvers */}
                                <div>
                                  <h4 className="font-medium mb-2">Approvers</h4>
                                  <div className="space-y-2">
                                    {request.approvers.map((approver, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                                        <div className="flex items-center space-x-3">
                                          <Avatar className="h-8 w-8">
                                            <AvatarImage src={approver.image} />
                                            <AvatarFallback>
                                              {approver.name.split(' ').map(n => n[0]).join('')}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div>
                                            <p className="font-medium text-sm">{approver.name}</p>
                                            <p className="text-xs text-muted-foreground">{approver.role}</p>
                                          </div>
                                        </div>
                                        
                                        <div className="text-right">
                                          {approver.decision ? (
                                            <Badge className={getStatusColor(approver.decision)}>
                                              {approver.decision.replace('_', ' ')}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline">Pending</Badge>
                                          )}
                                          {approver.decidedAt && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              {formatDistanceToNow(approver.decidedAt, { addSuffix: true })}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Comments */}
                                {request.comments.length > 0 && (
                                  <div>
                                    <h4 className="font-medium mb-2">Comments</h4>
                                    <div className="space-y-3">
                                      {request.comments.map((comment) => (
                                        <div key={comment.id} className="flex space-x-3 p-3 bg-muted rounded-lg">
                                          <Avatar className="h-6 w-6">
                                            <AvatarImage src={comment.author.image} />
                                            <AvatarFallback>
                                              {comment.author.name.split(' ').map(n => n[0]).join('')}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1">
                                            <div className="flex items-center space-x-2 text-xs">
                                              <span className="font-medium">{comment.author.name}</span>
                                              <span className="text-muted-foreground">
                                                {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                                              </span>
                                            </div>
                                            <p className="text-sm mt-1">{comment.content}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Review Form */}
                                <div>
                                  <h4 className="font-medium mb-2">Your Review</h4>
                                  <div className="space-y-4">
                                    <div className="flex space-x-2">
                                      <Button
                                        variant={reviewDecision === 'APPROVED' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setReviewDecision('APPROVED')}
                                        className="flex items-center space-x-1"
                                      >
                                        <ThumbsUp className="h-4 w-4" />
                                        <span>Approve</span>
                                      </Button>
                                      <Button
                                        variant={reviewDecision === 'CHANGES_REQUESTED' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setReviewDecision('CHANGES_REQUESTED')}
                                        className="flex items-center space-x-1"
                                      >
                                        <AlertCircle className="h-4 w-4" />
                                        <span>Request Changes</span>
                                      </Button>
                                      <Button
                                        variant={reviewDecision === 'REJECTED' ? 'destructive' : 'outline'}
                                        size="sm"
                                        onClick={() => setReviewDecision('REJECTED')}
                                        className="flex items-center space-x-1"
                                      >
                                        <ThumbsDown className="h-4 w-4" />
                                        <span>Reject</span>
                                      </Button>
                                    </div>
                                    
                                    <div>
                                      <Label htmlFor="review-feedback">Feedback (optional)</Label>
                                      <Textarea
                                        id="review-feedback"
                                        placeholder="Add your feedback or suggestions..."
                                        value={reviewFeedback}
                                        onChange={(e) => setReviewFeedback(e.target.value)}
                                        className="mt-2"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </ScrollArea>
                            
                            <DialogFooter>
                              <Button 
                                variant="outline" 
                                onClick={() => setIsReviewDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => reviewDecision && handleApprovalDecision(request.id, reviewDecision, reviewFeedback)}
                                disabled={!reviewDecision}
                              >
                                Submit Review
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviewed" className="space-y-4">
          {reviewedRequests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p>No reviewed requests found</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviewedRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          {getStatusIcon(request.status)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-medium">{request.title}</h3>
                            <Badge className={getStatusColor(request.status)}>
                              {request.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{request.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>By {request.requestedBy.name}</span>
                            <span>Updated {formatDistanceToNow(request.updatedAt, { addSuffix: true })}</span>
                            <span>{request.approvers.filter(a => a.decision).length}/{request.approvers.length} approvals</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Templates</CardTitle>
              <CardDescription>
                Configure approval workflows for different types of content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates.map((template) => (
                  <Card key={template.id} className={template.isDefault ? "border-blue-200 bg-blue-50" : ""}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium">{template.name}</h4>
                            {template.isDefault && (
                              <Badge variant="secondary" className="text-xs">Default</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Requires {template.requiredApprovers} approval{template.requiredApprovers > 1 ? 's' : ''}</span>
                            <span>{template.approvers.length} approver{template.approvers.length > 1 ? 's' : ''} assigned</span>
                            <span>Created {format(template.createdAt, 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}