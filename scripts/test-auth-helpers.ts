// Runtime verification for the ADR-0004 authorization helpers
// (requirePlatformAdmin / requireWorkspaceRole / the deprecated
// requireAdmin alias) in src/lib/auth/session.ts.
//
// Why this exists: the jest suite is currently broken (invalid
// `moduleNameMapping` key in jest.config.js — ADR-0021), so the jest-style
// spec in __tests__/unit/auth-helpers.test.ts cannot run yet. This script is
// the RUNNABLE equivalent: it mocks getServerSession at the next-auth module
// boundary (require.cache pre-population, BEFORE the session module loads)
// and exercises the real helpers against the live dev database using
// throwaway rows (unique per-run emails / workspace id) that it creates and
// deletes itself.
//
// Usage (host, DATABASE_URL exported from .env.local):
//   export $(grep -E '^DATABASE_URL=' .env.local | tr -d '"' | xargs)
//   npx tsx --tsconfig tsconfig.json scripts/test-auth-helpers.ts
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// 1. Mock next-auth BEFORE anything imports it. We replace the module's
// require.cache entry so that src/lib/auth/session.ts (dynamically imported
// below, AFTER this patch) receives our getServerSession. This is a mock at
// the next-auth module boundary — everything downstream (helpers, demo-id
// normalization, prisma) runs for real.
// ---------------------------------------------------------------------------
type MockSession = {
  user: { id: string; email?: string | null; name?: string | null }
} | null

let currentSession: MockSession = null

const nextAuthId = require.resolve("next-auth")
require.cache[nextAuthId] = {
  id: nextAuthId,
  filename: nextAuthId,
  path: nextAuthId,
  loaded: true,
  exports: {
    // Signature-compatible with getServerSession(authOptions): extra args
    // are accepted and ignored; only the resolved session matters here.
    getServerSession: async () => currentSession,
  },
  children: [],
  paths: [],
} as any

import { PrismaClient, WorkspaceRole } from "@prisma/client"

const prisma = new PrismaClient()

// Unique-per-run identifiers so parallel/aborted runs never collide and
// leftovers are recognizable.
const RUN = `adr0004-${Date.now()}`
const WS_ID = `${RUN}-ws`
const EMAIL_DOMAIN = "helpers.invalid" // RFC 2606 — can never be a real user
const email = (label: string) => `${RUN}-${label}@${EMAIL_DOMAIN}`

let passed = 0
let failed = 0

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function expectApiError(
  name: string,
  fn: () => Promise<unknown>,
  status: number,
  code: string,
  ApiErrorClass: any
) {
  try {
    await fn()
    ok(name, false, `expected ApiError(${status}, ${code}) but nothing was thrown`)
  } catch (err: any) {
    const isApiError = err instanceof ApiErrorClass
    ok(
      name,
      isApiError && err.status === status && err.code === code,
      `got ${err?.name ?? typeof err}(status=${err?.status}, code=${err?.code}, message=${err?.message})`
    )
  }
}

async function cleanup() {
  await prisma.userWorkspace.deleteMany({
    where: { workspaceId: { startsWith: "adr0004-" } },
  })
  await prisma.workspace.deleteMany({ where: { id: { startsWith: "adr0004-" } } })
  await prisma.user.deleteMany({
    where: { email: { startsWith: "adr0004-", endsWith: `@${EMAIL_DOMAIN}` } },
  })
}

