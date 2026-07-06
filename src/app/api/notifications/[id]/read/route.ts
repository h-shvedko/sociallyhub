import { NextRequest, NextResponse } from 'next/server'
import { NotificationStatus } from '@prisma/client'

import { requireSession, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// ADR-0010 Phase 1.1: real DB update. Ownership is enforced inside the
// `updateMany` where clause ({ id, userId }); a zero count means the row is
// not the caller's (or does not exist) → 404 (never reveal existence).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params // 1. await params
    const user = await requireSession() // 2. authenticate

    const readAt = new Date()
    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id }, // 3. authorize (ownership-scoped)
      data: { status: NotificationStatus.READ, readAt },
    })

    if (result.count === 0) {
      throw new ApiError(404, 'Notification not found', 'NOT_FOUND')
    }

    return NextResponse.json({
      success: true,
      data: { id, status: NotificationStatus.READ, readAt: readAt.toISOString() },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
