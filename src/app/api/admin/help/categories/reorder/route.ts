import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
// POST /api/admin/help/categories/reorder - Reorder categories
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const data = await request.json()
    const { categoryOrders } = data

    // Validate input
    if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid categoryOrders array' },
        { status: 400 }
      )
    }

    // Validate that all items have id and sortOrder
    for (const item of categoryOrders) {
      if (!item.id || typeof item.sortOrder !== 'number') {
        return NextResponse.json(
          { error: 'Each category order item must have id and sortOrder' },
          { status: 400 }
        )
      }
    }

    // Verify all categories exist
    const categoryIds = categoryOrders.map(item => item.id)
    const existingCategories = await prisma.helpCategory.findMany({
      where: {
        id: { in: categoryIds }
      },
      select: { id: true, name: true }
    })

    if (existingCategories.length !== categoryIds.length) {
      return NextResponse.json(
        { error: 'Some categories not found' },
        { status: 400 }
      )
    }

    // Update categories in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updates = await Promise.all(
        categoryOrders.map(({ id, sortOrder }) =>
          tx.helpCategory.update({
            where: { id },
            data: {
              sortOrder,
              updatedAt: new Date()
            },
            select: {
              id: true,
              name: true,
              slug: true,
              sortOrder: true
            }
          })
        )
      )

      return updates
    })

    return NextResponse.json({
      message: 'Categories reordered successfully',
      updatedCategories: result.sort((a, b) => a.sortOrder - b.sortOrder)
    })
  } catch (error) {
    return handleApiError(error)
  }
}