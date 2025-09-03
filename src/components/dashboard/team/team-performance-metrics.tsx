"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CheckCircle,
  Clock,
  Target,
  Award,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Star,
  Zap,
  Eye,
  MessageSquare,
  Share2,
  ThumbsUp,
  Download,
  Filter,
  User,
  Crown,
  Shield,
  Edit,
  Settings,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"

interface TeamMember {
  id: string
  name: string
  email: string
  image?: string
  role: string
  joinedAt: Date
  metrics: {
    postsCreated: number
    postsPublished: number
    postsApproved: number
    postsRejected: number
    commentsMade: number
    collaborations: number
    avgApprovalTime: number // in hours
    engagement: {
      likes: number
      comments: number
      shares: number
      views: number
    }
    productivity: {
      tasksCompleted: number
      tasksAssigned: number
      hoursWorked: number
      efficiency: number // 0-100
    }
    quality: {
      approvalRate: number // 0-100
      revision_requests: number
      rating: number // 1-5
    }
  }
  performance: {
    currentStreak: number
    bestStreak: number
    goalsAchieved: number
    totalGoals: number
    lastActivity: Date
  }
  goals: Array<{
    id: string
    title: string
    target: number
    current: number
    period: 'daily' | 'weekly' | 'monthly'
    type: 'posts' | 'engagement' | 'approval_rate' | 'collaboration'
  }>
}

interface TeamMetrics {
  overview: {
    totalMembers: number
    activeMembers: number
    avgProductivity: number
    teamEfficiency: number
  }
  period: {
    postsCreated: number
    postsPublished: number
    totalEngagement: number
    collaborations: number
  }
  trends: {
    productivity: number
    engagement: number
    quality: number
    collaboration: number
  }
}

interface TeamPerformanceMetricsProps {
  workspaceId?: string
  period?: 'week' | 'month' | 'quarter'
}

