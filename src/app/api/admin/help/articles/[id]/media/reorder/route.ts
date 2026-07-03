import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// POST /api/admin/help/articles/[id]/media/reorder - Reorder article media
export async function POST(request: NextRequest, props: RouteParams) {
  const params = await props.params;
  try {
    await requireAdmin()

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
    return handleApiError(error)
  }
}