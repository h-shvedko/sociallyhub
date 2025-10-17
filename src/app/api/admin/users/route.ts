import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'
import bcrypt from 'bcryptjs'

// GET /api/admin/users - Get all users with role information
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
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (workspaceId) {
      where.workspaces = {
        some: {
          workspaceId: workspaceId,
          ...(role && { role: role.toUpperCase() })
        }
      }
    }

    const users = await prisma.user.findMany({
      where,
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
                name: true
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
                color: true
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
            lastActiveAt: true,
            ipAddress: true
          },
          orderBy: {
            lastActiveAt: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            userActivities: true,
            auditLogs: true,
            userSessions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    const totalCount = await prisma.user.count({ where })

    // Get user statistics
    const stats = {
      total: totalCount,
      active: users.filter(u => u.userSessions.length > 0).length,
      verified: users.filter(u => u.emailVerified).length,
      twoFactorEnabled: users.filter(u => u.twoFactorEnabled).length
    }

    return NextResponse.json({
      users,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      stats
    })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// POST /api/admin/users - Create new user
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
      email,
      name,
      password,
      workspaceId,
      role = 'ANALYST',
      roleIds = [],
      sendInvitation = true,
      timezone = 'UTC',
      locale = 'en'
    } = body

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password if provided
    let hashedPassword = null
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12)
    }

    // Create user within a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          timezone,
          locale,
          emailVerified: sendInvitation ? null : new Date() // Auto-verify if not sending invitation
        }
      })

      // Add to workspace if specified
      if (workspaceId) {
        await tx.userWorkspace.create({
          data: {
            userId: user.id,
            workspaceId,
            role: role.toUpperCase() as any,
            joinedAt: new Date()
          }
        })
      }

      // Assign additional roles if specified
      if (roleIds.length > 0) {
        const roleAssignments = roleIds.map((roleId: string) => ({
          userId: user.id,
          roleId,
          assignedBy: normalizedUserId,
          assignedAt: new Date()
        }))

        await tx.userRole.createMany({
          data: roleAssignments
        })
      }

      return user
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        workspaceId: workspaceId || undefined,
        action: 'user_created',
        resource: 'user',
        resourceId: result.id,
        newValues: {
          email: result.email,
          name: result.name,
          workspaceRole: role,
          additionalRoles: roleIds
        },
        timestamp: new Date()
      }
    })

    // Send invitation email if requested
    if (sendInvitation) {
      // In a real implementation, send invitation email here
      console.log(`Invitation email sent to ${email}`)
    }

    return NextResponse.json({
      id: result.id,
      email: result.email,
      name: result.name,
      createdAt: result.createdAt
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}