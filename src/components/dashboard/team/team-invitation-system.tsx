"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  UserPlus, 
  Send, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Copy,
  Trash2,
  RefreshCw,
  Users,
  Shield,
  Edit,
  Eye
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface TeamInvitation {
  id: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER'
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  invitedBy: {
    id: string
    name: string
    email: string
    image?: string
  }
  invitedAt: Date
  expiresAt: Date
  acceptedAt?: Date
  message?: string
  permissions?: string[]
}

interface TeamMember {
  id: string
  name: string
  email: string
  image?: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER'
  joinedAt: Date
  lastActive: Date
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  permissions: string[]
}

const ROLE_PERMISSIONS = {
  OWNER: ['all'],
  ADMIN: ['manage_team', 'manage_content', 'manage_settings', 'view_analytics', 'approve_posts'],
  MANAGER: ['manage_content', 'view_analytics', 'approve_posts', 'assign_tasks'],
  EDITOR: ['create_posts', 'edit_posts', 'schedule_posts', 'view_analytics'],
  VIEWER: ['view_posts', 'view_analytics']
}

const ROLE_DESCRIPTIONS = {
  OWNER: 'Full access to all workspace features and settings',
  ADMIN: 'Manage team members, content, and workspace settings',
  MANAGER: 'Oversee content creation and approve posts',
  EDITOR: 'Create and manage social media content',
  VIEWER: 'View content and analytics (read-only access)'
}

