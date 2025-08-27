"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Shield, 
  Users, 
  Settings, 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  Lock, 
  Unlock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  BarChart3,
  MessageSquare,
  FileText,
  UserCheck,
  Crown,
  Star,
  User,
  Briefcase,
  Search,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Define comprehensive permission system
const PERMISSIONS = {
  WORKSPACE: {
    category: "Workspace Management",
    icon: <Settings className="h-4 w-4" />,
    permissions: {
      "workspace.manage": {
        name: "Manage Workspace",
        description: "Full workspace control including settings and billing"
      },
      "workspace.settings": {
        name: "Workspace Settings", 
        description: "Modify workspace configuration and preferences"
      },
      "workspace.billing": {
        name: "Billing Management",
        description: "Access and manage billing information"
      },
      "workspace.delete": {
        name: "Delete Workspace",
        description: "Permanently delete workspace (dangerous)"
      }
    }
  },
  TEAM: {
    category: "Team Management",
    icon: <Users className="h-4 w-4" />,
    permissions: {
      "team.invite": {
        name: "Invite Members",
        description: "Send invitations to new team members"
      },
      "team.remove": {
        name: "Remove Members",
        description: "Remove team members from workspace"
      },
      "team.roles": {
        name: "Manage Roles",
        description: "Assign and modify team member roles"
      },
      "team.permissions": {
        name: "Manage Permissions",
        description: "Configure custom permission settings"
      }
    }
  },
  CONTENT: {
    category: "Content Management",
    icon: <FileText className="h-4 w-4" />,
    permissions: {
      "content.create": {
        name: "Create Content",
        description: "Create new posts and content"
      },
      "content.edit": {
        name: "Edit Content",
        description: "Modify existing content and posts"
      },
      "content.delete": {
        name: "Delete Content",
        description: "Remove posts and content permanently"
      },
      "content.publish": {
        name: "Publish Content",
        description: "Publish content without approval"
      },
      "content.schedule": {
        name: "Schedule Posts",
        description: "Schedule posts for future publishing"
      },
      "content.approve": {
        name: "Approve Content",
        description: "Approve content created by others"
      },
      "content.templates": {
        name: "Manage Templates",
        description: "Create and manage content templates"
      }
    }
  },
  ANALYTICS: {
    category: "Analytics & Reporting",
    icon: <BarChart3 className="h-4 w-4" />,
    permissions: {
      "analytics.view": {
        name: "View Analytics",
        description: "Access basic analytics and metrics"
      },
      "analytics.advanced": {
        name: "Advanced Analytics",
        description: "Access detailed analytics and insights"
      },
      "analytics.export": {
        name: "Export Reports",
        description: "Export analytics data and reports"
      },
      "analytics.configure": {
        name: "Configure Analytics",
        description: "Set up analytics tracking and goals"
      }
    }
  },
  SOCIAL: {
    category: "Social Accounts",
    icon: <MessageSquare className="h-4 w-4" />,
    permissions: {
      "social.connect": {
        name: "Connect Accounts",
        description: "Connect social media accounts"
      },
      "social.disconnect": {
        name: "Disconnect Accounts",
        description: "Remove social media connections"
      },
      "social.manage": {
        name: "Manage Accounts",
        description: "Configure social media account settings"
      },
      "social.post": {
        name: "Post to Accounts",
        description: "Publish content to connected accounts"
      }
    }
  },
  INBOX: {
    category: "Inbox & Messages",
    icon: <MessageSquare className="h-4 w-4" />,
    permissions: {
      "inbox.view": {
        name: "View Messages",
        description: "Read inbox messages and notifications"
      },
      "inbox.reply": {
        name: "Reply to Messages",
        description: "Respond to messages and comments"
      },
      "inbox.assign": {
        name: "Assign Messages",
        description: "Assign messages to team members"
      },
      "inbox.configure": {
        name: "Configure Inbox",
        description: "Set up inbox rules and automation"
      }
    }
  }
}

