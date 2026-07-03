// Canonical session helpers (ADR-0003).
//
// These are the ONLY sanctioned way for application code to read the
// authenticated user. Routes must never call getServerSession() directly
// (see docs/api-conventions.md) — the helpers resolve the session AND the
// legacy demo-id normalization exactly once per request.

import { getServerSession } from "next-auth"

import { prisma } from "@/lib/prisma"

import { authOptions } from "./config"
import { normalizeUserId } from "./demo-user"

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
 * Interim admin gate: the user is considered an admin when they hold an
 * OWNER or ADMIN membership in ANY workspace. This deliberately reproduces
 * today's coarse, over-broad semantics so that all admin routes share a
 * single choke point.
 *
 * TODO(ADR-0004): replace the BODY of this function with the real platform
 * authorization model (workspace scoping / platform-admin role) WITHOUT
 * changing its signature or its call sites.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireSession()
  const membership = await prisma.userWorkspace.findFirst({
    where: {
      userId: user.id,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { id: true },
  })
  if (!membership) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN")
  }
  return user
}
