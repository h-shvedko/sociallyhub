"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Activity,
  User,
  UserPlus,
  UserMinus,
  FileText,
  Calendar,
  Settings,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  Share2,
  Edit,
  Trash2,
  Upload,
  Download,
  Eye,
  Clock,
  Filter,
  Search,
  Zap,
  Shield,
  Link,
  Image as ImageIcon,
  Video,
  Bookmark,
  Tag
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns"

interface ActivityItem {
  id: string
  type: 'user_joined' | 'user_left' | 'role_changed' | 'post_created' | 'post_published' | 'post_scheduled' | 
        'post_approved' | 'post_rejected' | 'campaign_created' | 'campaign_launched' | 'template_created' |
        'comment_added' | 'media_uploaded' | 'settings_changed' | 'account_connected' | 'account_disconnected' |
        'approval_request' | 'workflow_created' | 'permission_changed' | 'export_generated' | 'login' | 'logout'
  actor: {
    id: string
    name: string
    email: string
    image?: string
    role?: string
  }
  target?: {
    id: string
    name: string
    type: 'user' | 'post' | 'campaign' | 'template' | 'comment' | 'workflow' | 'account' | 'setting'
  }
  metadata?: {
    previousValue?: string
    newValue?: string
    platform?: string
    reason?: string
    location?: string
    ipAddress?: string
    userAgent?: string
    [key: string]: any
  }
  createdAt: Date
  importance: 'low' | 'medium' | 'high' | 'critical'
  isPrivate?: boolean
}

interface ActivityFilter {
  type?: string
  actor?: string
  timeRange?: string
  importance?: string
}

interface TeamActivityFeedProps {
  workspaceId?: string
  showFilters?: boolean
  maxItems?: number
}

