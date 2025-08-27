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

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
    }

    // Get inbox statistics
    const [
      totalItems,
      openItems,
      assignedItems,
      snoozedItems,
      closedItems,
      statusBreakdown,
      typeBreakdown,
      sentimentBreakdown,
      recentActivity
    ] = await Promise.all([
      // Total items
      prisma.inboxItem.count({
        where: { workspaceId }
      }),
      
      // Open items
      prisma.inboxItem.count({
        where: { workspaceId, status: 'OPEN' }
      }),
      
      // Assigned items
      prisma.inboxItem.count({
        where: { workspaceId, status: 'ASSIGNED' }
      }),
      
      // Snoozed items
      prisma.inboxItem.count({
        where: { workspaceId, status: 'SNOOZED' }
      }),
      
      // Closed items
      prisma.inboxItem.count({
        where: { workspaceId, status: 'CLOSED' }
      }),
      
      // Status breakdown
      prisma.inboxItem.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { id: true }
      }),
      
      // Type breakdown
      prisma.inboxItem.groupBy({
        by: ['type'],
        where: { workspaceId },
        _count: { id: true }
      }),
      
      // Sentiment breakdown
      prisma.inboxItem.groupBy({
        by: ['sentiment'],
        where: { workspaceId, sentiment: { not: null } },
        _count: { id: true }
      }),
      
      // Recent activity (last 24 hours)
      prisma.inboxItem.count({
        where: {
          workspaceId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })
    ])

    // Calculate response metrics
    const avgResponseTime = await prisma.inboxItem.aggregate({
      where: {
        workspaceId,
        status: 'CLOSED',
        updatedAt: { not: null }
      },
      _avg: {
        id: true // This would need a calculated field for response time
      }
    })

    return NextResponse.json({
      overview: {
        totalItems,
        openItems,
        assignedItems,
        snoozedItems,
        closedItems,
        recentActivity
      },
      breakdowns: {
        status: statusBreakdown.reduce((acc, item) => {
          acc[item.status] = item._count.id
          return acc
        }, {} as Record<string, number>),
        type: typeBreakdown.reduce((acc, item) => {
          acc[item.type] = item._count.id
          return acc
        }, {} as Record<string, number>),
        sentiment: sentimentBreakdown.reduce((acc, item) => {
          if (item.sentiment) {
            acc[item.sentiment] = item._count.id
          }
          return acc
        }, {} as Record<string, number>)
      },
      metrics: {
        responseRate: totalItems > 0 ? Math.round((closedItems / totalItems) * 100) : 0,
        avgResponseTime: null // Would need to implement response time tracking
      }
    })
  }, 'inbox-stats')(request)
}