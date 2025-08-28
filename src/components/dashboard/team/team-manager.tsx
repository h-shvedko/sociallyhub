'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  UserPlus, 
  Search, 
  Settings, 
  Trash2, 
  Mail,
  Calendar,
  BarChart3,
  MessageSquare,
  CheckCircle,
  Clock,
  Crown,
  Shield,
  User,
  Edit3,
  MoreVertical,
  Activity
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface TeamMember {
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER'
  joinedAt: string
  user: {
    id: string
    name: string
    email: string
    image?: string
    createdAt: string
  }
  stats: {
    assignedInboxItems: number
    resolvedInboxItems: number
    createdPosts: number
    lastActivity?: string
    responseRate: number
  }
}

interface TeamStats {
  totalMembers: number
  activeMembers: number
  totalAssignedItems: number
  totalResolvedItems: number
  averageResponseRate: number
}

interface TeamManagerProps {
  workspaceId: string
}

export function TeamManager({ workspaceId }: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'EDITOR' as TeamMember['role']
  })

  useEffect(() => {
    fetchTeamData()
  }, [workspaceId])

  const fetchTeamData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/team?workspaceId=${workspaceId}`)
      
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
        setStats(data.stats || null)
      } else {
        console.error('Failed to fetch team data')
        // Demo data fallback
        setMembers([
          {
            userId: '1',
            role: 'OWNER',
            joinedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
            user: {
              id: '1',
              name: 'Demo User',
              email: 'demo@sociallyhub.com',
              image: '/demo/avatar-1.jpg',
              createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
            },
            stats: {
              assignedInboxItems: 5,
              resolvedInboxItems: 23,
              createdPosts: 15,
              lastActivity: new Date(Date.now() - 3600000).toISOString(),
              responseRate: 85
            }
          },
          {
            userId: '2',
            role: 'ADMIN',
            joinedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
            user: {
              id: '2',
              name: 'Sarah Johnson',
              email: 'sarah@company.com',
              image: '/demo/avatar-2.jpg',
              createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
            },
            stats: {
              assignedInboxItems: 8,
              resolvedInboxItems: 17,
              createdPosts: 22,
              lastActivity: new Date(Date.now() - 7200000).toISOString(),
              responseRate: 78
            }
          },
          {
            userId: '3',
            role: 'EDITOR',
            joinedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
            user: {
              id: '3',
              name: 'Mike Chen',
              email: 'mike@company.com',
              createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
            },
            stats: {
              assignedInboxItems: 12,
              resolvedInboxItems: 8,
              createdPosts: 31,
              lastActivity: new Date(Date.now() - 86400000).toISOString(),
              responseRate: 67
            }
          }
        ])
        setStats({
          totalMembers: 3,
          activeMembers: 3,
          totalAssignedItems: 25,
          totalResolvedItems: 48,
          averageResponseRate: 77
        })
      }
    } catch (error) {
      console.error('Error fetching team data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteMember = async () => {
    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inviteData,
          workspaceId
        })
      })

      if (response.ok) {
        setIsInviteDialogOpen(false)
        setInviteData({ email: '', role: 'EDITOR' })
        // Show success message
        fetchTeamData()
      }
    } catch (error) {
      console.error('Invite error:', error)
    }
  }

  const handleRoleChange = async (userId: string, newRole: TeamMember['role']) => {
    try {
      const response = await fetch(`/api/team/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (response.ok) {
        setMembers(prev => prev.map(member => 
          member.userId === userId ? { ...member, role: newRole } : member
        ))
      }
    } catch (error) {
      console.error('Role change error:', error)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    try {
      const response = await fetch(`/api/team/${userId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMembers(prev => prev.filter(member => member.userId !== userId))
      }
    } catch (error) {
      console.error('Remove member error:', error)
    }
  }

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'OWNER': return <Crown className="h-4 w-4" />
      case 'ADMIN': return <Shield className="h-4 w-4" />
      case 'MANAGER': return <Settings className="h-4 w-4" />
      case 'EDITOR': return <Edit3 className="h-4 w-4" />
      case 'VIEWER': return <User className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: TeamMember['role']) => {
    switch (role) {
      case 'OWNER': return 'bg-yellow-100 text-yellow-800'
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'MANAGER': return 'bg-blue-100 text-blue-800'
      case 'EDITOR': return 'bg-green-100 text-green-800'
      case 'VIEWER': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityStatus = (lastActivity?: string) => {
    if (!lastActivity) return { status: 'never', text: 'Never active', color: 'text-gray-500' }
    
    const diff = Date.now() - new Date(lastActivity).getTime()
    const hours = diff / (1000 * 60 * 60)
    
    if (hours < 1) return { status: 'active', text: 'Active now', color: 'text-green-500' }
    if (hours < 24) return { status: 'recent', text: `${Math.floor(hours)}h ago`, color: 'text-blue-500' }
    if (hours < 168) return { status: 'week', text: `${Math.floor(hours/24)}d ago`, color: 'text-orange-500' }
    return { status: 'old', text: 'Inactive', color: 'text-red-500' }
  }

  const filteredMembers = members.filter(member => {
    const matchesSearch = searchQuery === '' || 
      member.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = selectedRole === 'all' || member.role === selectedRole
    
    return matchesSearch && matchesRole
  })

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            Manage your team members, roles, and permissions
          </p>
        </div>
        
        <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={inviteData.role}
                  onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value as TeamMember['role'] }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="EDITOR">Editor - Can create and edit content</option>
                  <option value="MANAGER">Manager - Can manage content and team</option>
                  <option value="ADMIN">Admin - Full access except billing</option>
                  <option value="VIEWER">Viewer - Read-only access</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteMember}>
                  Send Invitation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalMembers}</div>
                  <p className="text-xs text-muted-foreground">Total Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.activeMembers}</div>
                  <p className="text-xs text-muted-foreground">Active This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalAssignedItems}</div>
                  <p className="text-xs text-muted-foreground">Assigned Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalResolvedItems}</div>
                  <p className="text-xs text-muted-foreground">Resolved Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-orange-500" />
                <div>
                  <div className="text-2xl font-bold">{stats.averageResponseRate}%</div>
                  <p className="text-xs text-muted-foreground">Avg Response Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Roles</option>
              <option value="OWNER">Owners</option>
              <option value="ADMIN">Admins</option>
              <option value="MANAGER">Managers</option>
              <option value="EDITOR">Editors</option>
              <option value="VIEWER">Viewers</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading team members...</p>
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="space-y-4">
          {filteredMembers.map((member) => {
            const activity = getActivityStatus(member.stats.lastActivity)
            return (
              <Card key={member.userId} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.user.image} alt={member.user.name} />
                        <AvatarFallback>
                          {member.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg">{member.user.name}</h3>
                          <Badge className={cn("text-xs", getRoleColor(member.role))}>
                            <div className="flex items-center space-x-1">
                              {getRoleIcon(member.role)}
                              <span>{member.role}</span>
                            </div>
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>{member.user.email}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                          </div>
                          <div className={cn("flex items-center space-x-1", activity.color)}>
                            <Clock className="h-3 w-3" />
                            <span>{activity.text}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {/* Member Stats */}
                      <div className="hidden md:flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold">{member.stats.createdPosts}</div>
                          <div className="text-muted-foreground">Posts</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{member.stats.assignedInboxItems}</div>
                          <div className="text-muted-foreground">Assigned</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{member.stats.resolvedInboxItems}</div>
                          <div className="text-muted-foreground">Resolved</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{member.stats.responseRate}%</div>
                          <div className="text-muted-foreground">Response</div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {}}>
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Permissions
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(member.userId, 'ADMIN')}
                            disabled={member.role === 'OWNER'}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(member.userId, 'EDITOR')}
                            disabled={member.role === 'OWNER'}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Make Editor
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleRemoveMember(member.userId)}
                            className="text-red-600"
                            disabled={member.role === 'OWNER'}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No team members found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedRole !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Start building your team by inviting members'
            }
          </p>
          {!searchQuery && selectedRole === 'all' && (
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          )}
        </div>
      )}

      {/* Role Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">Owner</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Full access</li>
                <li>• Billing & settings</li>
                <li>• Manage team</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-4 w-4 text-red-500" />
                <span className="font-medium">Admin</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Manage content</li>
                <li>• Manage team</li>
                <li>• View analytics</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Settings className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Manager</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Manage content</li>
                <li>• Assign tasks</li>
                <li>• View reports</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Edit3 className="h-4 w-4 text-green-500" />
                <span className="font-medium">Editor</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Create content</li>
                <li>• Edit drafts</li>
                <li>• Handle inbox</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Viewer</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• View content</li>
                <li>• View analytics</li>
                <li>• Read-only access</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}