export function TeamInvitationSystem() {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isInviting, setIsInviting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('members')

  // Invitation form state
  const [inviteForm, setInviteForm] = useState({
    emails: '',
    role: 'EDITOR' as const,
    message: '',
    permissions: [] as string[]
  })

  useEffect(() => {
    fetchTeamData()
  }, [])

  const fetchTeamData = async () => {
    setLoading(true)
    try {
      // Fetch team members and invitations
      const [membersResponse, invitationsResponse] = await Promise.all([
        fetch('/api/team/members'),
        fetch('/api/team/invitations')
      ])

      if (membersResponse.ok) {
        const membersData = await membersResponse.json()
        setTeamMembers(membersData.members || [])
      }

      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json()
        setInvitations(invitationsData.invitations || [])
      }

      // Mock data fallback
      if (!membersResponse.ok) {
        setTeamMembers([
          {
            id: '1',
            name: 'John Doe',
            email: 'john@company.com',
            image: '/avatars/john.jpg',
            role: 'OWNER',
            joinedAt: new Date('2024-01-15'),
            lastActive: new Date(),
            status: 'ACTIVE',
            permissions: ['all']
          },
          {
            id: '2',
            name: 'Sarah Wilson',
            email: 'sarah@company.com',
            image: '/avatars/sarah.jpg',
            role: 'ADMIN',
            joinedAt: new Date('2024-02-01'),
            lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
            status: 'ACTIVE',
            permissions: ROLE_PERMISSIONS.ADMIN
          },
          {
            id: '3',
            name: 'Mike Chen',
            email: 'mike@company.com',
            role: 'EDITOR',
            joinedAt: new Date('2024-02-15'),
            lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000),
            status: 'ACTIVE',
            permissions: ROLE_PERMISSIONS.EDITOR
          }
        ])
      }

      if (!invitationsResponse.ok) {
        setInvitations([
          {
            id: '1',
            email: 'alex@newcompany.com',
            role: 'EDITOR',
            status: 'PENDING',
            invitedBy: {
              id: '1',
              name: 'John Doe',
              email: 'john@company.com'
            },
            invitedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            message: 'Welcome to our social media team!'
          }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error)
      toast.error('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  const sendInvitations = async () => {
    if (!inviteForm.emails.trim()) {
      toast.error('Please enter at least one email address')
      return
    }

    setIsInviting(true)
    try {
      const emails = inviteForm.emails.split('\n').map(email => email.trim()).filter(Boolean)
      
      const response = await fetch('/api/team/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails,
          role: inviteForm.role,
          message: inviteForm.message,
          permissions: inviteForm.permissions
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Invitations sent to ${emails.length} email${emails.length > 1 ? 's' : ''}`)
        setInviteForm({ emails: '', role: 'EDITOR', message: '', permissions: [] })
        fetchTeamData() // Refresh data
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to send invitations')
      }
    } catch (error) {
      console.error('Failed to send invitations:', error)
      toast.error('Failed to send invitations')
    } finally {
      setIsInviting(false)
    }
  }

  const resendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}/resend`, {
        method: 'POST'
      })

      if (response.ok) {
        toast.success('Invitation resent successfully')
        fetchTeamData()
      } else {
        toast.error('Failed to resend invitation')
      }
    } catch (error) {
      console.error('Failed to resend invitation:', error)
      toast.error('Failed to resend invitation')
    }
  }

  const cancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/team/invitations/${invitationId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Invitation cancelled')
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId))
      } else {
        toast.error('Failed to cancel invitation')
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
      toast.error('Failed to cancel invitation')
    }
  }

  const copyInviteLink = async (invitationId: string) => {
    const inviteLink = `${window.location.origin}/invite/${invitationId}`
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast.success('Invite link copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy invite link')
    }
  }

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      if (response.ok) {
        toast.success('Member role updated')
        setTeamMembers(prev => prev.map(member => 
          member.id === memberId 
            ? { ...member, role: newRole as any, permissions: ROLE_PERMISSIONS[newRole as keyof typeof ROLE_PERMISSIONS] }
            : member
        ))
      } else {
        toast.error('Failed to update member role')
      }
    } catch (error) {
      console.error('Failed to update member role:', error)
      toast.error('Failed to update member role')
    }
  }

  const removeMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Member removed from team')
        setTeamMembers(prev => prev.filter(member => member.id !== memberId))
      } else {
        toast.error('Failed to remove member')
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error('Failed to remove member')
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800'
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'MANAGER': return 'bg-blue-100 text-blue-800'
      case 'EDITOR': return 'bg-green-100 text-green-800'
      case 'VIEWER': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'ACCEPTED': return 'bg-green-100 text-green-800'
      case 'DECLINED': return 'bg-red-100 text-red-800'
      case 'EXPIRED': return 'bg-gray-100 text-gray-800'
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'INACTIVE': return 'bg-gray-100 text-gray-800'
      case 'SUSPENDED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'PENDING')
  const expiredInvitations = invitations.filter(inv => inv.status === 'EXPIRED' || new Date() > inv.expiresAt)

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
            <p className="text-xs text-muted-foreground">
              {teamMembers.filter(m => m.status === 'ACTIVE').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvitations.length}</div>
            <p className="text-xs text-muted-foreground">
              {expiredInvitations.length} expired
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(ROLE_PERMISSIONS).length}</div>
            <p className="text-xs text-muted-foreground">
              Permission levels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Now</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamMembers.filter(m => 
                new Date().getTime() - m.lastActive.getTime() < 15 * 60 * 1000
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 15 minutes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Management</CardTitle>
              <CardDescription>
                Manage team members, roles, and invitations
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Invite Team Members</DialogTitle>
                  <DialogDescription>
                    Send invitations to new team members via email
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="emails">Email Addresses</Label>
                    <Textarea
                      id="emails"
                      placeholder="Enter email addresses (one per line)&#10;john@example.com&#10;sarah@example.com"
                      value={inviteForm.emails}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, emails: e.target.value }))}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select 
                        value={inviteForm.role} 
                        onValueChange={(value: any) => setInviteForm(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[inviteForm.role]}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Personal Message (Optional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Add a personal message to the invitation..."
                      value={inviteForm.message}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, message: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setInviteForm({ emails: '', role: 'EDITOR', message: '', permissions: [] })}>
                      Clear
                    </Button>
                    <Button onClick={sendInvitations} disabled={isInviting}>
                      {isInviting ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Invitations
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members">Team Members ({teamMembers.length})</TabsTrigger>
              <TabsTrigger value="invitations">Invitations ({invitations.length})</TabsTrigger>
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="mt-6">
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Avatar>
                        <AvatarImage src={member.image} alt={member.name} />
                        <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{member.name}</p>
                          <Badge className={getRoleBadgeColor(member.role)}>
                            {member.role}
                          </Badge>
                          <Badge className={getStatusBadgeColor(member.status)}>
                            {member.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {format(member.joinedAt, 'MMM dd, yyyy')} • 
                          Last active {format(member.lastActive, 'MMM dd, HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {member.role !== 'OWNER' && (
                        <>
                          <Select 
                            value={member.role}
                            onValueChange={(value) => updateMemberRole(member.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                              <SelectItem value="EDITOR">Editor</SelectItem>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="invitations" className="mt-6">
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-medium">{invitation.email}</p>
                          <Badge className={getRoleBadgeColor(invitation.role)}>
                            {invitation.role}
                          </Badge>
                          <Badge className={getStatusBadgeColor(invitation.status)}>
                            {invitation.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Invited by {invitation.invitedBy.name} on {format(invitation.invitedAt, 'MMM dd, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invitation.status === 'PENDING' && (
                            `Expires ${format(invitation.expiresAt, 'MMM dd, yyyy')}`
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {invitation.status === 'PENDING' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInviteLink(invitation.id)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelInvitation(invitation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {invitations.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No invitations sent</p>
                    <p className="text-sm">Start by inviting team members to collaborate</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="roles" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
                  <Card key={role}>
                    <CardHeader>
                      <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5" />
                        <CardTitle className="text-lg">{role}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{description}</p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Permissions:</p>
                        <div className="space-y-1">
                          {ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS].map((permission) => (
                            <Badge key={permission} variant="outline" className="text-xs">
                              {permission.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}