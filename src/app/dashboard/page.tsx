"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Calendar, 
  MessageCircle, 
  PenTool, 
  TrendingUp, 
  Users,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react"

export default function DashboardPage() {
  // Mock data - will be replaced with real data from API
  const stats = [
    {
      title: "Posts This Week",
      value: "24",
      change: "+12%",
      trend: "up",
      icon: PenTool,
    },
    {
      title: "Inbox Items",
      value: "8",
      change: "3 urgent",
      trend: "neutral",
      icon: MessageCircle,
    },
    {
      title: "Total Reach",
      value: "45.2K",
      change: "+18%",
      trend: "up",
      icon: TrendingUp,
    },
    {
      title: "Connected Accounts",
      value: "6",
      change: "2 expire soon",
      trend: "warning",
      icon: Users,
    },
  ]

  const recentPosts = [
    {
      id: 1,
      content: "Exciting news about our new product launch! 🚀",
      platforms: ["Twitter", "LinkedIn", "Facebook"],
      status: "published",
      publishedAt: "2 hours ago",
      engagement: "124 likes, 23 comments"
    },
    {
      id: 2,
      content: "Behind the scenes of our team meeting...",
      platforms: ["Instagram", "TikTok"],
      status: "scheduled",
      scheduledAt: "Tomorrow 9:00 AM",
      engagement: "Pending"
    },
    {
      id: 3,
      content: "Customer success story: How we helped...",
      platforms: ["LinkedIn", "Twitter"],
      status: "draft",
      scheduledAt: null,
      engagement: "Draft"
    },
  ]

  const inboxItems = [
    {
      id: 1,
      author: "John Smith",
      platform: "Twitter",
      content: "Love this new feature! When will it be available?",
      time: "5 minutes ago",
      type: "mention"
    },
    {
      id: 2,
      author: "Sarah Johnson",
      platform: "Instagram",
      content: "Can you help me with my order #12345?",
      time: "1 hour ago",
      type: "dm"
    },
    {
      id: 3,
      author: "Mike Davis",
      platform: "Facebook",
      content: "Great post! We're interested in partnering.",
      time: "3 hours ago",
      type: "comment"
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your social media.
          </p>
        </div>
        <div className="flex space-x-3">
          <Button>
            <PenTool className="mr-2 h-4 w-4" />
            Compose Post
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs ${
                stat.trend === 'up' ? 'text-green-600' :
                stat.trend === 'warning' ? 'text-yellow-600' :
                'text-muted-foreground'
              }`}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Posts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>
              Your latest social media activity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentPosts.map((post) => (
              <div key={post.id} className="flex items-start space-x-4 rounded-lg border p-4">
                <div className="flex-1 space-y-2">
                  <p className="text-sm">{post.content}</p>
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      {post.platforms.map((platform) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                    <Badge 
                      variant={
                        post.status === 'published' ? 'default' :
                        post.status === 'scheduled' ? 'secondary' :
                        'outline'
                      }
                      className="text-xs"
                    >
                      {post.status === 'published' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {post.status === 'scheduled' && <Clock className="mr-1 h-3 w-3" />}
                      {post.status === 'draft' && <AlertCircle className="mr-1 h-3 w-3" />}
                      {post.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {post.status === 'published' ? 
                      `${post.publishedAt} • ${post.engagement}` :
                      post.status === 'scheduled' ?
                      `Scheduled for ${post.scheduledAt}` :
                      'Draft'
                    }
                  </p>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              <Calendar className="mr-2 h-4 w-4" />
              View Calendar
            </Button>
          </CardContent>
        </Card>

        {/* Inbox */}
        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              Recent comments, mentions, and messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inboxItems.map((item) => (
              <div key={item.id} className="flex items-start space-x-4 rounded-lg border p-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">{item.author}</p>
                      <Badge variant="outline" className="text-xs">
                        {item.platform}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {item.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.content}</p>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              <MessageCircle className="mr-2 h-4 w-4" />
              View All Messages
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Get things done faster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <PenTool className="h-6 w-6" />
              <span>New Post</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Calendar className="h-6 w-6" />
              <span>Schedule Post</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <BarChart3 className="h-6 w-6" />
              <span>View Analytics</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2">
              <Users className="h-6 w-6" />
              <span>Connect Account</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}