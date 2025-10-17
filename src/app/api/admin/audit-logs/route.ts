import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/audit-logs - Get comprehensive audit logs and access logs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')
    const resource = searchParams.get('resource')
    const userId = searchParams.get('userId')
    const workspaceId = searchParams.get('workspaceId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeUserActivity = searchParams.get('includeUserActivity') === 'true'

    // Build where clause for audit logs
    const auditWhere: any = {}

    if (action) {
      auditWhere.action = action
    }

    if (resource) {
      auditWhere.resource = resource
    }

    if (userId) {
      auditWhere.userId = userId
    }

    if (workspaceId) {
      auditWhere.workspaceId = workspaceId
    }

    if (startDate || endDate) {
      auditWhere.timestamp = {}
      if (startDate) {
        auditWhere.timestamp.gte = new Date(startDate)
      }
      if (endDate) {
        auditWhere.timestamp.lte = new Date(endDate)
      }
    }

    // Get audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: auditWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        },
        role: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset
    })

    const totalAuditLogs = await prisma.auditLog.count({ where: auditWhere })

    // Get user activity logs if requested
    let userActivities = []
    let totalUserActivities = 0

    if (includeUserActivity) {
      const activityWhere: any = {}

      if (userId) {
        activityWhere.userId = userId
      }

      if (workspaceId) {
        activityWhere.workspaceId = workspaceId
      }

      if (startDate || endDate) {
        activityWhere.timestamp = {}
        if (startDate) {
          activityWhere.timestamp.gte = new Date(startDate)
        }
        if (endDate) {
          activityWhere.timestamp.lte = new Date(endDate)
        }
      }

      userActivities = await prisma.userActivity.findMany({
        where: activityWhere,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          workspace: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: limit,
        skip: offset
      })

      totalUserActivities = await prisma.userActivity.count({ where: activityWhere })
    }

    // Get audit log statistics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentAuditLogs = await prisma.auditLog.count({
      where: {
        timestamp: {
          gte: thirtyDaysAgo
        }
      }
    })

    const recentUserActivities = await prisma.userActivity.count({
      where: {
        timestamp: {
          gte: thirtyDaysAgo
        }
      }
    })

    // Get action distribution
    const actionDistribution = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        timestamp: {
          gte: thirtyDaysAgo
        }
      },
      _count: true,
      orderBy: {
        _count: {
          action: 'desc'
        }
      },
      take: 10
    })

    // Get resource distribution
    const resourceDistribution = await prisma.auditLog.groupBy({
      by: ['resource'],
      where: {
        timestamp: {
          gte: thirtyDaysAgo
        }
      },
      _count: true,
      orderBy: {
        _count: {
          resource: 'desc'
        }
      },
      take: 10
    })

    // Get most active users
    const mostActiveUsers = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        timestamp: {
          gte: thirtyDaysAgo
        }
      },
      _count: true,
      orderBy: {
        _count: {
          userId: 'desc'
        }
      },
      take: 10
    })

    // Enrich most active users with user data
    const enrichedActiveUsers = await Promise.all(
      mostActiveUsers.map(async (userLog) => {
        const user = await prisma.user.findUnique({
          where: { id: userLog.userId || undefined },
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        })
        return {
          user,
          activityCount: userLog._count
        }
      })
    )

    // Get daily activity trend
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const dailyActivity = await prisma.auditLog.findMany({
      where: {
        timestamp: {
          gte: sevenDaysAgo
        }
      },
      select: {
        timestamp: true
      }
    })

    const dailyActivityTrend = dailyActivity.reduce((acc: any, log) => {
      const day = log.timestamp.toISOString().split('T')[0]
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {})

    // Get security events (failed logins, permission changes, etc.)
    const securityEvents = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'login_failed',
            'permission_denied',
            'role_updated',
            'user_suspended',
            'user_deleted',
            'workspace_access_revoked'
          ]
        },
        timestamp: {
          gte: thirtyDaysAgo
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 20
    })

    return NextResponse.json({
      auditLogs,
      ...(includeUserActivity && { userActivities }),
      pagination: {
        total: totalAuditLogs,
        ...(includeUserActivity && { totalUserActivities }),
        limit,
        offset,
        hasMore: offset + limit < totalAuditLogs
      },
      statistics: {
        recentAuditLogs,
        recentUserActivities,
        totalEvents: recentAuditLogs + recentUserActivities,
        actionDistribution: actionDistribution.map(a => ({
          action: a.action,
          count: a._count
        })),
        resourceDistribution: resourceDistribution.map(r => ({
          resource: r.resource,
          count: r._count
        })),
        mostActiveUsers: enrichedActiveUsers.filter(u => u.user !== null),
        dailyActivityTrend,
        securityEvents: securityEvents.length
      },
      securityEvents
    })
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

// POST /api/admin/audit-logs - Create manual audit log entry
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      action,
      resource,
      resourceId,
      description,
      metadata = {},
      workspaceId,
      roleId
    } = body

    if (!action || !resource) {
      return NextResponse.json(
        { error: 'Action and resource are required' },
        { status: 400 }
      )
    }

    const auditLog = await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        action,
        resource,
        resourceId,
        description,
        metadata,
        workspaceId,
        roleId,
        timestamp: new Date()
      }
    })

    return NextResponse.json(auditLog, { status: 201 })
  } catch (error) {
    console.error('Failed to create audit log:', error)
    return NextResponse.json(
      { error: 'Failed to create audit log' },
      { status: 500 }
    )
  }
}