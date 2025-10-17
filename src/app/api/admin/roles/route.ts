import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/roles - Get all roles
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
    const includeStats = searchParams.get('includeStats') === 'true'

    const roles = await prisma.role.findMany({
      include: {
        _count: includeStats ? {
          select: {
            userRoles: true,
            userWorkspaces: true
          }
        } : undefined,
        userRoles: includeStats ? {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          take: 5 // Latest 5 users with this role
        } : undefined
      },
      orderBy: [
        { priority: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      roles,
      stats: includeStats ? {
        total: roles.length,
        system: roles.filter(r => r.isSystem).length,
        active: roles.filter(r => r.isActive).length
      } : undefined
    })
  } catch (error) {
    console.error('Failed to fetch roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

// POST /api/admin/roles - Create new role
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
      name,
      displayName,
      description,
      permissions = [],
      color,
      priority = 0
    } = body

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      )
    }

    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name }
    })

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role with this name already exists' },
        { status: 409 }
      )
    }

    // Validate permissions
    const validPermissions = await validatePermissions(permissions)
    if (!validPermissions.valid) {
      return NextResponse.json(
        { error: `Invalid permissions: ${validPermissions.invalid.join(', ')}` },
        { status: 400 }
      )
    }

    const role = await prisma.role.create({
      data: {
        name,
        displayName,
        description,
        permissions,
        color,
        priority,
        isSystem: false,
        isActive: true
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        action: 'role_created',
        resource: 'role',
        resourceId: role.id,
        newValues: {
          name: role.name,
          displayName: role.displayName,
          permissions: role.permissions
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json(role, { status: 201 })
  } catch (error) {
    console.error('Failed to create role:', error)
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    )
  }
}

// Validate permissions against defined permission system
async function validatePermissions(permissions: string[]): Promise<{ valid: boolean; invalid: string[] }> {
  // Get all valid permissions from database
  const validPermissions = await prisma.permission.findMany({
    select: { name: true }
  })

  const validPermissionNames = validPermissions.map(p => p.name)
  const invalid = permissions.filter(p => !validPermissionNames.includes(p))

  return {
    valid: invalid.length === 0,
    invalid
  }
}