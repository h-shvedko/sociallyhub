import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/notifications/email-service'
import { notifyUser } from '@/lib/notifications/notify'
import type { WorkspaceRole } from '@prisma/client'
import crypto from 'crypto'

// ADR-0012 (Phase 3 item 10): the admin bulk-operations endpoint is reduced to
// the v1 operation set that the WorkspaceRole primitive actually supports:
//
//   - activate_users / deactivate_users  (existing-user account state)
//   - add_to_workspace / remove_from_workspace  (WorkspaceRole membership)
//   - send_invitation   (email-driven TeamInvitation + real email — ADR-0010)
//   - reset_passwords   (emailed VerificationToken reset link — NEVER a temp
//                        password in the response body, ADR-0006)
//   - resolve_emails    (CSV helper: map pasted emails -> real user ids;
//                        unknowns are surfaced for invitation)
//
// CUT (Role/UserRole/Team models were removed by ADR-0004; profile bulk-edit is
// out of the v1 operator-console scope): assign_role, remove_role,
// add_to_team, remove_from_team, update_profile. Every audit row uses the real
// AuditLog fields (extra context folds into `changes`, never `metadata`).

const WORKSPACE_ROLES: WorkspaceRole[] = [
  'OWNER',
  'ADMIN',
  'PUBLISHER',
  'ANALYST',
  'CLIENT_VIEWER',
]

interface OperationResults {
  success: number
  failed: number
  errors: string[]
  processedUsers: Array<{
    userId?: string
    email?: string
    status: 'success' | 'skipped' | 'failed'
    error?: string
  }>
}

function newResults(): OperationResults {
  return { success: 0, failed: 0, errors: [], processedUsers: [] }
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeRole(role: unknown, fallback: WorkspaceRole = 'ANALYST'): WorkspaceRole | null {
  if (!role) return fallback
  const upper = String(role).toUpperCase() as WorkspaceRole
  return WORKSPACE_ROLES.includes(upper) ? upper : null
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3099'
}

// POST /api/admin/bulk-operations - Perform bulk operations on users
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await request.json()
    const { operation, userIds = [], data = {} } = body

    if (!operation || typeof operation !== 'string') {
      return jsonError(400, 'Operation type is required')
    }

    switch (operation) {
      case 'resolve_emails':
        return await resolveEmails(data)

      case 'send_invitation':
        return await handleBulkInvitation(data, admin.id)

      case 'activate_users':
      case 'deactivate_users':
      case 'add_to_workspace':
      case 'remove_from_workspace':
      case 'reset_passwords':
        break

      default:
        return jsonError(400, `Unsupported operation: ${operation}`)
    }

    // Operations below act on a set of existing user ids.
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return jsonError(400, 'User IDs are required for this operation')
    }

    switch (operation) {
      case 'activate_users':
        return await handleBulkUserActivation(userIds, admin.id)
      case 'deactivate_users':
        return await handleBulkUserDeactivation(userIds, admin.id)
      case 'add_to_workspace':
        return await handleBulkWorkspaceAdd(userIds, data, admin.id)
      case 'remove_from_workspace':
        return await handleBulkWorkspaceRemoval(userIds, data, admin.id)
      case 'reset_passwords':
        return await handleBulkPasswordReset(userIds, admin.id)
      default:
        return jsonError(400, `Unsupported operation: ${operation}`)
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// Resolve a list of pasted emails into real user ids. Known emails map to a
// user; unknown emails are returned so the UI can offer to invite them.
async function resolveEmails(data: Record<string, unknown>) {
  const rawEmails: unknown[] = Array.isArray(data?.emails) ? data.emails : []
  const emails = Array.from(
    new Set(
      rawEmails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  )

  if (emails.length === 0) {
    return NextResponse.json({ known: [], unknown: [] })
  }

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, name: true },
  })

  const knownByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))
  const known = users.map((u) => ({ id: u.id, email: u.email, name: u.name }))
  const unknown = emails.filter((e) => !knownByEmail.has(e))

  return NextResponse.json({ known, unknown })
}

