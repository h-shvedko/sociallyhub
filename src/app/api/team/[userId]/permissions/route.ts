import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, normalizeUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Per-member permission storage was removed (ADR-0004): role is the sole authz
// field. These static permission sets are derived from roles and are used only
// to map a requested permissions payload back onto a WorkspaceRole.
const ASSIGNABLE_ROLE_PERMISSION_SETS = {
  ADMIN: {
    canManageTeam: true,
    canManageContent: true,
    canManageSettings: true,
    canViewAnalytics: true,
    canManageBilling: false
  },
  PUBLISHER: {
    canManageTeam: false,
    canManageContent: true,
    canManageSettings: false,
    canViewAnalytics: false,
    canManageBilling: false
  },
  ANALYST: {
    canManageTeam: false,
    canManageContent: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManageBilling: false
  },
  CLIENT_VIEWER: {
    canManageTeam: false,
    canManageContent: false,
    canManageSettings: false,
    canViewAnalytics: true,
    canManageBilling: false
  }
} as const

type AssignableRole = keyof typeof ASSIGNABLE_ROLE_PERMISSION_SETS

// Returns the role whose derived permission set exactly matches the payload,
// or null if the payload doesn't correspond to any single assignable role.
function mapPermissionsToRole(requested: Record<string, boolean>): AssignableRole | null {
  const matches = (Object.keys(ASSIGNABLE_ROLE_PERMISSION_SETS) as AssignableRole[]).filter(role => {
    const set: Record<string, boolean> = ASSIGNABLE_ROLE_PERMISSION_SETS[role]
    const keys = Object.keys(set)
    return keys.length === Object.keys(requested).length &&
      keys.every(key => requested[key] === set[key])
  })
  return matches.length === 1 ? matches[0] : null
}

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

    // Granular per-member permissions are no longer stored (ADR-0004): role is
    // the only authorization field. Apply the request only if it maps cleanly
    // onto a single workspace role; otherwise refuse instead of faking success.
    const mappedRole = mapPermissionsToRole(permissions)

    if (!mappedRole) {
      return NextResponse.json({
        error: 'Custom per-member permissions are not supported',
        message: 'Granular permission storage was removed (ADR-0004). Only permission sets that exactly match a workspace role (ADMIN, PUBLISHER, ANALYST, CLIENT_VIEWER) can be applied; change the member\'s role instead.'
      }, { status: 501 })
    }

    if (mappedRole !== targetUserWorkspace.role) {
      await prisma.userWorkspace.update({
        where: {
          id: targetUserWorkspace.id
        },
        data: {
          role: mappedRole
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: mappedRole !== targetUserWorkspace.role
        ? `Member role updated to ${mappedRole} to match the requested permissions`
        : 'Requested permissions already match the member\'s current role'
    })

  } catch (error) {
    console.error('Permissions update error:', error)
    return NextResponse.json({
      error: 'Failed to update permissions'
    }, { status: 500 })
  }
}