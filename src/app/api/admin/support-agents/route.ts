import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/support-agents - Get all support agents
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
    const status = searchParams.get('status')
    const department = searchParams.get('department')
    const workspaceId = searchParams.get('workspaceId')
    const includeStats = searchParams.get('includeStats') === 'true'

    // Find users with support agent roles or specific support permissions
    const supportRoles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: 'support', mode: 'insensitive' } },
          { permissions: { has: 'support_tickets_manage' } },
          { permissions: { has: 'support_tickets_view' } }
        ]
      }
    })

    const supportRoleIds = supportRoles.map(role => role.id)

    // Build where clause for support agents
    const where: any = {
      userRoles: {
        some: {
          roleId: { in: supportRoleIds },
          isActive: true
        }
      }
    }

    if (workspaceId) {
      where.workspaces = {
        some: {
          workspaceId
        }
      }
    }

    const supportAgents = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        timezone: true,
        locale: true,
        createdAt: true,
        emailVerified: true,
        userRoles: {
          where: {
            isActive: true,
            roleId: { in: supportRoleIds }
          },
          include: {
            role: {
              select: {
                id: true,
                name: true,
                displayName: true,
                permissions: true
              }
            }
          }
        },
        workspaces: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        userSessions: {
          where: {
            isActive: true
          },
          select: {
            lastActiveAt: true
          },
          orderBy: {
            lastActiveAt: 'desc'
          },
          take: 1
        },
        _count: includeStats ? {
          select: {
            userActivities: {
              where: {
                action: { in: ['ticket_created', 'ticket_updated', 'ticket_resolved'] }
              }
            }
          }
        } : undefined
      }
    })

    // Enhance agents with support-specific data
    const enhancedAgents = await Promise.all(
      supportAgents.map(async (agent) => {
        let ticketStats = undefined
        let availability = 'offline'

        if (includeStats) {
          // Get ticket statistics for the last 30 days
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          const ticketActivities = await prisma.userActivity.findMany({
            where: {
              userId: agent.id,
              action: { in: ['ticket_created', 'ticket_updated', 'ticket_resolved'] },
              timestamp: {
                gte: thirtyDaysAgo
              }
            }
          })

          ticketStats = {
            totalActivities: ticketActivities.length,
            resolved: ticketActivities.filter(a => a.action === 'ticket_resolved').length,
            created: ticketActivities.filter(a => a.action === 'ticket_created').length,
            updated: ticketActivities.filter(a => a.action === 'ticket_updated').length
          }
        }

        // Determine availability based on last activity
        const lastActivity = agent.userSessions[0]?.lastActiveAt
        if (lastActivity) {
          const minutesAgo = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60))
          if (minutesAgo < 15) {
            availability = 'online'
          } else if (minutesAgo < 60) {
            availability = 'away'
          } else {
            availability = 'offline'
          }
        }

        // Get support permissions
        const supportPermissions = agent.userRoles.reduce((perms: string[], userRole) => {
          const rolePerms = userRole.role.permissions.filter(p =>
            p.includes('support') || p.includes('ticket')
          )
          return [...perms, ...rolePerms]
        }, [])

        // Determine department based on roles and permissions
        let supportDepartment = 'general'
        if (supportPermissions.includes('support_technical_manage')) {
          supportDepartment = 'technical'
        } else if (supportPermissions.includes('support_billing_manage')) {
          supportDepartment = 'billing'
        } else if (supportPermissions.includes('support_sales_manage')) {
          supportDepartment = 'sales'
        }

        return {
          ...agent,
          availability,
          department: supportDepartment,
          supportPermissions,
          ...(ticketStats && { ticketStats })
        }
      })
    )

    // Filter by status and department if specified
    let filteredAgents = enhancedAgents

    if (status) {
      filteredAgents = filteredAgents.filter(agent => agent.availability === status)
    }

    if (department) {
      filteredAgents = filteredAgents.filter(agent => agent.department === department)
    }

    // Calculate statistics
    const stats = {
      total: enhancedAgents.length,
      online: enhancedAgents.filter(a => a.availability === 'online').length,
      away: enhancedAgents.filter(a => a.availability === 'away').length,
      offline: enhancedAgents.filter(a => a.availability === 'offline').length,
      departments: {
        general: enhancedAgents.filter(a => a.department === 'general').length,
        technical: enhancedAgents.filter(a => a.department === 'technical').length,
        billing: enhancedAgents.filter(a => a.department === 'billing').length,
        sales: enhancedAgents.filter(a => a.department === 'sales').length
      }
    }

    return NextResponse.json({
      supportAgents: filteredAgents,
      stats
    })
  } catch (error) {
    console.error('Failed to fetch support agents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch support agents' },
      { status: 500 }
    )
  }
}

