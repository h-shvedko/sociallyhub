"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building, Users, Plus, Settings, Check, Crown, Shield, Edit, Eye } from "lucide-react"

interface Workspace {
  id: string
  name: string
  role: "OWNER" | "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER"
  members: number
  isActive: boolean
  avatar?: string
}

const mockWorkspaces: Workspace[] = [
  {
    id: "1",
    name: "SociallyHub Team",
    role: "OWNER",
    members: 8,
    isActive: true
  },
  {
    id: "2", 
    name: "Acme Corp Marketing",
    role: "ADMIN",
    members: 12,
    isActive: false
  },
  {
    id: "3",
    name: "Startup Inc",
    role: "EDITOR",
    members: 4,
    isActive: false
  }
]

const getRoleIcon = (role: string) => {
  switch (role) {
    case "OWNER": return <Crown className="w-4 h-4" />
    case "ADMIN": return <Shield className="w-4 h-4" />
    case "MANAGER": return <Settings className="w-4 h-4" />
    case "EDITOR": return <Edit className="w-4 h-4" />
    case "VIEWER": return <Eye className="w-4 h-4" />
    default: return null
  }
}

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(mockWorkspaces)
  const [isCreating, setIsCreating] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState({ name: "", description: "" })

  const switchWorkspace = (workspaceId: string) => {
    setWorkspaces(workspaces.map(ws => ({
      ...ws,
      isActive: ws.id === workspaceId
    })))
    // TODO: Implement actual workspace switching logic
  }

  const createWorkspace = () => {
    if (!newWorkspace.name.trim()) return
    
    const workspace: Workspace = {
      id: Date.now().toString(),
      name: newWorkspace.name,
      role: "OWNER",
      members: 1,
      isActive: false
    }
    
    setWorkspaces([...workspaces, workspace])
    setNewWorkspace({ name: "", description: "" })
    setIsCreating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Switch Workspace</h1>
          <p className="text-muted-foreground">
            Manage and switch between your workspaces.
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Set up a new workspace for your team or organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="Enter workspace name"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({...newWorkspace, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-description">Description (Optional)</Label>
                <textarea
                  id="workspace-description"
                  className="w-full min-h-[80px] px-3 py-2 border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md resize-none"
                  placeholder="Describe your workspace..."
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({...newWorkspace, description: e.target.value})}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button onClick={createWorkspace}>
                  Create Workspace
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Workspace */}
      <Card className="border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Current Workspace
              </CardTitle>
              <CardDescription>
                You are currently working in this workspace
              </CardDescription>
            </div>
            <Badge variant="default">Active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {workspaces.find(ws => ws.isActive) && (
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center space-x-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {workspaces.find(ws => ws.isActive)?.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{workspaces.find(ws => ws.isActive)?.name}</h3>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getRoleIcon(workspaces.find(ws => ws.isActive)?.role || "")}
                      {workspaces.find(ws => ws.isActive)?.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {workspaces.find(ws => ws.isActive)?.members} members
                  </p>
                </div>
              </div>
              <Check className="w-5 h-5 text-primary" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle>Available Workspaces</CardTitle>
          <CardDescription>
            Switch to a different workspace or manage your workspace memberships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workspaces.filter(ws => !ws.isActive).map((workspace) => (
              <div 
                key={workspace.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {workspace.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{workspace.name}</h4>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getRoleIcon(workspace.role)}
                        {workspace.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {workspace.members} members
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => switchWorkspace(workspace.id)}
                >
                  Switch
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Invitations */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Workspaces you've been invited to join
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Building className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No pending invitations</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}