async function main() {
  // -------------------------------------------------------------------------
  // 2. Import the module under test AFTER the next-auth mock is installed.
  // -------------------------------------------------------------------------
  const session = await import("../src/lib/auth/session")
  const { requirePlatformAdmin, requireWorkspaceRole, requireAdmin, ApiError } = session

  // Also assert the barrel exports the new helpers (ADR-0004 step 3).
  const barrel = await import("../src/lib/auth")
  ok(
    "barrel exports requirePlatformAdmin + requireWorkspaceRole",
    barrel.requirePlatformAdmin === requirePlatformAdmin &&
      barrel.requireWorkspaceRole === requireWorkspaceRole
  )

  // -------------------------------------------------------------------------
  // 3. Throwaway fixtures in the live dev DB (removed in finally).
  // -------------------------------------------------------------------------
  await cleanup() // clear any leftovers from previous aborted runs

  const workspace = await prisma.workspace.create({
    data: { id: WS_ID, name: "ADR-0004 helper test workspace" },
  })
  const platformAdmin = await prisma.user.create({
    data: { email: email("platform-admin"), name: "Test Platform Admin", isPlatformAdmin: true },
  })
  const ownerMember = await prisma.user.create({
    data: { email: email("owner"), name: "Test Workspace Owner", isPlatformAdmin: false },
  })
  const analystMember = await prisma.user.create({
    data: { email: email("analyst"), name: "Test Workspace Analyst", isPlatformAdmin: false },
  })
  const nonMember = await prisma.user.create({
    data: { email: email("non-member"), name: "Test Non Member", isPlatformAdmin: false },
  })
  await prisma.userWorkspace.create({
    data: { userId: ownerMember.id, workspaceId: workspace.id, role: WorkspaceRole.OWNER },
  })
  await prisma.userWorkspace.create({
    data: { userId: analystMember.id, workspaceId: workspace.id, role: WorkspaceRole.ANALYST },
  })
  // NOTE: platformAdmin is intentionally NOT a member of the workspace.

  const asUser = (u: { id: string; email: string | null; name: string | null }) => {
    currentSession = { user: { id: u.id, email: u.email, name: u.name } }
  }
  const asNobody = () => {
    currentSession = null
  }

  // -------------------------------------------------------------------------
  // requirePlatformAdmin
  // -------------------------------------------------------------------------
  console.log("\nrequirePlatformAdmin:")

  asNobody()
  await expectApiError(
    "no session -> 401 UNAUTHENTICATED",
    () => requirePlatformAdmin(),
    401,
    "UNAUTHENTICATED",
    ApiError
  )

  asUser(nonMember)
  await expectApiError(
    "session but not platform admin -> 403 FORBIDDEN",
    () => requirePlatformAdmin(),
    403,
    "FORBIDDEN",
    ApiError
  )

  asUser(ownerMember)
  await expectApiError(
    "workspace OWNER (old any-workspace semantics) -> 403 FORBIDDEN",
    () => requirePlatformAdmin(),
    403,
    "FORBIDDEN",
    ApiError
  )

  asUser(platformAdmin)
  try {
    const authUser = await requirePlatformAdmin()
    ok(
      "platform admin -> returns AuthUser",
      authUser.id === platformAdmin.id && authUser.email === platformAdmin.email
    )
  } catch (err: any) {
    ok("platform admin -> returns AuthUser", false, `threw ${err?.message}`)
  }

  // -------------------------------------------------------------------------
  // requireAdmin — deprecated alias must now share requirePlatformAdmin's body
  // -------------------------------------------------------------------------
  console.log("\nrequireAdmin (deprecated alias of requirePlatformAdmin):")

  asUser(ownerMember)
  await expectApiError(
    "workspace OWNER no longer passes requireAdmin -> 403 FORBIDDEN",
    () => requireAdmin(),
    403,
    "FORBIDDEN",
    ApiError
  )

  asUser(platformAdmin)
  try {
    const authUser = await requireAdmin()
    ok("platform admin passes requireAdmin", authUser.id === platformAdmin.id)
  } catch (err: any) {
    ok("platform admin passes requireAdmin", false, `threw ${err?.message}`)
  }

  // -------------------------------------------------------------------------
  // requireWorkspaceRole
  // -------------------------------------------------------------------------
  console.log("\nrequireWorkspaceRole:")

  asNobody()
  await expectApiError(
    "no session -> 401 UNAUTHENTICATED",
    () => requireWorkspaceRole(workspace.id),
    401,
    "UNAUTHENTICATED",
    ApiError
  )

  asUser(nonMember)
  await expectApiError(
    "non-member -> 404 NOT_FOUND (no existence leak)",
    () => requireWorkspaceRole(workspace.id),
    404,
    "NOT_FOUND",
    ApiError
  )

  asUser(analystMember)
  await expectApiError(
    "member with wrong role (ANALYST vs [OWNER, ADMIN]) -> 403 FORBIDDEN",
    () => requireWorkspaceRole(workspace.id, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]),
    403,
    "FORBIDDEN",
    ApiError
  )

  asUser(ownerMember)
  try {
    const membership = await requireWorkspaceRole(workspace.id, [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ])
    ok(
      "member with correct role -> returns membership row",
      membership.userId === ownerMember.id &&
        membership.workspaceId === workspace.id &&
        membership.role === WorkspaceRole.OWNER
    )
  } catch (err: any) {
    ok("member with correct role -> returns membership row", false, `threw ${err?.message}`)
  }

  asUser(analystMember)
  try {
    const membership = await requireWorkspaceRole(workspace.id)
    ok(
      "roles omitted -> any member passes (ANALYST)",
      membership.userId === analystMember.id && membership.role === WorkspaceRole.ANALYST
    )
  } catch (err: any) {
    ok("roles omitted -> any member passes (ANALYST)", false, `threw ${err?.message}`)
  }

  asUser(platformAdmin)
  await expectApiError(
    "platform admin who is NOT a member -> 404 NOT_FOUND (no implicit bypass)",
    () => requireWorkspaceRole(workspace.id),
    404,
    "NOT_FOUND",
    ApiError
  )

  asUser(ownerMember)
  await expectApiError(
    "nonexistent workspace id -> 404 NOT_FOUND",
    () => requireWorkspaceRole(`${RUN}-does-not-exist`),
    404,
    "NOT_FOUND",
    ApiError
  )

  // -------------------------------------------------------------------------
  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error("❌ test-auth-helpers crashed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await cleanup()
      console.log("🧹 Throwaway fixtures removed")
    } catch (err) {
      console.error("⚠️ Cleanup failed (rows are prefixed adr0004- for manual removal):", err)
      process.exitCode = 1
    }
    await prisma.$disconnect()
  })
