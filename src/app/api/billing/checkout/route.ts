// POST /api/billing/checkout (ADR-0019 Track A).
//
// Creates a Stripe Checkout Session for upgrading a workspace to a paid
// tier. OWNER-only. Fails honestly with 503 { error: 'stripe_not_configured' }
// when Stripe env is absent — there is NEVER a fake success.

import { NextRequest, NextResponse } from 'next/server'

import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
import { priceIdForTier } from '@/lib/billing/plans'
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe'

export const dynamic = 'force-dynamic'

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3099'
  ).replace(/\/$/, '')
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession()

    const body = await request.json().catch(() => null)
    const workspaceId: unknown = body?.workspaceId
    const tier: unknown = body?.tier

    if (typeof workspaceId !== 'string' || !workspaceId) {
      return jsonError(400, 'workspaceId is required')
    }
    if (tier !== 'PRO' && tier !== 'BUSINESS') {
      return jsonError(400, "tier must be 'PRO' or 'BUSINESS'")
    }

    // Only the workspace OWNER may change billing.
    await requireWorkspaceRole(workspaceId, ['OWNER'])

    if (!isStripeConfigured()) {
      return jsonError(503, 'stripe_not_configured')
    }
    const priceId = priceIdForTier(tier)
    if (!priceId) {
      // Key present but the price id for this tier is not wired — still an
      // operator configuration gap, reported under the same honest error.
      return jsonError(503, 'stripe_not_configured', {
        code: 'MISSING_PRICE_ID',
        details: `No Stripe price id configured for tier ${tier}`,
      })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    })
    if (!workspace) {
      return jsonError(404, 'Workspace not found', { code: 'NOT_FOUND' })
    }

    const stripe = getStripe()

    // Create-or-reuse the Stripe customer, persisted on the Subscription row.
    let subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
    })
    let stripeCustomerId = subscription?.stripeCustomerId ?? null
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: workspace.name,
        email: user.email ?? undefined,
        metadata: { workspaceId },
      })
      stripeCustomerId = customer.id
      subscription = await prisma.subscription.upsert({
        where: { workspaceId },
        update: { stripeCustomerId },
        create: { workspaceId, stripeCustomerId },
      })
    }

    const base = appUrl()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      client_reference_id: workspaceId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/dashboard/billing?checkout=success`,
      cancel_url: `${base}/dashboard/billing?checkout=canceled`,
    })

    if (!checkoutSession.url) {
      // Stripe did not hand back a redirect URL — report it, never fake one.
      return jsonError(502, 'Stripe did not return a checkout URL', {
        code: 'STRIPE_NO_URL',
      })
    }

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    return handleApiError(error)
  }
}
