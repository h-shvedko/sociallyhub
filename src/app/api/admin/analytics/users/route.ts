import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/analytics/users - Get comprehensive user analytics
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
    const period = searchParams.get('period') || '30d'
    const workspaceId = searchParams.get('workspaceId')

    // Calculate date range based on period
    const now = new Date()
    const startDate = new Date()

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setDate(now.getDate() - 30)
    }

    // Build where clause for workspace filtering
    const userWhereClause: any = {}
    const activityWhereClause: any = {
      timestamp: {
        gte: startDate
      }
    }
    const sessionWhereClause: any = {
      createdAt: {
        gte: startDate
      }
    }

    if (workspaceId) {
      userWhereClause.workspaces = {
        some: {
          workspaceId
        }
      }
      activityWhereClause.workspaceId = workspaceId
      sessionWhereClause.user = {
        workspaces: {
          some: {
            workspaceId
          }
        }
      }
    }

    // Get user statistics
    const totalUsers = await prisma.user.count({ where: userWhereClause })

    const activeUsers = await prisma.user.count({
      where: {
        ...userWhereClause,
        userSessions: {
          some: {
            lastActiveAt: {
              gte: startDate
            }
          }
        }
      }
    })

    const newUsers = await prisma.user.count({
      where: {
        ...userWhereClause,
        createdAt: {
          gte: startDate
        }
      }
    })

    const verifiedUsers = await prisma.user.count({
      where: {
        ...userWhereClause,
        emailVerified: {
          not: null
        }
      }
    })

    const twoFactorUsers = await prisma.user.count({
      where: {
        ...userWhereClause,
        twoFactorEnabled: true
      }
    })

    // Get login patterns
    const loginSessions = await prisma.userSession.findMany({
      where: sessionWhereClause,
      select: {
        createdAt: true,
        lastActiveAt: true,
        user: {
          select: {
            id: true,
            timezone: true
          }
        }
      }
    })

    // Analyze login patterns
    const loginsByDay = loginSessions.reduce((acc: any, session) => {
      const day = session.createdAt.toISOString().split('T')[0]
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {})

    const loginsByHour = loginSessions.reduce((acc: any, session) => {
      const hour = session.createdAt.getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {})

    // Get user activities
    const userActivities = await prisma.userActivity.findMany({
      where: activityWhereClause,
      select: {
        action: true,
        resource: true,
        timestamp: true,
        user: {
          select: {
            id: true
          }
        }
      }
    })

    // Analyze feature usage
    const featureUsage = userActivities.reduce((acc: any, activity) => {
      const feature = `${activity.resource}_${activity.action}`
      acc[feature] = (acc[feature] || 0) + 1
      return acc
    }, {})

    const mostActiveFeatures = Object.entries(featureUsage)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10)
      .map(([feature, count]) => ({ feature, count }))

    // Get user engagement metrics
    const userEngagement = await prisma.user.findMany({
      where: userWhereClause,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            userActivities: {
              where: {
                timestamp: {
                  gte: startDate
                }
              }
            },
            userSessions: {
              where: {
                createdAt: {
                  gte: startDate
                }
              }
            }
          }
        },
        userSessions: {
          where: {
            createdAt: {
              gte: startDate
            }
          },
          select: {
            lastActiveAt: true
          },
          orderBy: {
            lastActiveAt: 'desc'
          },
          take: 1
        }
      }
    })

    // Calculate engagement scores
    const engagementScores = userEngagement.map(user => {
      const activities = user._count.userActivities
      const sessions = user._count.userSessions
      const daysSinceCreated = Math.max(1, Math.ceil((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)))
      const lastActive = user.userSessions[0]?.lastActiveAt
      const daysSinceActive = lastActive ? Math.ceil((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)) : 999

      const engagementScore = Math.round(
        ((activities / daysSinceCreated) * 10 + (sessions / daysSinceCreated) * 5) *
        Math.max(0.1, 1 - (daysSinceActive / 30))
      )

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        activities,
        sessions,
        lastActive,
        engagementScore
      }
    }).sort((a, b) => b.engagementScore - a.engagementScore)

    // Get role distribution
    const roleDistribution = await prisma.userWorkspace.groupBy({
      by: ['role'],
      where: workspaceId ? { workspaceId } : {},
      _count: true
    })

    // Get workspace activity if no specific workspace filter
    let workspaceActivity = []
    if (!workspaceId) {
      workspaceActivity = await prisma.workspace.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              users: true,
              posts: {
                where: {
                  createdAt: {
                    gte: startDate
                  }
                }
              },
              campaigns: {
                where: {
                  createdAt: {
                    gte: startDate
                  }
                }
              }
            }
          }
        },
        orderBy: {
          users: {
            _count: 'desc'
          }
        },
        take: 10
      })
    }

    return NextResponse.json({
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        verifiedUsers,
        twoFactorUsers,
        activityRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
        verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
      },
      loginPatterns: {
        daily: loginsByDay,
        hourly: loginsByHour,
        totalSessions: loginSessions.length
      },
      featureUsage: {
        totalActivities: userActivities.length,
        mostActive: mostActiveFeatures,
        uniqueFeatures: Object.keys(featureUsage).length
      },
      userEngagement: {
        topUsers: engagementScores.slice(0, 20),
        averageEngagement: engagementScores.length > 0
          ? Math.round(engagementScores.reduce((sum, u) => sum + u.engagementScore, 0) / engagementScores.length)
          : 0
      },
      roleDistribution: roleDistribution.map(r => ({
        role: r.role,
        count: r._count,
        percentage: totalUsers > 0 ? Math.round((r._count / totalUsers) * 100) : 0
      })),
      ...(workspaceActivity.length > 0 && {
        workspaceActivity: workspaceActivity.map(w => ({
          id: w.id,
          name: w.name,
          users: w._count.users,
          posts: w._count.posts,
          campaigns: w._count.campaigns
        }))
      }),
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      }
    })
  } catch (error) {
    console.error('Failed to fetch user analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user analytics' },
      { status: 500 }
    )
  }
}