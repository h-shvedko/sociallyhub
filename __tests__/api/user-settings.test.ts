/**
 * @jest-environment node
 *
 * ADR-0021 Track D — pattern-setter suite for the auth-triple net on a
 * repaired non-billing route: /api/user/settings (ADR-0017).
 *
 * Pattern every new API suite should copy:
 *   1. jest.mock('next-auth') at the top (hoisted above imports).
 *   2. Import the harness BEFORE the route module.
 *   3. mockSession(user | null) per test; real DB fixtures via
 *      createTestWorkspace(); cleanup + disconnect in afterAll.
 */
// NOTE: use the GLOBAL jest for jest.mock() — importing jest from '@jest/globals'
// shadows the global and defeats SWC mock hoisting (see utils/jest-globals.d.ts).
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

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
import { GET as settingsGET, PUT as settingsPUT } from '@/app/api/user/settings/route'

let ws: TestWorkspace

beforeAll(async () => {
  ws = await createTestWorkspace({ name: 'User Settings Suite' })
})

afterAll(async () => {
  await ws.cleanup() // also removes the UserSettings row created by GET
  await disconnectTestPrisma()
})

describe('GET /api/user/settings', () => {
  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await settingsGET()
    expect(res.status).toBe(401)
    const body = await readJson(res)
    expect(body.error).toBe('Unauthorized')
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('200 and lazily creates default settings for a fresh user', async () => {
    mockSession(ws.user)
    const res = await settingsGET()
    expect(res.status).toBe(200)
    const body = await readJson<{ settings: Record<string, unknown> }>(res)
    expect(body.settings).toMatchObject({
      userId: ws.user.id,
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
    })

    // Persisted for real, not fabricated in the response
    const row = await testPrisma.userSettings.findUnique({ where: { userId: ws.user.id } })
    expect(row).not.toBeNull()
  })
})

describe('PUT /api/user/settings', () => {
  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await settingsPUT(
      makeRequest('/api/user/settings', { method: 'PUT', body: { theme: 'dark' } })
    )
    expect(res.status).toBe(401)
  })

  it('400 for an invalid theme value', async () => {
    mockSession(ws.user)
    const res = await settingsPUT(
      makeRequest('/api/user/settings', { method: 'PUT', body: { theme: 'neon' } })
    )
    expect(res.status).toBe(400)
    const body = await readJson(res)
    expect(body.error).toBe('Invalid value for theme')
  })

  it('200 for a valid update and persists it', async () => {
    mockSession(ws.user)
    const res = await settingsPUT(
      makeRequest('/api/user/settings', {
        method: 'PUT',
        body: { theme: 'dark', compactMode: true },
      })
    )
    expect(res.status).toBe(200)
    const body = await readJson<{ settings: { theme: string; compactMode: boolean } }>(res)
    expect(body.settings.theme).toBe('dark')
    expect(body.settings.compactMode).toBe(true)

    const row = await testPrisma.userSettings.findUnique({ where: { userId: ws.user.id } })
    expect(row?.theme).toBe('dark')
    expect(row?.compactMode).toBe(true)
  })
})
