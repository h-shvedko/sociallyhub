/**
 * @jest-environment node
 *
 * ADR-0023 Track F1 — integration net for the observability endpoints, on the
 * billing.test.ts harness (real dev Postgres; only next-auth's getServerSession
 * is mocked). Handlers are imported and invoked directly.
 *
 * Covers:
 *  - GET /api/health          — real dependency report, degrades (never 500s),
 *                               no filesystem key, worker 'disabled' when
 *                               WORKER_EXPECTED is unset.
 *  - GET /api/metrics         — open Prometheus exposition; METRICS_TOKEN bearer
 *                               gate (401 without / 200 with).
 *  - GET /api/monitoring/metrics — platform-admin only; HONEST numbers (numeric
 *                               uptime not '99.9%', deterministic errorRate).
 *  - GET /api/clients/stats   — real DB counts, NONE of the dropped fabricated
 *                               fields.
 *  - GET /api/campaigns/analytics — no fabricated age/gender/location demographics.
 */
// NOTE: use the GLOBAL jest for jest.mock() — importing jest from '@jest/globals'
// shadows the global and defeats SWC mock hoisting.
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(),
  getServerSession: jest.fn(),
}))

// ESM-only package; the jest transform skips node_modules — stub it so importing
// authOptions (via '@/lib/auth') does not fail to parse.
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }))

// Mock ioredis so the /api/health dependency probe is deterministic and opens
// NO real socket (no dangling handle keeping jest alive). The health route uses
// only on/ping/get; queue-manager's module-scope `new QueueManager()` uses
// on() and never issues a command in tests. BullMQ Queue/Worker are never
// constructed at import, so this thin double is sufficient.
jest.mock('ioredis', () => {
  const instance = {
    on: jest.fn(),
    ping: jest.fn(async () => 'PONG'),
    get: jest.fn(async () => null),
    quit: jest.fn(async () => 'OK'),
    disconnect: jest.fn(),
  }
  const Redis = jest.fn(() => instance)
  return { __esModule: true, default: Redis }
})

import {
  makeRequest,
  mockSession,
  createTestWorkspace,
  disconnectTestPrisma,
  readJson,
  testPrisma,
  type TestWorkspace,
} from '../utils/integration'

import { recordHttpMetric } from '@/lib/observability/metrics'
import { GET as healthGET } from '@/app/api/health/route'
import { GET as metricsGET } from '@/app/api/metrics/route'
import { GET as monitoringGET } from '@/app/api/monitoring/metrics/route'
import { GET as clientStatsGET } from '@/app/api/clients/stats/route'
import { GET as campaignsAnalyticsGET } from '@/app/api/campaigns/analytics/route'

afterAll(async () => {
  await disconnectTestPrisma()
})

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  const savedWorkerExpected = process.env.WORKER_EXPECTED

  beforeAll(() => {
    delete process.env.WORKER_EXPECTED // worker check must report 'disabled'
  })

  afterAll(() => {
    if (savedWorkerExpected === undefined) delete process.env.WORKER_EXPECTED
    else process.env.WORKER_EXPECTED = savedWorkerExpected
  })

  it('reports a healthy DB, redis present, no filesystem key, disabled worker — and never 500s', async () => {
    const res = await healthGET(makeRequest('/api/health'))
    expect(res.status).toBe(200)

    const body = await readJson<{
      status: string
      services: {
        database: { status: string }
        redis?: { status: string }
        filesystem?: unknown
        worker: { status: string }
      }
    }>(res)

    // Real dev DB is up under the harness.
    expect(body.services.database.status).toBe('healthy')
    // Redis is present as a reported service.
    expect(body.services.redis).toBeDefined()
    // The misleading filesystem write-test was removed (ADR-0023).
    expect(body.services).not.toHaveProperty('filesystem')
    // Worker liveness is 'disabled' until WORKER_EXPECTED=true.
    expect(body.services.worker.status).toBe('disabled')
    // DB healthy => overall is healthy or degraded, never unhealthy / thrown 500.
    expect(['healthy', 'degraded']).toContain(body.status)
  })
})

// ---------------------------------------------------------------------------
// GET /api/metrics — Prometheus exposition + METRICS_TOKEN bearer gate
// ---------------------------------------------------------------------------

