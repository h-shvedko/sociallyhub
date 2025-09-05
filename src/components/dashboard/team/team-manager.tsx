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
  Activity,
  XCircle,
  AlertCircle
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
  role: 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'ANALYST' | 'CLIENT_VIEWER'
  permissions?: {
    canManageTeam: boolean
    canManageContent: boolean
    canManageSettings: boolean
    canViewAnalytics: boolean
    canManageBilling: boolean
  }
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
  workspaceName: string
}

export function TeamManager({ workspaceId, workspaceName }: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'PUBLISHER' as TeamMember['role']
  })
  const [notification, setNotification] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [memberToEditPermissions, setMemberToEditPermissions] = useState<TeamMember | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<{
    canManageTeam: boolean
    canManageContent: boolean
    canManageSettings: boolean
    canViewAnalytics: boolean
    canManageBilling: boolean
  }>({
    canManageTeam: false,
    canManageContent: false,
    canManageSettings: false,
    canViewAnalytics: false,
    canManageBilling: false
  })

  useEffect(() => {
    fetchTeamData()
  }, [workspaceId])

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

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
        setMembers([])
        setStats(null)
        setNotification({
          type: 'error',
          message: 'Failed to load team data'
        })
      }
    } catch (error) {
      console.error('Error fetching team data:', error)
      setMembers([])
      setStats(null)
      setNotification({
        type: 'error',
        message: 'Failed to load team data'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteMember = async () => {
    // Validate input
    if (!inviteData.email) {
      setNotification({
        type: 'error',
        message: 'Email address is required'
      })
      return
    }

    if (!/\S+@\S+\.\S+/.test(inviteData.email)) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid email address'
      })
      return
    }

    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inviteData,
          workspaceId
        })
      })

      const result = await response.json()

      if (response.ok) {
        setIsInviteDialogOpen(false)
        setInviteData({ email: '', role: 'PUBLISHER' })
        setNotification({
          type: 'success',
          message: result.message || 'Team member invited successfully'
        })
        fetchTeamData() // Refresh team list to show new member
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to invite team member'
        })
      }
    } catch (error) {
      console.error('Invite error:', error)
      setNotification({
        type: 'error',
        message: 'Failed to invite team member'
      })
    }
  }

  const handleRoleChange = async (userId: string, newRole: TeamMember['role']) => {
    try {
      const response = await fetch(`/api/team/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, workspaceId })
      })

      const result = await response.json()

      if (response.ok) {
        setMembers(prev => prev.map(member => 
          member.userId === userId ? { ...member, role: newRole } : member
        ))
        setNotification({
          type: 'success',
          message: result.message || 'Role updated successfully'
        })
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to update role'
        })
      }
    } catch (error) {
      console.error('Role change error:', error)
      setNotification({
        type: 'error',
        message: 'Failed to update role'
      })
    }
  }

  const confirmRemoveMember = (member: TeamMember) => {
    setMemberToRemove(member)
  }

  const openPermissionsEditor = (member: TeamMember) => {
    setMemberToEditPermissions(member)
    // Use actual permissions from the member data, fallback to role-based if not set
    const permissions = member.permissions || getPermissionsByRole(member.role)
    setEditingPermissions(permissions)
  }

  const getPermissionsByRole = (role: TeamMember['role']) => {
    switch (role) {
      case 'OWNER':
        return {
          canManageTeam: true,
          canManageContent: true,
          canManageSettings: true,
          canViewAnalytics: true,
          canManageBilling: true
        }
      case 'ADMIN':
        return {
          canManageTeam: true,
          canManageContent: true,
          canManageSettings: true,
          canViewAnalytics: true,
          canManageBilling: false
        }
      case 'PUBLISHER':
        return {
          canManageTeam: false,
          canManageContent: true,
          canManageSettings: false,
          canViewAnalytics: false,
          canManageBilling: false
        }
      case 'ANALYST':
        return {
          canManageTeam: false,
          canManageContent: false,
          canManageSettings: false,
          canViewAnalytics: true,
          canManageBilling: false
        }
      case 'CLIENT_VIEWER':
        return {
          canManageTeam: false,
          canManageContent: false,
          canManageSettings: false,
          canViewAnalytics: true,
          canManageBilling: false
        }
      default:
        return {
          canManageTeam: false,
          canManageContent: false,
          canManageSettings: false,
          canViewAnalytics: false,
          canManageBilling: false
        }
    }
  }

  const handleSavePermissions = async () => {
    if (!memberToEditPermissions) return

    try {
      const response = await fetch(`/api/team/${memberToEditPermissions.userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          permissions: editingPermissions,
          workspaceId 
        })
      })

      const result = await response.json()

      if (response.ok) {
        setNotification({
          type: 'success',
          message: 'Permissions updated successfully'
        })
        fetchTeamData() // Refresh to get updated data
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to update permissions'
        })
      }
    } catch (error) {
      console.error('Permissions update error:', error)
      setNotification({
        type: 'error',
        message: 'Failed to update permissions'
      })
    } finally {
      setMemberToEditPermissions(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    try {
      const response = await fetch(`/api/team/${memberToRemove.userId}?workspaceId=${workspaceId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        setMembers(prev => prev.filter(member => member.userId !== memberToRemove.userId))
        setNotification({
          type: 'success',
          message: result.message || 'Team member removed successfully'
        })
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to remove team member'
        })
      }
    } catch (error) {
      console.error('Remove member error:', error)
      setNotification({
        type: 'error',
        message: 'Failed to remove team member'
      })
    } finally {
      setMemberToRemove(null)
    }
  }

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'OWNER': return <Crown className="h-4 w-4" />
      case 'ADMIN': return <Shield className="h-4 w-4" />
      case 'PUBLISHER': return <Edit3 className="h-4 w-4" />
      case 'ANALYST': return <BarChart3 className="h-4 w-4" />
      case 'CLIENT_VIEWER': return <User className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  const getRoleColor = (role: TeamMember['role']) => {
    switch (role) {
      case 'OWNER': return 'bg-yellow-100 text-yellow-800'
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'PUBLISHER': return 'bg-green-100 text-green-800'
      case 'ANALYST': return 'bg-blue-100 text-blue-800'
      case 'CLIENT_VIEWER': return 'bg-gray-100 text-gray-800'
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
      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-lg border ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span>{notification.message}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotification(null)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            Manage your team members, roles, and permissions for {workspaceName}
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
                  <option value="PUBLISHER">Publisher - Can create and publish content</option>
                  <option value="ANALYST">Analyst - Can view analytics and reports</option>
                  <option value="ADMIN">Admin - Full access except billing</option>
                  <option value="CLIENT_VIEWER">Client Viewer - Read-only client access</option>
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
              <option value="PUBLISHER">Publishers</option>
              <option value="ANALYST">Analysts</option>
              <option value="CLIENT_VIEWER">Client Viewers</option>
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
                          <DropdownMenuItem onClick={() => openPermissionsEditor(member)}>
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
                            onClick={() => handleRoleChange(member.userId, 'PUBLISHER')}
                            disabled={member.role === 'OWNER'}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Make Publisher
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleRoleChange(member.userId, 'ANALYST')}
                            disabled={member.role === 'OWNER'}
                          >
                            <BarChart3 className="h-4 w-4 mr-2" />
                            Make Analyst
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => confirmRemoveMember(member)}
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
                <Edit3 className="h-4 w-4 text-green-500" />
                <span className="font-medium">Publisher</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Create content</li>
                <li>• Publish posts</li>
                <li>• Handle inbox</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Analyst</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• View analytics</li>
                <li>• Generate reports</li>
                <li>• Track metrics</li>
              </ul>
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Client Viewer</span>
              </div>
              <ul className="space-y-1 text-muted-foreground">
                <li>• View client reports</li>
                <li>• Limited access</li>
                <li>• Read-only mode</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!memberToEditPermissions} onOpenChange={(open) => !open && setMemberToEditPermissions(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Edit Permissions
            </DialogTitle>
          </DialogHeader>
          {memberToEditPermissions && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={memberToEditPermissions.user.image} alt={memberToEditPermissions.user.name} />
                  <AvatarFallback>
                    {memberToEditPermissions.user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{memberToEditPermissions.user.name}</p>
                  <p className="text-sm text-muted-foreground">{memberToEditPermissions.user.email}</p>
                  <Badge className={cn("text-xs", getRoleColor(memberToEditPermissions.role))}>
                    {getRoleIcon(memberToEditPermissions.role)}
                    <span className="ml-1">{memberToEditPermissions.role}</span>
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm">Permissions</h4>
                
                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editingPermissions.canManageTeam}
                      onChange={(e) => setEditingPermissions(prev => ({ ...prev, canManageTeam: e.target.checked }))}
                      disabled={memberToEditPermissions.role === 'OWNER'}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Manage Team</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Can invite, remove team members and change roles</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editingPermissions.canManageContent}
                      onChange={(e) => setEditingPermissions(prev => ({ ...prev, canManageContent: e.target.checked }))}
                      disabled={memberToEditPermissions.role === 'OWNER'}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Edit3 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Manage Content</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Can create, edit, and publish content</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editingPermissions.canManageSettings}
                      onChange={(e) => setEditingPermissions(prev => ({ ...prev, canManageSettings: e.target.checked }))}
                      disabled={memberToEditPermissions.role === 'OWNER'}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Settings className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium">Manage Settings</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Can modify workspace settings and preferences</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editingPermissions.canViewAnalytics}
                      onChange={(e) => setEditingPermissions(prev => ({ ...prev, canViewAnalytics: e.target.checked }))}
                      disabled={memberToEditPermissions.role === 'OWNER'}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">View Analytics</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Can access analytics, reports, and metrics</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editingPermissions.canManageBilling}
                      onChange={(e) => setEditingPermissions(prev => ({ ...prev, canManageBilling: e.target.checked }))}
                      disabled={memberToEditPermissions.role !== 'OWNER'}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Manage Billing</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Can manage billing, subscriptions, and payments</p>
                    </div>
                  </label>
                </div>
              </div>

              {memberToEditPermissions.role === 'OWNER' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Owner permissions cannot be modified. Only workspace ownership transfer can change these permissions.
                  </p>
                </div>
              )}

              <div className="flex space-x-3 justify-end pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setMemberToEditPermissions(null)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSavePermissions}
                  disabled={memberToEditPermissions.role === 'OWNER'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Save Permissions
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Remove Team Member
            </DialogTitle>
          </DialogHeader>
          {memberToRemove && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove <strong>{memberToRemove.user.name}</strong> from your team?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">This action will:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Remove their access to all workspace content</li>
                      <li>• Unassign them from all inbox items</li>
                      <li>• They can be re-invited later if needed</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setMemberToRemove(null)}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleRemoveMember}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Member
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}