// Bulk workspace addition (WorkspaceRole membership)
async function handleBulkWorkspaceAdd(
  userIds: string[],
  data: Record<string, unknown>,
  adminUserId: string
) {
  const workspaceId = data.workspaceId as string | undefined
  const role = normalizeRole(data.role)

  if (!workspaceId) {
    return jsonError(400, 'Workspace ID is required')
  }
  if (!role) {
    return jsonError(400, 'Invalid workspace role')
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  })

  if (!workspace) {
    return jsonError(404, 'Workspace not found')
  }

  const results = newResults()

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        const existing = await tx.userWorkspace.findFirst({
          where: { userId, workspaceId },
        })

        if (existing) {
          throw new Error('User already in workspace')
        }

        // ADR-0004: WorkspaceRole is the sole membership authz field; the
        // legacy `joinedAt`/`permissions` columns were dropped.
        await tx.userWorkspace.create({
          data: { userId, workspaceId, role },
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            workspaceId,
            action: 'bulk_workspace_added',
            resource: 'user',
            resourceId: userId,
            newValues: { workspaceId, role },
            timestamp: new Date(),
          },
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error) {
      const message = errMsg(error)
      results.failed++
      results.errors.push(`User ${userId}: ${message}`)
      results.processedUsers.push({ userId, status: 'failed', error: message })
    }
  }

  return NextResponse.json(results)
}

// Bulk workspace removal
async function handleBulkWorkspaceRemoval(
  userIds: string[],
  data: Record<string, unknown>,
  adminUserId: string
) {
  const workspaceId = data.workspaceId as string | undefined

  if (!workspaceId) {
    return jsonError(400, 'Workspace ID is required')
  }

  const results = newResults()

  for (const userId of userIds) {
    try {
      if (userId === adminUserId) {
        throw new Error('Cannot remove yourself from a workspace')
      }

      await prisma.$transaction(async (tx) => {
        const deleted = await tx.userWorkspace.deleteMany({
          where: { userId, workspaceId },
        })

        if (deleted.count === 0) {
          throw new Error('User not found in workspace')
        }

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            workspaceId,
            action: 'bulk_workspace_removed',
            resource: 'user',
            resourceId: userId,
            oldValues: { workspaceId },
            timestamp: new Date(),
          },
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error) {
      const message = errMsg(error)
      results.failed++
      results.errors.push(`User ${userId}: ${message}`)
      results.processedUsers.push({ userId, status: 'failed', error: message })
    }
  }

  return NextResponse.json(results)
}

// Bulk invitation — creates TeamInvitation rows and sends real email (ADR-0010).
// Accepts arbitrary emails (existing users AND brand-new addresses); the
// existing accept endpoint at /api/team/invitations/[token] provisions the user
// on acceptance.
async function handleBulkInvitation(data: Record<string, unknown>, adminUserId: string) {
  const workspaceId = data.workspaceId as string | undefined
  const role = normalizeRole(data.role)
  const rawEmails: unknown[] = Array.isArray(data?.emails) ? data.emails : []
  const emails = Array.from(
    new Set(
      rawEmails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  )

  if (!workspaceId) {
    return jsonError(400, 'Workspace ID is required for invitations')
  }
  if (!role) {
    return jsonError(400, 'Invalid workspace role')
  }
  if (emails.length === 0) {
    return jsonError(400, 'At least one email is required for invitations')
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true },
  })

  if (!workspace) {
    return jsonError(404, 'Workspace not found')
  }

  const inviter = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { name: true, email: true },
  })
  const inviterName = inviter?.name || inviter?.email || 'A team admin'

  const results = newResults()

  for (const email of emails) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (existingUser) {
        const existingMembership = await prisma.userWorkspace.findFirst({
          where: { userId: existingUser.id, workspaceId },
        })
        if (existingMembership) {
          results.processedUsers.push({
            email,
            status: 'skipped',
            error: 'Already a member of this workspace',
          })
          continue
        }
      }

      const existingInvitation = await prisma.teamInvitation.findFirst({
        where: {
          email,
          workspaceId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      })
      if (existingInvitation) {
        results.processedUsers.push({
          email,
          status: 'skipped',
          error: 'A pending invitation already exists',
        })
        continue
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const invitation = await prisma.teamInvitation.create({
        data: {
          email,
          role,
          workspaceId,
          invitedById: adminUserId,
          expiresAt,
        },
      })

      const invitationUrl = `${baseUrl()}/team/invite/${invitation.token}`

      // Real email (ADR-0010). Email delivery failure must not strand the
      // invitation row — surface it as a failure but keep the record.
      await emailService.sendTeamInvitationEmail(
        email,
        inviterName,
        workspace.name,
        invitationUrl
      )

      // If the invitee already has an account, also drop an in-app notification
      // so they can accept from within the app (best-effort).
      if (existingUser) {
        try {
          await notifyUser(existingUser.id, {
            type: 'TEAM_INVITATION',
            title: `Invitation to join ${workspace.name}`,
            message: `${inviterName} invited you to join ${workspace.name} as ${role}.`,
            data: {
              workspaceId,
              role,
              invitationToken: invitation.token,
              actionUrl: `/team/invite/${invitation.token}`,
            },
          })
        } catch (notifyError) {
          console.error('Failed to send invitation notification:', notifyError)
        }
      }

      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          workspaceId,
          action: 'bulk_invitation_sent',
          resource: 'user',
          resourceId: existingUser?.id,
          newValues: { email, role, workspaceId },
          changes: { invitationId: invitation.id, existingUser: Boolean(existingUser) },
          timestamp: new Date(),
        },
      })

      results.success++
      results.processedUsers.push({ email, userId: existingUser?.id, status: 'success' })
    } catch (error) {
      const message = errMsg(error)
      results.failed++
      results.errors.push(`${email}: ${message}`)
      results.processedUsers.push({ email, status: 'failed', error: message })
    }
  }

  return NextResponse.json(results)
}

