import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = await normalizeUserId(session.user.id)
    const { userId } = await params
    const body = await request.json()
    const { permissions, workspaceId } = body

    if (!permissions || !workspaceId) {
      return NextResponse.json({ 
        error: 'Permissions and workspaceId are required' 
      }, { status: 400 })
    }

    // Verify current user has permission to change permissions (OWNER or ADMIN)
    const currentUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: currentUserId,
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!currentUserWorkspace) {
      return NextResponse.json({ 
        error: 'No permission to modify member permissions' 
      }, { status: 403 })
    }

    // Get target user's current membership
    const targetUserWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        workspaceId
      }
    })

    if (!targetUserWorkspace) {
      return NextResponse.json({ 
        error: 'Member not found in workspace' 
      }, { status: 404 })
    }

    // Prevent changing OWNER permissions
    if (targetUserWorkspace.role === 'OWNER') {
      return NextResponse.json({ 
        error: 'Cannot modify owner permissions' 
      }, { status: 400 })
    }

    // Validate permissions structure
    const validPermissions = ['canManageTeam', 'canManageContent', 'canManageSettings', 'canViewAnalytics', 'canManageBilling']
    const permissionKeys = Object.keys(permissions)
    
    const invalidKeys = permissionKeys.filter(key => !validPermissions.includes(key))
    if (invalidKeys.length > 0) {
      return NextResponse.json({ 
        error: `Invalid permission keys: ${invalidKeys.join(', ')}` 
      }, { status: 400 })
    }

    // Ensure all values are boolean
    for (const [key, value] of Object.entries(permissions)) {
      if (typeof value !== 'boolean') {
        return NextResponse.json({ 
          error: `Permission ${key} must be a boolean value` 
        }, { status: 400 })
      }
    }

    // Prevent non-owners from granting billing permissions
    if (permissions.canManageBilling && currentUserWorkspace.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Only workspace owner can grant billing permissions' 
      }, { status: 403 })
    }

    // Update the permissions
    await prisma.userWorkspace.update({
      where: {
        id: targetUserWorkspace.id
      },
      data: {
        permissions: permissions
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Permissions updated successfully'
    })

  } catch (error) {
    console.error('Permissions update error:', error)
    return NextResponse.json({
      error: 'Failed to update permissions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}