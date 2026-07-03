/**
 * Unit tests for the ADR-0004 authorization helpers in
 * src/lib/auth/session.ts: requirePlatformAdmin(), requireWorkspaceRole(),
 * and the deprecated requireAdmin() alias.
 *
 * NOTE (ADR-0021): the jest infrastructure is currently broken —
 * jest.config.js uses the invalid option name `moduleNameMapping` (should be
 * `moduleNameMapper`), so the `@/` path alias never resolves and this suite
 * cannot run until ADR-0021 repairs the config. It is written jest-style for
 * that future suite. Until then, the RUNNABLE verification of the same cases
 * lives in scripts/test-auth-helpers.ts (tsx, live dev DB, run per ADR-0004
 * Phase 1 step 6).
 *
 * Mock strategy: getServerSession is mocked at the next-auth module
 * boundary; prisma is mocked at @/lib/prisma. Everything in between
 * (helpers, demo-id normalization pass-through) runs for real.
 */

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))

// authOptions pulls in providers/adapter/bcrypt — irrelevant to these units.
jest.mock("@/lib/auth/config", () => ({
  authOptions: {},
}))

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userWorkspace: { findUnique: jest.fn() },
  },
}))

import { getServerSession } from "next-auth"

import { prisma } from "@/lib/prisma"
import {
  ApiError,
  requireAdmin,
  requirePlatformAdmin,
  requireWorkspaceRole,
} from "@/lib/auth/session"

const mockGetServerSession = getServerSession as jest.Mock
const mockUserFindUnique = prisma.user.findUnique as unknown as jest.Mock
const mockMembershipFindUnique = prisma.userWorkspace.findUnique as unknown as jest.Mock

const USER = { id: "user-1", email: "user-1@example.test", name: "User One" }
const WORKSPACE_ID = "ws-1"

function signInAs(user: typeof USER | null) {
  mockGetServerSession.mockResolvedValue(user ? { user } : null)
}

async function expectApiError(
  fn: () => Promise<unknown>,
  status: number,
  code: string
): Promise<void> {
  const promise = fn()
  await expect(promise).rejects.toBeInstanceOf(ApiError)
  await expect(promise).rejects.toMatchObject({ status, code })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("requirePlatformAdmin (ADR-0004 platform tier)", () => {
  it("throws ApiError(401, UNAUTHENTICATED) when there is no session", async () => {
    signInAs(null)
    await expectApiError(() => requirePlatformAdmin(), 401, "UNAUTHENTICATED")
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it("throws ApiError(403, FORBIDDEN) for an authenticated non-admin", async () => {
    signInAs(USER)
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false })
    await expectApiError(() => requirePlatformAdmin(), 403, "FORBIDDEN")
  })

  it("throws ApiError(403, FORBIDDEN) when the session user no longer exists in the DB", async () => {
    signInAs(USER)
    mockUserFindUnique.mockResolvedValue(null)
    await expectApiError(() => requirePlatformAdmin(), 403, "FORBIDDEN")
  })

  it("returns the AuthUser for a platform admin", async () => {
    signInAs(USER)
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true })
    await expect(requirePlatformAdmin()).resolves.toEqual(USER)
  })

  it("re-checks the DATABASE, never the session claim (claim for UI, DB for API)", async () => {
    // Session claims isPlatformAdmin: true, but the DB says false — the DB
    // must win (JWT claims are not revocation-safe).
    mockGetServerSession.mockResolvedValue({ user: { ...USER, isPlatformAdmin: true } })
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false })
    await expectApiError(() => requirePlatformAdmin(), 403, "FORBIDDEN")
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: USER.id },
      select: { isPlatformAdmin: true },
    })
  })
})

describe("requireAdmin (deprecated alias, ADR-0004)", () => {
  it("no longer accepts a workspace OWNER/ADMIN who is not a platform admin", async () => {
    signInAs(USER)
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false })
    await expectApiError(() => requireAdmin(), 403, "FORBIDDEN")
    // The old any-workspace membership lookup must be gone entirely.
    expect(mockMembershipFindUnique).not.toHaveBeenCalled()
  })

  it("delegates to requirePlatformAdmin and passes platform admins", async () => {
    signInAs(USER)
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true })
    await expect(requireAdmin()).resolves.toEqual(USER)
  })
})

describe("requireWorkspaceRole (ADR-0004 workspace tier)", () => {
  const MEMBERSHIP = {
    id: "uw-1",
    userId: USER.id,
    workspaceId: WORKSPACE_ID,
    role: "ANALYST",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it("throws ApiError(401, UNAUTHENTICATED) when there is no session", async () => {
    signInAs(null)
    await expectApiError(() => requireWorkspaceRole(WORKSPACE_ID), 401, "UNAUTHENTICATED")
    expect(mockMembershipFindUnique).not.toHaveBeenCalled()
  })

  it("throws ApiError(404, NOT_FOUND) for a non-member (no existence leak, ADR-0005)", async () => {
    signInAs(USER)
    mockMembershipFindUnique.mockResolvedValue(null)
    await expectApiError(() => requireWorkspaceRole(WORKSPACE_ID), 404, "NOT_FOUND")
    expect(mockMembershipFindUnique).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: USER.id, workspaceId: WORKSPACE_ID } },
    })
  })

  it("throws ApiError(403, FORBIDDEN) for a member whose role is not allowed", async () => {
    signInAs(USER)
    mockMembershipFindUnique.mockResolvedValue(MEMBERSHIP) // ANALYST
    await expectApiError(
      () => requireWorkspaceRole(WORKSPACE_ID, ["OWNER", "ADMIN"]),
      403,
      "FORBIDDEN"
    )
  })

  it("returns the membership row for a member with an allowed role", async () => {
    signInAs(USER)
    mockMembershipFindUnique.mockResolvedValue({ ...MEMBERSHIP, role: "OWNER" })
    await expect(
      requireWorkspaceRole(WORKSPACE_ID, ["OWNER", "ADMIN"])
    ).resolves.toMatchObject({
      userId: USER.id,
      workspaceId: WORKSPACE_ID,
      role: "OWNER",
    })
  })

  it("accepts ANY member when roles are omitted", async () => {
    signInAs(USER)
    mockMembershipFindUnique.mockResolvedValue(MEMBERSHIP) // ANALYST
    await expect(requireWorkspaceRole(WORKSPACE_ID)).resolves.toMatchObject({
      role: "ANALYST",
    })
  })

  it("gives platform admins NO implicit bypass: non-member admin gets 404", async () => {
    // Session AND DB agree the user is a platform admin — but they hold no
    // membership in this workspace, so the workspace tier returns the same
    // 404 as for any other non-member (ADR-0004 Decision item 2).
    mockGetServerSession.mockResolvedValue({ user: { ...USER, isPlatformAdmin: true } })
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true })
    mockMembershipFindUnique.mockResolvedValue(null)
    await expectApiError(() => requireWorkspaceRole(WORKSPACE_ID), 404, "NOT_FOUND")
  })
})
