// Integration harness for App Router API route tests (ADR-0021 Track D).
//
// Invokes route handlers DIRECTLY (no HTTP server): build a NextRequest with
// makeRequest(), call the exported GET/POST/PUT handler, assert on the
// Response. Auth is exercised for REAL — the canonical helpers
// (requireSession / requireWorkspaceRole / requirePlatformAdmin in
// src/lib/auth/session.ts) call next-auth's getServerSession() internally,
// so mocking ONLY `next-auth`'s getServerSession is sufficient: the demo-id
// normalization and the DB membership/role checks all run against the real
// database. Do NOT mock '@/lib/auth'.
//
// ── HOW EVERY SUITE MUST START ────────────────────────────────────────────
//
//   // 1. Mock next-auth at the very top of the file. babel-jest HOISTS
//   //    jest.mock() calls above the imports, so the mock is registered
//   //    before any route module (or this harness) loads.
//   jest.mock('next-auth', () => ({
//     __esModule: true,
//     default: jest.fn(),          // NextAuth() initializer — unused here
//     getServerSession: jest.fn(), // driven via mockSession()
//   }))
//   // @auth/prisma-adapter is ESM-only and the jest transform skips
//   // node_modules — stub it so importing authOptions doesn't explode.
//   // (Routes never touch the adapter in tests; sessions are mocked.)
//   jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }))
//
//   // 2. Import the harness BEFORE any '@/app/api/**/route' module. Its
//   //    module-level side effects restore DATABASE_URL from .env.local
//   //    (jest.setup.js overwrites it with a nonexistent *_test database)
//   //    and pre-register the shared PrismaClient on globalThis so
//   //    '@/lib/prisma' reuses this exact client.
//   import { makeRequest, mockSession, createTestWorkspace, testPrisma } from '../utils/integration'
//   import { GET } from '@/app/api/whatever/route'
//
//   // 3. jest.config sets clearMocks/restoreMocks, so call mockSession()
//   //    inside EACH test (or a beforeEach) — never once per file.
//   //    Always disconnect in afterAll to avoid open-handle leaks:
//   afterAll(async () => { await ws.cleanup(); await disconnectTestPrisma() })
//
// ──────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import { PrismaClient, type WorkspaceRole } from '@prisma/client'

// ---------------------------------------------------------------------------
// Database: use the REAL dev Postgres from .env.local.
//
// jest.setup.js unconditionally sets DATABASE_URL to a nonexistent
// 'sociallyhub_test' database. next/jest already loaded .env.local before
// that, so we re-read the file ourselves and restore the real URL. This runs
// at module-evaluation time — before any route module imports '@/lib/prisma'
// — as long as suites import this harness first (see header docs).
// ---------------------------------------------------------------------------

function databaseUrlFromEnvLocal(): string | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    const match = raw.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m)
    return match ? match[1] : null
  } catch {
    return null
  }
}

const realDatabaseUrl = databaseUrlFromEnvLocal()
if (realDatabaseUrl) {
  process.env.DATABASE_URL = realDatabaseUrl
}

/**
 * The one PrismaClient for the whole test file. Also registered as the
 * `globalThis.prisma` singleton so '@/lib/prisma' (which does
 * `globalForPrisma.prisma ?? new PrismaClient()`) reuses this instance —
 * route handlers and test fixtures therefore share one connection pool
 * pointed at the real dev database regardless of import order.
 */
export const testPrisma: PrismaClient = new PrismaClient(
  realDatabaseUrl ? { datasources: { db: { url: realDatabaseUrl } } } : undefined
)
;(globalThis as unknown as { prisma?: PrismaClient }).prisma = testPrisma

