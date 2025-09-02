'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Shield,
  Users,
  Key,
  UserPlus,
  Edit,
  Trash2,
  Eye,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Search,
  Filter
} from 'lucide-react'
import { 
  Client, 
  ClientRole, 
  ClientPermissionType, 
  ClientPermission, 
  RestrictionType 
} from '@/types/client'

interface ClientPermissionSystemProps {
  client: Client
  onUpdatePermissions?: (permissions: ClientPermission[]) => void
  onInviteUser?: (invitation: any) => void
}

export function ClientPermissionSystem({ 
  client, 
  onUpdatePermissions, 
  onInviteUser 
}: ClientPermissionSystemProps) {
  const [activeTab, setActiveTab] = useState('users')
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ClientPermission | null>(null)

  // Mock client users and permissions
  const mockClientUsers: ClientPermission[] = [
    {
      id: '1',
      clientId: client.id,
      userId: 'user1',
      role: ClientRole.CLIENT_ADMIN,
      permissions: [
        ClientPermissionType.VIEW_CAMPAIGNS,
        ClientPermissionType.EDIT_CAMPAIGNS,
        ClientPermissionType.VIEW_ANALYTICS,
        ClientPermissionType.EXPORT_DATA,
        ClientPermissionType.MANAGE_BILLING,
        ClientPermissionType.EDIT_BRANDING,
        ClientPermissionType.MANAGE_USERS,
        ClientPermissionType.VIEW_REPORTS,
        ClientPermissionType.SCHEDULE_POSTS,
        ClientPermissionType.APPROVE_CONTENT
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-20')
    },
    {
      id: '2',
      clientId: client.id,
      userId: 'user2',
      role: ClientRole.CLIENT_MANAGER,
      permissions: [
        ClientPermissionType.VIEW_CAMPAIGNS,
        ClientPermissionType.EDIT_CAMPAIGNS,
        ClientPermissionType.VIEW_ANALYTICS,
        ClientPermissionType.EXPORT_DATA,
        ClientPermissionType.VIEW_REPORTS,
        ClientPermissionType.SCHEDULE_POSTS,
        ClientPermissionType.APPROVE_CONTENT
      ],
      restrictions: [
        {
          type: RestrictionType.TIME_BASED,
          value: '9:00-17:00',
          description: 'Access limited to business hours'
        }
      ],
      createdAt: new Date('2024-01-05'),
      updatedAt: new Date('2024-01-15')
    },
    {
      id: '3',
      clientId: client.id,
      userId: 'user3',
      role: ClientRole.CLIENT_CONTRIBUTOR,
      permissions: [
        ClientPermissionType.VIEW_CAMPAIGNS,
        ClientPermissionType.VIEW_ANALYTICS,
        ClientPermissionType.SCHEDULE_POSTS
      ],
      expiresAt: new Date('2024-03-01'),
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10')
    },
    {
      id: '4',
      clientId: client.id,
      userId: 'user4',
      role: ClientRole.CLIENT_VIEWER,
      permissions: [
        ClientPermissionType.VIEW_CAMPAIGNS,
        ClientPermissionType.VIEW_ANALYTICS,
        ClientPermissionType.VIEW_REPORTS
      ],
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15')
    }
  ]

  // Mock user details
  const mockUserDetails = {
    user1: { name: 'John Smith', email: 'john@client.com', avatar: null },
    user2: { name: 'Sarah Johnson', email: 'sarah@client.com', avatar: null },
    user3: { name: 'Mike Davis', email: 'mike@client.com', avatar: null },
    user4: { name: 'Emily Brown', email: 'emily@client.com', avatar: null }
  }

  const rolePermissions = {
    [ClientRole.CLIENT_ADMIN]: Object.values(ClientPermissionType),
    [ClientRole.CLIENT_MANAGER]: [
      ClientPermissionType.VIEW_CAMPAIGNS,
      ClientPermissionType.EDIT_CAMPAIGNS,
      ClientPermissionType.VIEW_ANALYTICS,
      ClientPermissionType.EXPORT_DATA,
      ClientPermissionType.VIEW_REPORTS,
      ClientPermissionType.SCHEDULE_POSTS,
      ClientPermissionType.APPROVE_CONTENT
    ],
    [ClientRole.CLIENT_CONTRIBUTOR]: [
      ClientPermissionType.VIEW_CAMPAIGNS,
      ClientPermissionType.VIEW_ANALYTICS,
      ClientPermissionType.SCHEDULE_POSTS
    ],
    [ClientRole.CLIENT_VIEWER]: [
      ClientPermissionType.VIEW_CAMPAIGNS,
      ClientPermissionType.VIEW_ANALYTICS,
      ClientPermissionType.VIEW_REPORTS
    ]
  }

  const permissionCategories = {
    'Campaign Management': [
      ClientPermissionType.VIEW_CAMPAIGNS,
      ClientPermissionType.EDIT_CAMPAIGNS
    ],
    'Content Management': [
      ClientPermissionType.SCHEDULE_POSTS,
      ClientPermissionType.APPROVE_CONTENT
    ],
    'Analytics & Reports': [
      ClientPermissionType.VIEW_ANALYTICS,
      ClientPermissionType.VIEW_REPORTS,
      ClientPermissionType.EXPORT_DATA
    ],
    'Administration': [
      ClientPermissionType.MANAGE_BILLING,
      ClientPermissionType.EDIT_BRANDING,
      ClientPermissionType.MANAGE_USERS
    ]
  }

  const getRoleColor = (role: ClientRole) => {
    switch (role) {
      case ClientRole.CLIENT_ADMIN:
        return 'bg-red-100 text-red-800'
      case ClientRole.CLIENT_MANAGER:
        return 'bg-blue-100 text-blue-800'
      case ClientRole.CLIENT_CONTRIBUTOR:
        return 'bg-green-100 text-green-800'
      case ClientRole.CLIENT_VIEWER:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatPermissionName = (permission: ClientPermissionType) => {
    return permission.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getUserDetails = (userId: string) => {
    return mockUserDetails[userId as keyof typeof mockUserDetails] || {
      name: 'Unknown User',
      email: 'unknown@client.com',
      avatar: null
    }
  }

  const isPermissionExpiring = (user: ClientPermission) => {
    if (!user.expiresAt) return false
    const daysUntilExpiry = Math.ceil((user.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Client Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Manage user access and permissions for {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Permission Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockClientUsers.length}</div>
            <p className="text-xs text-muted-foreground">
              Active client users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {mockClientUsers.filter(u => u.role === ClientRole.CLIENT_ADMIN).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Full access users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restrictions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {mockClientUsers.filter(u => u.restrictions?.length).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Users with restrictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {mockClientUsers.filter(u => isPermissionExpiring(u)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Expiring soon
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-10"
                  />
                </div>
                <Select>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value={ClientRole.CLIENT_ADMIN}>Admin</SelectItem>
                    <SelectItem value={ClientRole.CLIENT_MANAGER}>Manager</SelectItem>
                    <SelectItem value={ClientRole.CLIENT_CONTRIBUTOR}>Contributor</SelectItem>
                    <SelectItem value={ClientRole.CLIENT_VIEWER}>Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users List */}
          <div className="space-y-4">
            {mockClientUsers.map((user) => {
              const userDetails = getUserDetails(user.userId)
              const isExpiring = isPermissionExpiring(user)
              
              return (
                <Card key={user.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-medium">{userDetails.name}</h4>
                          <p className="text-sm text-muted-foreground">{userDetails.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getRoleColor(user.role)}>
                              {user.role.replace('CLIENT_', '').toLowerCase()}
                            </Badge>
                            {user.restrictions?.length && (
                              <Badge variant="outline" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {user.restrictions.length} restriction{user.restrictions.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                            {isExpiring && (
                              <Badge variant="outline" className="text-xs text-orange-600">
                                <Clock className="h-3 w-3 mr-1" />
                                Expires soon
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right text-sm text-muted-foreground">
                          <div>{user.permissions.length} permissions</div>
                          <div>Added {user.createdAt.toLocaleDateString()}</div>
                          {user.expiresAt && (
                            <div>Expires {user.expiresAt.toLocaleDateString()}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {user.restrictions && user.restrictions.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <Label className="text-xs font-medium mb-2 block">Restrictions</Label>
                        <div className="space-y-1">
                          {user.restrictions.map((restriction, index) => (
                            <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3 text-orange-500" />
                              <span>{restriction.type.toLowerCase().replace('_', ' ')}: {restriction.value}</span>
                              {restriction.description && <span>({restriction.description})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(rolePermissions).map(([role, permissions]) => (
              <Card key={role}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {role.replace('CLIENT_', '').toLowerCase().replace('_', ' ')}
                    </CardTitle>
                    <Badge className={getRoleColor(role as ClientRole)}>
                      {mockClientUsers.filter(u => u.role === role).length} users
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      This role includes {permissions.length} permissions:
                    </div>
                    <div className="space-y-2">
                      {Object.entries(permissionCategories).map(([category, categoryPermissions]) => {
                        const roleHasCategory = categoryPermissions.some(p => permissions.includes(p))
                        if (!roleHasCategory) return null
                        
                        return (
                          <div key={category} className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">{category}</div>
                            <div className="ml-3 space-y-1">
                              {categoryPermissions
                                .filter(p => permissions.includes(p))
                                .map(permission => (
                                  <div key={permission} className="flex items-center gap-2 text-xs">
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    {formatPermissionName(permission)}
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permission Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2">Permission</th>
                      <th className="text-center p-2">Admin</th>
                      <th className="text-center p-2">Manager</th>
                      <th className="text-center p-2">Contributor</th>
                      <th className="text-center p-2">Viewer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(permissionCategories).map(([category, categoryPermissions]) => (
                      <React.Fragment key={category}>
                        <tr>
                          <td colSpan={5} className="font-medium text-muted-foreground bg-muted/50 p-2 text-xs">
                            {category}
                          </td>
                        </tr>
                        {categoryPermissions.map(permission => (
                          <tr key={permission} className="border-t">
                            <td className="p-2">{formatPermissionName(permission)}</td>
                            {Object.values(ClientRole).map(role => (
                              <td key={role} className="text-center p-2">
                                {rolePermissions[role].includes(permission) ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permission Changes Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    date: new Date('2024-01-20T14:30:00'),
                    action: 'Permission Updated',
                    user: 'Sarah Johnson',
                    details: 'Added EXPORT_DATA permission',
                    by: 'John Smith'
                  },
                  {
                    date: new Date('2024-01-15T09:15:00'),
                    action: 'User Invited',
                    user: 'Emily Brown',
                    details: 'Invited as CLIENT_VIEWER',
                    by: 'John Smith'
                  },
                  {
                    date: new Date('2024-01-10T16:20:00'),
                    action: 'Role Changed',
                    user: 'Mike Davis',
                    details: 'Changed from CLIENT_VIEWER to CLIENT_CONTRIBUTOR',
                    by: 'John Smith'
                  },
                  {
                    date: new Date('2024-01-05T11:45:00'),
                    action: 'Restriction Added',
                    user: 'Sarah Johnson',
                    details: 'Added time-based restriction (9:00-17:00)',
                    by: 'John Smith'
                  }
                ].map((entry, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="p-2 bg-muted rounded">
                      <Key className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.action}</span>
                        <Badge variant="outline" className="text-xs">{entry.user}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {entry.details}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {entry.date.toLocaleString()} • by {entry.by}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{getUserDetails(selectedUser.userId).name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Role</Label>
                <Badge className={getRoleColor(selectedUser.role)}>
                  {selectedUser.role.replace('CLIENT_', '').toLowerCase()}
                </Badge>
              </div>

              <div>
                <Label>Permissions ({selectedUser.permissions.length})</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(permissionCategories).map(([category, categoryPermissions]) => {
                    const userCategoryPermissions = categoryPermissions.filter(p => 
                      selectedUser.permissions.includes(p)
                    )
                    if (userCategoryPermissions.length === 0) return null

                    return (
                      <div key={category} className="space-y-1">
                        <div className="text-sm font-medium">{category}</div>
                        <div className="ml-3 space-y-1">
                          {userCategoryPermissions.map(permission => (
                            <div key={permission} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              {formatPermissionName(permission)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedUser.restrictions && selectedUser.restrictions.length > 0 && (
                <div>
                  <Label>Restrictions</Label>
                  <div className="space-y-2 mt-2">
                    {selectedUser.restrictions.map((restriction, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-3 w-3 text-orange-500" />
                        <span>{restriction.type.toLowerCase().replace('_', ' ')}: {restriction.value}</span>
                        {restriction.description && <span className="text-muted-foreground">({restriction.description})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <Label className="text-xs">Added</Label>
                  <div>{selectedUser.createdAt.toLocaleString()}</div>
                </div>
                <div>
                  <Label className="text-xs">Last Updated</Label>
                  <div>{selectedUser.updatedAt.toLocaleString()}</div>
                </div>
                {selectedUser.expiresAt && (
                  <div className="col-span-2">
                    <Label className="text-xs">Expires</Label>
                    <div className={isPermissionExpiring(selectedUser) ? 'text-orange-600' : ''}>
                      {selectedUser.expiresAt.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline">Edit Permissions</Button>
                <Button variant="outline">Add Restriction</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}