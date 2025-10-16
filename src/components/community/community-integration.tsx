'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ExternalLink,
  Users,
  MessageCircle,
  TrendingUp,
  ThumbsUp,
  Clock,
  Activity,
  Hash,
  Globe,
  Star,
  ArrowRight,
  Zap
} from 'lucide-react'

interface CommunityStats {
  totalForumPosts: number
  totalFeatureRequests: number
  activeUsers: number
  weeklyActivityByType: Array<{
    activityType: string
    _count: { activityType: number }
  }>
  recentForumActivity: Array<{
    id: string
    title: string
    views: number
    repliesCount: number
    createdAt: string
  }>
  popularFeatureRequests: Array<{
    id: string
    title: string
    votes: number
    status: string
    createdAt: string
  }>
}

interface DiscordIntegration {
  id: string
  guildName: string
  guildIcon?: string
  inviteUrl: string
  memberCount: number
  onlineMembers: number
  lastActivity: string
  isActive: boolean
  channels: {
    general?: string
    support?: string
    announcements?: string
    feature_requests?: string
    showcase?: string
  }
  recentActivity?: Array<{
    type: string
    userName: string
    channel?: string
    content?: string
    timestamp: string
  }>
}

interface CommunityIntegrationProps {
  workspaceId?: string
}

export function CommunityIntegration({ workspaceId }: CommunityIntegrationProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [discord, setDiscord] = useState<DiscordIntegration | null>(null)
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    fetchCommunityData()
  }, [workspaceId])

  const fetchCommunityData = async () => {
    try {
      const [activityResponse, discordResponse] = await Promise.all([
        fetch(`/api/community/activity${workspaceId ? `?workspaceId=${workspaceId}` : ''}&limit=10`),
        fetch(`/api/community/discord${workspaceId ? `?workspaceId=${workspaceId}` : ''}`)
      ])

      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        setStats(activityData.stats)
        setActivities(activityData.activities)
      }

      if (discordResponse.ok) {
        const discordData = await discordResponse.json()
        setDiscord(discordData.integration)
      }
    } catch (error) {
      console.error('Failed to fetch community data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatActivityTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'FORUM_POST_CREATED':
        return <MessageCircle className="h-4 w-4" />
      case 'FEATURE_REQUEST_CREATED':
        return <Zap className="h-4 w-4" />
      case 'FEATURE_REQUEST_VOTED':
        return <ThumbsUp className="h-4 w-4" />
      case 'DISCORD_MEMBER_JOINED':
        return <Users className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700'
      case 'IN_DEVELOPMENT':
        return 'bg-blue-100 text-blue-700'
      case 'UNDER_REVIEW':
        return 'bg-yellow-100 text-yellow-700'
      case 'APPROVED':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-8 w-12 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Community Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalForumPosts}</p>
                  <p className="text-sm text-gray-600">Forum Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalFeatureRequests}</p>
                  <p className="text-sm text-gray-600">Feature Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeUsers}</p>
                  <p className="text-sm text-gray-600">Active Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.weeklyActivityByType.reduce((acc, curr) => acc + curr._count.activityType, 0)}
                  </p>
                  <p className="text-sm text-gray-600">Weekly Activity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Community Forum */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Community Forum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Join discussions, ask questions, and connect with other users in our community forum.
              </p>

              {stats?.recentForumActivity && stats.recentForumActivity.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Recent Forum Activity</h4>
                  {stats.recentForumActivity.slice(0, 3).map((post) => (
                    <div key={post.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">{post.title}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {post.views} views
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {post.replies} replies
                          </span>
                          <span>{formatActivityTime(post.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent forum activity</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => window.open('/community/forum', '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visit Forum
                </Button>
                <Button variant="outline" onClick={() => window.open('/community/forum/new', '_blank')}>
                  New Post
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discord Server */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Discord Server
              {discord?.isActive && (
                <div className="w-2 h-2 bg-green-500 rounded-full ml-auto" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {discord ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {discord.guildIcon && (
                    <img
                      src={discord.guildIcon}
                      alt={discord.guildName}
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{discord.guildName}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {discord.memberCount} members
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        {discord.onlineMembers} online
                      </span>
                    </div>
                  </div>
                </div>

                {discord.recentActivity && discord.recentActivity.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Recent Activity</h4>
                    {discord.recentActivity.slice(0, 3).map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Users className="h-3 w-3 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.userName}</span>
                            {activity.type === 'member_joined' && ' joined the server'}
                            {activity.type === 'message_posted' && activity.channel && ` posted in #${activity.channel}`}
                            {activity.type === 'feature_discussed' && activity.channel && ` discussed in #${activity.channel}`}
                          </p>
                          {activity.content && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">"{activity.content}"</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">{formatActivityTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => window.open(discord.inviteUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Discord Server
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Hash className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-4">
                  Connect with our community on Discord for real-time discussions and support.
                </p>
                <Button onClick={() => window.open('https://discord.gg/sociallyhub', '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Join Discord Server
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Feature Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Suggest new features and vote on ideas from the community.
              </p>

              {stats?.popularFeatureRequests && stats.popularFeatureRequests.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Popular Requests</h4>
                  {stats.popularFeatureRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">{request.title}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge className={getStatusColor(request.status)}>
                            {request.status.replace('_', ' ')}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <ThumbsUp className="h-3 w-3" />
                            {request.votes} votes
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No feature requests yet</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => window.open('/community/feature-requests', '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All
                </Button>
                <Button variant="outline" onClick={() => window.open('/community/feature-requests/new', '_blank')}>
                  Submit Idea
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Community Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities && activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                        {getActivityIcon(activity.activityType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{activity.userName}</span>{' '}
                          {activity.title.toLowerCase()}
                        </p>
                        {activity.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {formatActivityTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => window.open('/community/activity', '_blank')}>
                View All Activity
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}