// Define role templates with default permissions
const ROLE_TEMPLATES = {
  OWNER: {
    name: "Owner",
    description: "Full access to everything",
    icon: <Crown className="h-4 w-4 text-yellow-500" />,
    color: "border-yellow-200 bg-yellow-50",
    permissions: Object.values(PERMISSIONS).flatMap(category => 
      Object.keys(category.permissions)
    )
  },
  ADMIN: {
    name: "Administrator", 
    description: "Manage team and most settings",
    icon: <Shield className="h-4 w-4 text-blue-500" />,
    color: "border-blue-200 bg-blue-50",
    permissions: [
      "workspace.settings", "team.invite", "team.remove", "team.roles",
      "content.create", "content.edit", "content.delete", "content.publish", 
      "content.schedule", "content.approve", "content.templates",
      "analytics.view", "analytics.advanced", "analytics.export",
      "social.connect", "social.disconnect", "social.manage", "social.post",
      "inbox.view", "inbox.reply", "inbox.assign", "inbox.configure"
    ]
  },
  MANAGER: {
    name: "Manager",
    description: "Content approval and team oversight",
    icon: <Star className="h-4 w-4 text-purple-500" />,
    color: "border-purple-200 bg-purple-50",
    permissions: [
      "content.create", "content.edit", "content.publish", "content.schedule", 
      "content.approve", "content.templates", "analytics.view", "analytics.advanced",
      "social.post", "inbox.view", "inbox.reply", "inbox.assign"
    ]
  },
  EDITOR: {
    name: "Editor",
    description: "Create and edit content",
    icon: <Edit className="h-4 w-4 text-green-500" />,
    color: "border-green-200 bg-green-50",
    permissions: [
      "content.create", "content.edit", "content.schedule", "content.templates",
      "analytics.view", "social.post", "inbox.view", "inbox.reply"
    ]
  },
  VIEWER: {
    name: "Viewer",
    description: "Read-only access",
    icon: <Eye className="h-4 w-4 text-gray-500" />,
    color: "border-gray-200 bg-gray-50",
    permissions: [
      "analytics.view", "inbox.view"
    ]
  }
}

interface CustomRole {
  id: string
  name: string
  description: string
  permissions: string[]
  memberCount: number
  createdAt: Date
  createdBy: {
    id: string
    name: string
  }
}

interface TeamMember {
  id: string
  name: string
  email: string
  image?: string
  role: string
  customPermissions?: string[]
  joinedAt: Date
  lastActive: Date
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
}

interface RolePermissionInterfaceProps {
  workspaceId?: string
}

