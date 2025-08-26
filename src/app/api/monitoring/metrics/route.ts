import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { withLogging } from '@/lib/middleware/logging'

// GET /api/monitoring/metrics - Get system metrics
async function getHandler(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has monitoring permissions (admin/owner)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Calculate metrics
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get recent posts (API activity indicator)
    const recentPosts = await prisma.post.count({
      where: {
        createdAt: { gte: oneHourAgo }
      }
    })

    // Get user activity (session activity)
    const activeUsers = await prisma.userSession.count({
      where: {
        lastActivity: { gte: new Date(now.getTime() - 15 * 60 * 1000) }, // Last 15 minutes
        endTime: null
      }
    })

    // Get total users
    const totalUsers = await prisma.user.count()

    // Get error metrics from recent time period
    // This would typically come from your logging system
    const errorRate = Math.random() * 2 // Mock error rate between 0-2%
    const avgResponseTime = 200 + Math.random() * 300 // Mock response time 200-500ms

    // Database health check
    let dbStatus = 'Connected'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      dbStatus = 'Disconnected'
    }

    const metrics = {
      systemStatus: 'Healthy',
      uptime: '99.9%',
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      dbStatus,
      activeUsers,
      totalUsers,
      recentActivity: recentPosts,
      timestamp: now.toISOString()
    }

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(getHandler, 'monitoring-metrics')