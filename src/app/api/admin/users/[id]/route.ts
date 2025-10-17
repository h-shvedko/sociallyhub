import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'
import bcrypt from 'bcryptjs'

// GET /api/admin/users/[id] - Get specific user with full details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        twoFactorEnabled: true,
        timezone: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        workspaces: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                image: true,
                plan: true
              }
            }
          }
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                displayName: true,
                description: true,
                color: true,
                priority: true,
                permissions: true
              }
            }
          },
          where: {
            isActive: true
          }
        },
        teamMemberships: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                description: true,
                workspaceId: true
              }
            }
          }
        },
        userSessions: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            lastActiveAt: true,
            createdAt: true
          },
          orderBy: {
            lastActiveAt: 'desc'
          },
          take: 10
        },
        userActivities: {
          select: {
            id: true,
            action: true,
            resource: true,
            resourceId: true,
            metadata: true,
            timestamp: true,
            ipAddress: true
          },
          orderBy: {
            timestamp: 'desc'
          },
          take: 20
        },
        _count: {
          select: {
            userActivities: true,
            auditLogs: true,
            userSessions: true,
            teamMemberships: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user statistics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentActivity = await prisma.userActivity.count({
      where: {
        userId: params.id,
        timestamp: {
          gte: thirtyDaysAgo
        }
      }
    })

    const lastLogin = await prisma.userSession.findFirst({
      where: {
        userId: params.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        createdAt: true,
        lastActiveAt: true
      }
    })

    return NextResponse.json({
      ...user,
      stats: {
        recentActivity,
        lastLogin: lastLogin?.lastActiveAt || lastLogin?.createdAt,
        totalSessions: user._count.userSessions,
        totalActivities: user._count.userActivities
      }
    })
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/users/[id] - Update user information and roles
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      name,
      email,
      password,
      timezone,
      locale,
      twoFactorEnabled,
      workspaceRoles = [],
      additionalRoles = [],
      teamMemberships = [],
      isActive = true
    } = body

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        workspaces: true,
        userRoles: {
          where: { isActive: true }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent admin from modifying their own admin status
    if (params.id === normalizedUserId && workspaceRoles.length > 0) {
      const currentAdminRole = existingUser.workspaces.find(w =>
        ['OWNER', 'ADMIN'].includes(w.role)
      )
      const newAdminRole = workspaceRoles.find((wr: any) =>
        ['OWNER', 'ADMIN'].includes(wr.role)
      )

      if (currentAdminRole && !newAdminRole) {
        return NextResponse.json(
          { error: 'Cannot remove your own admin privileges' },
          { status: 400 }
        )
      }
    }

    // Check if email is being changed and already exists
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }
    }

    // Hash password if provided
    let hashedPassword = undefined
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12)
    }

    // Update user within a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update basic user information
      const user = await tx.user.update({
        where: { id: params.id },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(hashedPassword && { password: hashedPassword }),
          ...(timezone && { timezone }),
          ...(locale && { locale }),
          ...(twoFactorEnabled !== undefined && { twoFactorEnabled })
        }
      })

      // Update workspace roles
      if (workspaceRoles.length > 0) {
        // Remove existing workspace roles
        await tx.userWorkspace.deleteMany({
          where: { userId: params.id }
        })

        // Add new workspace roles
        const workspaceRoleData = workspaceRoles.map((wr: any) => ({
          userId: params.id,
          workspaceId: wr.workspaceId,
          role: wr.role.toUpperCase(),
          joinedAt: new Date()
        }))

        await tx.userWorkspace.createMany({
          data: workspaceRoleData
        })
      }

      // Update additional roles
      if (additionalRoles.length > 0) {
        // Deactivate existing roles
        await tx.userRole.updateMany({
          where: {
            userId: params.id,
            isActive: true
          },
          data: {
            isActive: false,
            updatedAt: new Date()
          }
        })

        // Add new roles
        const roleData = additionalRoles.map((roleId: string) => ({
          userId: params.id,
          roleId,
          assignedBy: normalizedUserId,
          assignedAt: new Date(),
          isActive: true
        }))

        await tx.userRole.createMany({
          data: roleData
        })
      }

      // Update team memberships
      if (teamMemberships.length > 0) {
        // Remove existing team memberships
        await tx.teamMember.deleteMany({
          where: { userId: params.id }
        })

        // Add new team memberships
        const teamData = teamMemberships.map((tm: any) => ({
          userId: params.id,
          teamId: tm.teamId,
          role: tm.role || 'MEMBER',
          joinedAt: new Date()
        }))

        await tx.teamMember.createMany({
          data: teamData
        })
      }

      return user
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        action: 'user_updated',
        resource: 'user',
        resourceId: params.id,
        oldValues: {
          name: existingUser.name,
          email: existingUser.email,
          timezone: existingUser.timezone,
          locale: existingUser.locale,
          twoFactorEnabled: existingUser.twoFactorEnabled
        },
        newValues: {
          name: updatedUser.name,
          email: updatedUser.email,
          timezone: updatedUser.timezone,
          locale: updatedUser.locale,
          twoFactorEnabled: updatedUser.twoFactorEnabled
        },
        changes: {
          name: name !== existingUser.name,
          email: email !== existingUser.email,
          password: !!password,
          timezone: timezone !== existingUser.timezone,
          locale: locale !== existingUser.locale,
          twoFactorEnabled: twoFactorEnabled !== existingUser.twoFactorEnabled,
          workspaceRoles: workspaceRoles.length > 0,
          additionalRoles: additionalRoles.length > 0,
          teamMemberships: teamMemberships.length > 0
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      updatedAt: updatedUser.updatedAt
    })
  } catch (error) {
    console.error('Failed to update user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id] - Delete or deactivate user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Prevent admin from deleting themselves
    if (params.id === normalizedUserId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true'

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        workspaces: true,
        _count: {
          select: {
            userActivities: true,
            auditLogs: true,
            userSessions: true
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (hardDelete) {
      // Hard delete - remove user completely
      await prisma.$transaction(async (tx) => {
        // Delete related records first
        await tx.userActivity.deleteMany({ where: { userId: params.id } })
        await tx.userSession.deleteMany({ where: { userId: params.id } })
        await tx.userRole.deleteMany({ where: { userId: params.id } })
        await tx.teamMember.deleteMany({ where: { userId: params.id } })
        await tx.userWorkspace.deleteMany({ where: { userId: params.id } })

        // Delete the user
        await tx.user.delete({ where: { id: params.id } })
      })
    } else {
      // Soft delete - deactivate user and remove from workspaces
      await prisma.$transaction(async (tx) => {
        // Deactivate user roles
        await tx.userRole.updateMany({
          where: { userId: params.id },
          data: { isActive: false }
        })

        // Deactivate user sessions
        await tx.userSession.updateMany({
          where: { userId: params.id },
          data: { isActive: false }
        })

        // Remove from workspaces
        await tx.userWorkspace.deleteMany({
          where: { userId: params.id }
        })

        // Remove from teams
        await tx.teamMember.deleteMany({
          where: { userId: params.id }
        })

        // Update user to mark as inactive
        await tx.user.update({
          where: { id: params.id },
          data: {
            emailVerified: null, // Mark as unverified
            twoFactorEnabled: false,
            updatedAt: new Date()
          }
        })
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        action: hardDelete ? 'user_deleted' : 'user_deactivated',
        resource: 'user',
        resourceId: params.id,
        oldValues: {
          name: existingUser.name,
          email: existingUser.email,
          workspaces: existingUser.workspaces.length,
          activities: existingUser._count.userActivities
        },
        metadata: {
          hardDelete,
          deletedBy: normalizedUserId
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      action: hardDelete ? 'deleted' : 'deactivated'
    })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}