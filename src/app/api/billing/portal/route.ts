// POST /api/billing/portal (ADR-0019 Track A).
//
// Creates a Stripe Billing Portal session so a workspace OWNER can manage
// payment methods / cancel / see invoices. Fails honestly: 503 when Stripe
// is unconfigured, 400 when the workspace has no Stripe customer yet.

import { NextRequest, NextResponse } from 'next/server'

import { requireSession, requireWorkspaceRole } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'
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
    await requireSession()

    const body = await request.json().catch(() => null)
    const workspaceId: unknown = body?.workspaceId
    if (typeof workspaceId !== 'string' || !workspaceId) {
      return jsonError(400, 'workspaceId is required')
    }

    // Only the workspace OWNER may manage billing.
    await requireWorkspaceRole(workspaceId, ['OWNER'])

    if (!isStripeConfigured()) {
      return jsonError(503, 'stripe_not_configured')
    }

    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId },
      select: { stripeCustomerId: true },
    })
    if (!subscription?.stripeCustomerId) {
      return jsonError(400, 'no_stripe_customer')
    }

    const stripe = getStripe()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl()}/dashboard/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    return handleApiError(error)
  }
}