export function TeamPerformanceMetrics({ 
  workspaceId, 
  period = 'month' 
}: TeamPerformanceMetricsProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null)
  const [selectedMember, setSelectedMember] = useState<string>("")
  const [selectedPeriod, setSelectedPeriod] = useState(period)
  const [activeTab, setActiveTab] = useState("overview")
  const [sortBy, setSortBy] = useState<'performance' | 'productivity' | 'quality' | 'engagement'>('performance')

  useEffect(() => {
    loadMockData()
  }, [selectedPeriod])

  const loadMockData = () => {
    const mockTeamMembers: TeamMember[] = [
      {
        id: "u1",
        name: "Sarah Johnson",
        email: "sarah@company.com",
        image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
        role: "Content Creator",
        joinedAt: new Date("2024-01-15"),
        metrics: {
          postsCreated: 24,
          postsPublished: 22,
          postsApproved: 20,
          postsRejected: 2,
          commentsMade: 45,
          collaborations: 8,
          avgApprovalTime: 2.5,
          engagement: {
            likes: 15420,
            comments: 892,
            shares: 234,
            views: 45680
          },
          productivity: {
            tasksCompleted: 28,
            tasksAssigned: 32,
            hoursWorked: 158,
            efficiency: 87
          },
          quality: {
            approvalRate: 91,
            revision_requests: 3,
            rating: 4.8
          }
        },
        performance: {
          currentStreak: 12,
          bestStreak: 18,
          goalsAchieved: 8,
          totalGoals: 10,
          lastActivity: new Date("2024-03-15T14:30:00")
        },
        goals: [
          {
            id: "g1",
            title: "Monthly Post Target",
            target: 25,
            current: 24,
            period: "monthly",
            type: "posts"
          },
          {
            id: "g2", 
            title: "Engagement Rate",
            target: 5.5,
            current: 6.2,
            period: "monthly",
            type: "engagement"
          }
        ]
      },
      {
        id: "u2",
        name: "Mike Chen",
        email: "mike@company.com",
        role: "Marketing Manager",
        joinedAt: new Date("2023-11-20"),
        metrics: {
          postsCreated: 16,
          postsPublished: 15,
          postsApproved: 14,
          postsRejected: 1,
          commentsMade: 67,
          collaborations: 15,
          avgApprovalTime: 1.8,
          engagement: {
            likes: 8930,
            comments: 456,
            shares: 123,
            views: 28450
          },
          productivity: {
            tasksCompleted: 35,
            tasksAssigned: 38,
            hoursWorked: 162,
            efficiency: 92
          },
          quality: {
            approvalRate: 93,
            revision_requests: 2,
            rating: 4.9
          }
        },
        performance: {
          currentStreak: 8,
          bestStreak: 23,
          goalsAchieved: 9,
          totalGoals: 11,
          lastActivity: new Date("2024-03-15T16:45:00")
        },
        goals: [
          {
            id: "g3",
            title: "Team Collaboration",
            target: 20,
            current: 15,
            period: "monthly",
            type: "collaboration"
          }
        ]
      },
      {
        id: "u3",
        name: "Emily Davis",
        email: "emily@company.com", 
        image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
        role: "Brand Director",
        joinedAt: new Date("2023-09-10"),
        metrics: {
          postsCreated: 12,
          postsPublished: 11,
          postsApproved: 10,
          postsRejected: 1,
          commentsMade: 89,
          collaborations: 22,
          avgApprovalTime: 1.2,
          engagement: {
            likes: 12350,
            comments: 678,
            shares: 189,
            views: 35670
          },
          productivity: {
            tasksCompleted: 31,
            tasksAssigned: 33,
            hoursWorked: 145,
            efficiency: 94
          },
          quality: {
            approvalRate: 91,
            revision_requests: 1,
            rating: 4.9
          }
        },
        performance: {
          currentStreak: 15,
          bestStreak: 28,
          goalsAchieved: 7,
          totalGoals: 8,
          lastActivity: new Date("2024-03-15T11:20:00")
        },
        goals: [
          {
            id: "g4",
            title: "Approval Rate Target",
            target: 95,
            current: 91,
            period: "monthly", 
            type: "approval_rate"
          }
        ]
      },
      {
        id: "u4",
        name: "Alex Wilson",
        email: "alex@company.com",
        role: "Copywriter",
        joinedAt: new Date("2024-02-01"),
        metrics: {
          postsCreated: 18,
          postsPublished: 16,
          postsApproved: 14,
          postsRejected: 2,
          commentsMade: 34,
          collaborations: 6,
          avgApprovalTime: 3.2,
          engagement: {
            likes: 6780,
            comments: 234,
            shares: 67,
            views: 18900
          },
          productivity: {
            tasksCompleted: 22,
            tasksAssigned: 28,
            hoursWorked: 142,
            efficiency: 79
          },
          quality: {
            approvalRate: 78,
            revision_requests: 6,
            rating: 4.2
          }
        },
        performance: {
          currentStreak: 5,
          bestStreak: 9,
          goalsAchieved: 4,
          totalGoals: 8,
          lastActivity: new Date("2024-03-15T09:15:00")
        },
        goals: [
          {
            id: "g5",
            title: "Quality Improvement",
            target: 85,
            current: 78,
            period: "monthly",
            type: "approval_rate"
          }
        ]
      }
    ]

    const mockTeamMetrics: TeamMetrics = {
      overview: {
        totalMembers: mockTeamMembers.length,
        activeMembers: mockTeamMembers.filter(m => 
          (new Date().getTime() - m.performance.lastActivity.getTime()) < 24 * 60 * 60 * 1000
        ).length,
        avgProductivity: Math.round(
          mockTeamMembers.reduce((sum, m) => sum + m.metrics.productivity.efficiency, 0) / mockTeamMembers.length
        ),
        teamEfficiency: 88
      },
      period: {
        postsCreated: mockTeamMembers.reduce((sum, m) => sum + m.metrics.postsCreated, 0),
        postsPublished: mockTeamMembers.reduce((sum, m) => sum + m.metrics.postsPublished, 0),
        totalEngagement: mockTeamMembers.reduce((sum, m) => 
          sum + m.metrics.engagement.likes + m.metrics.engagement.comments + m.metrics.engagement.shares, 0
        ),
        collaborations: mockTeamMembers.reduce((sum, m) => sum + m.metrics.collaborations, 0)
      },
      trends: {
        productivity: 12,
        engagement: 8,
        quality: 5,
        collaboration: 15
      }
    }

    setTeamMembers(mockTeamMembers)
    setTeamMetrics(mockTeamMetrics)
  }

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'brand director': return <Crown className="h-4 w-4 text-yellow-500" />
      case 'marketing manager': return <Shield className="h-4 w-4 text-blue-500" />
      case 'content creator': return <Star className="h-4 w-4 text-green-500" />
      case 'copywriter': return <Edit className="h-4 w-4 text-purple-500" />
      default: return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  const getPerformanceScore = (member: TeamMember): number => {
    const efficiency = member.metrics.productivity.efficiency
    const approvalRate = member.metrics.quality.approvalRate
    const engagement = Math.min(100, (member.metrics.engagement.likes / 100))
    const collaboration = Math.min(100, (member.metrics.collaborations * 5))
    
    return Math.round((efficiency + approvalRate + engagement + collaboration) / 4)
  }

  const sortedMembers = [...teamMembers].sort((a, b) => {
    switch (sortBy) {
      case 'performance':
        return getPerformanceScore(b) - getPerformanceScore(a)
      case 'productivity':
        return b.metrics.productivity.efficiency - a.metrics.productivity.efficiency
      case 'quality':
        return b.metrics.quality.approvalRate - a.metrics.quality.approvalRate
      case 'engagement':
        return (b.metrics.engagement.likes + b.metrics.engagement.comments + b.metrics.engagement.shares) -
               (a.metrics.engagement.likes + a.metrics.engagement.comments + a.metrics.engagement.shares)
      default:
        return 0
    }
  })

  const selectedMemberData = teamMembers.find(m => m.id === selectedMember)

  if (!teamMetrics) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Performance</h2>
          <p className="text-muted-foreground">Track team productivity, quality, and collaboration metrics</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Team Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span>Team Members</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.overview.totalMembers}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>{teamMetrics.overview.activeMembers} active today</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Target className="h-4 w-4 text-green-500" />
              <span>Team Productivity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.overview.avgProductivity}%</div>
            <div className="flex items-center space-x-1 text-xs">
              {getTrendIcon(teamMetrics.trends.productivity)}
              <span className={cn(
                teamMetrics.trends.productivity > 0 ? "text-green-600" : 
                teamMetrics.trends.productivity < 0 ? "text-red-600" : "text-gray-600"
              )}>
                {teamMetrics.trends.productivity > 0 ? "+" : ""}{teamMetrics.trends.productivity}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <FileText className="h-4 w-4 text-purple-500" />
              <span>Content Output</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.period.postsPublished}</div>
            <div className="flex items-center space-x-1 text-xs">
              <span className="text-muted-foreground">
                {teamMetrics.period.postsCreated} created, {teamMetrics.period.postsPublished} published
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <span>Total Engagement</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.period.totalEngagement.toLocaleString()}</div>
            <div className="flex items-center space-x-1 text-xs">
              {getTrendIcon(teamMetrics.trends.engagement)}
              <span className={cn(
                teamMetrics.trends.engagement > 0 ? "text-green-600" : 
                teamMetrics.trends.engagement < 0 ? "text-red-600" : "text-gray-600"
              )}>
                {teamMetrics.trends.engagement > 0 ? "+" : ""}{teamMetrics.trends.engagement}% vs last period
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Team Overview</TabsTrigger>
          <TabsTrigger value="individual">Individual Performance</TabsTrigger>
          <TabsTrigger value="goals">Goals & Targets</TabsTrigger>
          <TabsTrigger value="analytics">Detailed Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Team Leaderboard */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Team Leaderboard</CardTitle>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="productivity">Productivity</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedMembers.map((member, index) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                          index === 0 ? "bg-yellow-100 text-yellow-800" :
                          index === 1 ? "bg-gray-100 text-gray-800" :
                          index === 2 ? "bg-orange-100 text-orange-800" :
                          "bg-muted text-muted-foreground"
                        )}>
                          #{index + 1}
                        </div>
                        
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.image} />
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{member.name}</h4>
                          {getRoleIcon(member.role)}
                          <Badge variant="secondary" className="text-xs">{member.role}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{getPerformanceScore(member)}</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="font-medium">{member.metrics.postsPublished}</div>
                        <div className="text-xs text-muted-foreground">Posts</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="font-medium">{member.metrics.quality.approvalRate}%</div>
                        <div className="text-xs text-muted-foreground">Approval</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="font-medium">{member.performance.currentStreak}</div>
                        <div className="text-xs text-muted-foreground">Streak</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productivity Trends</CardTitle>
                <CardDescription>Team efficiency over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Current Period</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={teamMetrics.overview.avgProductivity} className="w-20" />
                      <span className="text-sm font-medium">{teamMetrics.overview.avgProductivity}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">vs Last Period</span>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(teamMetrics.trends.productivity)}
                      <span className={cn(
                        "text-sm",
                        teamMetrics.trends.productivity > 0 ? "text-green-600" : 
                        teamMetrics.trends.productivity < 0 ? "text-red-600" : "text-gray-600"
                      )}>
                        {teamMetrics.trends.productivity > 0 ? "+" : ""}{teamMetrics.trends.productivity}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quality Metrics</CardTitle>
                <CardDescription>Approval rates and content quality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Approval Rate</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={88} className="w-20" />
                      <span className="text-sm font-medium">88%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">vs Last Period</span>
                    <div className="flex items-center space-x-1">
                      {getTrendIcon(teamMetrics.trends.quality)}
                      <span className={cn(
                        "text-sm",
                        teamMetrics.trends.quality > 0 ? "text-green-600" : 
                        teamMetrics.trends.quality < 0 ? "text-red-600" : "text-gray-600"
                      )}>
                        {teamMetrics.trends.quality > 0 ? "+" : ""}{teamMetrics.trends.quality}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <div className="flex items-center space-x-4 mb-4">
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMemberData ? (
            <div className="space-y-4">
              {/* Member Profile Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={selectedMemberData.image} />
                        <AvatarFallback className="text-lg">
                          {selectedMemberData.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-xl font-bold">{selectedMemberData.name}</h3>
                          {getRoleIcon(selectedMemberData.role)}
                        </div>
                        <p className="text-muted-foreground">{selectedMemberData.role}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-2">
                          <span>Joined {format(selectedMemberData.joinedAt, 'MMM yyyy')}</span>
                          <span>• Performance Score: {getPerformanceScore(selectedMemberData)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedMemberData.performance.currentStreak}
                      </div>
                      <p className="text-sm text-muted-foreground">Day Streak</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span>Content</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedMemberData.metrics.postsPublished}</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedMemberData.metrics.postsCreated} created
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Quality</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedMemberData.metrics.quality.approvalRate}%</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedMemberData.metrics.quality.revision_requests} revisions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span>Engagement</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(selectedMemberData.metrics.engagement.likes + 
                        selectedMemberData.metrics.engagement.comments + 
                        selectedMemberData.metrics.engagement.shares).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">Total interactions</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center space-x-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      <span>Collaboration</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{selectedMemberData.metrics.collaborations}</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedMemberData.metrics.commentsMade} comments made
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Productivity Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Tasks Completed</span>
                        <span className="font-medium">
                          {selectedMemberData.metrics.productivity.tasksCompleted}/
                          {selectedMemberData.metrics.productivity.tasksAssigned}
                        </span>
                      </div>
                      <Progress 
                        value={(selectedMemberData.metrics.productivity.tasksCompleted / 
                               selectedMemberData.metrics.productivity.tasksAssigned) * 100} 
                      />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Efficiency Score</span>
                        <span className="font-medium">{selectedMemberData.metrics.productivity.efficiency}%</span>
                      </div>
                      <Progress value={selectedMemberData.metrics.productivity.efficiency} />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Hours Worked</span>
                        <span className="font-medium">{selectedMemberData.metrics.productivity.hoursWorked}h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Engagement Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <ThumbsUp className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">Likes</span>
                        </div>
                        <span className="font-medium">{selectedMemberData.metrics.engagement.likes.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Comments</span>
                        </div>
                        <span className="font-medium">{selectedMemberData.metrics.engagement.comments.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Share2 className="h-4 w-4 text-purple-500" />
                          <span className="text-sm">Shares</span>
                        </div>
                        <span className="font-medium">{selectedMemberData.metrics.engagement.shares.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Eye className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">Views</span>
                        </div>
                        <span className="font-medium">{selectedMemberData.metrics.engagement.views.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2" />
                  <p>Select a team member to view their performance metrics</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Goals & Progress</CardTitle>
              <CardDescription>Track individual and team goal achievement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {teamMembers.map(member => (
                  <div key={member.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.image} />
                          <AvatarFallback className="text-xs">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{member.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {member.performance.goalsAchieved}/{member.performance.totalGoals} goals achieved
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {Math.round((member.performance.goalsAchieved / member.performance.totalGoals) * 100)}% Complete
                        </div>
                        <Progress 
                          value={(member.performance.goalsAchieved / member.performance.totalGoals) * 100} 
                          className="w-24 mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {member.goals.map(goal => (
                        <div key={goal.id} className="border rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-sm">{goal.title}</h5>
                            <Badge variant="outline" className="text-xs capitalize">
                              {goal.period}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">
                              {goal.current} / {goal.target} 
                              {goal.type === 'approval_rate' || goal.type === 'engagement' ? '%' : ''}
                            </span>
                          </div>
                          
                          <Progress value={(goal.current / goal.target) * 100} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Distribution</CardTitle>
                <CardDescription>Team member performance comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedMembers.map(member => (
                    <div key={member.id} className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.image} />
                        <AvatarFallback className="text-xs">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{member.name}</span>
                          <span className="text-sm">{getPerformanceScore(member)}</span>
                        </div>
                        <Progress value={getPerformanceScore(member)} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Metrics Summary</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{teamMetrics.period.postsCreated}</div>
                      <p className="text-xs text-muted-foreground">Total Posts</p>
                    </div>
                    
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{Math.round(teamMetrics.period.postsCreated / teamMetrics.overview.totalMembers)}</div>
                      <p className="text-xs text-muted-foreground">Avg per Member</p>
                    </div>
                    
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{teamMetrics.period.collaborations}</div>
                      <p className="text-xs text-muted-foreground">Collaborations</p>
                    </div>
                    
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {Math.round(teamMembers.reduce((sum, m) => sum + m.metrics.avgApprovalTime, 0) / teamMembers.length * 10) / 10}h
                      </div>
                      <p className="text-xs text-muted-foreground">Avg Approval Time</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}