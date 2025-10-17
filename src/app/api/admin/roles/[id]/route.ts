import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/roles/[id] - Get specific role
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

    const role = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        userWorkspaces: {
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
          }
        },
        _count: {
          select: {
            userRoles: true,
            userWorkspaces: true,
            auditLogs: true
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(role)
  } catch (error) {
    console.error('Failed to fetch role:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/roles/[id] - Update role
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
      displayName,
      description,
      permissions,
      color,
      priority,
      isActive
    } = body

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id }
    })

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    // Prevent modification of system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: 'System roles cannot be modified' },
        { status: 400 }
      )
    }

    // Check if name is being changed and already exists
    if (name && name !== existingRole.name) {
      const nameExists = await prisma.role.findUnique({
        where: { name }
      })

      if (nameExists) {
        return NextResponse.json(
          { error: 'Role with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Validate permissions if provided
    if (permissions) {
      const validPermissions = await validatePermissions(permissions)
      if (!validPermissions.valid) {
        return NextResponse.json(
          { error: `Invalid permissions: ${validPermissions.invalid.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(description !== undefined && { description }),
        ...(permissions && { permissions }),
        ...(color !== undefined && { color }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive })
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        roleId: params.id,
        action: 'role_updated',
        resource: 'role',
        resourceId: params.id,
        oldValues: {
          name: existingRole.name,
          displayName: existingRole.displayName,
          permissions: existingRole.permissions,
          isActive: existingRole.isActive
        },
        newValues: {
          name: updatedRole.name,
          displayName: updatedRole.displayName,
          permissions: updatedRole.permissions,
          isActive: updatedRole.isActive
        },
        changes: {
          name: name !== existingRole.name,
          displayName: displayName !== existingRole.displayName,
          permissions: JSON.stringify(permissions) !== JSON.stringify(existingRole.permissions),
          isActive: isActive !== existingRole.isActive
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json(updatedRole)
  } catch (error) {
    console.error('Failed to update role:', error)
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/roles/[id] - Delete role
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

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            userRoles: true,
            userWorkspaces: true
          }
        }
      }
    })

    if (!existingRole) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of system roles
    if (existingRole.isSystem) {
      return NextResponse.json(
        { error: 'System roles cannot be deleted' },
        { status: 400 }
      )
    }

    // Check if role is in use
    if (existingRole._count.userRoles > 0 || existingRole._count.userWorkspaces > 0) {
      return NextResponse.json(
        { error: 'Role is currently assigned to users and cannot be deleted' },
        { status: 400 }
      )
    }

    // Delete the role
    await prisma.role.delete({
      where: { id: params.id }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        action: 'role_deleted',
        resource: 'role',
        resourceId: params.id,
        oldValues: {
          name: existingRole.name,
          displayName: existingRole.displayName,
          permissions: existingRole.permissions
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete role:', error)
    return NextResponse.json(
      { error: 'Failed to delete role' },
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