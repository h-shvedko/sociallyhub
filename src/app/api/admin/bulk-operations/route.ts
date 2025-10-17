import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'
import bcrypt from 'bcryptjs'

// POST /api/admin/bulk-operations - Perform bulk operations on users
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
    const { operation, userIds, data = {} } = body

    if (!operation || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Operation type and user IDs are required' },
        { status: 400 }
      )
    }

    let results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      processedUsers: [] as any[]
    }

    switch (operation) {
      case 'assign_role':
        return await handleBulkRoleAssignment(userIds, data, normalizedUserId, results)

      case 'remove_role':
        return await handleBulkRoleRemoval(userIds, data, normalizedUserId, results)

      case 'add_to_workspace':
        return await handleBulkWorkspaceAdd(userIds, data, normalizedUserId, results)

      case 'remove_from_workspace':
        return await handleBulkWorkspaceRemoval(userIds, data, normalizedUserId, results)

      case 'add_to_team':
        return await handleBulkTeamAdd(userIds, data, normalizedUserId, results)

      case 'remove_from_team':
        return await handleBulkTeamRemoval(userIds, data, normalizedUserId, results)

      case 'update_profile':
        return await handleBulkProfileUpdate(userIds, data, normalizedUserId, results)

      case 'send_invitation':
        return await handleBulkInvitation(userIds, data, normalizedUserId, results)

      case 'deactivate_users':
        return await handleBulkUserDeactivation(userIds, normalizedUserId, results)

      case 'activate_users':
        return await handleBulkUserActivation(userIds, normalizedUserId, results)

      case 'reset_passwords':
        return await handleBulkPasswordReset(userIds, normalizedUserId, results)

      default:
        return NextResponse.json(
          { error: 'Invalid operation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Failed to perform bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
}

// Bulk role assignment
async function handleBulkRoleAssignment(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { roleIds } = data

  if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
    return NextResponse.json(
      { error: 'Role IDs are required for role assignment' },
      { status: 400 }
    )
  }

  // Verify roles exist
  const validRoles = await prisma.role.findMany({
    where: { id: { in: roleIds } }
  })

  if (validRoles.length !== roleIds.length) {
    return NextResponse.json(
      { error: 'One or more roles not found' },
      { status: 404 }
    )
  }

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        // Check if user exists
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        // Deactivate existing roles
        await tx.userRole.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false, updatedAt: new Date() }
        })

        // Add new roles
        const roleData = roleIds.map((roleId: string) => ({
          userId,
          roleId,
          assignedBy: adminUserId,
          assignedAt: new Date(),
          isActive: true
        }))

        await tx.userRole.createMany({ data: roleData })

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_role_assigned',
            resource: 'user',
            resourceId: userId,
            newValues: { roleIds },
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk role removal
async function handleBulkRoleRemoval(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { roleIds } = data

  if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
    return NextResponse.json(
      { error: 'Role IDs are required for role removal' },
      { status: 400 }
    )
  }

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        // Deactivate specified roles
        const updated = await tx.userRole.updateMany({
          where: {
            userId,
            roleId: { in: roleIds },
            isActive: true
          },
          data: { isActive: false, updatedAt: new Date() }
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_role_removed',
            resource: 'user',
            resourceId: userId,
            oldValues: { roleIds },
            metadata: { removedCount: updated.count },
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk workspace addition
async function handleBulkWorkspaceAdd(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { workspaceId, role = 'ANALYST' } = data

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Workspace ID is required' },
      { status: 400 }
    )
  }

  // Verify workspace exists
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId }
  })

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404 }
    )
  }

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        // Check if user is already in workspace
        const existing = await tx.userWorkspace.findFirst({
          where: { userId, workspaceId }
        })

        if (existing) {
          throw new Error(`User already in workspace`)
        }

        await tx.userWorkspace.create({
          data: {
            userId,
            workspaceId,
            role: role.toUpperCase(),
            joinedAt: new Date()
          }
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            workspaceId,
            action: 'bulk_workspace_added',
            resource: 'user',
            resourceId: userId,
            newValues: { workspaceId, role },
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk workspace removal
async function handleBulkWorkspaceRemoval(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { workspaceId } = data

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Workspace ID is required' },
      { status: 400 }
    )
  }

  for (const userId of userIds) {
    try {
      // Prevent admin from removing themselves
      if (userId === adminUserId) {
        throw new Error('Cannot remove yourself from workspace')
      }

      await prisma.$transaction(async (tx) => {
        const deleted = await tx.userWorkspace.deleteMany({
          where: { userId, workspaceId }
        })

        if (deleted.count === 0) {
          throw new Error('User not found in workspace')
        }

        // Also remove from teams in this workspace
        await tx.teamMember.deleteMany({
          where: {
            userId,
            team: { workspaceId }
          }
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            workspaceId,
            action: 'bulk_workspace_removed',
            resource: 'user',
            resourceId: userId,
            oldValues: { workspaceId },
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk team addition
async function handleBulkTeamAdd(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { teamId, role = 'MEMBER' } = data

  if (!teamId) {
    return NextResponse.json(
      { error: 'Team ID is required' },
      { status: 400 }
    )
  }

  // Verify team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId }
  })

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    )
  }

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        // Check if user is in the workspace
        const userInWorkspace = await tx.userWorkspace.findFirst({
          where: { userId, workspaceId: team.workspaceId }
        })

        if (!userInWorkspace) {
          throw new Error('User must be in workspace to join team')
        }

        // Check if already in team
        const existing = await tx.teamMember.findFirst({
          where: { userId, teamId }
        })

        if (existing) {
          throw new Error('User already in team')
        }

        await tx.teamMember.create({
          data: {
            userId,
            teamId,
            role: role.toUpperCase(),
            joinedAt: new Date()
          }
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            workspaceId: team.workspaceId,
            action: 'bulk_team_added',
            resource: 'user',
            resourceId: userId,
            newValues: { teamId, role },
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk team removal
async function handleBulkTeamRemoval(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { teamId } = data

  if (!teamId) {
    return NextResponse.json(
      { error: 'Team ID is required' },
      { status: 400 }
    )
  }

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const deleted = await tx.teamMember.deleteMany({
          where: { userId, teamId }
        })

        if (deleted.count === 0) {
          throw new Error('User not found in team')
        }

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_team_removed',
            resource: 'user',
            resourceId: userId,
            oldValues: { teamId },
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk profile update
async function handleBulkProfileUpdate(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { timezone, locale, twoFactorEnabled } = data

  if (!timezone && !locale && twoFactorEnabled === undefined) {
    return NextResponse.json(
      { error: 'At least one field to update is required' },
      { status: 400 }
    )
  }

  for (const userId of userIds) {
    try {
      const updateData: any = {}
      if (timezone) updateData.timezone = timezone
      if (locale) updateData.locale = locale
      if (twoFactorEnabled !== undefined) updateData.twoFactorEnabled = twoFactorEnabled

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData
      })

      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'bulk_profile_updated',
          resource: 'user',
          resourceId: userId,
          newValues: updateData,
          timestamp: new Date()
        }
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk invitation sending
async function handleBulkInvitation(
  userIds: string[],
  data: any,
  adminUserId: string,
  results: any
) {
  const { workspaceId, role = 'ANALYST', message = '' } = data

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Workspace ID is required for invitations' },
      { status: 400 }
    )
  }

  for (const userId of userIds) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Create invitation record
      await prisma.userInvitation.create({
        data: {
          email: user.email,
          workspaceId,
          role: role.toUpperCase(),
          invitedBy: adminUserId,
          message,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })

      // In a real implementation, send invitation email here
      console.log(`Invitation sent to ${user.email}`)

      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          workspaceId,
          action: 'bulk_invitation_sent',
          resource: 'user',
          resourceId: userId,
          newValues: { email: user.email, role, workspaceId },
          timestamp: new Date()
        }
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk user deactivation
async function handleBulkUserDeactivation(
  userIds: string[],
  adminUserId: string,
  results: any
) {
  for (const userId of userIds) {
    try {
      // Prevent admin from deactivating themselves
      if (userId === adminUserId) {
        throw new Error('Cannot deactivate your own account')
      }

      await prisma.$transaction(async (tx) => {
        // Deactivate user sessions
        await tx.userSession.updateMany({
          where: { userId },
          data: { isActive: false }
        })

        // Deactivate user roles
        await tx.userRole.updateMany({
          where: { userId },
          data: { isActive: false }
        })

        // Mark email as unverified
        await tx.user.update({
          where: { id: userId },
          data: {
            emailVerified: null,
            twoFactorEnabled: false
          }
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_user_deactivated',
            resource: 'user',
            resourceId: userId,
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk user activation
async function handleBulkUserActivation(
  userIds: string[],
  adminUserId: string,
  results: any
) {
  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        // Verify email
        await tx.user.update({
          where: { id: userId },
          data: { emailVerified: new Date() }
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_user_activated',
            resource: 'user',
            resourceId: userId,
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}

// Bulk password reset
async function handleBulkPasswordReset(
  userIds: string[],
  adminUserId: string,
  results: any
) {
  for (const userId of userIds) {
    try {
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8)
      const hashedPassword = await bcrypt.hash(tempPassword, 12)

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { password: hashedPassword }
        })

        // In a real implementation, send password reset email here
        console.log(`Password reset for user ${userId}: ${tempPassword}`)

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_password_reset',
            resource: 'user',
            resourceId: userId,
            timestamp: new Date()
          }
        })
      })

      results.success++
      results.processedUsers.push({
        userId,
        status: 'success',
        tempPassword
      })
    } catch (error: any) {
      results.failed++
      results.errors.push(`User ${userId}: ${error.message}`)
      results.processedUsers.push({ userId, status: 'failed', error: error.message })
    }
  }

  return NextResponse.json(results)
}