// Canonical session helpers (ADR-0003) + platform authorization (ADR-0004).
//
// These are the ONLY sanctioned way for application code to read the
// authenticated user. Routes must never call getServerSession() directly
// (see docs/api-conventions.md) — the helpers resolve the session AND the
// legacy demo-id normalization exactly once per request.
//
// Authorization doctrine (ADR-0004): **claim for UI, DB for API.**
// The NextAuth session/JWT carries an `isPlatformAdmin` claim so layouts and
// client components can gate navigation without an extra query — but JWT
// claims are not revocation-safe (a revoked admin keeps the stale claim until
// the token expires). Every API handler therefore re-verifies authorization
// against the database via `requirePlatformAdmin()` /
// `requireWorkspaceRole()`; the session claim is NEVER trusted for
// enforcement. Two tiers, nothing else:
//   - Platform tier: `User.isPlatformAdmin` (cross-tenant admin surfaces).
//   - Workspace tier: `UserWorkspace.role` (the five WorkspaceRole values).
// Platform admins do NOT implicitly bypass workspace checks (ADR-0004,
// Decision item 2) — tenant data requires tenant membership.

import { getServerSession } from "next-auth"
import type { UserWorkspace, WorkspaceRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"

import { authOptions } from "./config"
import { normalizeUserId } from "./demo-user"

/** Membership row returned by requireWorkspaceRole for query scoping. */
export type WorkspaceMembership = UserWorkspace

export interface AuthUser {
  id: string
  email: string | null
  name: string | null
}

/**
 * Error thrown by auth helpers (and any route logic that wants a typed
 * short-circuit). Converted to the standard `{ error, code?, details? }`
 * envelope by `handleApiError` in `@/lib/api/respond`.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

/**
 * Session lookup + demo-id normalization resolved ONCE.
 * Returns null when unauthenticated.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  // Target end-state: this becomes the ONLY call site of normalizeUserId in
  // application code. Route-level calls still exist and are being migrated
  // onto these helpers by ADR-0011/0012; ADR-0025 owns the eventual removal
  // of the normalization itself (edit here, nowhere else, once migrated).
  const id = await normalizeUserId(session.user.id)
  return {
    id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  }
}

/**
 * Returns the authenticated user or throws ApiError(401).
 */
export async function requireSession(): Promise<AuthUser> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new ApiError(401, "Unauthorized", "UNAUTHENTICATED")
  }
  return user
}

/**
 * Platform-tier gate (ADR-0004): the caller must be a platform admin
 * (`User.isPlatformAdmin === true`).
 *
 * Throws:
 * - ApiError(401, UNAUTHENTICATED) when there is no session.
 * - ApiError(403, FORBIDDEN) when the user is not a platform admin.
 *
 * The flag is re-read from the DATABASE on every call, deliberately ignoring
 * the session's `isPlatformAdmin` claim: JWT sessions are not revocation-safe,
 * so a revoked admin would otherwise keep platform power until their token
 * expires. The claim exists only for UI gating ("claim for UI, DB for API" —
 * see the module docstring).
 */
export async function requirePlatformAdmin(): Promise<AuthUser> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new ApiError(401, "Unauthorized", "UNAUTHENTICATED")
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isPlatformAdmin: true },
  })
  if (!dbUser?.isPlatformAdmin) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN")
  }
  return user
}

/**
 * Workspace-tier gate (ADR-0004): the caller must be a member of the given
 * workspace, optionally holding one of the given roles.
 *
 * @param workspaceId Workspace to check membership against.
 * @param roles       Allowed roles. Omitted = ANY member of the workspace.
 * @returns The caller's membership row, so handlers can scope queries
 *          (e.g. `where: { workspaceId: membership.workspaceId }`) and
 *          branch on `membership.role` without a second lookup.
 *
 * Throws:
 * - ApiError(401, UNAUTHENTICATED) when there is no session.
 * - ApiError(404, NOT_FOUND) when the user is NOT a member — deliberately a
 *   404, not a 403, so non-members cannot probe which workspace ids exist
 *   (ADR-0005 no-existence-leak semantics).
 * - ApiError(403, FORBIDDEN) when the user IS a member but their role is not
 *   in `roles`.
 *
 * Platform admins get NO implicit bypass (ADR-0004, Decision item 2): a
 * platform admin who is not a member of the workspace receives the same 404
 * as any other non-member. Tenant data access requires tenant membership;
 * explicitly platform-scoped endpoints use requirePlatformAdmin() instead.
 */
export async function requireWorkspaceRole(
  workspaceId: string,
  roles?: WorkspaceRole[]
): Promise<WorkspaceMembership> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new ApiError(401, "Unauthorized", "UNAUTHENTICATED")
  }
  const membership = await prisma.userWorkspace.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId },
    },
  })
  if (!membership) {
    throw new ApiError(404, "Workspace not found", "NOT_FOUND")
  }
  if (roles && roles.length > 0 && !roles.includes(membership.role)) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN")
  }
  return membership
}

/** Result of requireClientViewer: a client-scoped portal membership. */
export interface ClientViewerContext {
  user: AuthUser
  membership: WorkspaceMembership
  /** The one client this CLIENT_VIEWER is scoped to (never null). */
  clientId: string
}

/**
 * Portal gate (ADR-0020 Phase 2): the caller must hold a CLIENT_VIEWER
 * membership scoped to a client.
 *
 * @param workspaceId Optional. When given, the check runs against that
 *                    workspace (layered on requireWorkspaceRole, so
 *                    non-members get its 404 no-existence-leak semantics).
 *                    When omitted, the user's first CLIENT_VIEWER membership
 *                    is resolved — the portal entry point, where the client
 *                    does not know a workspace id.
 *
 * Throws:
 * - ApiError(401, UNAUTHENTICATED) when there is no session.
 * - ApiError(404, NOT_FOUND) when `workspaceId` is given and the user is not
 *   a member of it (via requireWorkspaceRole).
 * - ApiError(403, FORBIDDEN) when the membership role is not CLIENT_VIEWER,
 *   or when `membership.clientId` is null (a CLIENT_VIEWER row without a
 *   client scope is invalid by ADR-0020 validation and grants nothing).
 */
export async function requireClientViewer(
  workspaceId?: string
): Promise<ClientViewerContext> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new ApiError(401, "Unauthorized", "UNAUTHENTICATED")
  }

  let membership: WorkspaceMembership | null
  if (workspaceId) {
    membership = await requireWorkspaceRole(workspaceId)
    if (membership.role !== "CLIENT_VIEWER") {
      throw new ApiError(403, "Forbidden", "FORBIDDEN")
    }
  } else {
    membership = await prisma.userWorkspace.findFirst({
      where: { userId: user.id, role: "CLIENT_VIEWER" },
      orderBy: { createdAt: "asc" },
    })
    if (!membership) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN")
    }
  }

  if (!membership.clientId) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN")
  }

  return { user, membership, clientId: membership.clientId }
}

/**
 * @deprecated ADR-0004: `requireAdmin()` is now an alias of
 * `requirePlatformAdmin()` — the interim "OWNER/ADMIN of ANY workspace"
 * semantics are gone. Kept with an identical signature so the ~40 existing
 * call sites keep compiling until a mechanical rename lands (ADR-0012).
 * New code must call `requirePlatformAdmin()` directly.
 */
export async function requireAdmin(): Promise<AuthUser> {
  return requirePlatformAdmin()
}
