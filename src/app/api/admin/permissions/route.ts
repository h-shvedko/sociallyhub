import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/admin/permissions - Get all permissions and permission matrix
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
    const includeMatrix = searchParams.get('includeMatrix') === 'true'

    // Get all permissions
    const permissions = await prisma.permission.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Group permissions by category
    const permissionsByCategory = permissions.reduce((acc: any, permission) => {
      const category = permission.category || 'General'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(permission)
      return acc
    }, {})

    let permissionMatrix = undefined

    if (includeMatrix) {
      // Get all roles with their permissions
      const roles = await prisma.role.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          permissions: true,
          isSystem: true,
          isActive: true,
          color: true,
          priority: true
        },
        orderBy: [
          { priority: 'desc' },
          { name: 'asc' }
        ]
      })

      // Build permission matrix
      permissionMatrix = {
        roles,
        permissions: permissions.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName,
          category: p.category,
          description: p.description
        })),
        matrix: roles.map(role => ({
          roleId: role.id,
          roleName: role.name,
          roleDisplayName: role.displayName,
          isSystem: role.isSystem,
          permissions: permissions.map(permission => ({
            permissionId: permission.id,
            permissionName: permission.name,
            hasPermission: role.permissions.includes(permission.name)
          }))
        }))
      }
    }

    return NextResponse.json({
      permissions,
      permissionsByCategory,
      ...(includeMatrix && { permissionMatrix }),
      stats: {
        totalPermissions: permissions.length,
        categories: Object.keys(permissionsByCategory).length,
        activePermissions: permissions.filter(p => p.isActive).length
      }
    })
  } catch (error) {
    console.error('Failed to fetch permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    )
  }
}

// POST /api/admin/permissions - Create new permission
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
      category = 'General',
      isActive = true
    } = body

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and display name are required' },
        { status: 400 }
      )
    }

    // Check if permission name already exists
    const existingPermission = await prisma.permission.findUnique({
      where: { name }
    })

    if (existingPermission) {
      return NextResponse.json(
        { error: 'Permission with this name already exists' },
        { status: 409 }
      )
    }

    const permission = await prisma.permission.create({
      data: {
        name,
        displayName,
        description,
        category,
        isActive,
        isSystem: false
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: normalizedUserId,
        action: 'permission_created',
        resource: 'permission',
        resourceId: permission.id,
        newValues: {
          name: permission.name,
          displayName: permission.displayName,
          category: permission.category
        },
        timestamp: new Date()
      }
    })

    return NextResponse.json(permission, { status: 201 })
  } catch (error) {
    console.error('Failed to create permission:', error)
    return NextResponse.json(
      { error: 'Failed to create permission' },
      { status: 500 }
    )
  }
}