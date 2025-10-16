import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/admin/help/categories/reorder - Reorder categories
export async function POST(request: NextRequest) {
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
    console.error('Failed to reorder categories:', error)
    return NextResponse.json(
      { error: 'Failed to reorder categories' },
      { status: 500 }
    )
  }
}