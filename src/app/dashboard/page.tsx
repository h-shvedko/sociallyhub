"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner, LoadingState } from "@/components/ui/loading-spinner"
import { 
  BarChart3, 
  Calendar, 
  MessageCircle, 
  PenTool, 
  TrendingUp, 
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox
} from "lucide-react"

interface DashboardStats {
  totalUsers: number
  activeUsers: number
  activeSessions: number
  postsCreated: number
  totalReach: number
  postEngagement: number
  connectedPlatforms: number
  totalComments: number
}

interface DashboardPost {
  id: string
  content: string
  platforms: string[]
  status: string
  publishedAt: string | null
  scheduledAt: string | null
  engagement: string
  campaign?: string | null
}

interface DashboardInboxItem {
  id: string
  author: string
  platform: string
  content: string
  time: string
  type: string
  status: string
  sentiment?: string | null
  isUrgent: boolean
  platformHandle?: string
  assignee?: string | null
}

interface InboxSummary {
  total: number
  urgent: number
  pending: number
  replied: number
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(true)
  const [inboxLoading, setInboxLoading] = useState(true)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [recentPosts, setRecentPosts] = useState<DashboardPost[]>([])
  const [inboxItems, setInboxItems] = useState<DashboardInboxItem[]>([])
  const [inboxSummary, setInboxSummary] = useState<InboxSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [postsError, setPostsError] = useState<string | null>(null)
  const [inboxError, setInboxError] = useState<string | null>(null)

