import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'
import { notifyUser } from '@/lib/notifications/notify'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const inboxItem = await prisma.inboxItem.findUnique({
      where: { id: params.id },
      include: {
        socialAccount: {
          select: {
            id: true,
            provider: true,
            handle: true,
            displayName: true
          }
        },
        assignee: {
          select: {
            id: true,
            name: true,
            image: true
          }
        },
        conversation: {
          select: {
            threadData: true
          }
        }
      }
    })

    if (!inboxItem) {
      return NextResponse.json({ error: 'Inbox item not found' }, { status: 404 })
    }

    return NextResponse.json(inboxItem)
  }, 'inbox-get')(request)
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, assigneeId, tags, internalNotes, sentiment } = body

    // Capture the prior assignee so we only notify on an actual assignment change
    // (ADR-0010 INBOX_ASSIGNMENT producer). Only fetch when assignment is touched.
    const previous =
      assigneeId !== undefined
        ? await prisma.inboxItem.findUnique({
            where: { id: params.id },
            select: { assigneeId: true }
          })
        : null

    const inboxItem = await prisma.inboxItem.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(tags && { tags }),
        ...(internalNotes !== undefined && { internalNotes }),
        ...(sentiment && { sentiment }),
        updatedAt: new Date()
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            provider: true,
            handle: true,
            displayName: true
          }
        },
        assignee: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // ADR-0010: notify the newly-assigned team member. Persist-first + best-effort
    // — a notify failure must never break the assignment write.
    if (
      assigneeId !== undefined &&
      inboxItem.assigneeId &&
      inboxItem.assigneeId !== previous?.assigneeId
    ) {
      try {
        await notifyUser(inboxItem.assigneeId, {
          type: 'INBOX_ASSIGNMENT',
          title: 'New inbox item assigned to you',
          message: `A ${inboxItem.socialAccount?.provider ?? 'social'} ${String(inboxItem.type).toLowerCase()} was assigned to you.`,
          data: {
            inboxItemId: inboxItem.id,
            actionUrl: `/dashboard/inbox?item=${inboxItem.id}`
          }
        })
      } catch (notifyError) {
        console.error('Failed to send inbox assignment notification:', notifyError)
      }
    }

    return NextResponse.json(inboxItem)
  }, 'inbox-update')(request)
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.inboxItem.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  }, 'inbox-delete')(request)
}