// Bulk user deactivation — clears email verification (blocks sign-in in
// production per src/lib/auth/config.ts) and disables 2FA. Auth is JWT-based;
// there is no server-side session table to revoke.
async function handleBulkUserDeactivation(userIds: string[], adminUserId: string) {
  const results = newResults()

  for (const userId of userIds) {
    try {
      if (userId === adminUserId) {
        throw new Error('Cannot deactivate your own account')
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        await tx.user.update({
          where: { id: userId },
          data: { emailVerified: null, twoFactorEnabled: false },
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_user_deactivated',
            resource: 'user',
            resourceId: userId,
            timestamp: new Date(),
          },
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error) {
      const message = errMsg(error)
      results.failed++
      results.errors.push(`User ${userId}: ${message}`)
      results.processedUsers.push({ userId, status: 'failed', error: message })
    }
  }

  return NextResponse.json(results)
}

// Bulk user activation — marks email verified (restores sign-in).
async function handleBulkUserActivation(userIds: string[], adminUserId: string) {
  const results = newResults()

  for (const userId of userIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })
        if (!user) {
          throw new Error(`User ${userId} not found`)
        }

        await tx.user.update({
          where: { id: userId },
          data: { emailVerified: new Date() },
        })

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'bulk_user_activated',
            resource: 'user',
            resourceId: userId,
            timestamp: new Date(),
          },
        })
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error) {
      const message = errMsg(error)
      results.failed++
      results.errors.push(`User ${userId}: ${message}`)
      results.processedUsers.push({ userId, status: 'failed', error: message })
    }
  }

  return NextResponse.json(results)
}

// Bulk password reset — issues a VerificationToken reset link and emails it.
// ADR-0006: NO temporary passwords, and NO secrets in the response body. The
// user's existing password is left untouched until they complete the reset.
async function handleBulkPasswordReset(userIds: string[], adminUserId: string) {
  const results = newResults()

  for (const userId of userIds) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      })

      if (!user) {
        throw new Error(`User ${userId} not found`)
      }
      if (!user.email) {
        throw new Error('User has no email address on file')
      }

      const resetToken = crypto.randomUUID()
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Invalidate any outstanding tokens for this identifier, then issue a new
      // one (mirrors the verify-email flow).
      await prisma.verificationToken.deleteMany({ where: { identifier: user.email } })
      await prisma.verificationToken.create({
        data: { identifier: user.email, token: resetToken, expires },
      })

      await emailService.sendPasswordResetEmail(user.email, resetToken)

      await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'bulk_password_reset_requested',
          resource: 'user',
          resourceId: userId,
          timestamp: new Date(),
        },
      })

      results.success++
      results.processedUsers.push({ userId, status: 'success' })
    } catch (error) {
      const message = errMsg(error)
      results.failed++
      results.errors.push(`User ${userId}: ${message}`)
      results.processedUsers.push({ userId, status: 'failed', error: message })
    }
  }

  return NextResponse.json(results)
}
