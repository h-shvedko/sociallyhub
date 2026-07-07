/**
 * @jest-environment node
 *
 * ADR-0020 integration net (Track F1): report share links, the public share
 * surface, CLIENT_VIEWER portal scoping, and portal-invite plan gating —
 * against the REAL dev database, invoking route handlers directly.
 *
 * Covers:
 *  - POST/GET/DELETE /api/client-reports/[id]/share-links (guard chain,
 *    token-hash-only persistence, 409 for unshareable reports, idempotent revoke)
 *  - GET/POST /api/share/reports/[token] (anonymous snapshot render, the
 *    uniform-404 no-oracle property, password flow + HMAC access cookie,
 *    viewCount accounting)
 *  - CLIENT_VIEWER allowlist: forced clientId/status scope on
 *    GET /api/client-reports, 404 for out-of-scope reports, honest .html
 *    download labels
 *  - GET /api/portal/summary (viewer-only: 401/403/200)
 *  - POST /api/team/invite CLIENT_VIEWER gating (clientId required,
 *    402 feature_not_in_plan on FREE, clientId persisted on success)
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

// The invite route sends a real SMTP email + in-app notification best-effort;
// both are out of scope here (ADR-0011 verified email against Mailhog). Mock
// them so this suite is deterministic and leaves no SMTP/BullMQ handles open.
jest.mock('@/lib/notifications/email-service', () => ({
  emailService: { sendTeamInvitationEmail: jest.fn(async () => undefined) },
}))
jest.mock('@/lib/notifications/notify', () => ({
  notifyUser: jest.fn(async () => undefined),
}))

import crypto from 'crypto'

import {
  makeRequest,
  mockSession,
  createTestWorkspace,
  disconnectTestPrisma,
  readJson,
  testPrisma,
  uid,
  type TestWorkspace,
} from '../utils/integration'

import {
  POST as createShareLinkPOST,
  GET as listShareLinksGET,
} from '@/app/api/client-reports/[id]/share-links/route'
import { DELETE as revokeShareLinkDELETE } from '@/app/api/client-reports/[id]/share-links/[linkId]/route'
import {
  GET as publicShareGET,
  POST as publicSharePOST,
} from '@/app/api/share/reports/[token]/route'
import { GET as reportsListGET } from '@/app/api/client-reports/route'
import { GET as reportByIdGET } from '@/app/api/client-reports/[id]/route'
import { GET as reportDownloadGET } from '@/app/api/client-reports/[id]/download/route'
import { GET as portalSummaryGET } from '@/app/api/portal/summary/route'
import { POST as teamInvitePOST } from '@/app/api/team/invite/route'

import {
  generateShareToken,
  hashSharePassword,
} from '@/lib/sharing/report-share'
import { __setRateLimitRedisForTests } from '@/lib/utils/rate-limit'

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex')

/** Next 15 route context: params arrive as a Promise. */
const ctx = <T extends Record<string, string>>(params: T) => ({
  params: Promise.resolve(params),
})

const SHARE_PASSWORD = 'p0rtal-Pass!'

