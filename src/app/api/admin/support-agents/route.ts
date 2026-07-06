import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { Prisma, TicketStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// ADR-0011 (item 4): `/api/admin/support-agents` is rewritten on the canonical
// `SupportAgent` model. The old `Role`/`UserRole` + string-permission paradigm
// is deleted — RBAC (ADR-0004) governs WHO may call this admin route;
// `SupportAgent` is the single source of truth for WHO IS an agent.

/**
 * Non-terminal ticket statuses. An agent's "open ticket" load is every
 * assigned ticket that is not RESOLVED / CLOSED / CANCELLED.
 */
const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_USER',
  'PENDING_AGENT',
]

/** Selection shared by every read path so the roster shape stays stable. */
const agentSelect = {
  id: true,
  userId: true,
  displayName: true,
  title: true,
  department: true,
  isActive: true,
  isOnline: true,
  autoAssign: true,
  maxConcurrentChats: true,
  currentChatCount: true,
  skills: true,
  languages: true,
  timezone: true,
  statusMessage: true,
  lastSeen: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { id: true, name: true, email: true, image: true },
  },
  _count: {
    select: {
      assignedTickets: { where: { status: { in: OPEN_TICKET_STATUSES } } },
    },
  },
} satisfies Prisma.SupportAgentSelect

type AgentRow = Prisma.SupportAgentGetPayload<{ select: typeof agentSelect }>

/** Flatten the Prisma row into the roster object the UI renders. */
function toRoster(agent: AgentRow) {
  const { _count, ...rest } = agent
  return {
    ...rest,
    openTicketCount: _count.assignedTickets,
  }
}

const listQuerySchema = z.object({
  department: z.string().trim().min(1).optional(),
  isOnline: z.enum(['true', 'false']).optional(),
  // Default: all agents. `active=true` → only active; `active=false` → only deactivated.
  active: z.enum(['true', 'false', 'all']).optional(),
  search: z.string().trim().min(1).optional(),
})

const createAgentSchema = z.object({
  userId: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().max(120).optional(),
  department: z.string().trim().min(1).max(60).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  maxConcurrentChats: z.number().int().min(0).max(100).optional(),
})

const updateAgentSchema = z
  .object({
    agentId: z.string().trim().min(1),
    isActive: z.boolean().optional(),
    isOnline: z.boolean().optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().max(120).optional(),
    department: z.string().trim().min(1).max(60).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    maxConcurrentChats: z.number().int().min(0).max(100).optional(),
  })
  .refine((d) => Object.keys(d).length > 1, {
    message: 'No fields to update',
  })

// GET /api/admin/support-agents — SupportAgent-backed roster for the admin UI.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    )
    if (!parsed.success) {
      return jsonError(400, 'Invalid query parameters', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }
    const { department, isOnline, active, search } = parsed.data

    const where: Prisma.SupportAgentWhereInput = {}
    if (department) where.department = department
    if (isOnline) where.isOnline = isOnline === 'true'
    if (active === 'true') where.isActive = true
    else if (active === 'false') where.isActive = false
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const rows = await prisma.supportAgent.findMany({
      where,
      select: agentSelect,
      orderBy: [{ isOnline: 'desc' }, { displayName: 'asc' }],
    })

    const agents = rows.map(toRoster)
    const stats = {
      total: agents.length,
      active: agents.filter((a) => a.isActive).length,
      online: agents.filter((a) => a.isOnline).length,
      openTickets: agents.reduce((sum, a) => sum + a.openTicketCount, 0),
    }

    return NextResponse.json({ agents, stats })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/admin/support-agents — create or reactivate a SupportAgent profile.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const parsed = createAgentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return jsonError(400, 'Invalid request body', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }
    const { userId, displayName, title, department, skills, maxConcurrentChats } =
      parsed.data

    // The agent profile must belong to a real user.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return jsonError(404, 'User not found', { code: 'NOT_FOUND' })
    }

    const existing = await prisma.supportAgent.findUnique({
      where: { userId },
      select: { id: true, isActive: true },
    })

    const resolvedDisplayName =
      displayName ?? user.name ?? user.email ?? 'Support Agent'

    // Upsert on the unique userId: create a fresh profile, or reactivate +
    // update an existing one (an agent is never duplicated).
    const agent = await prisma.supportAgent.upsert({
      where: { userId },
      create: {
        userId,
        displayName: resolvedDisplayName,
        ...(title !== undefined ? { title } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(skills !== undefined ? { skills } : {}),
        ...(maxConcurrentChats !== undefined ? { maxConcurrentChats } : {}),
        isActive: true,
      },
      update: {
        isActive: true,
        ...(displayName !== undefined ? { displayName } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(skills !== undefined ? { skills } : {}),
        ...(maxConcurrentChats !== undefined ? { maxConcurrentChats } : {}),
      },
      select: agentSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: existing ? 'support_agent_reactivated' : 'support_agent_created',
        resource: 'support_agent',
        resourceId: agent.id,
        newValues: {
          agentUserId: userId,
          displayName: agent.displayName,
          department: agent.department,
          reactivated: Boolean(existing && existing.isActive === false),
        },
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    })

    return NextResponse.json(
      { agent: toRoster(agent) },
      { status: existing ? 200 : 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/admin/support-agents — activate/deactivate or update an agent.
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const parsed = updateAgentSchema.safeParse(await request.json())
    if (!parsed.success) {
      return jsonError(400, 'Invalid request body', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }
    const { agentId, ...updates } = parsed.data

    const existing = await prisma.supportAgent.findUnique({
      where: { id: agentId },
      select: { id: true, isActive: true, isOnline: true },
    })
    if (!existing) {
      return jsonError(404, 'Support agent not found', { code: 'NOT_FOUND' })
    }

    const data: Prisma.SupportAgentUpdateInput = {}
    if (updates.isActive !== undefined) data.isActive = updates.isActive
    if (updates.isOnline !== undefined) data.isOnline = updates.isOnline
    if (updates.displayName !== undefined) data.displayName = updates.displayName
    if (updates.title !== undefined) data.title = updates.title
    if (updates.department !== undefined) data.department = updates.department
    if (updates.skills !== undefined) data.skills = updates.skills
    if (updates.maxConcurrentChats !== undefined) {
      data.maxConcurrentChats = updates.maxConcurrentChats
    }

    const agent = await prisma.supportAgent.update({
      where: { id: agentId },
      data,
      select: agentSelect,
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'support_agent_updated',
        resource: 'support_agent',
        resourceId: agent.id,
        oldValues: { isActive: existing.isActive, isOnline: existing.isOnline },
        changes: updates,
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    })

    return NextResponse.json({ agent: toRoster(agent) })
  } catch (error) {
    return handleApiError(error)
  }
}
