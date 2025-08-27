import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

export async function GET(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const assigneeId = searchParams.get('assigneeId')
    const socialAccountId = searchParams.get('socialAccountId')
    const sentiment = searchParams.get('sentiment')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100)
    const skip = (page - 1) * limit

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Build filters
    const where: any = {
      workspaceId,
      ...(status && { status }),
      ...(type && { type }),
      ...(assigneeId && { assigneeId }),
      ...(socialAccountId && { socialAccountId }),
      ...(sentiment && { sentiment }),
      ...(search && {
        OR: [
          { content: { contains: search, mode: 'insensitive' } },
          { authorName: { contains: search, mode: 'insensitive' } },
          { authorHandle: { contains: search, mode: 'insensitive' } },
          { internalNotes: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const [inboxItems, total] = await Promise.all([
      prisma.inboxItem.findMany({
        where,
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
        },
        orderBy: [
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.inboxItem.count({ where })
    ])

    return NextResponse.json({
      items: inboxItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  }, 'inbox-list')(request)
}

export async function POST(request: NextRequest) {
  return withLogging(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspaceId,
      socialAccountId,
      type,
      providerItemId,
      providerThreadId,
      content,
      authorName,
      authorHandle,
      authorAvatar,
      sentiment,
      tags = []
    } = body

    // Create inbox item
    const inboxItem = await prisma.inboxItem.create({
      data: {
        workspaceId,
        socialAccountId,
        type,
        providerItemId,
        providerThreadId,
        content,
        authorName,
        authorHandle,
        authorAvatar,
        sentiment,
        tags
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            provider: true,
            handle: true,
            displayName: true
          }
        }
      }
    })

    return NextResponse.json(inboxItem, { status: 201 })
  }, 'inbox-create')(request)
}