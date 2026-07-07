/**
 * @jest-environment node
 *
 * ADR-0021 Track D — billing API net (codes to the ADR-0019 shared contract).
 *
 * Covers:
 *  - auth triple (401 / non-member / honest happy path) for
 *    POST /api/billing/checkout, POST /api/billing/portal,
 *    GET  /api/billing/subscription
 *  - webhook signature verification + idempotency + subscription sync
 *    (no network, no STRIPE_SECRET_KEY — signatures come from Stripe's own
 *    generateTestHeaderString test helper)
 *  - entitlement enforcement: FREE workspace at the socialAccounts limit
 *    gets 402 limit_exceeded from POST /api/accounts/connect
 *
 * The billing routes are dynamically imported in beforeAll so a missing
 * Track A route fails as a clear test error, not an import-time crash.
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

import Stripe from 'stripe'

import {
  makeRequest,
  mockSession,
  createTestWorkspace,
  seedSocialAccounts,
  disconnectTestPrisma,
  readJson,
  testPrisma,
  uid,
  type TestWorkspace,
} from '../utils/integration'

// Deterministic billing env for the whole suite. Routes MUST read these
// lazily (per contract — never module-scope Stripe construction), so setting
// them here, before the dynamic route imports in beforeAll, is sufficient.
delete process.env.STRIPE_SECRET_KEY // happy paths must be the honest 503
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_test_pro'
process.env.STRIPE_PRICE_BUSINESS_MONTHLY = 'price_test_business'

type Handler = (req: ReturnType<typeof makeRequest>) => Promise<Response>

let checkoutPOST: Handler
let portalPOST: Handler
let subscriptionGET: Handler
let webhookPOST: Handler

let owner: TestWorkspace // member (OWNER) of the target workspace
let outsider: TestWorkspace // authenticated, but NOT a member of owner's workspace

/** Stripe instance used ONLY to sign test webhook payloads (no network). */
const signer = new Stripe('sk_test_dummy')

function signedHeader(payload: string): string {
  return signer.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test' })
}

function webhookRequest(payload: string, signature?: string) {
  return makeRequest('/api/billing/webhook', {
    method: 'POST',
    body: payload, // raw string — signature covers the exact bytes
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature ?? signedHeader(payload),
    },
  })
}

function makeEventPayload(id: string, type: string, object: Record<string, unknown>): string {
  return JSON.stringify({
    id,
    object: 'event',
    api_version: '2025-05-28.basil',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  })
}

const createdEventIds: string[] = []

beforeAll(async () => {
  const load = async (segment: string) => {
    try {
      return await import(`@/app/api/billing/${segment}/route`)
    } catch (err) {
      throw new Error(
        `Track A route src/app/api/billing/${segment}/route.ts is missing or fails to import: ${err}`
      )
    }
  }
  ;[{ POST: checkoutPOST }, { POST: portalPOST }, { GET: subscriptionGET }, { POST: webhookPOST }] =
    await Promise.all([load('checkout'), load('portal'), load('subscription'), load('webhook')])

  owner = await createTestWorkspace({ name: 'Billing Owner' })
  outsider = await createTestWorkspace({ name: 'Billing Outsider' })
})

afterAll(async () => {
  if (createdEventIds.length > 0) {
    await testPrisma.stripeEvent.deleteMany({ where: { id: { in: createdEventIds } } })
  }
  await owner?.cleanup()
  await outsider?.cleanup()
  await disconnectTestPrisma()
})

// ---------------------------------------------------------------------------
// Auth triples
// ---------------------------------------------------------------------------

