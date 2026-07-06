import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { NotificationStatus, NotificationType } from '@prisma/client'

import { requireSession } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// ADR-0010 Phase 1.1: `/api/notifications` GET is rewritten on the real
// `Notification` Prisma model. The former hardcoded `mockNotifications` array
// (5 fixed `userId: 'user1'` rows) is deleted — real users now see their own
// persisted rows. Persist-first (ADR-0010): these rows are the single source
// of truth; SSE/dispatch are latency upgrades layered on top in later phases.

const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.nativeEnum(NotificationStatus).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession() // 1. authenticate

    // 2. validate query params
    const parsed = getNotificationsQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    )
    if (!parsed.success) {
      return jsonError(400, 'Invalid query parameters', {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      })
    }
    const { limit, offset, status, type, startDate, endDate } = parsed.data

    // 3. build the filtered where clause (scoped to the caller's rows).
    // Default view hides DISMISSED (archived) rows so archiving is sticky
    // across refetches; an explicit `status=DISMISSED` can still list them.
    const createdAt =
      startDate || endDate
        ? {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          }
        : undefined

    const where = {
      userId: user.id,
      ...(status ? { status } : { status: { not: NotificationStatus.DISMISSED } }),
      ...(type ? { type } : {}),
      ...(createdAt ? { createdAt } : {}),
    }

    // 4. do the work — page of rows + counts + unread stats, in parallel.
    const [notifications, filteredTotal, total, unread, byTypeRaw] =
      await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { userId: user.id, status: { not: NotificationStatus.DISMISSED } },
        }),
        prisma.notification.count({
          where: { userId: user.id, status: NotificationStatus.UNREAD },
        }),
        prisma.notification.groupBy({
          by: ['type'],
          where: { userId: user.id, status: { not: NotificationStatus.DISMISSED } },
          _count: { _all: true },
        }),
      ])

    const byType = Object.fromEntries(
      byTypeRaw.map((g) => [g.type, g._count._all])
    ) as Record<string, number>

    // 5. respond — envelope shape preserved for the existing UI hook, which
    // reads `data.notifications` and `data.stats.unread`.
    return NextResponse.json({
      success: true,
      data: {
        notifications,
        pagination: {
          total: filteredTotal,
          offset,
          limit,
          hasMore: offset + limit < filteredTotal,
        },
        stats: {
          total,
          unread,
          byType,
        },
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
