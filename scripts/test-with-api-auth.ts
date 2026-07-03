// Runtime verification for the ADR-0005 withApiAuth wrapper in
// src/lib/api/with-api-auth.ts.
//
// Why this exists: the jest suite is currently broken (invalid
// `moduleNameMapping` key in jest.config.js — ADR-0021), so this script is the
// RUNNABLE proof for the wrapper's access-level enforcement. It mocks
// getServerSession at the next-auth module boundary (require.cache
// pre-population, BEFORE the wrapper/session module loads) exactly as
// scripts/test-auth-helpers.ts does, then drives the wrapper end-to-end:
//   - access:'public'        → passes with no session
//   - access:'session'       → 401 without session, 200 with
//   - access:'platformAdmin' → 403 for a non-admin, 200 for isPlatformAdmin
//   - access:'cron'          → 401 without x-cron-secret, 200 with the secret
//   - every response carries Cache-Control: no-store by default
//
// The platformAdmin path re-reads User.isPlatformAdmin from the DATABASE
// (requirePlatformAdmin, ADR-0004), so this creates throwaway users (unique
// per-run emails) in the live dev DB and deletes them in `finally`.
//
// Usage (host, DATABASE_URL exported from .env.local):
//   export $(grep -E '^DATABASE_URL=' .env.local | tr -d '"' | xargs)
//   npx tsx --tsconfig tsconfig.json scripts/test-with-api-auth.ts
//
// Exit code 0 = all assertions passed; 1 = at least one failure.

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// 0. A shared secret for the `cron` access level, set BEFORE the wrapper loads.
// ---------------------------------------------------------------------------
const CRON_SECRET = 'test-cron-secret-adr0005'
process.env.CRON_SECRET = CRON_SECRET
// Keep the limiter off the real Redis: no `limit` config is used below, so
// rateLimit() is never called, but be explicit so the module never dials out.
delete process.env.REDIS_URL

// ---------------------------------------------------------------------------
// 1. Mock next-auth BEFORE anything imports it (same technique as
// scripts/test-auth-helpers.ts). Everything downstream — the wrapper, the
// ADR-0003/0004 helpers, demo-id normalization, prisma — runs for real.
// ---------------------------------------------------------------------------
type MockSession = {
  user: { id: string; email?: string | null; name?: string | null }
} | null

let currentSession: MockSession = null

const nextAuthId = require.resolve('next-auth')
require.cache[nextAuthId] = {
  id: nextAuthId,
  filename: nextAuthId,
  path: nextAuthId,
  loaded: true,
  exports: {
    getServerSession: async () => currentSession,
  },
  children: [],
  paths: [],
} as any

import { PrismaClient } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

const prisma = new PrismaClient()

const RUN = `adr0005-${Date.now()}`
const EMAIL_DOMAIN = 'apiauth.invalid' // RFC 2606 — never a real user
const email = (label: string) => `${RUN}-${label}@${EMAIL_DOMAIN}`

let passed = 0
let failed = 0

function ok(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function req(path: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: headers ?? {},
  } as any)
}

async function cleanup() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: 'adr0005-', endsWith: `@${EMAIL_DOMAIN}` } },
  })
}