describe('POST /api/billing/checkout — auth triple', () => {
  const req = (workspaceId: string) =>
    makeRequest(`/api/billing/checkout?workspaceId=${workspaceId}`, {
      method: 'POST',
      body: { workspaceId, tier: 'PRO' },
    })

  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await checkoutPOST(req(owner.workspace.id))
    expect(res.status).toBe(401)
  })

  it('rejects a non-member of the target workspace (403/404, never success)', async () => {
    mockSession(outsider.user)
    const res = await checkoutPOST(req(owner.workspace.id))
    // requireWorkspaceRole returns 404 for non-members (ADR-0005
    // no-existence-leak); 403 also acceptable. Success is not.
    expect([403, 404]).toContain(res.status)
  })

  it('honest 503 stripe_not_configured for a member when STRIPE_SECRET_KEY is unset', async () => {
    mockSession(owner.user)
    const res = await checkoutPOST(req(owner.workspace.id))
    expect(res.status).toBe(503)
    const body = await readJson(res)
    expect(body.error).toBe('stripe_not_configured')
  })
})

describe('POST /api/billing/portal — auth triple', () => {
  const req = (workspaceId: string) =>
    makeRequest(`/api/billing/portal?workspaceId=${workspaceId}`, {
      method: 'POST',
      body: { workspaceId },
    })

  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await portalPOST(req(owner.workspace.id))
    expect(res.status).toBe(401)
  })

  it('rejects a non-member of the target workspace (403/404, never success)', async () => {
    mockSession(outsider.user)
    const res = await portalPOST(req(owner.workspace.id))
    expect([403, 404]).toContain(res.status)
  })

  it('honest 503 stripe_not_configured for a member when STRIPE_SECRET_KEY is unset', async () => {
    mockSession(owner.user)
    const res = await portalPOST(req(owner.workspace.id))
    expect(res.status).toBe(503)
    const body = await readJson(res)
    expect(body.error).toBe('stripe_not_configured')
  })
})

describe('GET /api/billing/subscription — auth triple', () => {
  const req = (workspaceId: string) =>
    makeRequest(`/api/billing/subscription?workspaceId=${workspaceId}`)

  it('401 when unauthenticated', async () => {
    mockSession(null)
    const res = await subscriptionGET(req(owner.workspace.id))
    expect(res.status).toBe(401)
  })

  it('rejects a non-member of the target workspace (403/404, never success)', async () => {
    mockSession(outsider.user)
    const res = await subscriptionGET(req(owner.workspace.id))
    expect([403, 404]).toContain(res.status)
  })

  it('200 with FREE entitlements + real usage + empty invoices for a member', async () => {
    mockSession(owner.user)
    const res = await subscriptionGET(req(owner.workspace.id))
    expect(res.status).toBe(200)
    const body = await readJson<{
      entitlements: {
        tier: string
        limits: Record<string, number | null>
        stripeConfigured: boolean
      }
      usage: Record<string, number>
      invoices: unknown[]
    }>(res)
    expect(body.entitlements).toBeDefined()
    expect(body.entitlements.tier).toBe('FREE') // no Subscription row → FREE
    expect(body.entitlements.limits.socialAccounts).toBe(3)
    expect(body.entitlements.stripeConfigured).toBe(false)
    expect(body.usage).toBeDefined()
    expect(typeof body.usage.socialAccounts).toBe('number')
    expect(body.invoices).toEqual([]) // no Stripe → honestly empty, never fabricated
  })
})

// ---------------------------------------------------------------------------
// Entitlement enforcement (Track B contract): FREE plan socialAccounts limit
// ---------------------------------------------------------------------------

describe('entitlement gate — POST /api/accounts/connect at the FREE socialAccounts limit', () => {
  let limited: TestWorkspace

  beforeAll(async () => {
    limited = await createTestWorkspace({ name: 'Billing Limited' })
    await seedSocialAccounts(limited.workspace.id, 3) // FREE limit = 3
  })

  afterAll(async () => {
    await limited.cleanup()
  })

  it('returns 402 limit_exceeded in the shared contract shape', async () => {
    const { POST: connectPOST } = await import('@/app/api/accounts/connect/route')
    mockSession(limited.user)
    const res = await connectPOST(
      makeRequest('/api/accounts/connect', {
        method: 'POST',
        body: { provider: 'twitter', workspaceId: limited.workspace.id },
      })
    )
    expect(res.status).toBe(402)
    const body = await readJson(res)
    expect(body).toMatchObject({
      error: 'limit_exceeded',
      limit: 'socialAccounts',
      current: 3,
      max: 3,
      upgradeUrl: '/dashboard/billing',
    })
  })
})