// POST /api/admin/support-agents - Assign support agent role to user
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
      userId,
      department = 'general',
      permissions = [],
      workspaceId
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Find or create appropriate support role based on department
    let supportRoleName = 'support_agent'
    let supportPermissions = ['support_tickets_view', 'support_tickets_update']

    switch (department) {
      case 'technical':
        supportRoleName = 'support_technical'
        supportPermissions = [
          'support_tickets_view',
          'support_tickets_update',
          'support_tickets_resolve',
          'support_technical_manage'
        ]
        break
      case 'billing':
        supportRoleName = 'support_billing'
        supportPermissions = [
          'support_tickets_view',
          'support_tickets_update',
          'support_tickets_resolve',
          'support_billing_manage'
        ]
        break
      case 'sales':
        supportRoleName = 'support_sales'
        supportPermissions = [
          'support_tickets_view',
          'support_tickets_update',
          'support_sales_manage'
        ]
        break
    }

    // Add any additional permissions
    if (permissions.length > 0) {
      supportPermissions = [...new Set([...supportPermissions, ...permissions])]
    }

    // Find or create the support role
    let supportRole = await prisma.role.findUnique({
      where: { name: supportRoleName }
    })

    if (!supportRole) {
      supportRole = await prisma.role.create({
        data: {
          name: supportRoleName,
          displayName: `Support Agent - ${department.charAt(0).toUpperCase() + department.slice(1)}`,
          description: `Support agent role for ${department} department`,
          permissions: supportPermissions,
          isSystem: false,
          isActive: true,
          color: '#4F46E5',
          priority: 5
        }
      })
    }

    // Assign role to user
    const result = await prisma.$transaction(async (tx) => {
      // Check if user already has this role
      const existingRole = await tx.userRole.findFirst({
        where: {
          userId,
          roleId: supportRole.id,
          isActive: true
        }
      })

      if (existingRole) {
        throw new Error('User already has this support role')
      }

      // Assign support role
      const userRole = await tx.userRole.create({
        data: {
          userId,
          roleId: supportRole.id,
          assignedBy: normalizedUserId,
          assignedAt: new Date(),
          isActive: true
        }
      })

      // Add to workspace if specified
      if (workspaceId) {
        const existingWorkspace = await tx.userWorkspace.findFirst({
          where: { userId, workspaceId }
        })

        if (!existingWorkspace) {
          await tx.userWorkspace.create({
            data: {
              userId,
              workspaceId,
              role: 'ANALYST',
              joinedAt: new Date()
            }
          })
        }
      }

      return userRole
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId,
        action: 'support_agent_assigned',
        resource: 'user',
        resourceId: userId,
        newValues: {
          roleId: supportRole.id,
          roleName: supportRole.name,
          department,
          permissions: supportPermissions
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json({
      id: result.id,
      userId,
      roleId: supportRole.id,
      roleName: supportRole.name,
      department,
      assignedAt: result.assignedAt
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to assign support agent role:', error)
    return NextResponse.json(
      { error: 'Failed to assign support agent role' },
      { status: 500 }
    )
  }
}