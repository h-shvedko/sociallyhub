'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  Circle,
  MessageSquare,
  Ticket,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Roster shape returned by the rewritten GET /api/admin/support-agents.
// Kept intentionally loose/optional so the UI is resilient to the exact
// serialization chosen by the route (ADR-0011 Phase 1, item 4).
interface SupportAgentRow {
  id: string
  userId: string
  displayName: string
  title?: string | null
  department: string
  isActive?: boolean
  isOnline?: boolean
  currentChatCount?: number
  maxConcurrentChats?: number
  skills?: string[]
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
  // open assigned-ticket count — tolerate a couple of likely field names
  openTicketCount?: number
  _count?: { assignedTickets?: number } | null
}

const DEPARTMENTS = ['support', 'technical', 'billing', 'sales'] as const

function openTicketsOf(agent: SupportAgentRow): number {
  return agent.openTicketCount ?? agent._count?.assignedTickets ?? 0
}

export default function SupportAgentsPage() {
  const [agents, setAgents] = useState<SupportAgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Create-agent dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    userId: '',
    displayName: '',
    title: '',
    department: 'support',
    skills: '',
    maxConcurrentChats: '5',
  })

  // Per-row toggle in-flight tracking
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/support-agents')
      if (!res.ok) {
        throw new Error(`Failed to load agents (${res.status})`)
      }
      const data = await res.json()
      const list: SupportAgentRow[] = data.supportAgents ?? data.agents ?? []
      setAgents(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Error loading support agents:', err)
      setLoadError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const resetForm = () => {
    setForm({
      userId: '',
      displayName: '',
      title: '',
      department: 'support',
      skills: '',
      maxConcurrentChats: '5',
    })
    setFormError(null)
  }

  const handleCreate = async () => {
    if (!form.userId.trim() || !form.displayName.trim()) {
      setFormError('User ID and display name are required.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const skills = form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const res = await fetch('/api/admin/support-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: form.userId.trim(),
          displayName: form.displayName.trim(),
          title: form.title.trim() || undefined,
          department: form.department,
          skills,
          maxConcurrentChats: Number(form.maxConcurrentChats) || 5,
          isActive: true,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to create agent (${res.status})`)
      }

      setDialogOpen(false)
      resetForm()
      await fetchAgents()
    } catch (err) {
      console.error('Error creating support agent:', err)
      setFormError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (agent: SupportAgentRow) => {
    const nextActive = !(agent.isActive ?? true)
    setTogglingUserId(agent.userId)
    try {
      // PATCH by agentId flips the active flag in place (deactivate OR reactivate).
      // POST only ever reactivates, so it cannot deactivate — use PATCH here.
      const res = await fetch('/api/admin/support-agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          isActive: nextActive,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to update agent (${res.status})`)
      }
      await fetchAgents()
    } catch (err) {
      console.error('Error toggling agent status:', err)
      setLoadError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setTogglingUserId(null)
    }
  }

  const total = agents.length
  const onlineCount = agents.filter((a) => a.isOnline).length
  const activeCount = agents.filter((a) => a.isActive ?? true).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Agents</h1>
          <p className="text-gray-600 mt-1">
            Manage who can be assigned support tickets and live chats.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setDialogOpen(true)
          }}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Make user an agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total agents</p>
              <p className="text-xl font-semibold text-gray-900">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Circle className="w-5 h-5 text-green-600 fill-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Online now</p>
              <p className="text-xl font-semibold text-gray-900">{onlineCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-xl font-semibold text-gray-900">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roster */}
      <Card>
        <CardHeader>
          <CardTitle>Agent roster</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading agents...
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 py-8 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <span>{loadError}</span>
              <Button variant="outline" size="sm" onClick={fetchAgents} className="ml-2">
                Retry
              </Button>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No support agents yet.</p>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm()
                  setDialogOpen(true)
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Make user an agent
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Chat load</th>
                    <th className="px-4 py-3">Open tickets</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {agents.map((agent) => {
                    const active = agent.isActive ?? true
                    return (
                      <tr key={agent.id} className="text-sm">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {agent.user?.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={agent.user.image}
                                alt=""
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {agent.displayName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {agent.user?.email || agent.user?.name || agent.userId}
                              </p>
                              {agent.title && (
                                <p className="text-xs text-gray-400">{agent.title}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize">
                            {agent.department}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  agent.isOnline ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                              />
                              {agent.isOnline ? 'Online' : 'Offline'}
                            </span>
                            <Badge variant={active ? 'default' : 'outline'}>
                              {active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                            {agent.currentChatCount ?? 0}/{agent.maxConcurrentChats ?? 5}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="inline-flex items-center gap-1">
                            <Ticket className="w-3.5 h-3.5 text-gray-400" />
                            {openTicketsOf(agent)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant={active ? 'outline' : 'default'}
                            size="sm"
                            disabled={togglingUserId === agent.userId}
                            onClick={() => handleToggleActive(agent)}
                          >
                            {togglingUserId === agent.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : active ? (
                              'Deactivate'
                            ) : (
                              'Activate'
                            )}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Make user an agent dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a user an agent</DialogTitle>
            <DialogDescription>
              Create a support-agent profile for an existing user. Enter the user&apos;s
              ID and how they should appear to the support team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-userId">User ID</Label>
              <Input
                id="agent-userId"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder="cuid of an existing user"
              />
            </div>
            <div>
              <Label htmlFor="agent-displayName">Display name</Label>
              <Input
                id="agent-displayName"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <Label htmlFor="agent-title">Title (optional)</Label>
              <Input
                id="agent-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Senior Support Agent"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={form.department}
                onValueChange={(value) => setForm({ ...form, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept} className="capitalize">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="agent-skills">Skills (comma-separated)</Label>
              <Input
                id="agent-skills"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="e.g. billing, api, onboarding"
              />
            </div>
            <div>
              <Label htmlFor="agent-maxChats">Max concurrent chats</Label>
              <Input
                id="agent-maxChats"
                type="number"
                min={1}
                value={form.maxConcurrentChats}
                onChange={(e) =>
                  setForm({ ...form, maxConcurrentChats: e.target.value })
                }
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create agent'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