  // Fetch real dashboard data from APIs
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session?.user) return
      
      // Fetch statistics
      try {
        setStatsLoading(true)
        const response = await fetch('/api/analytics/dashboard?timeRange=30d')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }
        const data = await response.json()
        setDashboardStats(data)
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Failed to load dashboard statistics')
      } finally {
        setStatsLoading(false)
      }
      
      // Fetch recent posts
      try {
        setPostsLoading(true)
        const response = await fetch('/api/dashboard/posts?limit=3')
        if (!response.ok) {
          throw new Error('Failed to fetch recent posts')
        }
        const data = await response.json()
        setRecentPosts(data.posts || [])
      } catch (err) {
        console.error('Error fetching recent posts:', err)
        setPostsError('Failed to load recent posts')
      } finally {
        setPostsLoading(false)
      }
      
      // Fetch inbox items
      try {
        setInboxLoading(true)
        const response = await fetch('/api/dashboard/inbox?limit=3')
        if (!response.ok) {
          throw new Error('Failed to fetch inbox items')
        }
        const data = await response.json()
        setInboxItems(data.items || [])
        setInboxSummary(data.summary || null)
      } catch (err) {
        console.error('Error fetching inbox items:', err)
        setInboxError('Failed to load inbox items')
      } finally {
        setInboxLoading(false)
      }
    }
    
    // Set initial loading state
    setTimeout(() => setLoading(false), 800)
    
    fetchDashboardData()
  }, [session])

  // Real statistics from database
  const stats = dashboardStats ? [
    {
      title: "Posts This Month",
      value: dashboardStats.postsCreated.toString(),
      change: dashboardStats.postsCreated > 20 ? "+" + Math.round((dashboardStats.postsCreated - 20) / 20 * 100) + "%" : "Below target",
      trend: dashboardStats.postsCreated > 20 ? "up" : "warning",
      icon: PenTool,
    },
    {
      title: "Total Comments",
      value: dashboardStats.totalComments.toString(),
      change: dashboardStats.totalComments > 50 ? "Active engagement" : "Low engagement",
      trend: dashboardStats.totalComments > 50 ? "up" : "neutral",
      icon: MessageCircle,
    },
    {
      title: "Total Reach",
      value: dashboardStats.totalReach > 1000 ? (dashboardStats.totalReach / 1000).toFixed(1) + "K" : dashboardStats.totalReach.toString(),
      change: dashboardStats.postEngagement > 100 ? "+" + Math.round((dashboardStats.postEngagement - 100) / 100 * 100) + "% engagement" : "Low engagement",
      trend: dashboardStats.postEngagement > 100 ? "up" : "warning",
      icon: TrendingUp,
    },
    {
      title: "Connected Accounts",
      value: dashboardStats.connectedPlatforms.toString(),
      change: dashboardStats.connectedPlatforms >= 3 ? "Well connected" : "Connect more platforms",
      trend: dashboardStats.connectedPlatforms >= 3 ? "up" : "warning",
      icon: Users,
    },
  ] : []

  // Real data is now fetched from APIs and stored in state

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6">
      {/* Material Design Header with proper typography */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-display-small font-normal text-md-on-background">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-body-large text-md-on-surface-variant">
            Here's what's happening with your social media.
          </p>
        </div>
        <div className="flex space-x-3">
          <Button 
            onClick={() => router.push('/dashboard/posts?compose=true')}
            className="bg-md-primary text-md-on-primary hover:bg-md-primary/90 shadow-md-level2 rounded-md-large transition-all duration-300 hover:shadow-md-level3"
          >
            <PenTool className="mr-2 h-4 w-4" />
            Compose Post
          </Button>
        </div>
      </div>

      {/* Material Design Stats Cards with Elevation */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          // Loading skeleton for stats
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="bg-md-surface-container rounded-md-medium shadow-md-level1 border-md-outline-variant/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
                <LoadingSpinner size="sm" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-8 bg-muted animate-pulse rounded w-16"></div>
                <div className="h-3 bg-muted animate-pulse rounded w-20"></div>
              </CardContent>
            </Card>
          ))
        ) : (
          stats.map((stat, index) => (
            <Card key={index} className="bg-md-surface-container rounded-md-medium shadow-md-level1 border-md-outline-variant/20 animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-title-medium font-medium text-md-on-surface">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-5 w-5 text-md-primary" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-headline-small font-normal text-md-on-surface">{stat.value}</div>
                <p className={`text-label-medium ${
                  stat.trend === 'up' ? 'text-md-tertiary' :
                  stat.trend === 'warning' ? 'text-md-error' :
                  'text-md-on-surface-variant'
                }`}>
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Posts with Material Design */}
        <Card className="bg-md-surface-container rounded-md-large shadow-md-level2 border-md-outline-variant/20 animate-slide-up">
          <CardHeader className="pb-4">
            <CardTitle className="text-headline-small font-normal text-md-on-surface">Recent Posts</CardTitle>
            <CardDescription className="text-body-medium text-md-on-surface-variant">
              Your latest social media activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {postsLoading ? (
              // Loading skeleton for posts
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-start space-x-4 rounded-md-medium bg-md-surface-container-high p-4 shadow-md-level1 border border-md-outline-variant/10">
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                    <div className="h-3 bg-muted animate-pulse rounded w-1/2"></div>
                    <div className="h-3 bg-muted animate-pulse rounded w-1/4"></div>
                  </div>
                </div>
              ))
            ) : postsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{postsError}</p>
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PenTool className="h-8 w-8 mx-auto mb-2" />
                <p>No posts yet. Create your first post!</p>
              </div>
            ) : (
              recentPosts.map((post, index) => (
                <div key={post.id} className="flex items-start space-x-4 rounded-md-medium bg-md-surface-container-high p-4 shadow-md-level1 border border-md-outline-variant/10 animate-fade-in" style={{animationDelay: `${index * 100}ms`}}>
                  <div className="flex-1 space-y-3">
                    <p className="text-body-medium text-md-on-surface">{post.content}</p>
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      <div className="flex space-x-1 flex-wrap gap-1">
                        {post.platforms.map((platform) => (
                          <Badge key={platform} className="bg-md-secondary-container text-md-on-secondary-container text-label-small rounded-md-small px-2 py-1">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                      <Badge className={`text-label-small rounded-md-small px-2 py-1 flex items-center gap-1 ${
                        post.status === 'published' ? 'bg-md-tertiary-container text-md-on-tertiary-container' :
                        post.status === 'scheduled' ? 'bg-md-primary-container text-md-on-primary-container' :
                        'bg-md-surface-variant text-md-on-surface-variant'
                      }`}>
                        {post.status === 'published' && <CheckCircle2 className="h-3 w-3" />}
                        {post.status === 'scheduled' && <Clock className="h-3 w-3" />}
                        {post.status === 'draft' && <AlertCircle className="h-3 w-3" />}
                        {post.status}
                      </Badge>
                    </div>
                    <p className="text-label-medium text-md-on-surface-variant">
                      {post.status === 'published' && post.publishedAt ? 
                        `${post.publishedAt} • ${post.engagement}` :
                        post.status === 'scheduled' && post.scheduledAt ?
                        `Scheduled for ${post.scheduledAt}` :
                        'Draft'
                      }
                    </p>
                  </div>
                </div>
              ))
            )}
            <Button 
              onClick={() => router.push('/dashboard/calendar')}
              className="w-full bg-md-surface-variant text-md-on-surface-variant hover:bg-md-surface-variant/80 rounded-md-medium border border-md-outline-variant transition-all duration-300 hover:shadow-md-level1"
            >
              <Calendar className="mr-2 h-4 w-4" />
              View Calendar
            </Button>
          </CardContent>
        </Card>

        {/* Inbox with Material Design */}
        <Card className="bg-md-surface-container rounded-md-large shadow-md-level2 border-md-outline-variant/20 animate-slide-up" style={{animationDelay: '200ms'}}>
          <CardHeader className="pb-4">
            <CardTitle className="text-headline-small font-normal text-md-on-surface">Inbox</CardTitle>
            <CardDescription className="text-body-medium text-md-on-surface-variant">
              Recent comments, mentions, and messages
              {inboxSummary && inboxSummary.urgent > 0 && (
                <span className="ml-2 text-red-600 font-medium">
                  • {inboxSummary.urgent} urgent
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inboxLoading ? (
              // Loading skeleton for inbox
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-start space-x-4 rounded-md-medium bg-md-surface-container-high p-4 shadow-md-level1 border border-md-outline-variant/10">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
                        <div className="h-3 bg-muted animate-pulse rounded w-16"></div>
                      </div>
                      <div className="h-3 bg-muted animate-pulse rounded w-12"></div>
                    </div>
                    <div className="h-4 bg-muted animate-pulse rounded w-full"></div>
                  </div>
                </div>
              ))
            ) : inboxError ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{inboxError}</p>
              </div>
            ) : inboxItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto mb-2" />
                <p>No recent messages. Your inbox is empty!</p>
              </div>
            ) : (
              inboxItems.map((item, index) => (
                <div key={item.id} className="flex items-start space-x-4 rounded-md-medium bg-md-surface-container-high p-4 shadow-md-level1 border border-md-outline-variant/10 animate-fade-in" style={{animationDelay: `${(index + 3) * 100}ms`}}>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-2">
                        <p className="text-title-medium font-medium text-md-on-surface">{item.author}</p>
                        <Badge className="bg-md-primary-container text-md-on-primary-container text-label-small rounded-md-small px-2 py-1">
                          {item.platform}
                        </Badge>
                        <Badge className={`text-label-small rounded-md-small px-2 py-1 ${
                          item.type === 'mention' ? 'bg-md-tertiary-container text-md-on-tertiary-container' :
                          item.type === 'dm' ? 'bg-md-primary-container text-md-on-primary-container' :
                          'bg-md-secondary-container text-md-on-secondary-container'
                        }`}>
                          {item.type}
                        </Badge>
                        {item.isUrgent && (
                          <Badge className="bg-red-100 text-red-800 text-label-small rounded-md-small px-2 py-1">
                            urgent
                          </Badge>
                        )}
                      </div>
                      <p className="text-label-medium text-md-on-surface-variant">{item.time}</p>
                    </div>
                    <p className="text-body-medium text-md-on-surface-variant">{item.content}</p>
                    {item.assignee && (
                      <p className="text-label-small text-md-on-surface-variant">
                        Assigned to: {item.assignee}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            <Button 
              onClick={() => router.push('/dashboard/inbox')}
              className="w-full bg-md-surface-variant text-md-on-surface-variant hover:bg-md-surface-variant/80 rounded-md-medium border border-md-outline-variant transition-all duration-300 hover:shadow-md-level1"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              View All Messages
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions with Material Design */}
      <Card className="bg-md-surface-container rounded-md-large shadow-md-level2 border-md-outline-variant/20 animate-scale-in" style={{animationDelay: '400ms'}}>
        <CardHeader className="pb-4">
          <CardTitle className="text-headline-small font-normal text-md-on-surface">Quick Actions</CardTitle>
          <CardDescription className="text-body-medium text-md-on-surface-variant">
            Get things done faster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button 
              onClick={() => router.push('/dashboard/posts?compose=true')}
              className="h-24 flex-col space-y-3 bg-md-primary-container text-md-on-primary-container rounded-md-large shadow-md-level1 border border-md-outline-variant/10 hover:scale-105 transition-all duration-200"
            >
              <PenTool className="h-6 w-6" />
              <span className="text-label-large">New Post</span>
            </Button>
            <Button 
              onClick={() => router.push('/dashboard/calendar')}
              className="h-24 flex-col space-y-3 bg-md-secondary-container text-md-on-secondary-container rounded-md-large shadow-md-level1 border border-md-outline-variant/10 hover:scale-105 transition-all duration-200"
            >
              <Calendar className="h-6 w-6" />
              <span className="text-label-large">Schedule Post</span>
            </Button>
            <Button 
              onClick={() => router.push('/dashboard/analytics')}
              className="h-24 flex-col space-y-3 bg-md-tertiary-container text-md-on-tertiary-container rounded-md-large shadow-md-level1 border border-md-outline-variant/10 hover:scale-105 transition-all duration-200"
            >
              <BarChart3 className="h-6 w-6" />
              <span className="text-label-large">View Analytics</span>
            </Button>
            <Button 
              onClick={() => router.push('/dashboard/accounts')}
              className="h-24 flex-col space-y-3 bg-md-surface-variant text-md-on-surface-variant rounded-md-large shadow-md-level1 border border-md-outline-variant hover:scale-105 transition-all duration-200"
            >
              <Users className="h-6 w-6" />
              <span className="text-label-large">Connect Account</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}