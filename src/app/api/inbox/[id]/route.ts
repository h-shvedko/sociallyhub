import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, assigneeId, tags, internalNotes, sentiment } = body

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

    return NextResponse.json(inboxItem)
  }, 'inbox-update')(request)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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