// GDPR Art.17 account deletion / right-to-erasure (ADR-0017 Track C, Phase 2 item 9).
//
// DELETE → re-authenticate the caller (password re-entry + explicit
// "DELETE" confirmation), enforce the ADR-0004 ownership guard, then hard
// delete the User row. 1:1 rows (UserSettings, NotificationPreferences,
// memberships, sessions, notifications, …) are removed by onDelete:Cascade.
//
// Workspaces where the caller is the SOLE member are deleted first so their
// content cascades away (and so posts the user authored there don't block the
// user delete via the Post.owner Restrict FK). Deletion is idempotent: a
// second call with no surviving user row returns { deleted: true }.
//
// This is destructive and irreversible — every step is defensive.

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'

import { requireSession } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSession()

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'Invalid request body')
    }
    const { password, confirm } = body as { password?: unknown; confirm?: unknown }

    if (confirm !== 'DELETE') {
      return jsonError(400, 'Confirmation required: set "confirm" to "DELETE"')
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: { id: true, password: true },
    })

    // Idempotent: the user is already gone (e.g. a retried request).
    if (!user) {
      return NextResponse.json({ deleted: true })
    }

    // Re-authenticate. Password users must prove the password; OAuth-only
    // users (no password hash) are gated by the "DELETE" confirmation alone.
    if (user.password) {
      if (typeof password !== 'string' || password.length === 0) {
        return jsonError(400, 'Password is required to delete your account')
      }
      const ok = await bcrypt.compare(password, user.password)
      if (!ok) {
        return jsonError(401, 'Incorrect password')
      }
    }
    // else: OAuth-only account — no password to verify; confirm === 'DELETE'
    // is sufficient re-authentication.

    // Ownership guard (ADR-0004): block if the user is the sole OWNER of any
    // workspace that still has OTHER members — ownership must be transferred
    // first. A workspace where they are the only member is fine (deleted below).
    const memberships = await prisma.userWorkspace.findMany({
      where: { userId: user.id },
      select: {
        workspaceId: true,
        role: true,
        workspace: { select: { name: true } },
      },
    })

    const soleOwnerBlockers: { id: string; name: string | null }[] = []
    const soloWorkspaceIds: string[] = []

    for (const m of memberships) {
      const [totalMembers, ownerCount] = await Promise.all([
        prisma.userWorkspace.count({ where: { workspaceId: m.workspaceId } }),
        prisma.userWorkspace.count({
          where: { workspaceId: m.workspaceId, role: 'OWNER' },
        }),
      ])

      if (totalMembers <= 1) {
        soloWorkspaceIds.push(m.workspaceId)
        continue
      }
      // Has other members. Block only if this user is the ONLY owner.
      if (m.role === 'OWNER' && ownerCount <= 1) {
        soleOwnerBlockers.push({ id: m.workspaceId, name: m.workspace?.name ?? null })
      }
    }

    if (soleOwnerBlockers.length > 0) {
      return jsonError(
        409,
        'You are the sole owner of workspace(s) with other members. Transfer ownership before deleting your account.',
        { code: 'SOLE_OWNER', details: { workspaces: soleOwnerBlockers } }
      )
    }

    // TODO(ADR-0019): cancel Stripe customer/subscription before deletion.
    // No billing service exists yet, so there is nothing to cancel — this hook
    // is where ADR-0019 wires in; we do NOT fabricate a Stripe call here.

    // Delete solo workspaces first so their content cascades and does not
    // block the user delete (Post.owner is a Restrict FK).
    for (const workspaceId of soloWorkspaceIds) {
      await prisma.workspace.delete({ where: { id: workspaceId } })
    }

    // Delete the user; 1:1 + cascade-configured rows go with it.
    await prisma.user.delete({ where: { id: user.id } })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    // A foreign-key Restrict violation means the account still has associated
    // records that are not cascade-deletable (e.g. posts authored in a shared
    // workspace, or platform-admin-owned configuration). Surface that honestly
    // instead of a generic 500 — never claim a delete that did not happen.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      console.error('Account deletion blocked by FK constraint:', error.meta)
      return jsonError(
        409,
        'Your account still has associated records that must be removed or reassigned before it can be deleted. Please contact support.',
        { code: 'HAS_ASSOCIATED_RECORDS' }
      )
    }
    return handleApiError(error)
  }
}