async function main() {
  // -------------------------------------------------------------------------
  // 2. Import the wrapper AFTER the next-auth mock is installed.
  // -------------------------------------------------------------------------
  const { withApiAuth } = await import('../src/lib/api/with-api-auth')

  // A trivial handler that reports whether it actually ran and what user it saw.
  const handler = (_request: NextRequest, ctx: any) =>
    NextResponse.json({ ran: true, userId: ctx.user?.id ?? null })

  // -------------------------------------------------------------------------
  // 3. Throwaway fixtures in the live dev DB (removed in finally).
  // -------------------------------------------------------------------------
  await cleanup()
  const adminUser = await prisma.user.create({
    data: { email: email('admin'), name: 'ADR-0005 Admin', isPlatformAdmin: true },
  })
  const plainUser = await prisma.user.create({
    data: { email: email('plain'), name: 'ADR-0005 Plain', isPlatformAdmin: false },
  })

  const asUser = (u: { id: string; email: string | null; name: string | null }) => {
    currentSession = { user: { id: u.id, email: u.email, name: u.name } }
  }
  const asNobody = () => {
    currentSession = null
  }

  // -------------------------------------------------------------------------
  // access: 'public'
  // -------------------------------------------------------------------------
  console.log("\naccess: 'public'")
  {
    const GET = withApiAuth(handler, { access: 'public' })
    asNobody()
    const res = await GET(req('/api/test/public'))
    const body = await res.json()
    ok('public + no session → 200 and handler ran', res.status === 200 && body.ran === true,
      `status=${res.status} body=${JSON.stringify(body)}`)
    ok('public response carries Cache-Control: no-store (default)',
      res.headers.get('Cache-Control') === 'no-store',
      `got ${res.headers.get('Cache-Control')}`)
    ok('public + no session → ctx.user is undefined', body.userId === null,
      `got ${JSON.stringify(body.userId)}`)
  }

  // -------------------------------------------------------------------------
  // access: 'session'
  // -------------------------------------------------------------------------
  console.log("\naccess: 'session'")
  {
    const GET = withApiAuth(handler, { access: 'session' })

    asNobody()
    const res401 = await GET(req('/api/test/session'))
    const body401 = await res401.json()
    ok('session + no session → 401', res401.status === 401, `status=${res401.status}`)
    ok('session 401 uses UNAUTHENTICATED code envelope', body401.code === 'UNAUTHENTICATED',
      `body=${JSON.stringify(body401)}`)
    ok('session 401 carries Cache-Control: no-store',
      res401.headers.get('Cache-Control') === 'no-store',
      `got ${res401.headers.get('Cache-Control')}`)

    asUser(plainUser)
    const res200 = await GET(req('/api/test/session'))
    const body200 = await res200.json()
    ok('session + valid session → 200 and handler saw the user',
      res200.status === 200 && body200.ran === true && body200.userId === plainUser.id,
      `status=${res200.status} body=${JSON.stringify(body200)}`)
  }

  // -------------------------------------------------------------------------
  // access: 'platformAdmin'  (re-checked against the DB)
  // -------------------------------------------------------------------------
  console.log("\naccess: 'platformAdmin'")
  {
    const GET = withApiAuth(handler, { access: 'platformAdmin' })

    asUser(plainUser)
    const res403 = await GET(req('/api/test/admin'))
    const body403 = await res403.json()
    ok('platformAdmin + non-admin session → 403', res403.status === 403, `status=${res403.status}`)
    ok('platformAdmin 403 uses FORBIDDEN code envelope', body403.code === 'FORBIDDEN',
      `body=${JSON.stringify(body403)}`)

    asNobody()
    const resNo = await GET(req('/api/test/admin'))
    ok('platformAdmin + no session → 401', resNo.status === 401, `status=${resNo.status}`)

    asUser(adminUser)
    const res200 = await GET(req('/api/test/admin'))
    const body200 = await res200.json()
    ok('platformAdmin + isPlatformAdmin session → 200',
      res200.status === 200 && body200.userId === adminUser.id,
      `status=${res200.status} body=${JSON.stringify(body200)}`)
  }

  // -------------------------------------------------------------------------
  // access: 'cron'  (shared-secret header)
  // -------------------------------------------------------------------------
  console.log("\naccess: 'cron'")
  {
    const POST = withApiAuth(handler, { access: 'cron' })

    asNobody()
    const resNoHeader = await POST(req('/api/test/cron'))
    ok('cron + no x-cron-secret → 401', resNoHeader.status === 401, `status=${resNoHeader.status}`)

    const resWrong = await POST(req('/api/test/cron', { 'x-cron-secret': 'wrong' }))
    ok('cron + wrong x-cron-secret → 401', resWrong.status === 401, `status=${resWrong.status}`)

    const resRight = await POST(req('/api/test/cron', { 'x-cron-secret': CRON_SECRET }))
    const bodyRight = await resRight.json()
    ok('cron + correct x-cron-secret → 200 and handler ran',
      resRight.status === 200 && bodyRight.ran === true, `status=${resRight.status}`)
    ok('cron 200 carries Cache-Control: no-store',
      resRight.headers.get('Cache-Control') === 'no-store',
      `got ${resRight.headers.get('Cache-Control')}`)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error('❌ test-with-api-auth crashed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await cleanup()
      console.log('🧹 Throwaway fixtures removed')
    } catch (err) {
      console.error('⚠️ Cleanup failed (rows are prefixed adr0005- for manual removal):', err)
      process.exitCode = 1
    }
    await prisma.$disconnect()
  })