describe('GET /api/metrics', () => {
  const savedToken = process.env.METRICS_TOKEN

  beforeAll(() => {
    // Guarantee at least one http_requests_total sample exists in the exposition.
    recordHttpMetric({ method: 'GET', pathname: '/api/warmup/123', status: 200, durationMs: 5 })
  })

  afterAll(() => {
    if (savedToken === undefined) delete process.env.METRICS_TOKEN
    else process.env.METRICS_TOKEN = savedToken
  })

  it('serves open Prometheus text (http + business series + HELP) when METRICS_TOKEN is unset', async () => {
    delete process.env.METRICS_TOKEN
    const res = await metricsGET(makeRequest('/api/metrics'))
    expect(res.status).toBe(200)

    const text = await res.text()
    expect(text).toContain('http_requests_total')
    expect(text).toContain('sociallyhub_users_total')
    expect(text).toContain('# HELP')
  })

  it('401s without a bearer token when METRICS_TOKEN is set', async () => {
    process.env.METRICS_TOKEN = 'secret'
    const res = await metricsGET(makeRequest('/api/metrics'))
    expect(res.status).toBe(401)
  })

  it('200s with the correct bearer token when METRICS_TOKEN is set', async () => {
    process.env.METRICS_TOKEN = 'secret'
    const res = await metricsGET(
      makeRequest('/api/metrics', { headers: { Authorization: 'Bearer secret' } })
    )
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// GET /api/monitoring/metrics — platform-admin only, honest numbers
// ---------------------------------------------------------------------------

describe('GET /api/monitoring/metrics', () => {
  let admin: TestWorkspace

  beforeAll(async () => {
    admin = await createTestWorkspace({ name: 'Obs Admin' })
    await testPrisma.user.update({
      where: { id: admin.user.id },
      data: { isPlatformAdmin: true },
    })
  })

  afterAll(async () => {
    await admin.cleanup()
  })

  it('rejects a non-platform-admin (403)', async () => {
    const nonAdmin = await createTestWorkspace({ name: 'Obs NonAdmin' })
    try {
      mockSession(nonAdmin.user)
      const res = await monitoringGET(makeRequest('/api/monitoring/metrics'))
      expect(res.status).toBe(403)
    } finally {
      await nonAdmin.cleanup()
    }
  })

  it('returns honest metrics: numeric uptime (never "99.9%"), deterministic errorRate, real totalUsers', async () => {
    mockSession(admin.user)

    // Warm up so at least one request is recorded — errorRate/avgResponseTime
    // become non-null, and the value is stable across the two measured calls
    // (proving it is a real series, not a per-call Math.random() float).
    await monitoringGET(makeRequest('/api/monitoring/metrics'))
    const r1 = await readJson<{
      uptime: unknown
      errorRate: number | null
      avgResponseTime: number | null
      totalUsers: unknown
      totalRequests: number | null
    }>(await monitoringGET(makeRequest('/api/monitoring/metrics')))
    const r2 = await readJson<{ errorRate: number | null }>(
      await monitoringGET(makeRequest('/api/monitoring/metrics'))
    )

    // uptime is numeric seconds, not the deleted hardcoded percentage string.
    expect(typeof r1.uptime).toBe('number')
    expect(JSON.stringify(r1)).not.toContain('99.9%')

    // errorRate is null-or-number and DETERMINISTIC across calls (no fabrication).
    expect(r1.errorRate === null || typeof r1.errorRate === 'number').toBe(true)
    expect(r1.errorRate).toBe(r2.errorRate)

    // Real DB-derived counts are present.
    expect(typeof r1.totalUsers).toBe('number')
    expect(r1.totalUsers as number).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// GET /api/clients/stats — real counts, no fabricated fields
// ---------------------------------------------------------------------------

describe('GET /api/clients/stats', () => {
  let owner: TestWorkspace

  beforeAll(async () => {
    owner = await createTestWorkspace({ name: 'Obs Clients' })
  })

  afterAll(async () => {
    await owner.cleanup()
  })

  it('returns real totalClients and NONE of the dropped fabricated fields', async () => {
    mockSession(owner.user)
    const res = await clientStatsGET(makeRequest('/api/clients/stats'))
    expect(res.status).toBe(200)

    const body = await readJson<Record<string, unknown>>(res)
    expect(typeof body.totalClients).toBe('number')

    const dropped = [
      'clientSatisfactionScore',
      'acquisitionCost',
      'clientsByIndustry',
      'projectedRevenue',
    ]
    for (const key of dropped) {
      expect(body).not.toHaveProperty(key)
    }
    const serialized = JSON.stringify(body)
    for (const key of dropped) {
      expect(serialized).not.toContain(key)
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/campaigns/analytics — no fabricated demographics
// ---------------------------------------------------------------------------

describe('GET /api/campaigns/analytics', () => {
  let owner: TestWorkspace

  beforeAll(async () => {
    owner = await createTestWorkspace({ name: 'Obs Campaigns' })
  })

  afterAll(async () => {
    await owner.cleanup()
  })

  it('omits fabricated age/gender/location demographics', async () => {
    mockSession(owner.user)
    const res = await campaignsAnalyticsGET(
      makeRequest(`/api/campaigns/analytics?workspaceId=${owner.workspace.id}`)
    )
    expect(res.status).toBe(200)

    const body = await readJson<{ demographics?: Record<string, unknown> }>(res)
    expect(body.demographics).toBeDefined()

    const forbidden = ['ageGroups', 'genders', 'locations']
    for (const key of forbidden) {
      expect(body.demographics).not.toHaveProperty(key)
    }
    const serialized = JSON.stringify(body)
    for (const key of forbidden) {
      expect(serialized).not.toContain(key)
    }
  })
})
