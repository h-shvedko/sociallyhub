import { NextRequest, NextResponse } from 'next/server'
import { NotificationStatus } from '@prisma/client'

import { requireSession, ApiError } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

// ADR-0010 Phase 1.1: archiving maps to the `DISMISSED` status. Ownership is
// enforced in the `updateMany` where clause; a zero count → 404.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params // 1. await params
    const user = await requireSession() // 2. authenticate

    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id }, // 3. authorize (ownership-scoped)
      data: { status: NotificationStatus.DISMISSED },
    })

    if (result.count === 0) {
      throw new ApiError(404, 'Notification not found', 'NOT_FOUND')
    }

    return NextResponse.json({
      success: true,
      data: { id, status: NotificationStatus.DISMISSED },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
