import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/admin/help/articles/[id]/media/reorder - Reorder article media
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: articleId } = params
    const data = await request.json()
    const { mediaOrders } = data

    // Validate input
    if (!Array.isArray(mediaOrders) || mediaOrders.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid mediaOrders array' },
        { status: 400 }
      )
    }

    // Validate that all items have id and sortOrder
    for (const item of mediaOrders) {
      if (!item.id || typeof item.sortOrder !== 'number') {
        return NextResponse.json(
          { error: 'Each media order item must have id and sortOrder' },
          { status: 400 }
        )
      }
    }

    // Verify all media belongs to the article
    const mediaIds = mediaOrders.map(item => item.id)
    const existingMedia = await prisma.helpArticleMedia.findMany({
      where: {
        id: { in: mediaIds },
        articleId
      },
      select: { id: true, fileName: true }
    })

    if (existingMedia.length !== mediaIds.length) {
      return NextResponse.json(
        { error: 'Some media items not found or do not belong to this article' },
        { status: 400 }
      )
    }

    // Update media order in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updates = await Promise.all(
        mediaOrders.map(({ id, sortOrder }) =>
          tx.helpArticleMedia.update({
            where: { id },
            data: {
              sortOrder,
              updatedAt: new Date()
            },
            select: {
              id: true,
              fileName: true,
              originalName: true,
              sortOrder: true
            }
          })
        )
      )

      return updates
    })

    return NextResponse.json({
      message: 'Media reordered successfully',
      updatedMedia: result.sort((a, b) => a.sortOrder - b.sortOrder)
    })
  } catch (error) {
    console.error('Failed to reorder media:', error)
    return NextResponse.json(
      { error: 'Failed to reorder media' },
      { status: 500 }
    )
  }
}