/** Frozen snapshot stored in ClientReport.data (the ONLY public render source). */
const SNAPSHOT_DATA = {
  dateRange: { start: '2026-06-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
  dataPoints: 12,
  sparse: false,
  growthRate: 4.2,
  metrics: {
    impressions: 1000,
    reach: 800,
    likes: 50,
    comments: 10,
    shares: 5,
    engagement: 65,
    clicks: 20,
    conversions: 3,
    followers: 200,
    pageViews: 40,
  },
  byMetricType: { likes: { total: 50, count: 10 } },
  byPlatform: { TWITTER: 500 },
}

// --- fixtures -------------------------------------------------------------
let agency: TestWorkspace // BUSINESS workspace; agency.user is OWNER
let freeWs: TestWorkspace // no Subscription row → FREE tier
let viewer: { id: string; email: string } // CLIENT_VIEWER scoped to clientA
let clientA: { id: string; name: string } // the viewer's client
let clientB: { id: string; name: string } // second client (exclusion proofs)
let freeClient: { id: string } // client inside the FREE workspace
let reportCompleted: { id: string; name: string } // clientA, COMPLETED + data
let reportDraft: { id: string } // clientA, DRAFT, no data
let reportOtherClient: { id: string } // clientB, COMPLETED + data

// Pre-seeded share links for the public-surface tests (independent of the
// POST tests; raw tokens exist only in this process).
let publicToken: string // usable, no password
let publicLinkId: string
let pwToken: string // usable, password-protected
let pwTokenHash: string
let revokedToken: string
let expiredToken: string

beforeAll(async () => {
  // Force the in-memory rate limiter so the public routes never open a Redis
  // connection from this suite (REDIS_URL is set by jest.setup.js).
  __setRateLimitRedisForTests(null)

  agency = await createTestWorkspace({ name: 'ShareLinks Agency' })
  freeWs = await createTestWorkspace({ name: 'ShareLinks Free' })

  await testPrisma.subscription.create({
    data: {
      workspaceId: agency.workspace.id,
      planTier: 'BUSINESS',
      status: 'ACTIVE',
    },
  })

  const clientARow = await testPrisma.client.create({
    data: {
      id: uid('itclient'),
      workspaceId: agency.workspace.id,
      name: 'Portal Client A',
      email: 'client-a@integration.test',
      company: 'A Corp',
    },
  })
  clientA = { id: clientARow.id, name: clientARow.name }

  const clientBRow = await testPrisma.client.create({
    data: {
      id: uid('itclient'),
      workspaceId: agency.workspace.id,
      name: 'Other Client B',
      email: 'client-b@integration.test',
    },
  })
  clientB = { id: clientBRow.id, name: clientBRow.name }

  const freeClientRow = await testPrisma.client.create({
    data: {
      id: uid('itclient'),
      workspaceId: freeWs.workspace.id,
      name: 'Free Tier Client',
      email: 'free-client@integration.test',
    },
  })
  freeClient = { id: freeClientRow.id }

  // CLIENT_VIEWER user, membership scoped to clientA.
  const viewerId = uid('itviewer')
  const viewerEmail = `${viewerId}@integration.test`
  await testPrisma.user.create({
    data: { id: viewerId, email: viewerEmail, name: 'Portal Viewer', emailVerified: new Date() },
  })
  await testPrisma.userWorkspace.create({
    data: {
      userId: viewerId,
      workspaceId: agency.workspace.id,
      role: 'CLIENT_VIEWER',
      clientId: clientA.id,
    },
  })
  viewer = { id: viewerId, email: viewerEmail }

  const completedRow = await testPrisma.clientReport.create({
    data: {
      workspaceId: agency.workspace.id,
      clientId: clientA.id,
      name: 'Monthly Report A',
      type: 'PERFORMANCE',
      format: 'PDF',
      frequency: 'MONTHLY',
      status: 'COMPLETED',
      data: SNAPSHOT_DATA,
      lastGenerated: new Date('2026-07-01T12:00:00Z'),
    },
  })
  reportCompleted = { id: completedRow.id, name: completedRow.name }

  const draftRow = await testPrisma.clientReport.create({
    data: {
      workspaceId: agency.workspace.id,
      clientId: clientA.id,
      name: 'Draft Report A',
      type: 'CUSTOM',
      format: 'PDF',
      frequency: 'ON_DEMAND',
      status: 'DRAFT',
    },
  })
  reportDraft = { id: draftRow.id }

  const otherRow = await testPrisma.clientReport.create({
    data: {
      workspaceId: agency.workspace.id,
      clientId: clientB.id,
      name: 'Monthly Report B',
      type: 'PERFORMANCE',
      format: 'PDF',
      frequency: 'MONTHLY',
      status: 'COMPLETED',
      data: SNAPSHOT_DATA,
      lastGenerated: new Date(),
    },
  })
  reportOtherClient = { id: otherRow.id }

  // Pre-seeded share links (raw tokens never persisted — only their hashes).
  const mkLink = async (
    overrides: Partial<{
      passwordHash: string | null
      expiresAt: Date | null
      revokedAt: Date | null
    }> = {}
  ) => {
    const { token, tokenHash } = generateShareToken()
    const row = await testPrisma.reportShareLink.create({
      data: {
        workspaceId: agency.workspace.id,
        reportId: reportCompleted.id,
        tokenHash,
        passwordHash: overrides.passwordHash ?? null,
        expiresAt:
          overrides.expiresAt === undefined
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : overrides.expiresAt,
        revokedAt: overrides.revokedAt ?? null,
        createdById: agency.user.id,
      },
    })
    return { token, tokenHash, id: row.id }
  }

  const plain = await mkLink()
  publicToken = plain.token
  publicLinkId = plain.id

  const pw = await mkLink({ passwordHash: await hashSharePassword(SHARE_PASSWORD) })
  pwToken = pw.token
  pwTokenHash = pw.tokenHash

  revokedToken = (await mkLink({ revokedAt: new Date() })).token
  expiredToken = (await mkLink({ expiresAt: new Date(Date.now() - 1000) })).token
})

afterAll(async () => {
  const wsIds = [agency?.workspace.id, freeWs?.workspace.id].filter(Boolean) as string[]
  if (wsIds.length > 0) {
    // FK order: share links → invitations → reports → viewer membership/user → clients.
    await testPrisma.reportShareLink.deleteMany({ where: { workspaceId: { in: wsIds } } })
    await testPrisma.teamInvitation.deleteMany({ where: { workspaceId: { in: wsIds } } })
    await testPrisma.clientReport.deleteMany({ where: { workspaceId: { in: wsIds } } })
  }
  if (viewer) {
    await testPrisma.userWorkspace.deleteMany({ where: { userId: viewer.id } })
    await testPrisma.user.deleteMany({ where: { id: viewer.id } })
  }
  if (wsIds.length > 0) {
    await testPrisma.client.deleteMany({ where: { workspaceId: { in: wsIds } } })
  }
  await agency?.cleanup()
  await freeWs?.cleanup()
  await disconnectTestPrisma()
})

// ---------------------------------------------------------------------------
// POST /api/client-reports/[id]/share-links
// ---------------------------------------------------------------------------

describe('POST /api/client-reports/[id]/share-links', () => {
  const url = (id: string) => `/api/client-reports/${id}/share-links`

  it('201 for an OWNER: returns the raw token ONCE; DB stores only sha256(token)', async () => {
    mockSession(agency.user)
    const res = await createShareLinkPOST(
      makeRequest(url(reportCompleted.id), { method: 'POST', body: {} }),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(201)
    const body = await readJson<{
      shareLink: {
        id: string
        createdAt: string
        expiresAt: string | null
        hasPassword: boolean
        viewCount: number
      }
      token: string
      url: string
    }>(res)

    // Pinned 201 shape.
    expect(typeof body.shareLink.id).toBe('string')
    expect(body.shareLink.hasPassword).toBe(false)
    expect(body.shareLink.viewCount).toBe(0)
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThanOrEqual(40)
    expect(body.url).toContain(`/share/reports/${body.token}`)

    // Default expiry ≈ 30 days out.
    expect(body.shareLink.expiresAt).not.toBeNull()
    const deltaMs = new Date(body.shareLink.expiresAt!).getTime() - Date.now()
    expect(deltaMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect(deltaMs).toBeLessThan(31 * 24 * 60 * 60 * 1000)

    // DB row: hash of the token, and the raw token appears NOWHERE.
    const row = await testPrisma.reportShareLink.findUnique({
      where: { id: body.shareLink.id },
    })
    expect(row).not.toBeNull()
    expect(row!.tokenHash).toBe(sha256(body.token))
    expect(JSON.stringify(row)).not.toContain(body.token)
  })

  it('409 REPORT_NOT_SHAREABLE for a DRAFT report (no snapshot)', async () => {
    mockSession(agency.user)
    const res = await createShareLinkPOST(
      makeRequest(url(reportDraft.id), { method: 'POST', body: {} }),
      ctx({ id: reportDraft.id })
    )
    expect(res.status).toBe(409)
    const body = await readJson<{ error: string; code?: string }>(res)
    expect(body.code).toBe('REPORT_NOT_SHAREABLE')
  })

  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await createShareLinkPOST(
      makeRequest(url(reportCompleted.id), { method: 'POST', body: {} }),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(401)
  })

  it('403 for a CLIENT_VIEWER (not a manager role)', async () => {
    mockSession(viewer)
    const res = await createShareLinkPOST(
      makeRequest(url(reportCompleted.id), { method: 'POST', body: {} }),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(403)
  })

  it('404 for an authenticated non-member (no existence leak)', async () => {
    mockSession(freeWs.user)
    const res = await createShareLinkPOST(
      makeRequest(url(reportCompleted.id), { method: 'POST', body: {} }),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /api/client-reports/[id]/share-links
// ---------------------------------------------------------------------------

describe('GET /api/client-reports/[id]/share-links', () => {
  it('lists links with hasPassword/active and NEVER tokenHash/passwordHash', async () => {
    mockSession(agency.user)
    const res = await listShareLinksGET(
      makeRequest(`/api/client-reports/${reportCompleted.id}/share-links`),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(200)
    const body = await readJson<{ shareLinks: Array<Record<string, unknown>> }>(res)
    expect(body.shareLinks.length).toBeGreaterThanOrEqual(4) // the seeded links

    for (const link of body.shareLinks) {
      expect(typeof link.id).toBe('string')
      expect(typeof link.hasPassword).toBe('boolean')
      expect(typeof link.active).toBe('boolean')
      expect(typeof link.viewCount).toBe('number')
      expect('createdAt' in link).toBe(true)
      expect('expiresAt' in link).toBe(true)
      expect('revokedAt' in link).toBe(true)
      expect('lastAccessedAt' in link).toBe(true)
      // Secrets never serialized.
      expect('tokenHash' in link).toBe(false)
      expect('passwordHash' in link).toBe(false)
      expect('token' in link).toBe(false)
    }

    // active reflects usability: the revoked + expired seeds must be inactive.
    const inactive = body.shareLinks.filter((l) => l.active === false)
    expect(inactive.length).toBeGreaterThanOrEqual(2)
    // hasPassword true for the password-protected seed.
    expect(body.shareLinks.some((l) => l.hasPassword === true)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/client-reports/[id]/share-links/[linkId] — idempotent revoke
// ---------------------------------------------------------------------------

describe('DELETE /api/client-reports/[id]/share-links/[linkId]', () => {
  it('revokes (sets revokedAt) and stays 200 + unchanged on replay', async () => {
    // Fresh link to revoke, created through the real POST route.
    mockSession(agency.user)
    const createRes = await createShareLinkPOST(
      makeRequest(`/api/client-reports/${reportCompleted.id}/share-links`, {
        method: 'POST',
        body: {},
      }),
      ctx({ id: reportCompleted.id })
    )
    expect(createRes.status).toBe(201)
    const { shareLink } = await readJson<{ shareLink: { id: string } }>(createRes)

    mockSession(agency.user)
    const del1 = await revokeShareLinkDELETE(
      makeRequest(`/api/client-reports/${reportCompleted.id}/share-links/${shareLink.id}`, {
        method: 'DELETE',
      }),
      ctx({ id: reportCompleted.id, linkId: shareLink.id })
    )
    expect(del1.status).toBe(200)
    expect(await readJson(del1)).toEqual({ success: true })

    const afterFirst = await testPrisma.reportShareLink.findUnique({
      where: { id: shareLink.id },
    })
    expect(afterFirst?.revokedAt).not.toBeNull()

    // Idempotent: second DELETE still 200, original revokedAt preserved.
    mockSession(agency.user)
    const del2 = await revokeShareLinkDELETE(
      makeRequest(`/api/client-reports/${reportCompleted.id}/share-links/${shareLink.id}`, {
        method: 'DELETE',
      }),
      ctx({ id: reportCompleted.id, linkId: shareLink.id })
    )
    expect(del2.status).toBe(200)
    expect(await readJson(del2)).toEqual({ success: true })

    const afterSecond = await testPrisma.reportShareLink.findUnique({
      where: { id: shareLink.id },
    })
    expect(afterSecond?.revokedAt?.getTime()).toBe(afterFirst?.revokedAt?.getTime())
  })
})

// ---------------------------------------------------------------------------
// PUBLIC surface: GET/POST /api/share/reports/[token]
// ---------------------------------------------------------------------------

describe('GET /api/share/reports/[token] (public, anonymous)', () => {
  const get = (token: string, headers?: Record<string, string>) =>
    publicShareGET(makeRequest(`/api/share/reports/${token}`, { headers }), ctx({ token }))

  it('renders the frozen snapshot for a valid token and increments viewCount', async () => {
    mockSession(null) // anonymous by design
    const before = await testPrisma.reportShareLink.findUnique({
      where: { id: publicLinkId },
    })

    const res = await get(publicToken)
    expect(res.status).toBe(200)
    const body = await readJson<{
      passwordRequired: boolean
      report: Record<string, unknown>
      data: unknown
      branding: unknown
    }>(res)

    expect(body.passwordRequired).toBe(false)
    expect(body.report).toMatchObject({
      name: reportCompleted.name,
      type: 'PERFORMANCE',
      clientName: clientA.name,
      frequency: 'MONTHLY',
    })
    expect(typeof body.report.generatedAt).toBe('string')
    expect(body.data).toEqual(SNAPSHOT_DATA) // snapshot-only render source
    expect(body.branding).toBeNull() // no ClientBranding row seeded

    const after = await testPrisma.reportShareLink.findUnique({
      where: { id: publicLinkId },
    })
    expect(after!.viewCount).toBe(before!.viewCount + 1)
    expect(after!.lastAccessedAt).not.toBeNull()
  })

  it('uniform 404: revoked, expired, unknown, and malformed tokens are indistinguishable', async () => {
    mockSession(null)
    const unknownToken = 'x'.repeat(43) // plausible shape, not in the DB
    const malformedToken = '!not-base64url!'

    const responses = await Promise.all([
      get(revokedToken),
      get(expiredToken),
      get(unknownToken),
      get(malformedToken),
    ])
    const bodies = []
    for (const res of responses) {
      expect(res.status).toBe(404)
      bodies.push(await readJson(res))
    }
    // The no-oracle property: byte-identical error bodies.
    expect(bodies[1]).toEqual(bodies[0])
    expect(bodies[2]).toEqual(bodies[0])
    expect(bodies[3]).toEqual(bodies[0])
  })

  it('password-protected link without a cookie → { passwordRequired: true }, nothing leaked, no count', async () => {
    mockSession(null)
    const res = await get(pwToken)
    expect(res.status).toBe(200)
    const body = await readJson<Record<string, unknown>>(res)
    expect(body).toEqual({ passwordRequired: true }) // no report/data/branding keys

    const row = await testPrisma.reportShareLink.findUnique({
      where: { tokenHash: pwTokenHash },
    })
    expect(row!.viewCount).toBe(0) // gated request does not count
  })
})

describe('POST /api/share/reports/[token] (password verification)', () => {
  const post = (token: string, body?: unknown) =>
    publicSharePOST(
      makeRequest(`/api/share/reports/${token}`, { method: 'POST', body }),
      ctx({ token })
    )

  it('400 when the link has no password', async () => {
    mockSession(null)
    const res = await post(publicToken, { password: 'anything' })
    expect(res.status).toBe(400)
  })

  it('401 Invalid password for a wrong password', async () => {
    mockSession(null)
    const res = await post(pwToken, { password: 'wrong-password' })
    expect(res.status).toBe(401)
    const body = await readJson<{ error: string }>(res)
    expect(body.error).toBe('Invalid password')
  })

  it('404 (uniform) for an unusable token even with a password body', async () => {
    mockSession(null)
    const res = await post(revokedToken, { password: SHARE_PASSWORD })
    expect(res.status).toBe(404)
    expect(await readJson(res)).toEqual({ error: 'Not found' })
  })

  it('correct password → 200 + HttpOnly access cookie; replaying GET with it unlocks the snapshot', async () => {
    mockSession(null)
    const res = await post(pwToken, { password: SHARE_PASSWORD })
    expect(res.status).toBe(200)
    expect(await readJson(res)).toEqual({ success: true })

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).not.toBeNull()
    const expectedName = `sh_access_${pwTokenHash.slice(0, 16)}`
    expect(setCookie!).toContain(`${expectedName}=`)
    expect(setCookie!.toLowerCase()).toContain('httponly')

    // Extract "name=value" (up to the first attribute separator).
    const pair = setCookie!.split(';')[0]

    mockSession(null)
    const replay = await publicShareGET(
      makeRequest(`/api/share/reports/${pwToken}`, { headers: { cookie: pair } }),
      ctx({ token: pwToken })
    )
    expect(replay.status).toBe(200)
    const body = await readJson<{
      passwordRequired: boolean
      report: { name: string }
      data: unknown
    }>(replay)
    expect(body.passwordRequired).toBe(false)
    expect(body.report.name).toBe(reportCompleted.name)
    expect(body.data).toEqual(SNAPSHOT_DATA)
  })
})

// ---------------------------------------------------------------------------
// CLIENT_VIEWER scoping on the agency report routes
// ---------------------------------------------------------------------------

describe('CLIENT_VIEWER scoping', () => {
  it('GET /api/client-reports is forced to the viewer’s own client + delivered statuses', async () => {
    mockSession(viewer)
    const res = await reportsListGET(makeRequest('/api/client-reports'))
    expect(res.status).toBe(200)
    const body = await readJson<{
      reports: Array<{ id: string; clientId: string; status: string }>
    }>(res)

    expect(body.reports.length).toBeGreaterThanOrEqual(1)
    for (const report of body.reports) {
      expect(report.clientId).toBe(clientA.id)
      expect(['COMPLETED', 'SENT']).toContain(report.status)
    }
    const ids = body.reports.map((r) => r.id)
    expect(ids).toContain(reportCompleted.id)
    expect(ids).not.toContain(reportOtherClient.id) // other client excluded
    expect(ids).not.toContain(reportDraft.id) // undelivered status excluded
  })

  it("GET /api/client-reports?clientId=<other> cannot widen the scope", async () => {
    mockSession(viewer)
    const res = await reportsListGET(
      makeRequest(`/api/client-reports?clientId=${clientB.id}&status=DRAFT`)
    )
    expect(res.status).toBe(200)
    const body = await readJson<{
      reports: Array<{ id: string; clientId: string; status: string }>
    }>(res)
    for (const report of body.reports) {
      expect(report.clientId).toBe(clientA.id)
      expect(['COMPLETED', 'SENT']).toContain(report.status)
    }
  })

  it("GET /api/client-reports/[id] for the OTHER client's report → 404 (no existence leak)", async () => {
    mockSession(viewer)
    const res = await reportByIdGET(
      makeRequest(`/api/client-reports/${reportOtherClient.id}`),
      ctx({ id: reportOtherClient.id })
    )
    expect(res.status).toBe(404)
  })

  it('GET /api/client-reports/[id] for an own-client DRAFT → 404 (undelivered)', async () => {
    mockSession(viewer)
    const res = await reportByIdGET(
      makeRequest(`/api/client-reports/${reportDraft.id}`),
      ctx({ id: reportDraft.id })
    )
    expect(res.status).toBe(404)
  })

  it('GET /api/client-reports/[id] for the own delivered report → 200', async () => {
    mockSession(viewer)
    const res = await reportByIdGET(
      makeRequest(`/api/client-reports/${reportCompleted.id}`),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(200)
    const body = await readJson<{ report: { id: string } }>(res)
    expect(body.report.id).toBe(reportCompleted.id)
  })

  it('download of the own delivered report → 200 with an honest .html label (never .pdf.html)', async () => {
    mockSession(viewer)
    const res = await reportDownloadGET(
      makeRequest(`/api/client-reports/${reportCompleted.id}/download`),
      ctx({ id: reportCompleted.id })
    )
    expect(res.status).toBe(200)
    const disposition = res.headers.get('content-disposition')
    expect(disposition).not.toBeNull()
    expect(disposition!).toMatch(/attachment; filename=".*\.html"$/)
    expect(disposition!).not.toContain('.pdf')
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it("download of the OTHER client's report → 404", async () => {
    mockSession(viewer)
    const res = await reportDownloadGET(
      makeRequest(`/api/client-reports/${reportOtherClient.id}/download`),
      ctx({ id: reportOtherClient.id })
    )
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /api/portal/summary
// ---------------------------------------------------------------------------

describe('GET /api/portal/summary', () => {
  it('200 for a CLIENT_VIEWER with their own client + honest aggregated summary', async () => {
    mockSession(viewer)
    const res = await portalSummaryGET()
    expect(res.status).toBe(200)
    const body = await readJson<{
      client: { id: string; name: string; company: string | null }
      workspace: { name: string }
      branding: unknown
      summary: { dataPoints: number; sparse: boolean; metrics: Record<string, number> }
      reports: { total: number; lastGeneratedAt: string | null }
    }>(res)

    expect(body.client.id).toBe(clientA.id)
    expect(body.client.name).toBe(clientA.name)
    expect(body.workspace.name).toBe(agency.workspace.name)
    expect(body.branding).toBeNull()
    expect(typeof body.summary.dataPoints).toBe('number')
    expect(typeof body.summary.sparse).toBe('boolean')
    expect(body.summary.metrics).toBeDefined()
    expect(body.reports.total).toBeGreaterThanOrEqual(1) // the COMPLETED report
    expect(body.reports.lastGeneratedAt).not.toBeNull()
  })

  it('403 for an agency OWNER (not a portal identity)', async () => {
    mockSession(agency.user)
    const res = await portalSummaryGET()
    expect(res.status).toBe(403)
  })

  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await portalSummaryGET()
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /api/team/invite — CLIENT_VIEWER portal-invite gating (ADR-0020)
// ---------------------------------------------------------------------------

describe('POST /api/team/invite — CLIENT_VIEWER gating', () => {
  const invite = (body: Record<string, unknown>) =>
    teamInvitePOST(makeRequest('/api/team/invite', { method: 'POST', body }))

  it('400 when role=CLIENT_VIEWER but clientId is missing', async () => {
    mockSession(agency.user)
    const res = await invite({
      email: `${uid('invitee')}@integration.test`,
      role: 'CLIENT_VIEWER',
      workspaceId: agency.workspace.id,
    })
    expect(res.status).toBe(400)
  })

  it('400 when a non-CLIENT_VIEWER role carries a clientId', async () => {
    mockSession(agency.user)
    const res = await invite({
      email: `${uid('invitee')}@integration.test`,
      role: 'PUBLISHER',
      workspaceId: agency.workspace.id,
      clientId: clientA.id,
    })
    expect(res.status).toBe(400)
  })

  it("404 when the clientId belongs to a different workspace", async () => {
    mockSession(agency.user)
    const res = await invite({
      email: `${uid('invitee')}@integration.test`,
      role: 'CLIENT_VIEWER',
      workspaceId: agency.workspace.id,
      clientId: freeClient.id, // client of freeWs, not of agency
    })
    expect(res.status).toBe(404)
  })

  it('402 feature_not_in_plan on a FREE workspace', async () => {
    mockSession(freeWs.user)
    const res = await invite({
      email: `${uid('invitee')}@integration.test`,
      role: 'CLIENT_VIEWER',
      workspaceId: freeWs.workspace.id,
      clientId: freeClient.id,
    })
    expect(res.status).toBe(402)
    const body = await readJson(res)
    expect(body).toMatchObject({
      error: 'feature_not_in_plan',
      feature: 'clientPortal',
      tier: 'FREE',
      upgradeUrl: '/dashboard/billing',
    })
  })

  it('succeeds on the BUSINESS workspace and persists clientId on the TeamInvitation', async () => {
    const email = `${uid('invitee')}@integration.test`
    mockSession(agency.user)
    const res = await invite({
      email,
      role: 'CLIENT_VIEWER',
      workspaceId: agency.workspace.id,
      clientId: clientA.id,
    })
    expect([200, 201]).toContain(res.status)
    const body = await readJson<{ success: boolean }>(res)
    expect(body.success).toBe(true)

    const row = await testPrisma.teamInvitation.findFirst({
      where: { email, workspaceId: agency.workspace.id },
    })
    expect(row).not.toBeNull()
    expect(row!.role).toBe('CLIENT_VIEWER')
    expect(row!.clientId).toBe(clientA.id)
    expect(row!.status).toBe('PENDING')
  })
})