/** Call in the suite's LAST afterAll so Jest can exit without open handles. */
export async function disconnectTestPrisma(): Promise<void> {
  await testPrisma.$disconnect()
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

export interface MakeRequestOptions {
  method?: string
  /** Object → JSON.stringify + content-type json. String → sent raw (webhook bodies). */
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Build a NextRequest for direct handler invocation.
 * `url` may be a path ('/api/posts?limit=5') or an absolute URL.
 */
export function makeRequest(url: string, opts: MakeRequestOptions = {}): NextRequest {
  const { method = 'GET', body, headers = {} } = opts
  const absolute = url.startsWith('http') ? url : `http://localhost:3099${url}`
  const init: RequestInit & { duplex?: 'half' } = { method, headers }
  if (body !== undefined) {
    if (typeof body === 'string') {
      init.body = body
    } else {
      init.body = JSON.stringify(body)
      init.headers = { 'content-type': 'application/json', ...headers }
    }
    init.duplex = 'half' // required by undici for request bodies
  }
  return new NextRequest(absolute, init as ConstructorParameters<typeof NextRequest>[1])
}

// ---------------------------------------------------------------------------
// Session mocking
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string
  email?: string | null
  name?: string | null
}

/** Structural view of a jest.fn() — keeps this file free of jest type deps. */
interface MockFn {
  mockResolvedValue: (value: unknown) => unknown
}

/**
 * Point the (suite-mocked) getServerSession at a user, or at null for the
 * unauthenticated case. Requires the jest.mock('next-auth', ...) block from
 * the header docs; throws with instructions if the suite forgot it.
 */
export function mockSession(user: SessionUser | null): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nextAuth = require('next-auth') as { getServerSession?: MockFn }
  const fn = nextAuth.getServerSession
  if (!fn || typeof fn.mockResolvedValue !== 'function') {
    throw new Error(
      "mockSession() needs the suite to declare: jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(), getServerSession: jest.fn() })) at the top of the test file."
    )
  }
  fn.mockResolvedValue(
    user
      ? {
          user: {
            id: user.id,
            email: user.email ?? `${user.id}@integration.test`,
            name: user.name ?? 'Integration Test User',
          },
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }
      : null
  )
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** cuid-ish unique id — sortable-ish, collision-safe enough for fixtures. */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export interface TestWorkspace {
  user: { id: string; email: string; name: string }
  workspace: { id: string; name: string }
  /** Deletes everything createTestWorkspace created (plus dependent rows). */
  cleanup: () => Promise<void>
}

/**
 * Create a user + workspace + membership (default role OWNER) in the real
 * dev database. Rows use uid()-prefixed ids and an @integration.test email
 * so they never collide with seeded demo data.
 *
 * cleanup() removes dependent rows first (settings, accounts, posts,
 * subscription, membership) and is safe to call even if a test already
 * deleted some of them.
 */
export async function createTestWorkspace(
  opts: { role?: WorkspaceRole; name?: string } = {}
): Promise<TestWorkspace> {
  const userId = uid('itusr')
  const workspaceId = uid('itws')
  const email = `${userId}@integration.test`
  const name = opts.name ?? 'Integration Test'

  const user = await testPrisma.user.create({
    data: { id: userId, email, name, emailVerified: new Date() },
  })
  const workspace = await testPrisma.workspace.create({
    data: { id: workspaceId, name: `${name} Workspace` },
  })
  await testPrisma.userWorkspace.create({
    data: { userId, workspaceId, role: opts.role ?? 'OWNER' },
  })

  const cleanup = async () => {
    // Dependent rows first; each deleteMany is a no-op when nothing matches.
    await testPrisma.postVariant.deleteMany({ where: { post: { workspaceId } } })
    await testPrisma.post.deleteMany({ where: { workspaceId } })
    await testPrisma.socialAccount.deleteMany({ where: { workspaceId } })
    await testPrisma.subscription.deleteMany({ where: { workspaceId } })
    await testPrisma.userWorkspace.deleteMany({ where: { workspaceId } })
    await testPrisma.userSettings.deleteMany({ where: { userId } })
    await testPrisma.workspace.deleteMany({ where: { id: workspaceId } })
    await testPrisma.user.deleteMany({ where: { id: userId } })
  }

  return {
    user: { id: user.id, email, name },
    workspace: { id: workspace.id, name: workspace.name },
    cleanup,
  }
}

/**
 * Seed `count` ACTIVE SocialAccount rows into a workspace (for entitlement /
 * usage tests). Tokens are inert placeholders — nothing ever decrypts them.
 */
export async function seedSocialAccounts(workspaceId: string, count: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const id = uid('itacct')
    await testPrisma.socialAccount.create({
      data: {
        id,
        workspaceId,
        provider: 'TWITTER',
        accountType: 'profile',
        handle: `@${id}`,
        displayName: `Integration Account ${i + 1}`,
        accountId: id,
        accessToken: 'enc:test:integration-placeholder',
        status: 'ACTIVE',
        scopes: [],
      },
    })
    ids.push(id)
  }
  return ids
}

/** Parse a handler Response as JSON with a helpful failure message. */
export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Expected JSON response (status ${res.status}), got: ${text.slice(0, 300)}`)
  }
}
