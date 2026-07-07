/**
 * @jest-environment node
 *
 * ADR-0018 Track E — integration tests for the AI availability contract:
 *   - GET /api/ai/status (auth triple + env-truthful body)
 *   - POST /api/ai/tone/analyze gating: 503 AI_UNAVAILABLE when provider is
 *     'none'; 200 { aiProvider:'mock', simulated:true } in demo mode.
 *
 * Runs through the integration harness (real dev Postgres, only next-auth's
 * getServerSession mocked).
 */
// NOTE: use the GLOBAL jest for jest.mock() — importing jest from
// '@jest/globals' shadows the global and defeats SWC mock hoisting.
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import type { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}))

// ESM-only package; the jest transform skips node_modules — stub it so
// importing authOptions (via '@/lib/auth') does not fail to parse.
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }))

import {
  makeRequest,
  mockSession,
  createTestWorkspace,
  disconnectTestPrisma,
  readJson,
  testPrisma,
  type TestWorkspace,
} from '../utils/integration'
import { GET as statusGET } from '@/app/api/ai/status/route'

const mutableEnv = process.env as Record<string, string | undefined>

let ws: TestWorkspace

beforeAll(async () => {
  ws = await createTestWorkspace({ name: 'AI Status Suite' })
})

afterAll(async () => {
  // The tone/analyze route writes AIUsageTracking rows; remove them before
  // the workspace row so cleanup() cannot hit an FK violation.
  await testPrisma.aIUsageTracking.deleteMany({
    where: { workspaceId: ws.workspace.id },
  })
  await ws.cleanup()
  await disconnectTestPrisma()
})

// ---------------------------------------------------------------------------
// Isolated route loading (documents the singleton-caching pattern)
// ---------------------------------------------------------------------------
//
// Module-scope singletons in the AI layer (aiService is constructed at import
// time and registers its providers based on process.env; src/lib/config/demo
// freezes isDemoMode() at module load) CACHE availability state. To test a
// different env state we must (1) mutate process.env FIRST, then (2) require
// the route inside jest.isolateModules() so a fresh registry re-evaluates
// everything.
//
// EXTRA TRAP: inside isolateModules the jest.mock('next-auth') factory
// produces a FRESH mock instance for that registry — the outer mockSession()
// helper would configure the WRONG getServerSession. So the session is
// configured on the registry-local instance, inside the same callback,
// before the route module loads.

type Handler = (req: NextRequest) => Promise<Response>

function loadToneAnalyzeIsolated(user: { id: string; email: string; name: string } | null): Handler {
  let post!: Handler
  jest.isolateModules(() => {
    const nextAuth = require('next-auth') as { getServerSession: jest.Mock }
    nextAuth.getServerSession.mockResolvedValue(
      user
        ? {
            user: { id: user.id, email: user.email, name: user.name },
            expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          }
        : null
    )
    post = (require('@/app/api/ai/tone/analyze/route') as { POST: Handler }).POST
  })
  return post
}

/** Set/delete the AI-relevant env vars, returning a restore function. */
function overrideAIEnv(overrides: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(overrides)) {
    saved[k] = mutableEnv[k]
    if (v === undefined) delete mutableEnv[k]
    else mutableEnv[k] = v
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete mutableEnv[k]
      else mutableEnv[k] = v
    }
  }
}

// ---------------------------------------------------------------------------
// GET /api/ai/status
// ---------------------------------------------------------------------------

describe('GET /api/ai/status', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const res = await statusGET(makeRequest('/api/ai/status'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with available/provider/model matching the env state', async () => {
    mockSession(ws.user)
    const res = await statusGET(makeRequest('/api/ai/status'))
    expect(res.status).toBe(200)
    const body = await readJson<{
      available: boolean
      provider: string
      model: string
      reason?: string
    }>(res)

    // Compute the expected availability from the CURRENT env with the exact
    // contract rules, so this test is truthful in any environment (dev
    // .env.local has a real key → 'openai'; a keyless CI → 'none'/'mock').
    const key = process.env.OPENAI_API_KEY
    const hasKey = Boolean(key) && key !== 'your-openai-api-key-here'
    const demo =
      process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO === 'true'
    const expectedProvider = hasKey ? 'openai' : demo ? 'mock' : 'none'

    expect(body.provider).toBe(expectedProvider)
    expect(body.available).toBe(expectedProvider !== 'none')
    expect(body.model).toBe(process.env.OPENAI_MODEL || 'gpt-4o-mini')
    if (expectedProvider === 'none') {
      expect(body.reason).toMatch(/OPENAI_API_KEY/)
    }
  })
})

// ---------------------------------------------------------------------------
// POST /api/ai/tone/analyze — availability gating
// ---------------------------------------------------------------------------

describe('POST /api/ai/tone/analyze availability gating', () => {
  // Minimal valid body per the route's zod schema:
  // { content: string (1..5000) } — postId optional, omitted.
  const validBody = { content: 'A short, friendly test sentence for tone analysis.' }

  it('returns 503 AI_UNAVAILABLE when no key and demo mode is off', async () => {
    const restore = overrideAIEnv({
      OPENAI_API_KEY: undefined,
      ENABLE_DEMO: undefined,
      // NODE_ENV is already 'test' under jest — NOT 'development', so
      // isDemoMode() is false and the provider resolves to 'none'.
    })
    try {
      const post = loadToneAnalyzeIsolated(ws.user)
      const res = await post(
        makeRequest('/api/ai/tone/analyze', { method: 'POST', body: validBody })
      )
      expect(res.status).toBe(503)
      const body = await readJson<{ error: string; message?: string }>(res)
      expect(body.error).toBe('AI_UNAVAILABLE')
    } finally {
      restore()
    }
  })

  it('returns 200 with aiProvider:"mock" + simulated:true in demo mode without a key', async () => {
    const restore = overrideAIEnv({
      OPENAI_API_KEY: undefined,
      ENABLE_DEMO: 'true',
    })
    try {
      const post = loadToneAnalyzeIsolated(ws.user)
      const res = await post(
        makeRequest('/api/ai/tone/analyze', { method: 'POST', body: validBody })
      )
      const body = await readJson<{
        aiProvider?: string
        simulated?: boolean
        error?: string
      }>(res)
      expect(res.status).toBe(200)
      // Success-body contract: top-level aiProvider + simulated on every
      // /api/ai/** success response. Also proves MockAIProvider still works
      // as an HONEST test double (never silently in production paths).
      expect(body.aiProvider).toBe('mock')
      expect(body.simulated).toBe(true)
    } finally {
      restore()
    }
  })
})