export function TeamActivityFeed({ 
  workspaceId, 
  showFilters = true,
  maxItems = 50 
}: TeamActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [filters, setFilters] = useState<ActivityFilter>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadMockData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [activities, filters, searchQuery, activeTab])

  const loadMockData = () => {
    const mockActivities: ActivityItem[] = [
      {
        id: "1",
        type: "post_published",
        actor: {
          id: "u1",
          name: "Sarah Johnson",
          email: "sarah@company.com",
          image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
          role: "Content Creator"
        },
        target: {
          id: "p1",
          name: "Spring Campaign Launch",
          type: "post"
        },
        metadata: {
          platform: "Instagram",
          reach: 15000
        },
        createdAt: new Date("2024-03-15T14:30:00"),
        importance: "high"
      },
      {
        id: "2", 
        type: "user_joined",
        actor: {
          id: "u2",
          name: "Mike Chen",
          email: "mike@company.com",
          role: "Marketing Manager"
        },
        target: {
          id: "w1",
          name: "Marketing Team",
          type: "user"
        },
        metadata: {
          invitedBy: "Emily Davis",
          role: "Marketing Manager"
        },
        createdAt: new Date("2024-03-15T10:15:00"),
        importance: "medium"
      },
      {
        id: "3",
        type: "post_approved",
        actor: {
          id: "u3",
          name: "Emily Davis", 
          email: "emily@company.com",
          image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
          role: "Brand Director"
        },
        target: {
          id: "p2",
          name: "Behind the Scenes Content",
          type: "post"
        },
        metadata: {
          feedback: "Great authentic content! This aligns well with our brand voice.",
          approvalTime: "2.5 hours"
        },
        createdAt: new Date("2024-03-15T09:45:00"),
        importance: "medium"
      },
      {
        id: "4",
        type: "campaign_created",
        actor: {
          id: "u1",
          name: "Sarah Johnson",
          email: "sarah@company.com",
          image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
          role: "Content Creator"
        },
        target: {
          id: "c1",
          name: "Summer 2024 Collection",
          type: "campaign"
        },
        metadata: {
          budget: "$5000",
          duration: "30 days",
          platforms: ["Instagram", "Facebook", "TikTok"]
        },
        createdAt: new Date("2024-03-14T16:20:00"),
        importance: "high"
      },
      {
        id: "5",
        type: "role_changed",
        actor: {
          id: "admin",
          name: "John Admin",
          email: "admin@company.com",
          role: "Administrator"
        },
        target: {
          id: "u4",
          name: "Alex Wilson",
          type: "user"
        },
        metadata: {
          previousValue: "Editor",
          newValue: "Manager",
          reason: "Promotion and expanded responsibilities"
        },
        createdAt: new Date("2024-03-14T11:30:00"),
        importance: "medium"
      },
      {
        id: "6",
        type: "media_uploaded",
        actor: {
          id: "u5",
          name: "Jordan Smith",
          email: "jordan@company.com",
          role: "Designer"
        },
        target: {
          id: "m1", 
          name: "Product Photography Set",
          type: "post"
        },
        metadata: {
          fileCount: 25,
          totalSize: "120MB",
          fileTypes: ["JPG", "PNG"]
        },
        createdAt: new Date("2024-03-14T09:10:00"),
        importance: "low"
      },
      {
        id: "7",
        type: "account_connected",
        actor: {
          id: "u1",
          name: "Sarah Johnson", 
          email: "sarah@company.com",
          image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
          role: "Content Creator"
        },
        target: {
          id: "a1",
          name: "TikTok Business Account",
          type: "account"
        },
        metadata: {
          platform: "TikTok",
          handle: "@company_official",
          followers: 12500
        },
        createdAt: new Date("2024-03-13T15:45:00"),
        importance: "medium"
      },
      {
        id: "8",
        type: "post_rejected",
        actor: {
          id: "u3",
          name: "Emily Davis",
          email: "emily@company.com", 
          image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
          role: "Brand Director"
        },
        target: {
          id: "p3",
          name: "Controversial Marketing Post",
          type: "post"
        },
        metadata: {
          reason: "Content doesn't align with brand guidelines",
          feedback: "Please revise the messaging to be more inclusive and brand-appropriate."
        },
        createdAt: new Date("2024-03-13T13:20:00"),
        importance: "high"
      },
      {
        id: "9",
        type: "settings_changed",
        actor: {
          id: "admin",
          name: "John Admin",
          email: "admin@company.com",
          role: "Administrator"
        },
        target: {
          id: "s1",
          name: "Approval Workflow Settings",
          type: "setting"
        },
        metadata: {
          changes: "Updated required approvers from 1 to 2 for promotional content",
          category: "workflow"
        },
        createdAt: new Date("2024-03-13T10:00:00"),
        importance: "medium"
      },
      {
        id: "10",
        type: "comment_added",
        actor: {
          id: "u4",
          name: "Alex Wilson",
          email: "alex@company.com",
          role: "Manager"
        },
        target: {
          id: "p1",
          name: "Spring Campaign Launch",
          type: "post"
        },
        metadata: {
          comment: "Great engagement on this post! Let's create similar content for the next campaign.",
          mentions: ["@sarah", "@emily"]
        },
        createdAt: new Date("2024-03-12T18:35:00"),
        importance: "low"
      }
    ]

    // Sort by creation date (newest first)
    mockActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    setActivities(mockActivities)
    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...activities]

    // Apply tab filter
    if (activeTab !== "all") {
      const tabFilters = {
        "team": ["user_joined", "user_left", "role_changed", "permission_changed"],
        "content": ["post_created", "post_published", "post_scheduled", "post_approved", "post_rejected", "media_uploaded", "template_created"],
        "system": ["settings_changed", "account_connected", "account_disconnected", "workflow_created", "export_generated", "login", "logout"]
      }
      filtered = filtered.filter(activity => 
        tabFilters[activeTab as keyof typeof tabFilters]?.includes(activity.type)
      )
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(activity => 
        activity.actor.name.toLowerCase().includes(query) ||
        activity.target?.name?.toLowerCase().includes(query) ||
        getActivityDescription(activity).toLowerCase().includes(query)
      )
    }

    // Apply other filters
    if (filters.type) {
      filtered = filtered.filter(activity => activity.type === filters.type)
    }
    
    if (filters.actor && filters.actor !== "all") {
      filtered = filtered.filter(activity => activity.actor.id === filters.actor)
    }
    
    if (filters.importance && filters.importance !== "all") {
      filtered = filtered.filter(activity => activity.importance === filters.importance)
    }
    
    if (filters.timeRange && filters.timeRange !== "all") {
      const now = new Date()
      const ranges = {
        "today": (date: Date) => isToday(date),
        "yesterday": (date: Date) => isYesterday(date), 
        "this-week": (date: Date) => isThisWeek(date),
        "last-7-days": (date: Date) => (now.getTime() - date.getTime()) <= 7 * 24 * 60 * 60 * 1000
      }
      
      if (ranges[filters.timeRange as keyof typeof ranges]) {
        filtered = filtered.filter(activity => 
          ranges[filters.timeRange as keyof typeof ranges](activity.createdAt)
        )
      }
    }

    // Limit to maxItems if specified
    if (maxItems) {
      filtered = filtered.slice(0, maxItems)
    }

    setFilteredActivities(filtered)
  }

  const getActivityIcon = (type: string) => {
    const icons = {
      user_joined: <UserPlus className="h-4 w-4 text-green-500" />,
      user_left: <UserMinus className="h-4 w-4 text-red-500" />,
      role_changed: <Shield className="h-4 w-4 text-blue-500" />,
      post_created: <FileText className="h-4 w-4 text-blue-500" />,
      post_published: <Share2 className="h-4 w-4 text-green-500" />,
      post_scheduled: <Calendar className="h-4 w-4 text-orange-500" />,
      post_approved: <CheckCircle className="h-4 w-4 text-green-500" />,
      post_rejected: <XCircle className="h-4 w-4 text-red-500" />,
      campaign_created: <Zap className="h-4 w-4 text-purple-500" />,
      campaign_launched: <Zap className="h-4 w-4 text-green-500" />,
      template_created: <Bookmark className="h-4 w-4 text-blue-500" />,
      comment_added: <MessageSquare className="h-4 w-4 text-blue-500" />,
      media_uploaded: <Upload className="h-4 w-4 text-blue-500" />,
      settings_changed: <Settings className="h-4 w-4 text-orange-500" />,
      account_connected: <Link className="h-4 w-4 text-green-500" />,
      account_disconnected: <Link className="h-4 w-4 text-red-500" />,
      approval_request: <AlertCircle className="h-4 w-4 text-yellow-500" />,
      workflow_created: <Settings className="h-4 w-4 text-blue-500" />,
      permission_changed: <Shield className="h-4 w-4 text-orange-500" />,
      export_generated: <Download className="h-4 w-4 text-blue-500" />,
      login: <User className="h-4 w-4 text-green-500" />,
      logout: <User className="h-4 w-4 text-gray-500" />
    }
    return icons[type as keyof typeof icons] || <Activity className="h-4 w-4 text-gray-500" />
  }

  const getActivityDescription = (activity: ActivityItem): string => {
    const { type, actor, target, metadata } = activity
    
    switch (type) {
      case 'user_joined':
        return `joined the team as ${metadata?.role || 'a team member'}`
      case 'user_left':
        return `left the team`
      case 'role_changed':
        return `changed ${target?.name}'s role from ${metadata?.previousValue} to ${metadata?.newValue}`
      case 'post_created':
        return `created a new post "${target?.name}"`
      case 'post_published':
        return `published "${target?.name}" to ${metadata?.platform}`
      case 'post_scheduled':
        return `scheduled "${target?.name}" for publishing`
      case 'post_approved':
        return `approved "${target?.name}"`
      case 'post_rejected':
        return `rejected "${target?.name}"`
      case 'campaign_created':
        return `created campaign "${target?.name}"`
      case 'campaign_launched':
        return `launched campaign "${target?.name}"`
      case 'template_created':
        return `created template "${target?.name}"`
      case 'comment_added':
        return `commented on "${target?.name}"`
      case 'media_uploaded':
        return `uploaded ${metadata?.fileCount} files to "${target?.name}"`
      case 'settings_changed':
        return `updated ${target?.name}`
      case 'account_connected':
        return `connected ${metadata?.platform} account "${metadata?.handle}"`
      case 'account_disconnected':
        return `disconnected ${metadata?.platform} account`
      case 'approval_request':
        return `requested approval for "${target?.name}"`
      case 'workflow_created':
        return `created workflow "${target?.name}"`
      case 'permission_changed':
        return `updated permissions for ${target?.name}`
      case 'export_generated':
        return `generated ${target?.name} export`
      case 'login':
        return `logged in${metadata?.location ? ` from ${metadata.location}` : ''}`
      case 'logout':
        return `logged out`
      default:
        return `performed an action on ${target?.name || 'the system'}`
    }
  }

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical': return 'border-l-red-500 bg-red-50'
      case 'high': return 'border-l-orange-500 bg-orange-50'
      case 'medium': return 'border-l-blue-500 bg-blue-50'
      case 'low': return 'border-l-gray-500 bg-gray-50'
      default: return 'border-l-gray-300'
    }
  }

  const groupActivitiesByDate = (activities: ActivityItem[]) => {
    const groups: { [key: string]: ActivityItem[] } = {}
    
    activities.forEach(activity => {
      let dateKey: string
      
      if (isToday(activity.createdAt)) {
        dateKey = 'Today'
      } else if (isYesterday(activity.createdAt)) {
        dateKey = 'Yesterday'
      } else {
        dateKey = format(activity.createdAt, 'MMMM dd, yyyy')
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(activity)
    })
    
    return groups
  }

  const uniqueActors = Array.from(new Set(activities.map(a => a.actor.id)))
    .map(id => activities.find(a => a.actor.id === id)?.actor)
    .filter(Boolean)

  const activityTypes = Array.from(new Set(activities.map(a => a.type)))

  const groupedActivities = groupActivitiesByDate(filteredActivities)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Activity</h2>
          <p className="text-muted-foreground">Track team actions and workspace changes</p>
        </div>
        
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Activity
        </Button>
      </div>

      {/* Activity Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span>Today's Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.filter(a => isToday(a.createdAt)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {activities.filter(a => isToday(a.createdAt) && a.importance === 'high').length} high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <User className="h-4 w-4 text-green-500" />
              <span>Active Users</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(activities.filter(a => isToday(a.createdAt)).map(a => a.actor.id)).size}
            </div>
            <p className="text-xs text-muted-foreground">Active today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <FileText className="h-4 w-4 text-purple-500" />
              <span>Content Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.filter(a => 
                ['post_created', 'post_published', 'post_approved', 'post_rejected'].includes(a.type)
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Settings className="h-4 w-4 text-orange-500" />
              <span>System Changes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.filter(a => 
                ['settings_changed', 'role_changed', 'permission_changed', 'workflow_created'].includes(a.type)
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              
              <Select 
                value={filters.timeRange || "all"} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, timeRange: value }))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={filters.actor || "all"} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, actor: value }))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Team Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {uniqueActors.map(actor => actor && (
                    <SelectItem key={actor.id} value={actor.id}>{actor.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={filters.importance || "all"} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, importance: value }))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Activity</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {Object.keys(groupedActivities).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2" />
                  <p>No activities found matching your filters</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedActivities).map(([dateGroup, groupActivities]) => (
              <Card key={dateGroup}>
                <CardHeader>
                  <CardTitle className="text-lg">{dateGroup}</CardTitle>
                  <CardDescription>
                    {groupActivities.length} activit{groupActivities.length === 1 ? 'y' : 'ies'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-4">
                      {groupActivities.map((activity) => (
                        <div 
                          key={activity.id} 
                          className={cn(
                            "flex items-start space-x-4 p-3 rounded-lg border-l-4 transition-colors hover:bg-muted/50",
                            getImportanceColor(activity.importance)
                          )}
                        >
                          <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center">
                            {getActivityIcon(activity.type)}
                          </div>
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={activity.actor.image} />
                                <AvatarFallback className="text-xs">
                                  {activity.actor.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{activity.actor.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {getActivityDescription(activity)}
                              </span>
                            </div>
                            
                            {/* Activity metadata */}
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              <div className="ml-8 mt-2">
                                {activity.metadata.feedback && (
                                  <p className="text-xs text-muted-foreground italic">
                                    "{activity.metadata.feedback}"
                                  </p>
                                )}
                                {activity.metadata.platforms && Array.isArray(activity.metadata.platforms) && (
                                  <div className="flex space-x-1 mt-1">
                                    {activity.metadata.platforms.map((platform: string) => (
                                      <Badge key={platform} variant="secondary" className="text-xs">
                                        {platform}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                {activity.metadata.fileCount && (
                                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                                    <span>{activity.metadata.fileCount} files</span>
                                    <span>•</span>
                                    <span>{activity.metadata.totalSize}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground flex items-center space-x-2">
                            <span>{format(activity.createdAt, 'HH:mm')}</span>
                            {activity.importance === 'high' && <Star className="h-3 w-3 text-orange-500" />}
                            {activity.importance === 'critical' && <AlertCircle className="h-3 w-3 text-red-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}