/**
 * @jest-environment node
 *
 * ADR-0025 Track F1 — the registry-escape guard, as a test. Demo fabrication
 * must be reachable ONLY when DEMO_MODE is explicitly on. This drives the two
 * accounts routes both ways:
 *
 *   DEMO_MODE unset:
 *     - POST /api/accounts/connect for an unconfigured provider → 503
 *       PLATFORM_NOT_CONFIGURED, and creates NO SocialAccount (nothing flagged
 *       metadata.demoAccount).
 *     - GET  /api/accounts/platforms → NO platform in the 'demo' tier.
 *   DEMO_MODE=true:
 *     - GET  /api/accounts/platforms → the unconfigured provider is offered in
 *       the 'demo' tier.
 *     - POST /api/accounts/connect → a flagged demo account (demo:true,
 *       metadata.demoAccount:true) is created.
 *
 * PROBE = 'instagram': non-gated (so it is not permanently 'unavailable') but
 * has NO env credentials in the test env (.env.local ships only TWITTER_/
 * FACEBOOK_ demo creds), so it is the honest "not configured" / "demo tier"
 * platform. The route reads isDemoMode() fresh per request, so flipping
 * process.env.DEMO_MODE between calls needs no module re-import.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}))
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }))

import {
  makeRequest,
  mockSession,
  createTestWorkspace,
  readJson,
  testPrisma,
  disconnectTestPrisma,
  type TestWorkspace,
} from '../utils/integration'

// The gate must start OFF regardless of what the sourced shell env carries.
delete process.env.DEMO_MODE

const PROBE = 'instagram'

type Handler = (req: ReturnType<typeof makeRequest>) => Promise<Response>

interface PlatformsBody {
  demoMode: boolean
  tiers: { available: string[]; configurable: string[]; unavailable: string[]; demo: string[] }
  platforms: Array<{ id: string; tier: string; available: boolean }>
}

let connectPOST: Handler
let platformsGET: Handler
let ws: TestWorkspace

beforeAll(async () => {
  ;({ POST: connectPOST } = await import('@/app/api/accounts/connect/route'))
  ;({ GET: platformsGET } = await import('@/app/api/accounts/platforms/route'))
  ws = await createTestWorkspace({ name: 'Demo Gating' })
})

afterAll(async () => {
  delete process.env.DEMO_MODE
  await ws?.cleanup()
  await disconnectTestPrisma()
})

// ---------------------------------------------------------------------------
// DEMO_MODE unset — no fabrication anywhere
// ---------------------------------------------------------------------------

describe('DEMO_MODE unset — no demo fabrication', () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE
  })

  it('POST /api/accounts/connect (unconfigured provider) → 503 PLATFORM_NOT_CONFIGURED, no demo account', async () => {
    mockSession(ws.user)
    const before = await testPrisma.socialAccount.count({ where: { workspaceId: ws.workspace.id } })

    const res = await connectPOST(
      makeRequest('/api/accounts/connect', {
        method: 'POST',
        body: { provider: PROBE, workspaceId: ws.workspace.id },
      })
    )

    expect(res.status).toBe(503)
    const body = await readJson<{ code?: string; error?: string }>(res)
    expect(body.code).toBe('PLATFORM_NOT_CONFIGURED')

    // No SocialAccount created; nothing flagged as a demo account.
    const after = await testPrisma.socialAccount.findMany({ where: { workspaceId: ws.workspace.id } })
    expect(after.length).toBe(before)
    expect(
      after.some((a) => (a.metadata as Record<string, unknown> | null)?.demoAccount === true)
    ).toBe(false)
  })

  it('GET /api/accounts/platforms → NO platform in the demo tier', async () => {
    const res = await platformsGET(makeRequest('/api/accounts/platforms'))
    expect(res.status).toBe(200)

    const body = await readJson<PlatformsBody>(res)
    expect(body.demoMode).toBe(false)
    expect(body.tiers.demo).toEqual([])

    // The unconfigured probe is 'configurable' (set up later), NOT connectable now.
    const probe = body.platforms.find((p) => p.id === PROBE)
    expect(probe?.tier).toBe('configurable')
    expect(probe?.available).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DEMO_MODE=true — the demo path IS offered (proves the gate both ways)
// ---------------------------------------------------------------------------

describe('DEMO_MODE=true — demo path offered', () => {
  beforeEach(() => {
    process.env.DEMO_MODE = 'true'
  })

  afterAll(() => {
    delete process.env.DEMO_MODE
  })

  it('GET /api/accounts/platforms → the unconfigured provider is offered in the demo tier', async () => {
    const res = await platformsGET(makeRequest('/api/accounts/platforms'))
    expect(res.status).toBe(200)

    const body = await readJson<PlatformsBody>(res)
    expect(body.demoMode).toBe(true)
    expect(body.tiers.demo).toContain(PROBE)

    const probe = body.platforms.find((p) => p.id === PROBE)
    expect(probe?.tier).toBe('demo')
    expect(probe?.available).toBe(true)
  })

  it('POST /api/accounts/connect → fabricates a flagged demo account (demo:true, metadata.demoAccount:true)', async () => {
    mockSession(ws.user)
    const res = await connectPOST(
      makeRequest('/api/accounts/connect', {
        method: 'POST',
        body: { provider: PROBE, workspaceId: ws.workspace.id },
      })
    )

    expect(res.status).toBe(200)
    const body = await readJson<{ success?: boolean; demo?: boolean }>(res)
    expect(body.success).toBe(true)
    expect(body.demo).toBe(true)

    // A SocialAccount flagged metadata.demoAccount:true now exists.
    const accounts = await testPrisma.socialAccount.findMany({
      where: { workspaceId: ws.workspace.id },
    })
    expect(
      accounts.some((a) => (a.metadata as Record<string, unknown> | null)?.demoAccount === true)
    ).toBe(true)
  })
})
