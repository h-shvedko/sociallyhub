import { NextResponse } from 'next/server'
import { NotificationStatus } from '@prisma/client'

import { requireSession } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// ADR-0010 Phase 1.1: bulk mark-as-read via `updateMany` over the caller's
// UNREAD rows only. Idempotent — a second call updates 0 rows.

export async function POST() {
  try {
    const user = await requireSession() // authenticate

    const readAt = new Date()
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ, readAt },
    })

    return NextResponse.json({
      success: true,
      data: {
        updated: result.count,
        readAt: readAt.toISOString(),
        message: 'All notifications marked as read',
      },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
