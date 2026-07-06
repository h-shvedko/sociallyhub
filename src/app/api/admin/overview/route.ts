import { NextResponse } from 'next/server'
import { TicketStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// GET /api/admin/overview — real platform stats for the admin overview page.
//
// Every number here is a live DB count; nothing is fabricated. Stats without a
// real source (SLA compliance, avg response time, service health) are simply
// not returned (ADR-0012 Phase 4 item 17).
export async function GET() {
  try {
    await requireAdmin()

    const [totalUsers, totalWorkspaces, openTickets, recent] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.supportTicket.count({
        where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } },
      }),
      prisma.auditLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          timestamp: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ])

    const recentActivity = recent.map((entry) => ({
      id: entry.id,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      timestamp: entry.timestamp,
      actor: entry.user
        ? { name: entry.user.name, email: entry.user.email }
        : null,
    }))

    return NextResponse.json({
      stats: {
        totalUsers,
        totalWorkspaces,
        openTickets,
      },
      recentActivity,
    })
  } catch (err) {
    return handleApiError(err)
  }
}