// ---------------------------------------------------------------------------
// Webhook: signature verification, idempotency, subscription sync.
// Kept LAST so nothing here can leak state into the 503 assertions above.
// ---------------------------------------------------------------------------

describe('POST /api/billing/webhook', () => {
  it('accepts a validly-signed unknown event type with 200 and records a StripeEvent row', async () => {
    const eventId = `evt_${uid('unknown')}`
    createdEventIds.push(eventId)
    const payload = makeEventPayload(eventId, 'customer.created', {
      id: `cus_${uid('x')}`,
      object: 'customer',
    })

    const res = await webhookPOST(webhookRequest(payload))
    expect(res.status).toBe(200)

    const row = await testPrisma.stripeEvent.findUnique({ where: { id: eventId } })
    expect(row).not.toBeNull()
    expect(row?.type).toBe('customer.created')
  })

  it('rejects a tampered payload / bad signature with 400 and stores nothing', async () => {
    const eventId = `evt_${uid('tamper')}`
    const payload = makeEventPayload(eventId, 'customer.created', {
      id: `cus_${uid('x')}`,
      object: 'customer',
    })
    const signatureForOriginal = signedHeader(payload)
    const tampered = payload.replace('"livemode":false', '"livemode":true')

    const res = await webhookPOST(webhookRequest(tampered, signatureForOriginal))
    expect(res.status).toBe(400)

    const row = await testPrisma.stripeEvent.findUnique({ where: { id: eventId } })
    expect(row).toBeNull()
  })

  it('is idempotent: replaying the same event id returns 200 duplicate:true and no second row', async () => {
    const eventId = `evt_${uid('dupe')}`
    createdEventIds.push(eventId)
    const payload = makeEventPayload(eventId, 'customer.created', {
      id: `cus_${uid('x')}`,
      object: 'customer',
    })

    const first = await webhookPOST(webhookRequest(payload))
    expect(first.status).toBe(200)

    const second = await webhookPOST(webhookRequest(payload))
    expect(second.status).toBe(200)
    const body = await readJson<{ duplicate?: boolean }>(second)
    expect(body.duplicate).toBe(true)

    const count = await testPrisma.stripeEvent.count({ where: { id: eventId } })
    expect(count).toBe(1)
  })

  it('customer.subscription.updated with the PRO price id upgrades the workspace Subscription to PRO/ACTIVE', async () => {
    const stripeCustomerId = `cus_${uid('sync')}`
    const stripeSubscriptionId = `sub_${uid('sync')}`
    await testPrisma.subscription.create({
      data: {
        workspaceId: owner.workspace.id,
        stripeCustomerId,
        stripeSubscriptionId,
        planTier: 'FREE',
        status: 'ACTIVE',
      },
    })

    const nowSec = Math.floor(Date.now() / 1000)
    const periodEnd = nowSec + 30 * 24 * 60 * 60
    const eventId = `evt_${uid('subupd')}`
    createdEventIds.push(eventId)
    const payload = makeEventPayload(eventId, 'customer.subscription.updated', {
      id: stripeSubscriptionId,
      object: 'subscription',
      customer: stripeCustomerId,
      status: 'active',
      cancel_at_period_end: false,
      current_period_start: nowSec,
      current_period_end: periodEnd,
      trial_end: null,
      items: {
        object: 'list',
        data: [
          {
            id: `si_${uid('x')}`,
            object: 'subscription_item',
            price: { id: 'price_test_pro', object: 'price' },
            current_period_start: nowSec,
            current_period_end: periodEnd,
          },
        ],
      },
    })

    const res = await webhookPOST(webhookRequest(payload))
    expect(res.status).toBe(200)

    const sub = await testPrisma.subscription.findUnique({
      where: { workspaceId: owner.workspace.id },
    })
    expect(sub?.planTier).toBe('PRO')
    expect(sub?.status).toBe('ACTIVE')
    expect(sub?.stripePriceId).toBe('price_test_pro')
  })
})