export function RolePermissionInterface({ workspaceId }: RolePermissionInterfaceProps) {
  const [activeTab, setActiveTab] = useState("roles")
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false)
  const [isEditPermissionsOpen, setIsEditPermissionsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("")
  
  // Create role form state
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])

  // Load mock data
  useEffect(() => {
    loadMockData()
  }, [])

  const loadMockData = () => {
    // Mock custom roles
    setCustomRoles([
      {
        id: "1",
        name: "Content Creator",
        description: "Specialized role for content creation and social media posting",
        permissions: ["content.create", "content.edit", "content.schedule", "social.post", "analytics.view"],
        memberCount: 3,
        createdAt: new Date("2024-01-15"),
        createdBy: { id: "1", name: "John Admin" }
      },
      {
        id: "2", 
        name: "Client Manager",
        description: "Client-facing role with limited access",
        permissions: ["analytics.view", "content.approve", "inbox.view", "inbox.reply"],
        memberCount: 2,
        createdAt: new Date("2024-02-01"),
        createdBy: { id: "1", name: "John Admin" }
      }
    ])

    // Mock team members
    setTeamMembers([
      {
        id: "1",
        name: "Sarah Johnson",
        email: "sarah@company.com",
        image: "https://images.unsplash.com/photo-1494790108755-2616b14223b2?w=32&h=32&fit=crop&crop=face",
        role: "ADMIN",
        joinedAt: new Date("2024-01-10"),
        lastActive: new Date("2024-03-15T10:30:00"),
        status: "ACTIVE"
      },
      {
        id: "2",
        name: "Mike Chen",
        email: "mike@company.com", 
        role: "Content Creator",
        customPermissions: ["content.create", "content.edit", "social.post"],
        joinedAt: new Date("2024-02-05"),
        lastActive: new Date("2024-03-15T09:15:00"),
        status: "ACTIVE"
      },
      {
        id: "3",
        name: "Emily Davis",
        email: "emily@company.com",
        role: "EDITOR",
        joinedAt: new Date("2024-02-20"),
        lastActive: new Date("2024-03-14T16:45:00"),
        status: "INACTIVE"
      }
    ])
  }

  const handleCreateRole = () => {
    if (!newRoleName.trim()) {
      toast.error("Role name is required")
      return
    }

    const newRole: CustomRole = {
      id: Date.now().toString(),
      name: newRoleName,
      description: newRoleDescription,
      permissions: newRolePermissions,
      memberCount: 0,
      createdAt: new Date(),
      createdBy: { id: "current-user", name: "Current User" }
    }

    setCustomRoles(prev => [...prev, newRole])
    setIsCreateRoleOpen(false)
    setNewRoleName("")
    setNewRoleDescription("")
    setNewRolePermissions([])
    toast.success("Custom role created successfully")
  }

  const handleUpdateMemberPermissions = (memberId: string, newPermissions: string[]) => {
    setTeamMembers(prev => prev.map(member => 
      member.id === memberId 
        ? { ...member, customPermissions: newPermissions }
        : member
    ))
    toast.success("Member permissions updated")
  }

  const handleDeleteRole = (roleId: string) => {
    setCustomRoles(prev => prev.filter(role => role.id !== roleId))
    toast.success("Role deleted successfully")
  }

  const togglePermission = (permission: string) => {
    setNewRolePermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    )
  }

  const getAllPermissionsForRole = (roleName: string): string[] => {
    if (roleName in ROLE_TEMPLATES) {
      return ROLE_TEMPLATES[roleName as keyof typeof ROLE_TEMPLATES].permissions
    }
    
    const customRole = customRoles.find(role => role.name === roleName)
    return customRole?.permissions || []
  }

  const filteredMembers = teamMembers.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(member => 
    selectedRole === "" || member.role === selectedRole
  )

  const getRoleIcon = (roleName: string) => {
    if (roleName in ROLE_TEMPLATES) {
      return ROLE_TEMPLATES[roleName as keyof typeof ROLE_TEMPLATES].icon
    }
    return <User className="h-4 w-4 text-indigo-500" />
  }

  const getRoleColor = (roleName: string) => {
    if (roleName in ROLE_TEMPLATES) {
      return ROLE_TEMPLATES[roleName as keyof typeof ROLE_TEMPLATES].color
    }
    return "border-indigo-200 bg-indigo-50"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Role & Permission Management</h2>
          <p className="text-muted-foreground">Configure team roles and permissions</p>
        </div>
        
        <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Create Custom Role</DialogTitle>
              <DialogDescription>
                Create a custom role with specific permissions for your team
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name</Label>
                  <input
                    id="role-name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="e.g., Content Creator"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description" 
                    placeholder="Describe what this role can do..."
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <Label>Permissions</Label>
                  {Object.entries(PERMISSIONS).map(([key, category]) => (
                    <Card key={key}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center space-x-2">
                          {category.icon}
                          <span>{category.category}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(category.permissions).map(([permKey, permission]) => (
                            <div key={permKey} className="flex items-start space-x-3">
                              <Switch
                                id={permKey}
                                checked={newRolePermissions.includes(permKey)}
                                onCheckedChange={() => togglePermission(permKey)}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <Label htmlFor={permKey} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  {permission.name}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRole}>
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roles">Roles Overview</TabsTrigger>
          <TabsTrigger value="permissions">Permission Matrix</TabsTrigger>
          <TabsTrigger value="members">Member Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          {/* Default Roles */}
          <Card>
            <CardHeader>
              <CardTitle>Default Roles</CardTitle>
              <CardDescription>Pre-configured role templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(ROLE_TEMPLATES).map(([key, role]) => (
                  <Card key={key} className={cn("relative", role.color)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-2">
                        {role.icon}
                        <CardTitle className="text-sm">{role.name}</CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        {role.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Permissions</span>
                          <Badge variant="secondary">{role.permissions.length}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Members</span>
                          <span>{teamMembers.filter(m => m.role === key).length}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Roles */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Roles</CardTitle>
              <CardDescription>User-created custom roles</CardDescription>
            </CardHeader>
            <CardContent>
              {customRoles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-8 w-8 mx-auto mb-2" />
                  <p>No custom roles created yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => setIsCreateRoleOpen(true)}
                  >
                    Create First Role
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customRoles.map((role) => (
                    <Card key={role.id} className="relative border-indigo-200 bg-indigo-50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-sm">{role.name}</CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRole(role.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <CardDescription className="text-xs">
                          {role.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Permissions</span>
                            <Badge variant="secondary">{role.permissions.length}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Members</span>
                            <span>{role.memberCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Created</span>
                            <span>{role.createdAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>View permissions across all roles</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-7 gap-2 mb-4 text-xs font-medium">
                    <div>Permission</div>
                    <div className="text-center">Owner</div>
                    <div className="text-center">Admin</div>
                    <div className="text-center">Manager</div>
                    <div className="text-center">Editor</div>
                    <div className="text-center">Viewer</div>
                    <div className="text-center">Custom</div>
                  </div>
                  
                  {Object.entries(PERMISSIONS).map(([categoryKey, category]) => (
                    <div key={categoryKey} className="mb-6">
                      <div className="flex items-center space-x-2 mb-3 text-sm font-medium">
                        {category.icon}
                        <span>{category.category}</span>
                      </div>
                      
                      {Object.entries(category.permissions).map(([permKey, permission]) => (
                        <div key={permKey} className="grid grid-cols-7 gap-2 py-2 border-b text-xs">
                          <div className="font-medium">{permission.name}</div>
                          
                          {Object.entries(ROLE_TEMPLATES).map(([roleKey, role]) => (
                            <div key={roleKey} className="text-center">
                              {role.permissions.includes(permKey) ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                              )}
                            </div>
                          ))}
                          
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {customRoles.filter(role => role.permissions.includes(permKey)).length}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="w-[200px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Roles</SelectItem>
                    {Object.keys(ROLE_TEMPLATES).map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                    {customRoles.map(role => (
                      <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Member List */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({filteredMembers.length})</CardTitle>
              <CardDescription>Manage individual member permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        {member.image ? (
                          <img 
                            src={member.image} 
                            alt={member.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background",
                          member.status === 'ACTIVE' ? 'bg-green-500' : 
                          member.status === 'INACTIVE' ? 'bg-yellow-500' : 'bg-red-500'
                        )} />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{member.name}</h4>
                          <Badge 
                            variant={member.status === 'ACTIVE' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {member.status.toLowerCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                          <span>Joined {member.joinedAt.toLocaleDateString()}</span>
                          <span>Last active {member.lastActive.toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "flex items-center space-x-2 px-3 py-1 rounded-full border",
                        getRoleColor(member.role)
                      )}>
                        {getRoleIcon(member.role)}
                        <span className="text-sm font-medium">{member.role}</span>
                      </div>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Permissions
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Edit Permissions - {member.name}</DialogTitle>
                            <DialogDescription>
                              Customize permissions for this team member
                            </DialogDescription>
                          </DialogHeader>
                          
                          <ScrollArea className="max-h-[60vh] pr-4">
                            <div className="space-y-4">
                              <div className="flex items-center space-x-4 p-4 bg-muted rounded-lg">
                                <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center">
                                  <User className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <h4 className="font-medium">{member.name}</h4>
                                  <p className="text-sm text-muted-foreground">Current role: {member.role}</p>
                                </div>
                              </div>
                              
                              {Object.entries(PERMISSIONS).map(([categoryKey, category]) => (
                                <Card key={categoryKey}>
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center space-x-2">
                                      {category.icon}
                                      <span>{category.category}</span>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      {Object.entries(category.permissions).map(([permKey, permission]) => {
                                        const hasPermission = member.customPermissions?.includes(permKey) || 
                                                            getAllPermissionsForRole(member.role).includes(permKey)
                                        
                                        return (
                                          <div key={permKey} className="flex items-start space-x-3">
                                            <Switch
                                              id={`${member.id}-${permKey}`}
                                              checked={hasPermission}
                                              disabled={getAllPermissionsForRole(member.role).includes(permKey)}
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                              <Label 
                                                htmlFor={`${member.id}-${permKey}`} 
                                                className="text-sm font-medium leading-none"
                                              >
                                                {permission.name}
                                                {getAllPermissionsForRole(member.role).includes(permKey) && (
                                                  <Badge variant="secondary" className="ml-2 text-xs">
                                                    From Role
                                                  </Badge>
                                                )}
                                              </Label>
                                              <p className="text-xs text-muted-foreground">
                                                {permission.description}
                                              </p>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </ScrollArea>
                          
                          <DialogFooter>
                            <Button variant="outline">Cancel</Button>
                            <Button>Save Changes</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
                
                {filteredMembers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2" />
                    <p>No team members found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}